import type { ProgramId } from "../../../types/brandedIds";

export type ProgramCategory =
  | "FULL_BODY"
  | "CHEST"
  | "BACK"
  | "LOWER_BODY"
  | "SHOULDER"
  | "ARMS"
  | "RECOVERY"
  | "ETC"
  | "CUSTOM";

export type ProgramDifficulty = "GENERAL" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export interface ProgramExercise {
  id: string;
  name: string;
  sets: number;
  memo?: string;
  order: number;
  catalogExerciseId?: string;
  displayName?: string;
}

export interface Program {
  id: ProgramId;
  schemaVersion: 1;
  category: ProgramCategory;
  title: string;
  difficulty?: ProgramDifficulty;
  memo?: string;
  exercises: ProgramExercise[];
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
  usageCount: number;
  favorite: boolean;
  isArchived: boolean;
  createdBy?: string;
  updatedBy?: string;
}

export const PROGRAM_EXERCISE_LIMIT = 8;
export const PROGRAM_EXERCISE_MIN = 1;

export interface ProgramFormExercise {
  id: string;
  name: string;
  sets: number;
  memo: string;
  order: number;
  catalogExerciseId?: string;
  displayName?: string;
}

export interface ProgramFormValues {
  title: string;
  category: ProgramCategory;
  difficulty: ProgramDifficulty;
  memo: string;
  favorite: boolean;
  exercises: ProgramFormExercise[];
}
