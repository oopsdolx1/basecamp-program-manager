import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken,
  type Auth,
  type User,
} from "firebase/auth";
import { getFirebaseApp } from "./firebaseApp";

let auth: Auth | null = null;

export const getFirebaseAuth = (): Auth => {
  auth ??= getAuth(getFirebaseApp());
  return auth;
};

const getInitialAuthToken = (): string | undefined => {
  const maybeGlobal = globalThis as { __initial_auth_token?: unknown };
  return typeof maybeGlobal.__initial_auth_token === "string" ? maybeGlobal.__initial_auth_token : undefined;
};

export const ensureFirebaseAuth = async (): Promise<User> => {
  const firebaseAuth = getFirebaseAuth();
  if (firebaseAuth.currentUser) {
    return firebaseAuth.currentUser;
  }

  const token = getInitialAuthToken();
  const credential = token
    ? await signInWithCustomToken(firebaseAuth, token)
    : await signInAnonymously(firebaseAuth);

  return credential.user;
};

export const subscribeAuthState = (callback: (user: User | null) => void): (() => void) =>
  onAuthStateChanged(getFirebaseAuth(), callback);
