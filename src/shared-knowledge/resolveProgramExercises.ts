import type { Program } from "../features/programs/types/program.types";
import { programManagerRuntime } from "./programManagerRuntime";
import { resolveProgramExerciseKnowledgeFromCatalog, type ResolvedExerciseKnowledge } from "./programExerciseMetadata";

export { hydrateProgramExerciseKnowledge, resolveProgramExerciseKnowledgeFromCatalog, type ResolvedExerciseKnowledge } from "./programExerciseMetadata";

export const resolveProgramExerciseKnowledge = (program: Program): Map<string, ResolvedExerciseKnowledge> =>
  resolveProgramExerciseKnowledgeFromCatalog(program, programManagerRuntime.getAll());
