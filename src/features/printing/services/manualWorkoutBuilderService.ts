import type { ExerciseCatalogOption } from "../../exercise-catalog";
import type { SnapshotBuilderHistory } from "./snapshotBuilderService";

export const createManualWorkoutBuilderHistory = (
  exercise: ExerciseCatalogOption,
  _condition: { targetFatigue?: "LOW" | "NORMAL" | "HIGH" | null; condition?: "GOOD" | "NORMAL" | "BAD" | null; sleep?: "ENOUGH" | "NORMAL" | "LACK" | null; alcohol?: "YES" | "NO" | null },
): SnapshotBuilderHistory => ({
  past: [], future: [], present: {
    title: "직접 구성 운동", category: "CUSTOM", difficulty: "GENERAL", memo: "", favorite: false,
    exercises: [{ id: crypto.randomUUID(), name: exercise.name, displayName: exercise.displayName ?? exercise.name, catalogExerciseId: exercise.id, sets: 4, plannedSets: 4, reps: "", weight: "0", restSeconds: 60, memo: "", order: 1 }],
  },
});
