import { ensureFirebaseAuth } from "../../../firebase/firebaseAuth";
import type { CreateWorkoutSessionInput, WorkoutSessionRecord } from "../domain/workoutSession.types";
import { buildWorkoutSessionRecord } from "./workoutSessionRecordBuilder";
import { firestoreWorkoutSessionRepository } from "../repositories/firestoreWorkoutSessionRepository";

const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

export const createWorkoutSessionId = (date = new Date()): string =>
  `ws_${formatDateKey(date)}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

export const createWorkoutSession = async (input: CreateWorkoutSessionInput): Promise<string> => {
  if (input.exercises.length < 1) throw new Error("출력할 운동이 없습니다.");
  if (input.exercises.length > 9) throw new Error("운동은 최대 9개까지 가능합니다.");

  const user = await ensureFirebaseAuth();
  const sessionId = createWorkoutSessionId();
  await firestoreWorkoutSessionRepository.create(input.appId, buildWorkoutSessionRecord(input, user.uid, sessionId));

  return sessionId;
};

export const getWorkoutSession = (appId: CreateWorkoutSessionInput["appId"], sessionId: string): Promise<WorkoutSessionRecord | null> =>
  firestoreWorkoutSessionRepository.get(appId, sessionId);

export const markWorkoutSessionPrinted = (appId: CreateWorkoutSessionInput["appId"], sessionId: string, printHistoryId: string): Promise<void> =>
  firestoreWorkoutSessionRepository.markPrinted(appId, sessionId, printHistoryId).then(() => undefined);

export const subscribeWorkoutSessions = (
  appId: CreateWorkoutSessionInput["appId"],
  callback: (records: WorkoutSessionRecord[]) => void,
  onError: (message: string) => void,
) => firestoreWorkoutSessionRepository.subscribe(appId, callback, onError);
