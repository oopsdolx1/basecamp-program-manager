import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { firebaseEmulator, getFirebaseApp } from "./firebaseApp";

let firestore: Firestore | null = null;

export const getFirestoreClient = (): Firestore => {
  if (!firestore) {
    firestore = getFirestore(getFirebaseApp());
    if (firebaseEmulator) connectFirestoreEmulator(firestore, firebaseEmulator.host, firebaseEmulator.firestorePort);
  }
  return firestore;
};
