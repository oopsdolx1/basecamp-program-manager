import { KioskApiError } from "../kiosk-recommendations/kioskRecommendationClient";
import type { KioskMemberSessionClient } from "./kioskMemberSessionClient";

/**
 * Client-side lifecycle of the Kiosk member session (memory only: never localStorage, sessionStorage,
 * IndexedDB, URL or logs).
 *
 * - `select(memberId)`: the member chosen on the Kiosk. A different member starts a new session and
 *   retires the previous one; selecting the same member again reuses the pending/active session.
 * - `clear()`: selection cancelled / flow left. The active session is closed; nothing is selected.
 * - `sessionFor(memberId)`: the token to use for a member-scoped request. Only for the currently
 *   selected member; an expired session is replaced (never reused); a failed issue throws.
 * - `renew(memberId, token)`: the server reported that `token` expired → issue a new one (still-selected member only).
 *   Which server errors may renew is decided by kioskSessionRenewal.ts (EXPIRED only, never ENDED).
 * Every issue carries a generation; a response that arrives after the selection changed is closed and
 * discarded, so a late response for member A can never become member B's session.
 */
export interface KioskMemberSession { memberId: string; token: string; expiresAt: number }

export interface KioskMemberSessionManager {
  select(memberId: string): void;
  clear(options?: { keepalive?: boolean }): void;
  sessionFor(memberId: string): Promise<KioskMemberSession>;
  renew(memberId: string, staleToken: string): Promise<KioskMemberSession>;
  /** Selected member and whether a usable session is held (no token). For tests and diagnostics. */
  inspect(): { selectedMemberId: string | null; hasSession: boolean; pending: boolean };
}

interface Entry { memberId: string; promise: Promise<KioskMemberSession>; session?: KioskMemberSession; failed?: boolean }

export const createKioskMemberSessionManager = ({ client, now = () => Date.now(), expirySkewMs = 15_000 }: { client: KioskMemberSessionClient; now?: () => number; expirySkewMs?: number }): KioskMemberSessionManager => {
  let selectedMemberId: string | null = null;
  let current: Entry | null = null;
  const usable = (session: KioskMemberSession) => session.expiresAt - expirySkewMs > now();
  const retire = (entry: Entry | null, keepalive = false) => {
    if (entry?.session) void client.closeSession(entry.session.token, { keepalive }).catch(() => undefined);
  };
  const issue = (memberId: string): Entry => {
    const entry: Entry = { memberId, promise: Promise.resolve(null as never) };
    entry.promise = client.openSession(memberId).then(({ token, expiresAt }) => {
      const session = { memberId, token, expiresAt };
      if (current !== entry) {
        // Selection changed (or was cleared) while this issue was in flight.
        void client.closeSession(token).catch(() => undefined);
        throw new KioskApiError("KIOSK_SESSION_STALE", 0);
      }
      entry.session = session;
      return session;
    }, (error: unknown) => {
      entry.failed = true;
      throw error;
    });
    entry.promise.catch(() => undefined); // observed by sessionFor(); avoid unhandled rejections
    return entry;
  };
  const replace = (memberId: string) => { const previous = current; current = issue(memberId); retire(previous); return current; };

  const sessionFor = async (memberId: string): Promise<KioskMemberSession> => {
    if (selectedMemberId !== memberId) throw new KioskApiError("KIOSK_SESSION_MEMBER_CHANGED", 0);
    let entry = current && current.memberId === memberId && !current.failed && !(current.session && !usable(current.session)) ? current : replace(memberId);
    let session = await entry.promise;
    if (current !== entry || selectedMemberId !== memberId) throw new KioskApiError("KIOSK_SESSION_MEMBER_CHANGED", 0);
    if (!usable(session)) { entry = replace(memberId); session = await entry.promise; }
    if (current !== entry || selectedMemberId !== memberId || !usable(session)) throw new KioskApiError("KIOSK_SESSION_EXPIRED", 0);
    return session;
  };

  return Object.freeze({
    select(memberId: string) {
      if (selectedMemberId === memberId && current && current.memberId === memberId && !current.failed && !(current.session && !usable(current.session))) return;
      selectedMemberId = memberId;
      replace(memberId);
    },
    clear(options: { keepalive?: boolean } = {}) {
      const previous = current;
      selectedMemberId = null;
      current = null;
      retire(previous, options.keepalive === true);
    },
    sessionFor,
    async renew(memberId: string, staleToken: string) {
      if (selectedMemberId !== memberId) throw new KioskApiError("KIOSK_SESSION_MEMBER_CHANGED", 0);
      if (current?.session?.token === staleToken) { current.session = undefined; current.failed = true; }
      return sessionFor(memberId);
    },
    inspect() {
      return { selectedMemberId, hasSession: Boolean(current?.session && usable(current.session)), pending: Boolean(current && !current.session && !current.failed) };
    },
  });
};
