import type { ProfileId, ProgramId } from "../../../types/brandedIds";
import type { ProgramCategory, ProgramDifficulty } from "../../programs/types/program.types";
import type { A5WorkoutLayout } from "../services/a5WorkoutLayoutService";

export interface PrintMemberSnapshot {
  memberId: ProfileId;
  name: string;
}

export interface PrintProgramExerciseSnapshot {
  id: string;
  exerciseId: string;
  name: string;
  memo: string;
  order: number;
  configuredSets: number | null;
  memberWhy: string;
}

export interface PrintProgramSnapshot {
  programId: ProgramId;
  title: string;
  category: ProgramCategory;
  categoryLabel: string;
  difficulty: ProgramDifficulty;
  difficultyLabel: string;
  memo: string;
  exercises: PrintProgramExerciseSnapshot[];
}

export interface PrintExerciseRow {
  order: number;
  exerciseName: string;
  exerciseMemo: string;
  memberWhy: string;
  configuredSets: number | null;
  isBlank: boolean;
}

/**
 * `blank-workout-log` is a handwriting template: the A5 layout with no member,
 * program, exercise or workout session data and no QR. It is never persisted.
 * Omitted means a regular workout-session document.
 */
export type WorkoutPrintDocumentKind = "workout-session" | "blank-workout-log";

export interface WorkoutPrintDocument {
  kind?: WorkoutPrintDocumentKind;
  templateKey: "basecamp-workout-log-v1";
  templateVersion: 1;
  format: "A5-landscape";
  member: PrintMemberSnapshot;
  workoutSessionId: string;
  bodyParts: string[];
  program: PrintProgramSnapshot;
  printDate: Date;
  layout: A5WorkoutLayout;
  rows: PrintExerciseRow[];
}
