import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";

const localCommit = (): string => {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
};

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
    define: {
      __PROGRAM_MANAGER_COMMIT__: JSON.stringify(env.VERCEL_GIT_COMMIT_SHA || localCommit()),
      __PROGRAM_MANAGER_BUILT_AT__: JSON.stringify(new Date().toISOString()),
    },
  };
});
