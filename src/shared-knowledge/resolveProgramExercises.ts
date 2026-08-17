import { normalizeText } from "../utils/normalizeText";
import type { Program } from "../features/programs/types/program.types";
import { programManagerRuntime } from "./programManagerRuntime";

export interface ResolvedExerciseKnowledge {
  id: string;
  name: string;
  memberWhy: string;
  bodyPart: string;
}

export const resolveProgramExerciseKnowledge = (program: Program): Map<string, ResolvedExerciseKnowledge> => {
  const all = programManagerRuntime.getAll();
  const bySearchName = new Map(all.flatMap((exercise) =>
    [exercise.name, exercise.englishName, ...exercise.aliases]
      .filter(Boolean)
      .map((value) => [normalizeText(value), exercise] as const),
  ));
  return new Map(program.exercises.map((exercise) => {
    const knowledge = (exercise.catalogExerciseId ? programManagerRuntime.getById(exercise.catalogExerciseId) : null)
      ?? bySearchName.get(normalizeText(exercise.name));
    return [exercise.id, {
      id: knowledge?.id ?? exercise.catalogExerciseId ?? exercise.id,
      name: knowledge?.name ?? exercise.name,
      memberWhy: knowledge?.memberWhy ?? "",
      bodyPart: knowledge?.bodyPart ?? "",
    }];
  }));
};

export const hydrateProgramExerciseKnowledge = (programs: Program[]): Program[] => programs.map((program) => {
  const resolved = resolveProgramExerciseKnowledge(program);
  return {
    ...program,
    exercises: program.exercises.map((exercise) => ({
      ...exercise,
      name: resolved.get(exercise.id)?.name ?? exercise.name,
      displayName: resolved.get(exercise.id)?.name ?? exercise.displayName,
    })),
  };
});
