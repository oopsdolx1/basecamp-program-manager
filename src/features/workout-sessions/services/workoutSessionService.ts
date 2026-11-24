import type { CreateWorkoutSessionInput, WorkoutSessionRecord } from "../domain/workoutSession.types";
import { buildWorkoutSessionRecord } from "./workoutSessionRecordBuilder";
import { firestoreWorkoutSessionRepository } from "../repositories/firestoreWorkoutSessionRepository";
import { KioskApiError } from "../../kiosk-recommendations/kioskRecommendationClient";
import { getDefaultKioskMemberSessionRuntime, type KioskMemberSessionRuntime } from "../../kiosk-session/defaultKioskMemberSession";
import type { KioskWorkoutSessionPayload } from "../../kiosk-session/kioskMemberSessionClient";
import { isRenewableKioskSessionError } from "../../kiosk-session/kioskSessionRenewal";
import { logKioskError } from "../../kiosk-diagnostics/kioskErrorLog";

const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

export const createWorkoutSessionId = (date = new Date()): string =>
  `ws_${formatDateKey(date)}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

const SAVE_ERROR_MESSAGES: Record<string, string> = {
  KIOSK_DEVICE_NOT_ENROLLED: "키오스크 기기 인증이 되어 있지 않아 운동 세션을 저장할 수 없습니다.",
  KIOSK_DEVICE_STARTING: "키오스크 서비스를 준비하고 있습니다. 잠시만 기다려 주세요.",
  KIOSK_DEVICE_NOT_REGISTERED: "등록되지 않았거나 사용이 중지된 키오스크입니다. 운동 세션을 저장할 수 없습니다.",
  KIOSK_DEVICE_IDENTITY_REQUIRED: "키오스크 기기 인증이 필요합니다.",
  KIOSK_SESSION_MEMBER_CHANGED: "선택한 회원이 바뀌어 저장을 중단했습니다. 다시 시도해 주세요.",
  KIOSK_SESSION_STALE: "선택한 회원이 바뀌어 저장을 중단했습니다. 다시 시도해 주세요.",
  KIOSK_SESSION_RATE_LIMITED: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  KIOSK_SESSION_ENDED: "회원 선택이 종료되어 저장하지 못했습니다. 처음 화면에서 회원을 다시 선택해 주세요.",
  KIOSK_SESSION_EXPIRED: "회원 선택 시간이 만료되어 저장하지 못했습니다. 처음 화면에서 회원을 다시 선택해 주세요.",
  MEMBER_NOT_FOUND: "회원 정보를 확인할 수 없어 저장하지 못했습니다.",
  NETWORK_ERROR: "서버에 연결하지 못해 운동 세션을 저장하지 못했습니다.",
  // Phase 3-E: every server code of the save/session path has guidance; no code reaches the screen.
  KIOSK_DEVICE_AUTH_FAILED: "키오스크 기기 인증이 필요합니다.",
  KIOSK_SESSION_MEMBER_MISMATCH: "선택한 회원이 바뀌어 저장을 중단했습니다. 다시 시도해 주세요.",
  KIOSK_SESSION_INVALID: "회원 선택 정보를 확인할 수 없어 저장하지 못했습니다. 처음 화면에서 회원을 다시 선택해 주세요.",
  KIOSK_SESSION_NOT_FOUND: "회원 선택 정보를 확인할 수 없어 저장하지 못했습니다. 처음 화면에서 회원을 다시 선택해 주세요.",
  KIOSK_SESSION_REQUIRED: "회원 선택 정보를 확인할 수 없어 저장하지 못했습니다. 처음 화면에서 회원을 다시 선택해 주세요.",
  INVALID_WORKOUT_SESSION: "운동 구성이 올바르지 않아 저장하지 못했습니다. 운동 구성을 확인해 주세요.",
  WORKOUT_SESSION_CONFLICT: "이미 저장된 운동 세션과 내용이 달라 저장하지 못했습니다. 처음 화면에서 다시 시도해 주세요.",
  RECOMMENDATION_SCOPE_DENIED: "선택한 회원의 추천 프로그램이 아니어서 저장하지 못했습니다. 회원을 다시 선택해 주세요.",
};
const SAVE_SERVER_ERROR = "일시적인 서버 오류로 운동 세션을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
const SAVE_GENERAL_ERROR = "운동 세션을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
const saveError = (error: unknown): Error => {
  const code = error instanceof KioskApiError ? error.code : "UNKNOWN";
  logKioskError("workout session save", error);
  const server = error instanceof KioskApiError && (error.status >= 500 || code === "INTERNAL_ERROR" || code === "INVALID_API_RESPONSE");
  return new Error(SAVE_ERROR_MESSAGES[code] ?? (server ? SAVE_SERVER_ERROR : SAVE_GENERAL_ERROR));
};
const retryable = (error: unknown) => error instanceof KioskApiError && (error.code === "NETWORK_ERROR" || error.status >= 500);
// Shared Phase 3-E policy: only a server-EXPIRED session is renewed (once); ENDED / mismatch / device errors are not.
const renewableSession = isRenewableKioskSessionError;

/**
 * Saves through the Condition Lab Kiosk API (`POST /v1/kiosk/workout-sessions`) with the selected
 * member's Kiosk session. There is no Client SDK fallback: without a configured API, an enrolled device
 * or a valid session, nothing is saved and an error is thrown. One `workoutSessionId` is reused across
 * retries so a repeated request cannot create a second document (server-side idempotency).
 */
export const createWorkoutSession = async (input: CreateWorkoutSessionInput, runtime: KioskMemberSessionRuntime | null = getDefaultKioskMemberSessionRuntime()): Promise<string> => {
  if (input.exercises.length < 1) throw new Error("출력할 운동이 없습니다.");
  if (input.exercises.length > 8) throw new Error("운동은 최대 8개까지 가능합니다.");
  if (!runtime) throw new Error("키오스크 API가 설정되지 않아 운동 세션을 저장할 수 없습니다.");

  const workoutSessionId = createWorkoutSessionId();
  // Same validation and normalization as before (source identity, ordering, categories).
  const record = buildWorkoutSessionRecord(input, "", workoutSessionId);
  const payload: KioskWorkoutSessionPayload = {
    workoutSessionId,
    memberId: record.memberId,
    programTitle: record.programSnapshot.title,
    ...(record.programId ? { programId: record.programId } : {}),
    source: record.source!,
    ...(record.programSnapshot.category ? { category: record.programSnapshot.category } : {}),
    ...(record.programSnapshot.categories ? { categories: record.programSnapshot.categories } : {}),
    exercises: record.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId, programExerciseId: exercise.programExerciseId, name: exercise.name, order: exercise.order,
      ...(exercise.plannedSets !== undefined ? { plannedSets: exercise.plannedSets } : {}),
      ...(typeof exercise.memo === "string" ? { memo: exercise.memo } : {}),
    })),
  };

  let renewed = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let token = "";
    try {
      token = (await runtime.sessions.sessionFor(input.memberId)).token;
      return (await runtime.client.saveWorkoutSession(token, payload)).workoutSessionId;
    } catch (error) {
      if (token && renewableSession(error) && !renewed) {
        renewed = true;
        try { await runtime.sessions.renew(input.memberId, token); } catch (renewError) { throw saveError(renewError); }
        continue;
      }
      if (token && retryable(error) && attempt < 2) continue;
      throw saveError(error);
    }
  }
  throw saveError(new KioskApiError("NETWORK_ERROR", 0));
};

export const getWorkoutSession = (appId: CreateWorkoutSessionInput["appId"], memberId: string, sessionId: string): Promise<WorkoutSessionRecord | null> =>
  firestoreWorkoutSessionRepository.get(appId, memberId, sessionId);

export const subscribeWorkoutSessions = (
  appId: CreateWorkoutSessionInput["appId"],
  memberId: string,
  callback: (records: WorkoutSessionRecord[]) => void,
  onError: (message: string) => void,
) => firestoreWorkoutSessionRepository.subscribe(appId, memberId, callback, onError);
