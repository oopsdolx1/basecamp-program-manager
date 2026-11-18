import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";

function requiredEnv(value: string | undefined, name: string): string {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    throw new Error(`${name} is required.`);
  }

  return normalizedValue;
}

const firebaseConfig = {
  apiKey: requiredEnv(
    import.meta.env.VITE_FIREBASE_API_KEY,
    "VITE_FIREBASE_API_KEY",
  ),
  authDomain: requiredEnv(
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    "VITE_FIREBASE_AUTH_DOMAIN",
  ),
  projectId: requiredEnv(
    import.meta.env.VITE_FIREBASE_PROJECT_ID,
    "VITE_FIREBASE_PROJECT_ID",
  ),
  storageBucket: requiredEnv(
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    "VITE_FIREBASE_STORAGE_BUCKET",
  ),
  messagingSenderId: requiredEnv(
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
  ),
  appId: requiredEnv(
    import.meta.env.VITE_FIREBASE_APP_ID,
    "VITE_FIREBASE_APP_ID",
  ),
};

// The kiosk browser is bound to the current BaseCamp production project. Keep
// this explicit so an accidental old-project build fails closed in emulator mode.
const PRODUCTION_PROJECT_ID = "basecamp-c1710";
const runtimeEnv = import.meta.env as Record<string, string | undefined> | undefined;

/** Local Firebase Emulator target. Only when VITE_FIREBASE_USE_EMULATOR=true, never with the production project. */
export const firebaseEmulator = runtimeEnv?.VITE_FIREBASE_USE_EMULATOR === "true"
  ? {
    host: runtimeEnv.VITE_FIREBASE_EMULATOR_HOST?.trim() || "127.0.0.1",
    firestorePort: Number(runtimeEnv.VITE_FIRESTORE_EMULATOR_PORT || 18080),
    authPort: Number(runtimeEnv.VITE_FIREBASE_AUTH_EMULATOR_PORT || 19099),
  }
  : null;
if (firebaseEmulator && firebaseConfig.projectId === PRODUCTION_PROJECT_ID) {
  throw new Error("Emulator mode cannot use the production Firebase project.");
}

/** Options for secondary Firebase apps (Kiosk device and Kiosk session identities). */
export const getFirebaseOptions = () => ({ ...firebaseConfig });

export function getFirebaseApp(): FirebaseApp {
  // Secondary named apps may exist (Kiosk identities); only reuse the default app here.
  if (getApps().some((app) => app.name === "[DEFAULT]")) {
    return getApp();
  }

  return initializeApp(firebaseConfig);
}
