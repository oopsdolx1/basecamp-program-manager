import type { AppId } from "../../../types/brandedIds";
import type { ProgramCategory } from "../../programs/types/program.types";

export type WorkoutSessionStatus =
  | "created"
  | "printed"
  | "ocr_pending"
  | "ocr_completed"
  | "ai_completed"
  | "confirmed";

export type WorkoutSource = { type: "program"; programId: string } | { type: "manual" };

export interface WorkoutSessionExerciseSnapshot {
  exerciseId: string;
  programExerciseId: string;
  name: string;
  order: number;
  plannedSets?: number;
  memo?: string;
}

export interface WorkoutSessionRecord {
  sessionId: string;
  schemaVersion: 1;
  memberId: string;
  programId?: string;
  source?: WorkoutSource;
  trainerId: string;
  status: WorkoutSessionStatus;
  exerciseIds: string[];
  memberSnapshot: { name: string };
  programSnapshot: { title: string; category?: ProgramCategory };
  exercises: WorkoutSessionExerciseSnapshot[];
  prescription?: { source?: WorkoutSource; sourceProgramId?: string; sourceProgramName: string; category?: ProgramCategory; exercises: WorkoutSessionExerciseSnapshot[] };
  print: {
    format: "A5-portrait" | "A5-landscape";
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
  programId?: string;
  source?: WorkoutSource;
  programTitle: string;
  category?: ProgramCategory;
  exercises: WorkoutSessionExerciseSnapshot[];
}
