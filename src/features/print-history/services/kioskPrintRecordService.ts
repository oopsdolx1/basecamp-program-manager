import { KioskApiError } from "../../kiosk-recommendations/kioskRecommendationClient";
import type { KioskMemberSessionRuntime } from "../../kiosk-session/defaultKioskMemberSession";
import type { KioskPrintRecordResponse } from "../../kiosk-session/kioskMemberSessionClient";
import { isRenewableKioskSessionError } from "../../kiosk-session/kioskSessionRenewal";
import { logKioskError } from "../../kiosk-diagnostics/kioskErrorLog";
import type { PrintRequestProgramSnapshot, PrintRequestRecord, PrintRequestTemplateSnapshot } from "../domain/printRequest.types";

/**
 * Phase 3-B print persistence through the Condition Lab Kiosk API (replaces the Client SDK
 * printHistory create + workoutSessions markPrinted). There is no Client SDK fallback.
 *
 * - `ensureKioskPrintSession` runs BEFORE the physical print: the selected member must be this workout
 *   session's member and the server must still accept the session, so a print that could not be recorded
 *   (no selection, other member, revoked device) is not started.
 * - `recordKioskPrint` runs AFTER the physical print with one idempotency key per physical print. Network
 *   errors/5xx retry with the same key (a lost response is replayed, never counted twice); an ended or
 *   expired session is renewed once for the still-selected member. It never triggers another physical print.
 */
export class KioskPrintRecordError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = "KioskPrintRecordError"; }
}
const MESSAGES: Record<string, string> = {
  NO_API: "키오스크 API가 설정되지 않아 출력 기록을 저장할 수 없습니다.",
  KIOSK_SESSION_MEMBER_CHANGED: "선택된 회원 정보가 없습니다. 처음 화면에서 회원을 다시 선택해 주세요.",
  KIOSK_SESSION_STALE: "선택된 회원 정보가 없습니다. 처음 화면에서 회원을 다시 선택해 주세요.",
  KIOSK_SESSION_ENDED: "회원 선택이 종료되었습니다. 처음 화면에서 회원을 다시 선택해 주세요.",
  KIOSK_SESSION_EXPIRED: "회원 선택 시간이 만료되었습니다. 처음 화면에서 회원을 다시 선택해 주세요.",
  PRINT_SCOPE_DENIED: "선택한 회원의 운동 기록이 아닙니다. 회원을 다시 선택해 주세요.",
  KIOSK_DEVICE_NOT_ENROLLED: "키오스크 기기 인증이 되어 있지 않아 출력할 수 없습니다.",
  KIOSK_DEVICE_STARTING: "키오스크 서비스를 준비하고 있습니다. 잠시만 기다려 주세요.",
  KIOSK_DEVICE_NOT_REGISTERED: "등록되지 않았거나 사용이 중지된 키오스크입니다.",
  WORKOUT_SESSION_NOT_FOUND: "운동 세션을 찾지 못했습니다.",
  NETWORK_ERROR: "서버에 연결하지 못했습니다.",
  // Phase 3-E: every server code of the print/session path has guidance; no code reaches the screen.
  KIOSK_SESSION_MEMBER_MISMATCH: "선택된 회원 정보가 없습니다. 처음 화면에서 회원을 다시 선택해 주세요.",
  KIOSK_SESSION_INVALID: "회원 선택 정보를 확인할 수 없습니다. 처음 화면에서 회원을 다시 선택해 주세요.",
  KIOSK_SESSION_NOT_FOUND: "회원 선택 정보를 확인할 수 없습니다. 처음 화면에서 회원을 다시 선택해 주세요.",
  KIOSK_SESSION_REQUIRED: "회원 선택 정보를 확인할 수 없습니다. 처음 화면에서 회원을 다시 선택해 주세요.",
  KIOSK_SESSION_RATE_LIMITED: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  KIOSK_DEVICE_IDENTITY_REQUIRED: "키오스크 기기 인증이 필요합니다. 관리자에게 문의해 주세요.",
  KIOSK_DEVICE_AUTH_FAILED: "키오스크 기기 인증이 필요합니다. 관리자에게 문의해 주세요.",
  PRINT_REQUEST_CONFLICT: "이미 처리된 출력 요청과 내용이 달라 기록하지 못했습니다. 처음 화면에서 다시 시도해 주세요.",
  PRINT_SOURCE_UNAVAILABLE: "출력할 수 있는 운동 프로그램 정보가 없어 기록하지 못했습니다.",
  INVALID_PRINT_RECORD: "출력 기록 요청이 올바르지 않아 기록하지 못했습니다. 다시 시도해 주세요.",
};
const PRINT_SERVER_ERROR = "일시적인 서버 오류로 출력 기록을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
const PRINT_GENERAL_ERROR = "출력 기록을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
/** The user-facing Kiosk message for an API error code, when one is defined (shared with the print preview). */
export const kioskErrorMessage = (code: string): string | undefined => MESSAGES[code];
const toError =(error: unknown): KioskPrintRecordError => {
  if (error instanceof KioskPrintRecordError) return error;
  const code = error instanceof KioskApiError ? error.code : "UNKNOWN";
  logKioskError("print record", error);
  const server = error instanceof KioskApiError && (error.status >= 500 || code === "INTERNAL_ERROR" || code === "INVALID_API_RESPONSE");
  return new KioskPrintRecordError(code, MESSAGES[code] ?? (server ? PRINT_SERVER_ERROR : PRINT_GENERAL_ERROR));
};
// Shared Phase 3-E policy: only a server-EXPIRED session is renewed (once); ENDED / mismatch / device errors are not.
const renewableSession = isRenewableKioskSessionError;
const retryable = (error: unknown) => error instanceof KioskApiError && (error.code === "NETWORK_ERROR" || error.status >= 500);

