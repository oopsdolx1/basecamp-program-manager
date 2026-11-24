import { getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, inMemoryPersistence, initializeAuth, signInWithCustomToken, signOut, type Auth } from "firebase/auth";
import { firebaseEmulator, getFirebaseOptions } from "../../firebase/firebaseApp";
import { createKioskRecommendationClient, isText, resolveKioskApiBaseUrl, type KioskDeviceIdentity, type KioskRecommendationClient } from "./kioskRecommendationClient";
import { createAgentDeviceTokenSource, createKioskDeviceIdentity, installKioskDeviceRecoveryTriggers, resolveKioskDeviceAgentEndpoint, type KioskDeviceTokenSource } from "./kioskDeviceIdentityCore";

// Firebase-backed Kiosk device identity (browser). A separate named app keeps the Program Manager identity untouched.
// In-memory persistence: no device refresh token is written to IndexedDB/localStorage; a reload re-authenticates.
const DEVICE_APP = "basecamp-kiosk-device";
let deviceAuth: Auth | null = null;
const getDeviceAuth = (): Auth => {
  if (deviceAuth) return deviceAuth;
  const app = getApps().find((candidate) => candidate.name === DEVICE_APP) ?? initializeApp(getFirebaseOptions(), DEVICE_APP);
  deviceAuth = initializeAuth(app, { persistence: inMemoryPersistence });
  if (firebaseEmulator) connectAuthEmulator(deviceAuth, `http://${firebaseEmulator.host}:${firebaseEmulator.authPort}`, { disableWarnings: true });
  return deviceAuth;
};

let identity: KioskDeviceIdentity | null = null;
/**
 * Device-only identity (role kiosk + deviceId), shared by every Kiosk API client on the page.
 * Token sources, in order:
 *   1. `globalThis.__kiosk_device_token`: development/E2E enrollment hook, honored only against the Firebase Emulator.
 *   2. The local BaseCamp agent (`VITE_KIOSK_DEVICE_AGENT_ENDPOINT`, default http://127.0.0.1:43127), which holds the
 *      enrolled, administrator-approved device key (Phase 3-A). This is the production path.
 */
export const createFirebaseKioskDeviceIdentity = (): KioskDeviceIdentity => {
  if (identity) return identity;
  const env = import.meta.env as Record<string, string | undefined> | undefined;
  const sources: KioskDeviceTokenSource[] = [];
  if (firebaseEmulator) sources.push(async () => { const token = (globalThis as { __kiosk_device_token?: unknown }).__kiosk_device_token; return isText(token) ? token : null; });
  const agentEndpoint = resolveKioskDeviceAgentEndpoint(env?.VITE_KIOSK_DEVICE_AGENT_ENDPOINT);
  if (agentEndpoint) sources.push(createAgentDeviceTokenSource({ endpoint: agentEndpoint }));
  identity = createKioskDeviceIdentity({
    sources,
    auth: {
      async currentIdToken() { const auth = getDeviceAuth(); await auth.authStateReady(); return auth.currentUser ? auth.currentUser.getIdToken() : null; },
      async signInWithCustomToken(customToken) { await signInWithCustomToken(getDeviceAuth(), customToken); },
      async signOut() { await signOut(getDeviceAuth()); },
    },
  });
  // Focus, visibility and online events retry a failed device sign-in (startup race with the agent); the identity
  // itself throttles them and keeps one attempt in flight.
  if (typeof window !== "undefined" && typeof document !== "undefined") installKioskDeviceRecoveryTriggers(identity, { window, document });
  return identity;
};

let defaultClient: KioskRecommendationClient | null | undefined;
/** Null when `VITE_BASECAMP_API_BASE_URL` is unset or invalid: the Kiosk fails closed. */
export const getDefaultKioskRecommendationClient = (): KioskRecommendationClient | null => {
  if (defaultClient !== undefined) return defaultClient;
  const env = import.meta.env as Record<string, string | undefined> | undefined;
  const baseUrl = resolveKioskApiBaseUrl(env?.VITE_BASECAMP_API_BASE_URL, typeof window === "undefined" ? undefined : window.location.origin);
  defaultClient = baseUrl ? createKioskRecommendationClient({ baseUrl, device: createFirebaseKioskDeviceIdentity() }) : null;
  return defaultClient;
};
