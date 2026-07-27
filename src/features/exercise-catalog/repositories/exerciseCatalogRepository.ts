import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getFirebaseAuth } from "../../../firebase/firebaseAuth";
import { getFirestoreClient } from "../../../firebase/firestoreClient";
import { exerciseCatalogCollectionPath } from "../../../firebase/firestorePaths";
import type { AppId } from "../../../types/brandedIds";
import { exerciseCatalogToPayload, mapExerciseCatalogDocument } from "../mappers/exerciseCatalogMapper";
import type { ExerciseCatalogRepository } from "./exerciseCatalogRepository.types";

const catalogCollection = (appId: AppId) =>
  collection(getFirestoreClient(), exerciseCatalogCollectionPath(appId));

const catalogDocument = (appId: AppId, exerciseId: string) =>
  doc(getFirestoreClient(), exerciseCatalogCollectionPath(appId), exerciseId);

const currentUserId = (): string | null => getFirebaseAuth().currentUser?.uid ?? null;

export const exerciseCatalogRepository: ExerciseCatalogRepository = {
  subscribeCatalog(appId, callback, onError) {
    return onSnapshot(
      catalogCollection(appId),
      (snapshot) => callback(snapshot.docs.map((item) => mapExerciseCatalogDocument(item.id, item.data()))),
      (error) => onError(`${error.code}: ${error.message}`),
    );
  },

  async getExercise(appId, exerciseId) {
    const snapshot = await getDoc(catalogDocument(appId, exerciseId));
    return snapshot.exists() ? mapExerciseCatalogDocument(snapshot.id, snapshot.data()) : null;
  },

  async createExercise(appId, values) {
    const documentRef = doc(catalogCollection(appId));
    await setDoc(documentRef, {
      id: documentRef.id,
      ...exerciseCatalogToPayload(values),
      createdBy: currentUserId(),
      updatedBy: currentUserId(),
      isArchived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return documentRef.id;
  },

  async updateExercise(appId, exerciseId, values) {
    await updateDoc(catalogDocument(appId, exerciseId), {
      ...exerciseCatalogToPayload(values),
      updatedBy: currentUserId(),
      updatedAt: serverTimestamp(),
    });
  },

  async archiveExercise(appId, exerciseId) {
    await updateDoc(catalogDocument(appId, exerciseId), {
      isArchived: true,
      updatedBy: currentUserId(),
      updatedAt: serverTimestamp(),
    });
  },

  async restoreExercise(appId, exerciseId) {
    await updateDoc(catalogDocument(appId, exerciseId), {
      isArchived: false,
      updatedBy: currentUserId(),
      updatedAt: serverTimestamp(),
    });
  },
};
