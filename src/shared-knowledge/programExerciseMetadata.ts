import type { Program } from "../features/programs/types/program.types";

export interface ResolvedExerciseKnowledge {
  id: string;
  name: string;
  memberWhy: string;
  bodyPart: string;
  /** A missing catalog item is visible to callers; it is never replaced with another exercise. */
  metadataMissing: boolean;
}

/**
 * Enriches a persisted Program exercise with catalog metadata only.
 *
 * Program exercise identity, prescribed name, order and dosage belong to the Program document.
 * In particular, do not fall back to a catalog name/alias here: aliases are not unique and doing
 * so can silently turn a prescribed exercise into a different one on the recommendation card.
 */
export const resolveProgramExerciseKnowledgeFromCatalog = (program: Program, catalog: ReadonlyArray<{
  id: string;
  memberWhy: string;
  bodyPart: string;
}>): Map<string, ResolvedExerciseKnowledge> => {
  const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]));
  return new Map(program.exercises.map((exercise) => {
    const knowledge = exercise.catalogExerciseId ? byId.get(exercise.catalogExerciseId) : undefined;
    return [exercise.id, {
      id: knowledge?.id ?? exercise.catalogExerciseId ?? exercise.id,
      name: exercise.name,
      memberWhy: knowledge?.memberWhy ?? "",
      bodyPart: knowledge?.bodyPart ?? "",
      metadataMissing: !knowledge,
    }];
  }));
};

/** Runtime hydration may add metadata elsewhere, but may never rewrite the persisted prescription. */
export const hydrateProgramExerciseKnowledge = (programs: Program[]): Program[] => programs.map((program) => ({
  ...program,
  exercises: program.exercises.map((exercise) => ({ ...exercise })),
}));
