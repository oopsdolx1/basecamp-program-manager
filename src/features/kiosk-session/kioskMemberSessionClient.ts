import { KioskApiError, isText, kioskDeviceTokenUnavailable, type KioskDeviceIdentity } from "../kiosk-recommendations/kioskRecommendationClient";
import type { WorkoutSessionExerciseSnapshot, WorkoutSource } from "../workout-sessions/domain/workoutSession.types";
import type { ProgramCategory } from "../programs/types/program.types";

/**
 * Condition Lab Kiosk member-session API (server/kiosk/kioskMemberSessions.js).
 * The device ID token goes in Authorization; the member-session token only in the
 * `X-BaseCamp-Kiosk-Session` header. The token is never put in a URL, storage, log or error message.
 */
export const KIOSK_SESSION_HEADER = "x-basecamp-kiosk-session";

export interface IssuedKioskSession { token: string; expiresAt: number }

/** Request body of `POST /v1/kiosk/workout-sessions` (memberSnapshot.name is taken from the profile on the server). */
export interface KioskWorkoutSessionPayload {
  workoutSessionId: string;
  memberId: string;
  programTitle: string;
  programId?: string;
  source: WorkoutSource;
  category?: ProgramCategory;
  categories?: ProgramCategory[];
  exercises: WorkoutSessionExerciseSnapshot[];
}

/** `POST /v1/kiosk/workout-sessions/{id}/prints` body: an idempotency key per physical print and the printer name. */
export interface KioskPrintRecordPayload { printRequestId: string; printer: string; copy?: number }
/** The stored printHistory record as returned by the server (timestamps in epoch milliseconds). */
export interface KioskPrintRecordResponse {
  id: string; schemaVersion: 1; requestedAt: number; requestedBy: string; requestSource: "quick-print"; status: "printed"; workoutSessionId: string;
  printedAt: number; printedBy: string; printer: string; copy: number; memberId: string; programId: string;
  memberSnapshot: { memberId: string; name: string }; programSnapshot: Record<string, unknown>; template: Record<string, unknown>; createdAt: number; createdBy: string; isArchived: boolean;
}

export interface KioskMemberSessionClient {
  openSession(memberId: string): Promise<IssuedKioskSession>;
  closeSession(token: string, options?: { keepalive?: boolean }): Promise<void>;
  saveWorkoutSession(token: string, payload: KioskWorkoutSessionPayload): Promise<{ workoutSessionId: string; replayed: boolean }>;
  /** Server view of the session (member and expiry), used to confirm the session before a physical print. */
  currentSession(token: string): Promise<{ memberId: string; expiresAt: number }>;
  recordPrint(token: string, workoutSessionId: string, payload: KioskPrintRecordPayload): Promise<{ record: KioskPrintRecordResponse; replayed: boolean }>;
  listMembers(): Promise<Array<{ memberId: string; name: string }>>;
  readProfile(token: string): Promise<Record<string, unknown>>;
  readLogs(token: string, limit?: number): Promise<Record<string, unknown>[]>;
  readWorkoutSessions(token: string, limit?: number): Promise<Record<string, unknown>[]>;
  readWorkoutSession(token: string, workoutSessionId: string): Promise<Record<string, unknown> | null>;
  readWorkoutSessionPrints(token: string, workoutSessionId: string): Promise<Record<string, unknown>[]>;
  readPrintHistory(token: string, limit?: number, cursor?: string): Promise<{ prints: Record<string, unknown>[]; nextCursor: string | null }>;
}

const TOKEN_PATTERN = /^bks1_[A-Za-z0-9_-]{43}$/;

