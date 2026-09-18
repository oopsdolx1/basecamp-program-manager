import type { SnapshotBuilderExercise } from "../../printing/services/snapshotBuilderService";
import type { WorkoutSessionExerciseSnapshot } from "../domain/workoutSession.types";

export const mapSessionPrescriptionExercises = (exercises: SnapshotBuilderExercise[], resolved: Map<string, { id: string; name: string }>): WorkoutSessionExerciseSnapshot[] =>
  exercises.map((exercise) => ({ exerciseId: resolved.get(exercise.id)?.id ?? exercise.catalogExerciseId ?? exercise.id, programExerciseId: exercise.id, name: resolved.get(exercise.id)?.name ?? exercise.name, order: exercise.order, plannedSets: exercise.plannedSets, memo: exercise.memo }));
