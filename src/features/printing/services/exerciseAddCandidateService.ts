import type { ExerciseCatalogOption } from "../../exercise-catalog";
import { evaluateExerciseAdd, snapshotBuilderService, type ExerciseAddEligibility, type SnapshotBuilderExercise, type SnapshotBuilderHistory } from "./snapshotBuilderService";

export interface ExerciseAddCandidate {
  candidate: ExerciseCatalogOption;
  eligibility: ExerciseAddEligibility;
}

export const buildExerciseAddCandidates = (
  catalogOptions: ExerciseCatalogOption[],
  existingExercises: SnapshotBuilderExercise[],
): ExerciseAddCandidate[] =>
  catalogOptions.map((candidate) => ({
    candidate,
    eligibility: evaluateExerciseAdd(existingExercises, candidate),
  }));

export const addExerciseBatch = (
  history: SnapshotBuilderHistory,
  candidates: ExerciseCatalogOption[],
  maximumExercises = 8,
): SnapshotBuilderHistory => {
  let next = history;
  for (const candidate of candidates) {
    if (next.present.exercises.length >= maximumExercises) break;
    next = snapshotBuilderService.addExercise(next, candidate).history;
  }
  return next;
};
