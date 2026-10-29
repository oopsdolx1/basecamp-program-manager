export type A5WorkoutLayoutDensity = "invalid" | "standard";
export type A5WorkoutSetLayout = "four-set-with-note" | "five-set";

export interface A5WorkoutLayout {
  density: A5WorkoutLayoutDensity;
  exerciseCount: number;
  minimumRowCount: number;
  topBindingSafeAreaMm: 14;
  showExerciseMemo: boolean;
  setLayout: A5WorkoutSetLayout;
}

export const A5_WORKOUT_TOP_BINDING_SAFE_AREA_MM = 14 as const;

export const resolveA5WorkoutLayout = (exerciseCount: number, configuredSets: Array<number | null> = []): A5WorkoutLayout => {
  const count = Math.max(0, Math.floor(exerciseCount));
  const setLayout: A5WorkoutSetLayout = configuredSets.some((sets) => sets === 5) ? "five-set" : "four-set-with-note";
  if (count === 0) return { density: "invalid", exerciseCount: 0, minimumRowCount: 0, topBindingSafeAreaMm: A5_WORKOUT_TOP_BINDING_SAFE_AREA_MM, showExerciseMemo: setLayout === "four-set-with-note", setLayout };
  return {
    density: "standard",
    exerciseCount: count,
    // Preserve every real exercise and reserve two handwritten additions, up to
    // the A5 template's eight-row physical limit.
    minimumRowCount: Math.min(count + 2, 8),
    topBindingSafeAreaMm: A5_WORKOUT_TOP_BINDING_SAFE_AREA_MM,
    showExerciseMemo: setLayout === "four-set-with-note",
    setLayout,
  };
};
