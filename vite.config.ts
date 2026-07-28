import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  console.log("Firebase env diagnostic", {
    mode,
    apiKey: Boolean(env.VITE_FIREBASE_API_KEY),
    authDomain: Boolean(env.VITE_FIREBASE_AUTH_DOMAIN),
    projectId: Boolean(env.VITE_FIREBASE_PROJECT_ID),
    storageBucket: Boolean(env.VITE_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: Boolean(env.VITE_FIREBASE_MESSAGING_SENDER_ID),
    appId: Boolean(env.VITE_FIREBASE_APP_ID),
    conditionLabAppId: Boolean(env.VITE_CONDITION_LAB_APP_ID),
  });

  return {
    plugins: [react()],
  };
});
