import { ensureFirebaseAuth } from "../../../firebase/firebaseAuth";
import { PRINT_FORMAT, PRINT_TEMPLATE_KEY, PRINT_TEMPLATE_VERSION } from "../../printing/constants/print.constants";
import type { CreateWorkoutSessionInput, WorkoutSessionRecord } from "../domain/workoutSession.types";
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
  if (input.exercises.length > 8) throw new Error("운동이 8개를 초과하여 출력할 수 없습니다.");

  const user = await ensureFirebaseAuth();
  const sessionId = createWorkoutSessionId();
  const exercises = [...input.exercises].sort((left, right) => left.order - right.order);
  await firestoreWorkoutSessionRepository.create(input.appId, {
    sessionId,
    schemaVersion: 1,
    memberId: input.memberId,
    programId: input.programId,
    trainerId: user.uid,
    status: "created",
    exerciseIds: exercises.map((exercise) => exercise.exerciseId),
    memberSnapshot: { name: input.memberName },
    programSnapshot: { title: input.programTitle },
    exercises,
    print: {
      format: PRINT_FORMAT,
      templateKey: PRINT_TEMPLATE_KEY,
      templateVersion: PRINT_TEMPLATE_VERSION,
      printHistoryId: null,
      historyIds: [],
      copyCount: 0,
    },
  });
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
