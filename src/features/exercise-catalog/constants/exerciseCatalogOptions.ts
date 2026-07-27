import type { EquipmentType, ExerciseCategory, PrimaryMuscle } from "../domain/exerciseCatalog.types";

export const exerciseCategories: Array<{ value: ExerciseCategory; label: string }> = [
  { value: "chest", label: "가슴" },
  { value: "back", label: "등" },
  { value: "shoulder", label: "어깨" },
  { value: "arm", label: "팔" },
  { value: "lower_body", label: "하체" },
  { value: "full_body", label: "전신" },
  { value: "core", label: "코어" },
  { value: "cardio", label: "유산소" },
  { value: "recovery", label: "회복" },
  { value: "mobility", label: "모빌리티" },
  { value: "other", label: "기타" },
];

export const primaryMuscles: Array<{ value: PrimaryMuscle; label: string }> = [
  { value: "chest", label: "가슴" },
  { value: "upper_back", label: "상부 등" },
  { value: "lats", label: "광배" },
  { value: "traps", label: "승모" },
  { value: "rear_delts", label: "후면 어깨" },
  { value: "front_delts", label: "전면 어깨" },
  { value: "side_delts", label: "측면 어깨" },
  { value: "biceps", label: "이두" },
  { value: "triceps", label: "삼두" },
  { value: "forearm", label: "전완" },
  { value: "glutes", label: "둔근" },
  { value: "quadriceps", label: "대퇴사두" },
  { value: "hamstrings", label: "햄스트링" },
  { value: "calves", label: "종아리" },
  { value: "abs", label: "복근" },
  { value: "obliques", label: "복사근" },
  { value: "hip_flexors", label: "고관절 굴곡근" },
  { value: "full_body", label: "전신" },
  { value: "other", label: "기타" },
];

export const equipmentTypes: Array<{ value: EquipmentType; label: string }> = [
  { value: "barbell", label: "바벨" },
  { value: "dumbbell", label: "덤벨" },
  { value: "machine", label: "머신" },
  { value: "cable", label: "케이블" },
  { value: "bodyweight", label: "맨몸" },
  { value: "kettlebell", label: "케틀벨" },
  { value: "smith", label: "스미스" },
  { value: "resistance_band", label: "밴드" },
  { value: "medicine_ball", label: "메디신볼" },
  { value: "cardio_machine", label: "유산소 머신" },
  { value: "other", label: "기타" },
];

const labelFor = <T extends string>(items: Array<{ value: T; label: string }>, fallback: string) =>
  (value: T): string => items.find((item) => item.value === value)?.label ?? fallback;

export const getExerciseCategoryLabel = labelFor(exerciseCategories, "기타");
export const getPrimaryMuscleLabel = labelFor(primaryMuscles, "기타");
export const getEquipmentTypeLabel = labelFor(equipmentTypes, "기타");
