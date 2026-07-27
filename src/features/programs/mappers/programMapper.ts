import { Timestamp, type DocumentData } from "firebase/firestore";
import { toProgramId } from "../../../types/brandedIds";
import { getCategoryLabel, getDifficultyLabel } from "../config/programOptions";
import type {
  Program,
  ProgramCategory,
  ProgramDifficulty,
  ProgramExercise,
  ProgramFormExercise,
  ProgramFormValues,
} from "../types/program.types";
import type { ProgramListItem } from "../types/programViewModel.types";

const asText = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const asNumber = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const asBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const asDate = (value: unknown): Date => {
  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  return new Date(0);
};

const asOptionalDate = (value: unknown): Date | undefined => {
  if (!value) {
    return undefined;
  }

  return asDate(value);
};

const isProgramCategory = (value: unknown): value is ProgramCategory =>
  typeof value === "string" &&
  ["FULL_BODY", "CHEST", "BACK", "LOWER_BODY", "SHOULDER", "ARMS", "RECOVERY", "ETC", "CUSTOM"].includes(value);

const isProgramDifficulty = (value: unknown): value is ProgramDifficulty =>
  typeof value === "string" && ["GENERAL", "BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(value);

const mapExercise = (value: unknown, index: number): ProgramExercise | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const name = asText(source.name);
  if (!name) {
    return null;
  }

  return {
    id: asText(source.id) ?? crypto.randomUUID(),
    name,
    sets: Math.max(1, asNumber(source.sets, 1)),
    memo: asText(source.memo),
    order: asNumber(source.order, index + 1),
    catalogExerciseId: asText(source.catalogExerciseId),
    displayName: asText(source.displayName) ?? name,
  };
};

export const mapProgramDocument = (documentId: string, data: DocumentData): Program => {
  const exercises = Array.isArray(data.exercises)
    ? data.exercises
        .map((exercise, index) => mapExercise(exercise, index))
        .filter((exercise): exercise is ProgramExercise => Boolean(exercise))
        .sort((left, right) => left.order - right.order)
    : [];

  return {
    id: toProgramId(documentId),
    schemaVersion: 1,
    title: asText(data.title) ?? "제목 없음",
    category: isProgramCategory(data.category) ? data.category : "ETC",
    difficulty: isProgramDifficulty(data.difficulty) ? data.difficulty : "GENERAL",
    memo: asText(data.memo),
    favorite: asBoolean(data.favorite, false),
    usageCount: asNumber(data.usageCount, 0),
    createdAt: asDate(data.createdAt),
    updatedAt: asDate(data.updatedAt),
    lastUsedAt: asOptionalDate(data.lastUsedAt),
    createdBy: asText(data.createdBy),
    updatedBy: asText(data.updatedBy),
    isArchived: asBoolean(data.isArchived, false),
    exercises,
  };
};

const formatDateLabel = (date?: Date): string => {
  if (!date || date.getTime() === 0) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(date);
};

export const toProgramListItem = (program: Program): ProgramListItem => ({
  id: program.id,
  title: program.title,
  category: program.category,
  categoryLabel: getCategoryLabel(program.category),
  difficulty: program.difficulty,
  difficultyLabel: getDifficultyLabel(program.difficulty),
  exerciseCount: program.exercises.length,
  exerciseNames: program.exercises.map((exercise) => exercise.name),
  favorite: program.favorite,
  usageCount: program.usageCount,
  lastUsedLabel: formatDateLabel(program.lastUsedAt),
  updatedAtLabel: formatDateLabel(program.updatedAt),
  isArchived: program.isArchived,
});

export const programToFormValues = (program: Program): ProgramFormValues => ({
  title: program.title,
  category: program.category,
  difficulty: program.difficulty ?? "GENERAL",
  memo: program.memo ?? "",
  favorite: program.favorite,
  exercises: program.exercises.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    sets: exercise.sets,
    memo: exercise.memo ?? "",
    order: exercise.order,
    catalogExerciseId: exercise.catalogExerciseId,
    displayName: exercise.displayName ?? exercise.name,
  })),
});

export const formExerciseToPayload = (exercise: ProgramFormExercise): Record<string, unknown> => ({
  id: exercise.id,
  name: exercise.name.trim(),
  sets: exercise.sets,
  memo: exercise.memo.trim(),
  order: exercise.order,
  ...(exercise.catalogExerciseId ? { catalogExerciseId: exercise.catalogExerciseId } : {}),
  displayName: (exercise.displayName || exercise.name).trim(),
});
