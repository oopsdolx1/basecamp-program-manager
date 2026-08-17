import { collection, doc, getDoc, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, type DocumentData, Timestamp, type Unsubscribe } from "firebase/firestore";
import { getFirestoreClient } from "../../../firebase/firestoreClient";
import { workoutSessionsCollectionPath } from "../../../firebase/firestorePaths";
import type { AppId } from "../../../types/brandedIds";
import type { WorkoutSessionRecord } from "../domain/workoutSession.types";

const asDate = (value: unknown): Date => value instanceof Timestamp ? value.toDate() : new Date(0);
const statuses = new Set(["created", "printed", "ocr_pending", "ocr_completed", "ai_completed", "confirmed"]);

const mapRecord = (id: string, data: DocumentData): WorkoutSessionRecord => ({
  sessionId: id,
  schemaVersion: 1,
  memberId: String(data.memberId ?? ""),
  programId: String(data.programId ?? ""),
  trainerId: String(data.trainerId ?? ""),
  status: statuses.has(data.status) ? data.status : data.status === "preview" ? "created" : "created",
  exerciseIds: Array.isArray(data.exerciseIds) ? data.exerciseIds.map(String) : [],
  memberSnapshot: data.memberSnapshot,
  programSnapshot: data.programSnapshot,
  exercises: Array.isArray(data.exercises) ? data.exercises : [],
  print: {
    format: "A5-landscape",
    templateKey: "basecamp-workout-log-v1",
    templateVersion: 1,
    printHistoryId: typeof data.print?.printHistoryId === "string" ? data.print.printHistoryId : null,
    historyIds: Array.isArray(data.print?.historyIds)
      ? data.print.historyIds.map(String)
      : typeof data.print?.printHistoryId === "string" ? [data.print.printHistoryId] : [],
    copyCount: Number.isFinite(data.print?.copyCount) ? data.print.copyCount : data.status === "printed" ? 1 : 0,
  },
  createdAt: asDate(data.createdAt),
  updatedAt: asDate(data.updatedAt),
  printedAt: data.printedAt ? asDate(data.printedAt) : null,
  lastPrintedAt: data.lastPrintedAt ? asDate(data.lastPrintedAt) : data.printedAt ? asDate(data.printedAt) : null,
});

export const firestoreWorkoutSessionRepository = {
  async create(appId: AppId, record: Omit<WorkoutSessionRecord, "createdAt" | "updatedAt" | "printedAt" | "lastPrintedAt">): Promise<void> {
    const ref = doc(getFirestoreClient(), workoutSessionsCollectionPath(appId), record.sessionId);
    const timestamp = serverTimestamp();
    await setDoc(ref, { ...record, createdAt: timestamp, updatedAt: timestamp, printedAt: null, lastPrintedAt: null });
  },

  async get(appId: AppId, sessionId: string): Promise<WorkoutSessionRecord | null> {
    const snapshot = await getDoc(doc(getFirestoreClient(), workoutSessionsCollectionPath(appId), sessionId));
    return snapshot.exists() ? mapRecord(snapshot.id, snapshot.data()) : null;
  },

  subscribe(appId: AppId, callback: (records: WorkoutSessionRecord[]) => void, onError: (message: string) => void): Unsubscribe {
    return onSnapshot(
      query(collection(getFirestoreClient(), workoutSessionsCollectionPath(appId)), orderBy("createdAt", "desc")),
      (snapshot) => callback(snapshot.docs.map((item) => mapRecord(item.id, item.data()))),
      (error) => onError(`${error.code}: ${error.message}`),
    );
  },

  async markPrinted(appId: AppId, sessionId: string, printHistoryId: string): Promise<number> {
    const db = getFirestoreClient();
    const ref = doc(db, workoutSessionsCollectionPath(appId), sessionId);
    return runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) throw new Error("Workout Session을 찾지 못했습니다.");
      const current = mapRecord(snapshot.id, snapshot.data());
      const copyCount = current.print.copyCount + 1;
      const timestamp = serverTimestamp();
      transaction.update(ref, {
        status: "printed",
        "print.printHistoryId": printHistoryId,
        "print.historyIds": [...current.print.historyIds, printHistoryId],
        "print.copyCount": copyCount,
        printedAt: current.printedAt ? snapshot.data().printedAt : timestamp,
        lastPrintedAt: timestamp,
        updatedAt: timestamp,
      });
      return copyCount;
    });
  },
};
