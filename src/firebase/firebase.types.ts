import type { AppId } from "../types/brandedIds";

export interface FirebaseRuntimeConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface FirebaseRuntime {
  conditionLabAppId: AppId;
}
