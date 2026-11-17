import type { KioskDeviceIdentity } from "./kioskRecommendationClient";

/**
 * Kiosk device identity lifecycle, independent of the Firebase SDK (unit-testable).
 *
 * Production: the device's Firebase custom token comes from the local BaseCamp agent
 * (`POST {agent}/kiosk/device-token`), which proves possession of the DPAPI-protected device key to the
 * Condition Lab API. Development: the Emulator-only `__kiosk_device_token` hook. The resulting Firebase
 * session is kept in memory only (no refresh token on disk); a reload or a failed refresh asks the
 * agent again, and a revoked device gets nothing, so every Kiosk API call then fails closed.
 */
export interface KioskDeviceAuthPort {
  /** ID token of the signed-in device user (refreshed by Firebase when expired), or null when signed out. */
  currentIdToken(): Promise<string | null>;
  signInWithCustomToken(customToken: string): Promise<void>;
  signOut(): Promise<void>;
}
export type KioskDeviceTokenSource = () => Promise<string | null>;

export const createKioskDeviceIdentity = ({ auth, sources }: { auth: KioskDeviceAuthPort; sources: KioskDeviceTokenSource[] }): KioskDeviceIdentity => {
  let signingIn: Promise<string | null> | null = null;
  const signIn = async (): Promise<string | null> => {
    for (const source of sources) {
      let customToken: string | null = null;
      try { customToken = await source(); } catch { customToken = null; }
      if (!customToken) continue;
      try {
        await auth.signInWithCustomToken(customToken);
        return await auth.currentIdToken();
      } catch {
        await auth.signOut().catch(() => undefined);
      }
    }
    return null;
  };
  return Object.freeze({
    async getIdToken() {
      try {
        const token = await auth.currentIdToken();
        if (token) return token;
      } catch {
        // Refresh failed (revoked device user, disabled account, network): drop the session and re-authenticate.
        await auth.signOut().catch(() => undefined);
      }
      signingIn ??= signIn().finally(() => { signingIn = null; });
      return signingIn;
    },
  });
};

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);
/** The agent must be on this machine: http(s) on a loopback host only. */
export const resolveKioskDeviceAgentEndpoint = (raw: string | undefined): string | null => {
  const value = raw?.trim() || "http://127.0.0.1:43127";
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && LOOPBACK.has(url.hostname) && url.pathname === "/" ? url.origin : null;
  } catch {
    return null;
  }
};

/** Custom token from the local agent. Never logged; failures return null (the caller fails closed). */
export const createAgentDeviceTokenSource = ({ endpoint, fetchImpl = globalThis.fetch.bind(globalThis) }: { endpoint: string; fetchImpl?: typeof fetch }): KioskDeviceTokenSource => async () => {
  try {
    const response = await fetchImpl(`${endpoint}/kiosk/device-token`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}", cache: "no-store", credentials: "omit" });
    if (!response.ok) return null;
    const data = await response.json().catch(() => null) as { customToken?: unknown } | null;
    return typeof data?.customToken === "string" && data.customToken ? data.customToken : null;
  } catch {
    return null;
  }
};