export const createPrintRequestId = (): string => `pr_${crypto.randomUUID().replace(/-/g, "")}`;

export const ensureKioskPrintSession = async (memberId: string, runtime: KioskMemberSessionRuntime | null): Promise<void> => {
  if (!runtime) throw new KioskPrintRecordError("NO_API", MESSAGES.NO_API);
  try {
    let session = await runtime.sessions.sessionFor(memberId);
    try {
      const current = await runtime.client.currentSession(session.token);
      if (current.memberId !== memberId) throw new KioskApiError("KIOSK_SESSION_MEMBER_CHANGED", 0);
    } catch (error) {
      if (!renewableSession(error)) throw error;
      session = await runtime.sessions.renew(memberId, session.token);
      const current = await runtime.client.currentSession(session.token);
      if (current.memberId !== memberId) throw new KioskApiError("KIOSK_SESSION_MEMBER_CHANGED", 0);
    }
  } catch (error) {
    throw toError(error);
  }
};

const toRecord = (record: KioskPrintRecordResponse): PrintRequestRecord => ({
  ...record,
  requestedAt: new Date(record.requestedAt), printedAt: new Date(record.printedAt), createdAt: new Date(record.createdAt),
  programSnapshot: record.programSnapshot as unknown as PrintRequestProgramSnapshot, template: record.template as unknown as PrintRequestTemplateSnapshot,
});

export interface PendingPrintRecord { printRequestId: string; workoutSessionId: string; memberId: string; printer: string; copy: number }

export const recordKioskPrint = async (pending: PendingPrintRecord, runtime: KioskMemberSessionRuntime | null): Promise<PrintRequestRecord> => {
  if (!runtime) throw new KioskPrintRecordError("NO_API", MESSAGES.NO_API);
  let renewed = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let token = "";
    try {
      token = (await runtime.sessions.sessionFor(pending.memberId)).token;
      const { record } = await runtime.client.recordPrint(token, pending.workoutSessionId, { printRequestId: pending.printRequestId, printer: pending.printer, copy: pending.copy });
      return toRecord(record);
    } catch (error) {
      if (token && renewableSession(error) && !renewed) {
        renewed = true;
        try { await runtime.sessions.renew(pending.memberId, token); } catch (renewError) { throw toError(renewError); }
        continue;
      }
      if (token && retryable(error) && attempt < 2) continue;
      throw toError(error);
    }
  }
  throw toError(new KioskApiError("NETWORK_ERROR", 0));
};
