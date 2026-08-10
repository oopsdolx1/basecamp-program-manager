export type ExerciseCategory =
  | "chest"
  | "back"
  | "shoulder"
  | "arm"
  | "lower_body"
  | "full_body"
  | "core"
  | "cardio"
  | "recovery"
  | "mobility"
  | "other";

export type PrimaryMuscle =
  | "chest"
  | "upper_back"
  | "lats"
  | "traps"
  | "rear_delts"
  | "front_delts"
  | "side_delts"
  | "biceps"
  | "triceps"
  | "forearm"
  | "glutes"
  | "quadriceps"
  | "hamstrings"
  | "calves"
  | "abs"
  | "obliques"
  | "hip_flexors"
  | "full_body"
  | "other";

export type EquipmentType =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "kettlebell"
  | "smith"
  | "resistance_band"
  | "medicine_ball"
  | "cardio_machine"
  | "other";

export type MovementPattern =
  | "push"
  | "pull"
  | "squat"
  | "hinge"
  | "carry"
  | "lunge"
  | "rotation"
  | "anti_rotation"
  | "isolation"
  | "cardio";

export type ExerciseDifficulty = "beginner" | "intermediate" | "advanced";

export interface ExerciseCatalogItem {
  id: string;
  schemaVersion: 1;
  name: string;
  englishName: string | null;
  aliases: string[];
  bodyPart?: string;
  equipment?: string;
  category: ExerciseCategory;
  primaryMuscle: PrimaryMuscle;
  secondaryMuscles: PrimaryMuscle[];
  equipmentType: EquipmentType;
  movementPattern: MovementPattern | null;
  difficulty: ExerciseDifficulty | null;
  memo: string;
  isFavorite: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface ExerciseCatalogFilters {
  search: string;
  category: ExerciseCategory | "ALL";
  bodyPart: string;
  equipment: string;
  equipmentType: EquipmentType | "ALL";
  primaryMuscle: PrimaryMuscle | "ALL";
  status: "ACTIVE" | "ARCHIVED" | "ALL";
  quality: "ALL" | "NO_ALIAS" | "NO_ENGLISH_NAME" | "NO_MEMO";
}

export interface ExerciseCatalogOption {
  id: string;
  displayName: string;
  name: string;
  englishName: string | null;
  category: ExerciseCategory;
  categoryLabel: string;
  equipmentType: EquipmentType;
  equipmentLabel: string;
  bodyPart: string;
  equipment: string;
  aliases: string[];
}
