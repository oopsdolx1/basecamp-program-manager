import { initializeApp, type FirebaseApp } from "firebase/app";
import type { FirebaseRuntimeConfig } from "./firebase.types";

const requiredEnv = (key: string): string => {
  const value = import.meta.env[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} is required.`);
  }

  return value;
};

export const getFirebaseConfig = (): FirebaseRuntimeConfig => ({
  apiKey: requiredEnv("VITE_FIREBASE_API_KEY"),
  authDomain: requiredEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: requiredEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: requiredEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: requiredEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: requiredEnv("VITE_FIREBASE_APP_ID"),
});

let firebaseApp: FirebaseApp | null = null;

export const getFirebaseApp = (): FirebaseApp => {
  firebaseApp ??= initializeApp(getFirebaseConfig());
  return firebaseApp;
};
