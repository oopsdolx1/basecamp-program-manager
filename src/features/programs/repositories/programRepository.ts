import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import { getFirebaseAuth } from "../../../firebase/firebaseAuth";
import { getFirestoreClient } from "../../../firebase/firestoreClient";
import { programsCollectionPath } from "../../../firebase/firestorePaths";
import type { AppId, ProgramId } from "../../../types/brandedIds";
import { toProgramId } from "../../../types/brandedIds";
import { formExerciseToPayload, mapProgramDocument } from "../mappers/programMapper";
import type { Program, ProgramFormValues } from "../types/program.types";
import type { ProgramRepository } from "./programRepository.types";

const programCollection = (appId: AppId) =>
  collection(getFirestoreClient(), programsCollectionPath(appId));

const programDocument = (appId: AppId, programId: ProgramId) =>
  doc(getFirestoreClient(), programsCollectionPath(appId), programId);

const currentUserId = (): string | null => getFirebaseAuth().currentUser?.uid ?? null;

const toCreatePayload = (programId: ProgramId, values: ProgramFormValues): Record<string, unknown> => ({
  id: programId,
  schemaVersion: 1,
  title: values.title.trim(),
  category: values.category,
  difficulty: values.difficulty,
  memo: values.memo.trim(),
  favorite: values.favorite,
  usageCount: 0,
  lastUsedAt: null,
  createdBy: currentUserId(),
  updatedBy: currentUserId(),
  isArchived: false,
  exercises: values.exercises.map(formExerciseToPayload),
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

const toUpdatePayload = (values: ProgramFormValues): Record<string, unknown> => ({
  title: values.title.trim(),
  category: values.category,
  difficulty: values.difficulty,
  memo: values.memo.trim(),
  favorite: values.favorite,
  exercises: values.exercises.map(formExerciseToPayload),
  updatedBy: currentUserId(),
  updatedAt: serverTimestamp(),
});

export const programRepository: ProgramRepository = {
  async getPrograms(appId) {
    const snapshot = await getDocs(programCollection(appId));
    return snapshot.docs.map((documentSnapshot) =>
      mapProgramDocument(documentSnapshot.id, documentSnapshot.data()),
    );
  },

  subscribePrograms(appId, callback, onError) {
    return onSnapshot(
      programCollection(appId),
      (snapshot) => {
        const programs = snapshot.docs.map((documentSnapshot) =>
          mapProgramDocument(documentSnapshot.id, documentSnapshot.data()),
        );
        callback(programs);
      },
      (error) => onError(`${error.code}: ${error.message}`),
    );
  },

  async getProgram(appId, programId) {
    const snapshot = await getDoc(programDocument(appId, programId));
    if (!snapshot.exists()) {
      return null;
    }

    return mapProgramDocument(snapshot.id, snapshot.data() as DocumentData);
  },

  async createProgram(appId, values) {
    const documentRef = doc(programCollection(appId));
    const programId = toProgramId(documentRef.id);
    await setDoc(documentRef, toCreatePayload(programId, values));
    return programId;
  },

  async updateProgram(appId, programId, values) {
    await updateDoc(programDocument(appId, programId), toUpdatePayload(values));
  },

  async archiveProgram(appId, programId) {
    await updateDoc(programDocument(appId, programId), {
      isArchived: true,
      updatedBy: currentUserId(),
      updatedAt: serverTimestamp(),
    });
  },

  async duplicateProgram(appId, source, title) {
    const documentRef = doc(programCollection(appId));
    const programId = toProgramId(documentRef.id);
    await setDoc(documentRef, {
      id: programId,
      schemaVersion: 1,
      title,
      category: source.category,
      difficulty: source.difficulty ?? "GENERAL",
      memo: source.memo ?? "",
      favorite: false,
      usageCount: 0,
      lastUsedAt: null,
      createdBy: currentUserId(),
      updatedBy: currentUserId(),
      isArchived: false,
      exercises: source.exercises.map((exercise) => ({
        id: crypto.randomUUID(),
        name: exercise.name,
        sets: exercise.sets,
        memo: exercise.memo ?? "",
        order: exercise.order,
        ...(exercise.catalogExerciseId ? { catalogExerciseId: exercise.catalogExerciseId } : {}),
      })),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return programId;
  },

  async restoreProgram(appId, programId) {
    await updateDoc(programDocument(appId, programId), {
      isArchived: false,
      updatedBy: currentUserId(),
      updatedAt: serverTimestamp(),
    });
  },
};
