import { getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, connectAuthEmulator, inMemoryPersistence, initializeAuth, signInWithCustomToken, signOut, type Auth, type Persistence } from "firebase/auth";
import { firebaseEmulator, getFirebaseOptions } from "../../firebase/firebaseApp";
import { createKioskRecommendationClient, isText, resolveKioskApiBaseUrl, type KioskDeviceIdentity, type KioskRecommendationClient, type KioskSessionIdentity } from "./kioskRecommendationClient";

// Firebase-backed Kiosk identities (browser). Separate named apps keep the Program Manager identity untouched.

const DEVICE_APP = "basecamp-kiosk-device";
const SESSION_APP = "basecamp-kiosk-session";
const auths = new Map<string, Auth>();
const authFor = (name: string, persistence: Persistence): Auth => {
  const cached = auths.get(name);
  if (cached) return cached;
  const app = getApps().find((candidate) => candidate.name === name) ?? initializeApp(getFirebaseOptions(), name);
  const auth = initializeAuth(app, { persistence });
  if (firebaseEmulator) connectAuthEmulator(auth, `http://${firebaseEmulator.host}:${firebaseEmulator.authPort}`, { disableWarnings: true });
  auths.set(name, auth);
  return auth;
};

export const createFirebaseKioskDeviceIdentity = (): KioskDeviceIdentity => ({
  async getIdToken() {
    const auth = authFor(DEVICE_APP, browserLocalPersistence);
    await auth.authStateReady();
    if (!auth.currentUser) {
      const enrollmentToken = (globalThis as { __kiosk_device_token?: unknown }).__kiosk_device_token;
      if (!isText(enrollmentToken)) return null;
      await signInWithCustomToken(auth, enrollmentToken);
    }
    return auth.currentUser ? auth.currentUser.getIdToken() : null;
  },
});

export const createFirebaseKioskSessionIdentity = (): KioskSessionIdentity => {
  const auth = () => authFor(SESSION_APP, inMemoryPersistence);
  return {
    async signIn(customToken) { await signInWithCustomToken(auth(), customToken); },
    async getIdToken() { return auth().currentUser ? auth().currentUser!.getIdToken() : null; },
    async signOut() { await signOut(auth()); },
  };
};

let defaultClient: KioskRecommendationClient | null | undefined;
/** Null when `VITE_CONDITION_LAB_API_BASE_URL` is unset or invalid: the Kiosk keeps its existing flow. */
export const getDefaultKioskRecommendationClient = (): KioskRecommendationClient | null => {
  if (defaultClient !== undefined) return defaultClient;
  const env = import.meta.env as Record<string, string | undefined> | undefined;
  const baseUrl = resolveKioskApiBaseUrl(env?.VITE_CONDITION_LAB_API_BASE_URL, typeof window === "undefined" ? undefined : window.location.origin);
  defaultClient = baseUrl ? createKioskRecommendationClient({ baseUrl, device: createFirebaseKioskDeviceIdentity(), session: createFirebaseKioskSessionIdentity() }) : null;
  return defaultClient;
};
