import { Timestamp, type DocumentData } from "firebase/firestore";
import { getEquipmentTypeLabel, getExerciseCategoryLabel } from "../constants/exerciseCatalogOptions";
import type {
  EquipmentType,
  ExerciseCatalogFormValues,
  ExerciseCatalogItem,
  ExerciseCatalogOption,
  ExerciseCategory,
  ExerciseDifficulty,
  MovementPattern,
  PrimaryMuscle,
} from "../domain/exerciseCatalog.types";

const exerciseCategoryValues: ExerciseCategory[] = [
  "chest",
  "back",
  "shoulder",
  "arm",
  "lower_body",
  "full_body",
  "core",
  "cardio",
  "recovery",
  "mobility",
  "other",
];

const primaryMuscleValues: PrimaryMuscle[] = [
  "chest",
  "upper_back",
  "lats",
  "traps",
  "rear_delts",
  "front_delts",
  "side_delts",
  "biceps",
  "triceps",
  "forearm",
  "glutes",
  "quadriceps",
  "hamstrings",
  "calves",
  "abs",
  "obliques",
  "hip_flexors",
  "full_body",
  "other",
];

const equipmentTypeValues: EquipmentType[] = [
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "bodyweight",
  "kettlebell",
  "smith",
  "resistance_band",
  "medicine_ball",
  "cardio_machine",
  "other",
];

const movementPatternValues: MovementPattern[] = [
  "push",
  "pull",
  "squat",
  "hinge",
  "carry",
  "lunge",
  "rotation",
  "anti_rotation",
  "isolation",
  "cardio",
];

const difficultyValues: ExerciseDifficulty[] = ["beginner", "intermediate", "advanced"];

const asText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
    : [];

const asDate = (value: unknown): Date => {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return new Date(0);
};

const includes = <T extends string>(values: T[], value: unknown, fallback: T): T =>
  typeof value === "string" && values.includes(value as T) ? (value as T) : fallback;

const nullableIncludes = <T extends string>(values: T[], value: unknown): T | null =>
  typeof value === "string" && values.includes(value as T) ? (value as T) : null;

export const mapExerciseCatalogDocument = (id: string, data: DocumentData): ExerciseCatalogItem => ({
  id,
  schemaVersion: 1,
  name: asText(data.name) ?? "이름 없음",
  englishName: asText(data.englishName),
  aliases: asStringArray(data.aliases),
  category: includes(exerciseCategoryValues, data.category, "other"),
  primaryMuscle: includes(primaryMuscleValues, data.primaryMuscle, "other"),
  secondaryMuscles: asStringArray(data.secondaryMuscles)
    .map((value) => nullableIncludes(primaryMuscleValues, value))
    .filter((value): value is PrimaryMuscle => Boolean(value)),
  equipmentType: includes(equipmentTypeValues, data.equipmentType, "other"),
  movementPattern: nullableIncludes(movementPatternValues, data.movementPattern),
  difficulty: nullableIncludes(difficultyValues, data.difficulty),
  memo: asText(data.memo) ?? "",
  isFavorite: data.isFavorite === true,
  isArchived: data.isArchived === true,
  createdAt: asDate(data.createdAt),
  updatedAt: asDate(data.updatedAt),
  createdBy: asText(data.createdBy),
  updatedBy: asText(data.updatedBy),
});

export const exerciseCatalogToPayload = (values: ExerciseCatalogFormValues): Record<string, unknown> => ({
  schemaVersion: 1,
  name: values.name.trim(),
  englishName: values.englishName.trim() || null,
  aliases: values.aliases,
  category: values.category,
  primaryMuscle: values.primaryMuscle,
  secondaryMuscles: values.secondaryMuscles,
  equipmentType: values.equipmentType,
  movementPattern: values.movementPattern,
  difficulty: values.difficulty,
  memo: values.memo.trim(),
  isFavorite: values.isFavorite,
});

export const toExerciseCatalogOption = (item: ExerciseCatalogItem): ExerciseCatalogOption => ({
  id: item.id,
  displayName: item.name,
  name: item.name,
  englishName: item.englishName,
  category: item.category,
  categoryLabel: getExerciseCategoryLabel(item.category),
  equipmentType: item.equipmentType,
  equipmentLabel: getEquipmentTypeLabel(item.equipmentType),
  aliases: item.aliases,
});
