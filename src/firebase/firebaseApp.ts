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

export function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(firebaseConfig);
}