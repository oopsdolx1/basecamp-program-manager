import type { AppId } from "../../../types/brandedIds";

export type WorkoutSessionStatus =
  | "created"
  | "printed"
  | "ocr_pending"
  | "ocr_completed"
  | "ai_completed"
  | "confirmed";

export interface WorkoutSessionExerciseSnapshot {
  exerciseId: string;
  programExerciseId: string;
  name: string;
  order: number;
}

export interface WorkoutSessionRecord {
  sessionId: string;
  schemaVersion: 1;
  memberId: string;
  programId: string;
  trainerId: string;
  status: WorkoutSessionStatus;
  exerciseIds: string[];
  memberSnapshot: { name: string };
  programSnapshot: { title: string };
  exercises: WorkoutSessionExerciseSnapshot[];
  print: {
    format: "A5-portrait";
    templateKey: "basecamp-workout-log-v1";
    templateVersion: 1;
    printHistoryId: string | null;
    historyIds: string[];
    copyCount: number;
  };
  createdAt: Date;
  updatedAt: Date;
  printedAt: Date | null;
  lastPrintedAt: Date | null;
}

export interface CreateWorkoutSessionInput {
  appId: AppId;
  memberId: string;
  memberName: string;
  programId: string;
  programTitle: string;
  exercises: WorkoutSessionExerciseSnapshot[];
}
