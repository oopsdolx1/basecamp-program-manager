import type { RecommendedProgram } from "../printing/services/recommendationBuilderService";

/**
 * Kiosk recommendation client (Phase 2-T3, approved device-trust policy).
 *
 * - Device identity: a registered Kiosk device-only Firebase identity (`basecampRole: 'kiosk'`,
 *   `deviceId`, no session). Kept in its own Firebase app with local persistence. It is enrolled once
 *   from a server-issued custom token provided as `globalThis.__kiosk_device_token`.
 * - Session identity: the short-lived, member-scoped session token returned by
 *   `POST /v1/kiosk/session/start`, kept in a separate in-memory Firebase app.
 * The Program Manager's own (anonymous) Firebase identity is not touched and gets no Trainer role.
 */

export interface KioskSession {
  kioskSessionId: string;
  memberId: string;
  memberName: string;
  expiresAt: number;
}

export class KioskApiError extends Error {
  constructor(readonly code: string, readonly status: number, message?: string) {
    super(message ?? code);
    this.name = "KioskApiError";
  }
}

export interface KioskDeviceIdentity { getIdToken(): Promise<string | null> }
export interface KioskSessionIdentity { signIn(customToken: string): Promise<void>; getIdToken(): Promise<string | null>; signOut(): Promise<void> }

export interface KioskRecommendationClient {
  startSession(memberId: string): Promise<KioskSession>;
  listPrograms(session: KioskSession): Promise<RecommendedProgram[]>;
  closeSession(session: KioskSession): Promise<void>;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Accepts https URLs, or http only for localhost. Relative values resolve against `origin`. */
export const resolveKioskApiBaseUrl = (raw: string | undefined, origin?: string): string | null => {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value, origin);
    if (url.protocol === "https:" || (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname))) return url.href.replace(/\/$/, "");
  } catch {
    return null;
  }
  return null;
};

export const isText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const parseProgram = (value: unknown): RecommendedProgram | null => {
  const item = value as Partial<RecommendedProgram> | null;
  if (!item || !isText(item.id) || !isText(item.name) || !Array.isArray(item.exercises)) return null;
  const exercises = item.exercises.filter((exercise) => isText(exercise?.exerciseId) && isText(exercise?.name) && Number.isFinite(exercise?.order) && Number(exercise?.plannedSets) > 0)
    .map((exercise) => ({ exerciseId: exercise.exerciseId, name: exercise.name, order: Number(exercise.order), plannedSets: Number(exercise.plannedSets), ...(isText(exercise.memo) ? { memo: exercise.memo } : {}) }));
  return exercises.length ? { id: item.id, name: item.name, isDefault: item.isDefault === true, exercises } : null;
};

export const createKioskRecommendationClient = ({ baseUrl, device, session, fetchImpl = globalThis.fetch.bind(globalThis) }: { baseUrl: string; device: KioskDeviceIdentity; session: KioskSessionIdentity; fetchImpl?: typeof fetch }): KioskRecommendationClient => {
  const request = async (method: "GET" | "POST", path: string, token: string | null, body?: unknown): Promise<Record<string, unknown>> => {
    if (!token) throw new KioskApiError("AUTH_REQUIRED", 401);
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, { method, headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    } catch {
      throw new KioskApiError("NETWORK_ERROR", 0);
    }
    const data = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok || !data) {
      const error = (data?.error ?? {}) as { code?: string; message?: string };
      throw new KioskApiError(error.code ?? "INVALID_API_RESPONSE", response.status, error.message);
    }
    return data;
  };

  return Object.freeze({
    async startSession(memberId: string) {
      const deviceToken = await device.getIdToken();
      if (!deviceToken) throw new KioskApiError("KIOSK_DEVICE_NOT_ENROLLED", 0);
      const data = await request("POST", "/v1/kiosk/session/start", deviceToken, { memberId });
      const member = data.member as { id?: unknown; name?: unknown } | undefined;
      // Defense in depth: the server decides scope; never accept a session for another member.
      if (!isText(data.kioskSessionId) || !isText(data.customToken) || member?.id !== memberId) throw new KioskApiError("INVALID_API_RESPONSE", 200);
      await session.signIn(data.customToken);
      return { kioskSessionId: data.kioskSessionId, memberId, memberName: isText(member.name) ? member.name : "", expiresAt: Number(data.expiresAt) || 0 };
    },
    async listPrograms(active: KioskSession) {
      const data = await request("GET", `/v1/kiosk/session/workout-programs?kioskSessionId=${encodeURIComponent(active.kioskSessionId)}`, await session.getIdToken());
      return (Array.isArray(data.programs) ? data.programs : []).map(parseProgram).filter((program): program is RecommendedProgram => Boolean(program));
    },
    async closeSession(active: KioskSession) {
      try {
        await request("POST", "/v1/kiosk/session/close", await session.getIdToken(), { kioskSessionId: active.kioskSessionId });
      } finally {
        await session.signOut().catch(() => undefined);
      }
    },
  });
};
