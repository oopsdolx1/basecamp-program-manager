import { KioskApiError } from "../kiosk-recommendations/kioskRecommendationClient";

/**
 * Diagnostic log for a Kiosk API failure (Phase 3-E): the internal code and HTTP status only, so the code is
 * findable without showing it on screen. Never the session token, device token, member id, name or any
 * request/response body. Kept outside features/kiosk-session, whose code must not log at all.
 */
export const logKioskError = (context: string, error: unknown): void => {
  const detail = error instanceof KioskApiError ? { code: error.code, status: error.status } : { code: "UNKNOWN", type: error instanceof Error ? error.name : typeof error };
  console.warn(`[Kiosk] ${context} failed`, detail);
};
