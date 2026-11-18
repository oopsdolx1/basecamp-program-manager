import type { AppId, ProgramId } from "../../../types/brandedIds";
import { mapProgramDocument } from "../mappers/programMapper";
import { createFirebaseKioskDeviceIdentity } from "../../kiosk-recommendations/kioskFirebaseIdentity";
import { KioskApiError, resolveKioskApiBaseUrl } from "../../kiosk-recommendations/kioskRecommendationClient";
import type { Program, ProgramFormValues } from "../types/program.types";
import type { ProgramRepository } from "./programRepository.types";

const kioskPrograms = async (): Promise<Program[]> => {
  const env = import.meta.env as Record<string, string | undefined>;
  const baseUrl = resolveKioskApiBaseUrl(env.VITE_BASECAMP_API_BASE_URL, typeof window === "undefined" ? undefined : window.location.origin);
  if (!baseUrl) throw new KioskApiError("KIOSK_API_NOT_CONFIGURED", 0);
  const token = await createFirebaseKioskDeviceIdentity().getIdToken();
  if (!token) throw new KioskApiError("KIOSK_DEVICE_NOT_ENROLLED", 0);
  const response = await fetch(`${baseUrl}/v1/kiosk/programs`, { headers: { authorization: `Bearer ${token}` } });
  const body = await response.json().catch(() => null) as { programs?: Array<Record<string, unknown>>; error?: { code?: string } } | null;
  if (!response.ok || !Array.isArray(body?.programs)) throw new KioskApiError(body?.error?.code ?? "INVALID_API_RESPONSE", response.status);
  return body.programs.map((program) => mapProgramDocument(String(program.id ?? ""), { ...program, createdAt: new Date(Number(program.createdAt) || 0), updatedAt: new Date(Number(program.updatedAt) || 0), ...(program.lastUsedAt ? { lastUsedAt: new Date(Number(program.lastUsedAt)) } : {}) } as never));
};

const unavailable = async (): Promise<never> => { throw new Error("Kiosk program mutation is unavailable."); };

export const programRepository: ProgramRepository = {
  async getPrograms(_appId) { return kioskPrograms(); },

  subscribePrograms(appId, callback, onError) {
    void appId;
    let active = true;
    void kioskPrograms().then((programs) => { if (active) callback(programs); }).catch((error: unknown) => { if (active) onError(error instanceof Error ? error.message : "PROGRAM_READ_FAILED"); });
    return () => { active = false; };
  },

  async getProgram(appId, programId) {
    void appId;
    return (await kioskPrograms()).find((program) => program.id === programId) ?? null;
  },

  async createProgram(appId, values) {
    void appId; void values; return unavailable();
  },

  async updateProgram(appId, programId, values) {
    void appId; void programId; void values; return unavailable();
  },

  async archiveProgram(appId, programId) {
    void appId; void programId; return unavailable();
  },

  async duplicateProgram(appId, source, title) {
    void appId; void source; void title; return unavailable();
  },

  async restoreProgram(appId, programId) {
    void appId; void programId; return unavailable();
  },
};
