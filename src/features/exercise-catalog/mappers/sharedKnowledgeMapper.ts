import type { SharedExerciseKnowledge } from "../../../shared-knowledge/programManagerRuntime";
import type { EquipmentType, ExerciseCatalogItem, ExerciseCategory, MovementPattern, PrimaryMuscle } from "../domain/exerciseCatalog.types";

const categoryValues: ExerciseCategory[] = ["chest", "back", "shoulder", "arm", "lower_body", "full_body", "core", "cardio", "recovery", "mobility", "other"];
const muscleValues: PrimaryMuscle[] = ["chest", "upper_back", "lats", "traps", "rear_delts", "front_delts", "side_delts", "biceps", "triceps", "forearm", "glutes", "quadriceps", "hamstrings", "calves", "abs", "obliques", "hip_flexors", "full_body", "other"];
const equipmentValues: EquipmentType[] = ["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell", "smith", "resistance_band", "medicine_ball", "cardio_machine", "other"];
const movementValues: MovementPattern[] = ["push", "pull", "squat", "hinge", "carry", "lunge", "rotation", "anti_rotation", "isolation", "cardio"];

const known = <T extends string>(values: T[], value: string | undefined, fallback: T): T =>
  values.includes(value as T) ? value as T : fallback;

const mapEquipment = (value: string): EquipmentType =>
  known(equipmentValues, value === "band" ? "resistance_band" : value, "other");

const mapMovement = (value: string): MovementPattern | null => {
  const normalized = value === "hip_hinge" ? "hinge" : value;
  return normalized ? known(movementValues, normalized, "isolation") : null;
};

export const fromSharedKnowledge = (exercise: SharedExerciseKnowledge): ExerciseCatalogItem => ({
  id: exercise.id,
  schemaVersion: 1,
  name: exercise.name,
  englishName: exercise.englishName || null,
  aliases: [...exercise.aliases],
  bodyPart: exercise.bodyPart,
  equipment: exercise.equipment,
  category: known(categoryValues, exercise.legacy?.category || exercise.category, "other"),
  primaryMuscle: known(muscleValues, exercise.legacy?.primaryMuscle || exercise.primaryMuscle, "other"),
  secondaryMuscles: (exercise.legacy?.secondaryMuscles || exercise.secondaryMuscles).map((value) => known(muscleValues, value, "other")),
  equipmentType: mapEquipment(exercise.legacy?.equipmentType || exercise.equipment),
  movementPattern: mapMovement(exercise.movementPattern),
  difficulty: exercise.difficulty || null,
  memo: exercise.memo || "",
  isFavorite: false,
  isArchived: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  createdBy: null,
  updatedBy: null,
});
