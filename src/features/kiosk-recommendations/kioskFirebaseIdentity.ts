import { getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, connectAuthEmulator, initializeAuth, signInWithCustomToken, type Auth } from "firebase/auth";
import { firebaseEmulator, getFirebaseOptions } from "../../firebase/firebaseApp";
import { createKioskRecommendationClient, isText, resolveKioskApiBaseUrl, type KioskDeviceIdentity, type KioskRecommendationClient } from "./kioskRecommendationClient";

// Firebase-backed Kiosk device identity (browser). A separate named app keeps the Program Manager identity untouched.
const DEVICE_APP = "basecamp-kiosk-device";
let deviceAuth: Auth | null = null;
const getDeviceAuth = (): Auth => {
  if (deviceAuth) return deviceAuth;
  const app = getApps().find((candidate) => candidate.name === DEVICE_APP) ?? initializeApp(getFirebaseOptions(), DEVICE_APP);
  deviceAuth = initializeAuth(app, { persistence: browserLocalPersistence });
  if (firebaseEmulator) connectAuthEmulator(deviceAuth, `http://${firebaseEmulator.host}:${firebaseEmulator.authPort}`, { disableWarnings: true });
  return deviceAuth;
};

/** Device-only identity (role kiosk + deviceId), enrolled once from `globalThis.__kiosk_device_token`. */
export const createFirebaseKioskDeviceIdentity = (): KioskDeviceIdentity => ({
  async getIdToken() {
    const auth = getDeviceAuth();
    await auth.authStateReady();
    if (!auth.currentUser) {
      const enrollmentToken = (globalThis as { __kiosk_device_token?: unknown }).__kiosk_device_token;
      if (!isText(enrollmentToken)) return null;
      await signInWithCustomToken(auth, enrollmentToken);
    }
    return auth.currentUser ? auth.currentUser.getIdToken() : null;
  },
});

let defaultClient: KioskRecommendationClient | null | undefined;
/** Null when `VITE_CONDITION_LAB_API_BASE_URL` is unset or invalid: the Kiosk keeps its existing flow. */
export const getDefaultKioskRecommendationClient = (): KioskRecommendationClient | null => {
  if (defaultClient !== undefined) return defaultClient;
  const env = import.meta.env as Record<string, string | undefined> | undefined;
  const baseUrl = resolveKioskApiBaseUrl(env?.VITE_CONDITION_LAB_API_BASE_URL, typeof window === "undefined" ? undefined : window.location.origin);
  defaultClient = baseUrl ? createKioskRecommendationClient({ baseUrl, device: createFirebaseKioskDeviceIdentity() }) : null;
  return defaultClient;
};
