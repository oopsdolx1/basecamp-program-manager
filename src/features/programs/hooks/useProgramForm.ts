import { useState } from "react";
import {
  createBlankExercise,
  createInitialProgramFormValues,
  reorderExercises,
  sanitizeProgramForm,
  validateProgramForm,
} from "../services/programService";
import type { ProgramFormExercise, ProgramFormValues } from "../types/program.types";

export const useProgramForm = (initialValues?: ProgramFormValues) => {
  const [values, setValues] = useState<ProgramFormValues>(
    initialValues ?? createInitialProgramFormValues(),
  );

  const validation = validateProgramForm(values);

  const update = <TKey extends keyof ProgramFormValues>(key: TKey, value: ProgramFormValues[TKey]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const addExercise = (exercise?: Partial<ProgramFormExercise>) =>
    setValues((current) => {
      const blankIndex = current.exercises.findIndex((item) => !item.name.trim());
      if (exercise && blankIndex >= 0) {
        return {
          ...current,
          exercises: current.exercises.map((item, index) => index === blankIndex ? { ...item, ...exercise } : item),
        };
      }
      if (current.exercises.length >= 8) {
        return current;
      }

      return {
        ...current,
        exercises: [...current.exercises, { ...createBlankExercise(current.exercises.length + 1), ...exercise }],
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

  const moveExercise = (exerciseId: string, direction: "up" | "down") =>
    setValues((current) => {
      const index = current.exercises.findIndex((exercise) => exercise.id === exerciseId);
      const target = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || target < 0 || target >= current.exercises.length) return current;
      const next = [...current.exercises];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, exercises: reorderExercises(next) };
    });

  return {
    values,
    validation,
    update,
    addExercise,
    updateExercise,
    removeExercise,
    reorder,
    moveExercise,
    sanitizedValues: sanitizeProgramForm(values),
  };
};
