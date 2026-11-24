import type { KioskDeviceAuthState, KioskDeviceIdentity } from "./kioskRecommendationClient";

/**
 * Kiosk device identity lifecycle, independent of the Firebase SDK (unit-testable).
 *
 * Production: the device's Firebase custom token comes from the local BaseCamp agent
 * (`POST {agent}/kiosk/device-token`), which proves possession of the DPAPI-protected device key to the
 * Condition Lab API. Development: the Emulator-only `__kiosk_device_token` hook. The resulting Firebase
 * session is kept in memory only (no refresh token on disk); a reload or a failed refresh asks the
 * agent again, and a revoked device gets nothing, so every Kiosk API call then fails closed.
 *
 * Startup recovery: after a Windows sign-in the kiosk browser can start before the agent listens. A failure that may
 * clear by itself (agent not listening, timeout, agent cannot reach the API, custom-token exchange failed) leaves the
 * identity in `starting` and retries automatically (1 s, 2 s, then every 5 s) until it signs in; listeners are told
 * when it becomes `ready`, so screens reload without a browser restart. Only an explicit "this device has no usable
 * credential" answer from the agent is `not_enrolled`, which is not retried automatically.
 */
export interface KioskDeviceAuthPort {
  /** ID token of the signed-in device user (refreshed by Firebase when expired), or null when signed out. */
  currentIdToken(): Promise<string | null>;
  signInWithCustomToken(customToken: string): Promise<void>;
  signOut(): Promise<void>;
}

/**
 * Thrown by a token source when the failure may clear by itself: the local agent is not listening yet (Windows
 * startup), the request timed out, or the agent could not reach the Condition Lab API. Returning null instead means
 * "this source has no token for this device" (not enrolled, credential missing/unreadable, refused or revoked).
 */
export class KioskDeviceTransientError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = "KioskDeviceTransientError";
  }
}
export type KioskDeviceTokenSource = () => Promise<string | null>;

export type { KioskDeviceAuthState };

/** Automatic retry after a transient failure: 1 s, 2 s, then every 5 s until the agent answers. */
export const KIOSK_DEVICE_RETRY_DELAYS_MS: readonly number[] = Object.freeze([1_000, 2_000, 5_000]);
/** Recovery triggers (focus, visibility, online, a search on an unavailable screen) start at most one sign-in per second. */
export const KIOSK_DEVICE_RECOVERY_MIN_INTERVAL_MS = 1_000;

