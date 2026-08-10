import { programManagerRuntime as runtime } from "@basecamp/exercise-knowledge/program-manager";
import type { ExerciseKnowledge, ProgramManagerRuntime } from "@basecamp/exercise-knowledge";

export const programManagerRuntime = runtime as ProgramManagerRuntime;
export type SharedExerciseKnowledge = ExerciseKnowledge;