export const createKioskMemberSessionClient = ({ baseUrl, device, fetchImpl = globalThis.fetch.bind(globalThis) }: { baseUrl: string; device: KioskDeviceIdentity; fetchImpl?: typeof fetch }): KioskMemberSessionClient => {
  const request = async (path: string, { body, session, keepalive, method = "POST" }: { body?: unknown; session?: string; keepalive?: boolean; method?: "GET" | "POST" }): Promise<Record<string, unknown>> => {
    const idToken = await device.getIdToken();
    if (!idToken) throw kioskDeviceTokenUnavailable(device);
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: { authorization: `Bearer ${idToken}`, ...(method === "POST" ? { "content-type": "application/json" } : {}), ...(session ? { [KIOSK_SESSION_HEADER]: session } : {}) },
        ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}),
        ...(keepalive ? { keepalive: true } : {}),
      });
    } catch {
      throw new KioskApiError("NETWORK_ERROR", 0);
    }
    const data = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok || !data) {
      const error = (data?.error ?? {}) as { code?: string };
      // Server messages are generic; only the code is surfaced so nothing request-specific leaks into the UI.
      throw new KioskApiError(isText(error.code) ? error.code : "INVALID_API_RESPONSE", response.status);
    }
    return data;
  };

  return Object.freeze({
    async openSession(memberId: string) {
      const data = await request("/v1/kiosk/sessions", { body: { memberId } });
      const session = data.kioskSession as { token?: unknown; expiresAt?: unknown } | undefined;
      if (!session || typeof session.token !== "string" || !TOKEN_PATTERN.test(session.token) || !Number.isFinite(session.expiresAt)) throw new KioskApiError("INVALID_API_RESPONSE", 200);
      return { token: session.token, expiresAt: Number(session.expiresAt) };
    },
    async closeSession(token: string, options: { keepalive?: boolean } = {}) {
      await request("/v1/kiosk/sessions/current/close", { session: token, keepalive: options.keepalive });
    },
    async saveWorkoutSession(token: string, payload: KioskWorkoutSessionPayload) {
      const data = await request("/v1/kiosk/workout-sessions", { body: payload, session: token });
      const saved = data.workoutSession as { workoutSessionId?: unknown; replayed?: unknown } | undefined;
      if (!saved || saved.workoutSessionId !== payload.workoutSessionId) throw new KioskApiError("INVALID_API_RESPONSE", 200);
      return { workoutSessionId: payload.workoutSessionId, replayed: saved.replayed === true };
    },
    async currentSession(token: string) {
      const data = await request("/v1/kiosk/sessions/current", { session: token, method: "GET" });
      const session = data.kioskSession as { memberId?: unknown; expiresAt?: unknown } | undefined;
      if (!session || !isText(session.memberId) || !Number.isFinite(session.expiresAt)) throw new KioskApiError("INVALID_API_RESPONSE", 200);
      return { memberId: session.memberId, expiresAt: Number(session.expiresAt) };
    },
    async recordPrint(token: string, workoutSessionId: string, payload: KioskPrintRecordPayload) {
      const data = await request(`/v1/kiosk/workout-sessions/${encodeURIComponent(workoutSessionId)}/prints`, { body: payload, session: token });
      const record = data.printRecord as KioskPrintRecordResponse | undefined;
      if (!record || record.id !== payload.printRequestId || record.workoutSessionId !== workoutSessionId || !Number.isInteger(record.copy)) throw new KioskApiError("INVALID_API_RESPONSE", 200);
      return { record, replayed: data.replayed === true };
    },
    async listMembers() {
      const data = await request("/v1/kiosk/members", { method: "GET" });
      const members = Array.isArray(data.members) ? data.members : [];
      return members.filter((item): item is { memberId: string; name: string } => Boolean(item) && isText((item as { memberId?: unknown }).memberId) && isText((item as { name?: unknown }).name));
    },
    async readProfile(token: string) {
      const data = await request("/v1/kiosk/sessions/current/profile", { session: token, method: "GET" });
      return data.profile && typeof data.profile === "object" ? data.profile as Record<string, unknown> : {};
    },
    async readLogs(token: string, limit = 100) {
      const data = await request(`/v1/kiosk/sessions/current/logs?limit=${encodeURIComponent(Math.min(200, Math.max(1, limit)))}`, { session: token, method: "GET" });
      return Array.isArray(data.logs) ? data.logs.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
    },
    async readWorkoutSessions(token: string, limit = 100) {
      const data = await request(`/v1/kiosk/sessions/current/workout-sessions?limit=${encodeURIComponent(Math.min(100, Math.max(1, limit)))}`, { session: token, method: "GET" });
      return Array.isArray(data.workoutSessions) ? data.workoutSessions.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
    },
    async readWorkoutSession(token: string, workoutSessionId: string) {
      const data = await request(`/v1/kiosk/sessions/current/workout-sessions/${encodeURIComponent(workoutSessionId)}`, { session: token, method: "GET" });
      return data.workoutSession && typeof data.workoutSession === "object" ? data.workoutSession as Record<string, unknown> : null;
    },
    async readWorkoutSessionPrints(token: string, workoutSessionId: string) {
      const data = await request(`/v1/kiosk/sessions/current/workout-sessions/${encodeURIComponent(workoutSessionId)}/prints`, { session: token, method: "GET" });
      return Array.isArray(data.prints) ? data.prints.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
    },
    async readPrintHistory(token: string, limit = 100, cursor?: string) {
      const query = new URLSearchParams({ limit: String(Math.min(100, Math.max(1, limit))), ...(cursor ? { cursor } : {}) });
      const data = await request(`/v1/kiosk/sessions/current/print-history?${query}`, { session: token, method: "GET" });
      return { prints: Array.isArray(data.prints) ? data.prints.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [], nextCursor: isText(data.nextCursor) ? data.nextCursor : null };
    },
  });
};
