export type A5WorkoutLayoutDensity = "invalid" | "standard";

export interface A5WorkoutLayout {
  density: A5WorkoutLayoutDensity;
  exerciseCount: number;
  minimumRowCount: number;
  topBindingSafeAreaMm: 14;
  showExerciseMemo: false;
}

export const A5_WORKOUT_TOP_BINDING_SAFE_AREA_MM = 14 as const;

export const resolveA5WorkoutLayout = (exerciseCount: number): A5WorkoutLayout => {
  const count = Math.max(0, Math.floor(exerciseCount));
  if (count === 0) return { density: "invalid", exerciseCount: 0, minimumRowCount: 0, topBindingSafeAreaMm: A5_WORKOUT_TOP_BINDING_SAFE_AREA_MM, showExerciseMemo: false };
  return { density: "standard", exerciseCount: count, minimumRowCount: 8, topBindingSafeAreaMm: A5_WORKOUT_TOP_BINDING_SAFE_AREA_MM, showExerciseMemo: false };
};
