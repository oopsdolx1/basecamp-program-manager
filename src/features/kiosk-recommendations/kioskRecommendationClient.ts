import type { RecommendedProgram } from "../printing/services/recommendationBuilderService";

/**
 * Kiosk recommendation client (Phase 2-T3, Trainer → Kiosk handoff).
 *
 * The Kiosk authenticates only as its registered device (device-only Firebase identity:
 * `basecampRole: 'kiosk'`, `deviceId`). It reads the handoff a Trainer issued to this device
 * (`GET /v1/kiosk/handoff`) and never sends a member or program choice: the server decides scope
 * from the stored handoff (device + bound member + active status). The member selected on the
 * Kiosk is only compared with `handoff.memberId` to decide whether to show the card.
 * The Program Manager's own (anonymous) Firebase identity is not touched and gets no Trainer role.
 */

export interface KioskHandoff {
  handoffId: string;
  memberId: string;
  memberName: string;
  memberProgramId: string;
  expiresAt: number;
}

export interface KioskHandoffResult {
  handoff: KioskHandoff;
  programs: RecommendedProgram[];
}

export class KioskApiError extends Error {
  constructor(readonly code: string, readonly status: number, message?: string) {
    super(message ?? code);
    this.name = "KioskApiError";
  }
}

export interface KioskDeviceIdentity { getIdToken(): Promise<string | null> }

export interface KioskRecommendationClient {
  /** This device's active Trainer handoff and the bound member's active recommendations, or null. */
  fetchHandoff(): Promise<KioskHandoffResult | null>;
  /** Idempotent: closing an already closed, superseded or expired handoff succeeds. */
  closeHandoff(handoffId: string): Promise<void>;
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
const parseHandoff = (value: unknown): KioskHandoff | null => {
  const item = value as Partial<KioskHandoff> | null;
  if (!item || !isText(item.handoffId) || !isText(item.memberId) || !isText(item.memberProgramId)) return null;
  return { handoffId: item.handoffId, memberId: item.memberId, memberName: isText(item.memberName) ? item.memberName : "", memberProgramId: item.memberProgramId, expiresAt: Number(item.expiresAt) || 0 };
};

export const createKioskRecommendationClient = ({ baseUrl, device, fetchImpl = globalThis.fetch.bind(globalThis) }: { baseUrl: string; device: KioskDeviceIdentity; fetchImpl?: typeof fetch }): KioskRecommendationClient => {
  const request = async (method: "GET" | "POST", path: string, body?: unknown): Promise<Record<string, unknown>> => {
    const token = await device.getIdToken();
    if (!token) throw new KioskApiError("KIOSK_DEVICE_NOT_ENROLLED", 0);
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
    async fetchHandoff() {
      const data = await request("GET", "/v1/kiosk/handoff");
      if (data.handoff === null) return null;
      const handoff = parseHandoff(data.handoff);
      if (!handoff) throw new KioskApiError("INVALID_API_RESPONSE", 200);
      const programs = (Array.isArray(data.programs) ? data.programs : []).map(parseProgram).filter((program): program is RecommendedProgram => Boolean(program));
      return { handoff, programs };
    },
    async closeHandoff(handoffId: string) {
      await request("POST", "/v1/kiosk/handoff/close", { handoffId });
    },
  });
};
