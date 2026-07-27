import { getFirestore, type Firestore } from "firebase/firestore";
import { getFirebaseApp } from "./firebaseApp";

let firestore: Firestore | null = null;

export const getFirestoreClient = (): Firestore => {
  firestore ??= getFirestore(getFirebaseApp());
  return firestore;
};
