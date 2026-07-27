import { useState } from "react";
import {
  createBlankExercise,
  createInitialProgramFormValues,
  reorderExercises,
  sanitizeProgramForm,
  validateProgramForm,
} from "../services/programService";
import type { ProgramFormValues } from "../types/program.types";

export const useProgramForm = (initialValues?: ProgramFormValues) => {
  const [values, setValues] = useState<ProgramFormValues>(
    initialValues ?? createInitialProgramFormValues(),
  );

  const validation = validateProgramForm(values);

  const update = <TKey extends keyof ProgramFormValues>(key: TKey, value: ProgramFormValues[TKey]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const addExercise = () =>
    setValues((current) => {
      if (current.exercises.length >= 8) {
        return current;
      }

      return {
        ...current,
        exercises: [...current.exercises, createBlankExercise(current.exercises.length + 1)],
      };
    });

  const updateExercise = (exerciseId: string, patch: Partial<ProgramFormValues["exercises"][number]>) =>
    setValues((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, ...patch } : exercise,
      ),
    }));

  const removeExercise = (exerciseId: string) =>
    setValues((current) => ({
      ...current,
      exercises: reorderExercises(current.exercises.filter((exercise) => exercise.id !== exerciseId)),
    }));

  const reorder = (activeId: string, overId: string) =>
    setValues((current) => {
      const activeIndex = current.exercises.findIndex((exercise) => exercise.id === activeId);
      const overIndex = current.exercises.findIndex((exercise) => exercise.id === overId);

      if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
        return current;
      }

      const next = [...current.exercises];
      const [moved] = next.splice(activeIndex, 1);
      next.splice(overIndex, 0, moved);

      return {
        ...current,
        exercises: reorderExercises(next),
      };
    });

  return {
    values,
    validation,
    update,
    addExercise,
    updateExercise,
    removeExercise,
    reorder,
    sanitizedValues: sanitizeProgramForm(values),
  };
};
