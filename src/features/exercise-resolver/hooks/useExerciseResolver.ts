import { useMemo } from "react";
import type { ExerciseCatalogItem } from "../../exercise-catalog";
import { resolveExercise, resolveExercises } from "../services/exerciseResolverService";

export const useExerciseResolver = (catalog: ExerciseCatalogItem[]) =>
  useMemo(
    () => ({
      resolve: (text: string) => resolveExercise({ text, catalog }),
      resolveBatch: (texts: string[]) => resolveExercises({ texts, catalog }),
    }),
    [catalog],
  );
