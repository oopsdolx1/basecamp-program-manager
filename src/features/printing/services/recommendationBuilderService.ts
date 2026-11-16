import type { SnapshotBuilderExercise, SnapshotBuilderHistory } from "./snapshotBuilderService";

/** Trainer recommendation as served to the Kiosk (`GET /v1/kiosk/session/workout-programs`). */
export interface RecommendedProgramExercise {
  exerciseId: string;
  name: string;
  order: number;
  plannedSets: number;
  memo?: string;
}

export interface RecommendedProgram {
  id: string;
  name: string;
  isDefault: boolean;
  exercises: RecommendedProgramExercise[];
}

const orderedExercises = (program: RecommendedProgram): RecommendedProgramExercise[] =>
  [...program.exercises].sort((left, right) => left.order - right.order);

/**
 * Copies a Trainer recommendation into the existing snapshot builder (same shape as
 * createManualWorkoutBuilderHistory). The recommendation itself is never referenced afterwards,
 * so editing the builder cannot change the original.
 */
export const createRecommendationBuilderHistory = (program: RecommendedProgram): SnapshotBuilderHistory => ({
  past: [],
  future: [],
  present: {
    title: program.name,
    category: "CUSTOM",
    difficulty: "GENERAL",
    memo: "",
    favorite: false,
    exercises: orderedExercises(program).map((exercise, index): SnapshotBuilderExercise => ({
      id: crypto.randomUUID(),
      name: exercise.name,
      displayName: exercise.name,
      catalogExerciseId: exercise.exerciseId,
      sets: exercise.plannedSets,
      plannedSets: exercise.plannedSets,
      reps: "",
      weight: "0",
      restSeconds: 60,
      memo: exercise.memo ?? "",
      order: index + 1,
    })),
  },
});

/** True when the member changed exercises, order, planned sets or memo before printing. */
export const isRecommendationEdited = (program: RecommendedProgram, exercises: SnapshotBuilderExercise[]): boolean => {
  const original = orderedExercises(program);
  if (original.length !== exercises.length) return true;
  return [...exercises].sort((left, right) => left.order - right.order).some((exercise, index) => {
    const source = original[index];
    return exercise.catalogExerciseId !== source.exerciseId || exercise.plannedSets !== source.plannedSets || exercise.memo.trim() !== (source.memo ?? "").trim();
  });
};