export interface KioskDeviceRecoveryOptions {
  retryDelaysMs?: readonly number[];
  minRecoveryIntervalMs?: number;
  now?: () => number;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

const TRANSIENT = Symbol("transient");

export const createKioskDeviceIdentity = ({
  auth,
  sources,
  retryDelaysMs = KIOSK_DEVICE_RETRY_DELAYS_MS,
  minRecoveryIntervalMs = KIOSK_DEVICE_RECOVERY_MIN_INTERVAL_MS,
  now = () => Date.now(),
  // unref: a pending retry never keeps a Node process (tests, tools) alive; no effect in the browser.
  setTimer = (callback, ms) => { const handle = setTimeout(callback, ms); (handle as { unref?: () => void }).unref?.(); return handle; },
  clearTimer = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}: { auth: KioskDeviceAuthPort; sources: KioskDeviceTokenSource[] } & KioskDeviceRecoveryOptions): KioskDeviceIdentity => {
  let state: KioskDeviceAuthState = "idle";
  let signingIn: Promise<string | null> | null = null;
  let retryTimer: unknown = null;
  let retryAttempt = 0;
  let lastRecoveryAt = Number.NEGATIVE_INFINITY;
  const listeners = new Set<(next: KioskDeviceAuthState) => void>();

  const setState = (next: KioskDeviceAuthState) => {
    if (next === state) return;
    state = next;
    for (const listener of [...listeners]) {
      try { listener(next); } catch { /* a listener never breaks recovery */ }
    }
  };
  const cancelRetry = () => {
    if (retryTimer === null) return;
    clearTimer(retryTimer);
    retryTimer = null;
  };
  const scheduleRetry = () => {
    if (retryTimer !== null || !retryDelaysMs.length) return;
    const delay = retryDelaysMs[Math.min(retryAttempt, retryDelaysMs.length - 1)];
    retryAttempt += 1;
    retryTimer = setTimer(() => { retryTimer = null; void attempt(); }, delay);
  };

  /** Token, or throws TRANSIENT (retry) / null (no usable credential). */
  const signIn = async (): Promise<string> => {
    let transient = false;
    for (const source of sources) {
      let customToken: string | null = null;
      try { customToken = await source(); } catch { transient = true; }
      if (!customToken) continue;
      try {
        await auth.signInWithCustomToken(customToken);
        const token = await auth.currentIdToken();
        if (token) return token;
        transient = true;
      } catch {
        // A failed custom-token exchange (Firebase unreachable, …) is retried with a fresh token from the agent.
        transient = true;
        await auth.signOut().catch(() => undefined);
      }
    }
    throw transient ? TRANSIENT : null;
  };

  /** One sign-in at a time, shared by every caller. Updates the state and (re)arms the automatic retry. */
  const attempt = (): Promise<string | null> => {
    signingIn ??= signIn().then(
      (token) => { cancelRetry(); retryAttempt = 0; setState("ready"); return token; },
      (failure: unknown) => {
        if (failure === TRANSIENT) { setState("starting"); scheduleRetry(); } else { cancelRetry(); retryAttempt = 0; setState("not_enrolled"); }
        return null;
      },
    ).finally(() => { signingIn = null; });
    return signingIn;
  };

  const currentToken = async (): Promise<string | null> => {
    try {
      return await auth.currentIdToken();
    } catch {
      // Refresh failed (revoked device user, disabled account, network): drop the session and re-authenticate.
      await auth.signOut().catch(() => undefined);
      return null;
    }
  };

  return Object.freeze({
    async getIdToken() {
      const token = await currentToken();
      if (token) { setState("ready"); return token; }
      return attempt();
    },
    getState: () => state,
    subscribe(listener: (next: KioskDeviceAuthState) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    /**
     * Recovery trigger. Does nothing while signed in; otherwise starts one sign-in now (joining one already running),
     * at most once per `minRecoveryIntervalMs`, so repeated focus/visibility/online events cannot flood the agent.
     */
    async recover() {
      if (state === "ready") return;
      if (signingIn) { await signingIn; return; }
      const at = now();
      if (at - lastRecoveryAt < minRecoveryIntervalMs) return;
      lastRecoveryAt = at;
      cancelRetry();
      await attempt();
    },
  });
};

interface RecoveryEventTarget { addEventListener(type: string, listener: () => void): void; removeEventListener(type: string, listener: () => void): void }
/**
 * Window focus, `visibilitychange` → visible and `online` call `identity.recover()`, which does nothing while signed
 * in and is throttled + single-flight otherwise. Returns a function that removes the listeners.
 */
export const installKioskDeviceRecoveryTriggers = (identity: KioskDeviceIdentity, { window: win, document: doc }: { window: RecoveryEventTarget; document: RecoveryEventTarget & { visibilityState?: string } }): (() => void) => {
  const recover = () => { void identity.recover?.().catch(() => undefined); };
  const onVisibility = () => { if (doc.visibilityState === undefined || doc.visibilityState === "visible") recover(); };
  win.addEventListener("focus", recover);
  win.addEventListener("online", recover);
  doc.addEventListener("visibilitychange", onVisibility);
  return () => {
    win.removeEventListener("focus", recover);
    win.removeEventListener("online", recover);
    doc.removeEventListener("visibilitychange", onVisibility);
  };
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

/** Agent failure reasons that a later request will not fix (windows-print-agent/server.mjs, kiosk-device-credential.mjs). */
const PERMANENT_AGENT_REASONS = new Set([
  "device_not_enrolled",
  "enrollment_already_pending",
  "device_auth_not_configured",
  "credential_unreadable",
  "credential_protection_unavailable",
  "credential_protection_failed",
  "origin_not_allowed",
]);
/** Time limit for one agent request; a hung agent counts as "not ready yet". */
export const KIOSK_DEVICE_AGENT_TIMEOUT_MS = 5_000;

/**
 * Custom token from the local agent. Never logged.
 * - connection refused / fetch failed / timeout / 408 / 429 / 5xx without a credential reason
 *   (e.g. device_auth_unavailable: the agent cannot reach the API) / 2xx without a token
 *   → throws KioskDeviceTransientError (retry);
 * - a credential reason (device_not_enrolled, device_auth_not_configured, …) or any other 4xx (the API refused the
 *   device: KIOSK_DEVICE_AUTH_FAILED, DEVICE_REVOKED, …) → null (no usable credential).
 */
export const createAgentDeviceTokenSource = ({ endpoint, fetchImpl = globalThis.fetch.bind(globalThis), timeoutMs = KIOSK_DEVICE_AGENT_TIMEOUT_MS }: { endpoint: string; fetchImpl?: typeof fetch; timeoutMs?: number }): KioskDeviceTokenSource => async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response: Response;
    try {
      response = await fetchImpl(`${endpoint}/kiosk/device-token`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}", cache: "no-store", credentials: "omit", signal: controller.signal });
    } catch {
      throw new KioskDeviceTransientError(controller.signal.aborted ? "agent_timeout" : "agent_unreachable");
    }
    const data = await response.json().catch(() => null) as { customToken?: unknown; reason?: unknown } | null;
    if (response.ok) {
      if (typeof data?.customToken === "string" && data.customToken) return data.customToken;
      throw new KioskDeviceTransientError("agent_invalid_response");
    }
    const reason = typeof data?.reason === "string" ? data.reason : "";
    if (PERMANENT_AGENT_REASONS.has(reason)) return null;
    if (response.status >= 500 || response.status === 408 || response.status === 429) throw new KioskDeviceTransientError(reason || `agent_http_${response.status}`);
    return null;
  } catch (error) {
    if (error instanceof KioskDeviceTransientError) throw error;
    throw new KioskDeviceTransientError(controller.signal.aborted ? "agent_timeout" : "agent_unreachable");
  } finally {
    clearTimeout(timer);
  }
};
