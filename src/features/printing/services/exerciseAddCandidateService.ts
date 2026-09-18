import type { ExerciseCatalogOption } from "../../exercise-catalog";
import { evaluateExerciseAdd, type ExerciseAddEligibility, type SnapshotBuilderExercise } from "./snapshotBuilderService";

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
