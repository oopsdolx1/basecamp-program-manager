import type { ProfileId, ProgramId } from "../../../types/brandedIds";
import type { ProgramCategory, ProgramDifficulty } from "../../programs/types/program.types";

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

export interface WorkoutPrintDocument {
  templateKey: "basecamp-workout-log-v1";
  templateVersion: 1;
  format: "A5-portrait";
  member: PrintMemberSnapshot;
  workoutSessionId: string;
  bodyParts: string[];
  program: PrintProgramSnapshot;
  printDate: Date;
  rows: PrintExerciseRow[];
}
