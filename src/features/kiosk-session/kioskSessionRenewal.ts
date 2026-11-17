import { KioskApiError } from "../kiosk-recommendations/kioskRecommendationClient";
import type { KioskMemberSessionManager } from "./kioskMemberSessionManager";

/**
 * Shared Kiosk member-session renewal policy (Phase 3-E): workout-history reads, print-preview loading,
 * workout-session save and print record all use this one rule.
 *
 * Renewed (at most once per request, then the request is retried once):
 *   - KIOSK_SESSION_EXPIRED: the session simply timed out on the server.
 *   `sessions.renew()` only issues a new session while the same member is still selected; a member change
 *   rejects it (KIOSK_SESSION_MEMBER_CHANGED). The renewed token is member-scoped by the server as usual.
 *
 * Never renewed:
 *   - KIOSK_SESSION_ENDED (explicitly closed or superseded), KIOSK_SESSION_MEMBER_MISMATCH, KIOSK_SESSION_INVALID,
 *     KIOSK_SESSION_NOT_FOUND, KIOSK_SESSION_REQUIRED;
 *   - device revocation / authentication failures (KIOSK_DEVICE_*), member changes, and any error of the
 *     renewal itself or of the single retry (no loop).
 */
export const isRenewableKioskSessionError = (error: unknown): boolean => error instanceof KioskApiError && error.code === "KIOSK_SESSION_EXPIRED";

/** Runs a member-scoped request with the selected member's session, renewing an expired session once. */
export const withKioskMemberSession = async <T>(sessions: Pick<KioskMemberSessionManager, "sessionFor" | "renew">, memberId: string, request: (token: string) => Promise<T>): Promise<T> => {
  const session = await sessions.sessionFor(memberId);
  try {
    return await request(session.token);
  } catch (error) {
    if (!isRenewableKioskSessionError(error)) throw error;
    const renewed = await sessions.renew(memberId, session.token);
    return request(renewed.token);
  }
};
