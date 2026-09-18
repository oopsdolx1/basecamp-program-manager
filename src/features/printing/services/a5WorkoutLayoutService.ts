export type A5WorkoutLayoutDensity = "invalid" | "relaxed" | "compact" | "dense";

export interface A5WorkoutLayout {
  density: A5WorkoutLayoutDensity;
  exerciseCount: number;
  minimumRowCount: number;
  topBindingSafeAreaMm: 14;
  showExerciseMemo: true;
}

export const A5_WORKOUT_TOP_BINDING_SAFE_AREA_MM = 14 as const;

export const resolveA5WorkoutLayout = (exerciseCount: number): A5WorkoutLayout => {
  const count = Math.max(0, Math.floor(exerciseCount));
  if (count === 0) return { density: "invalid", exerciseCount: 0, minimumRowCount: 0, topBindingSafeAreaMm: A5_WORKOUT_TOP_BINDING_SAFE_AREA_MM, showExerciseMemo: true };
  if (count <= 4) return { density: "relaxed", exerciseCount: count, minimumRowCount: 4, topBindingSafeAreaMm: A5_WORKOUT_TOP_BINDING_SAFE_AREA_MM, showExerciseMemo: true };
  if (count <= 7) return { density: "compact", exerciseCount: count, minimumRowCount: 7, topBindingSafeAreaMm: A5_WORKOUT_TOP_BINDING_SAFE_AREA_MM, showExerciseMemo: true };
  return { density: "dense", exerciseCount: count, minimumRowCount: Math.max(9, count), topBindingSafeAreaMm: A5_WORKOUT_TOP_BINDING_SAFE_AREA_MM, showExerciseMemo: true };
};
