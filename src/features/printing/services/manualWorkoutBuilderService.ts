import type { ExerciseCatalogOption } from "../../exercise-catalog";
import { recommendPlannedSets, type SnapshotBuilderHistory } from "./snapshotBuilderService";

export const createManualWorkoutBuilderHistory = (
  exercise: ExerciseCatalogOption,
  condition: Parameters<typeof recommendPlannedSets>[0],
): SnapshotBuilderHistory => ({
  past: [], future: [], present: {
    title: "직접 구성 운동", category: "CUSTOM", difficulty: "GENERAL", memo: "", favorite: false,
    exercises: [{ id: crypto.randomUUID(), name: exercise.name, displayName: exercise.displayName ?? exercise.name, catalogExerciseId: exercise.id, sets: recommendPlannedSets(condition), plannedSets: recommendPlannedSets(condition), reps: "", weight: "0", restSeconds: 60, memo: "", order: 1 }],
  },
});
