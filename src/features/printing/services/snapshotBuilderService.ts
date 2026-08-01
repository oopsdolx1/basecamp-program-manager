import type { Program, ProgramFormValues } from "../../programs/types/program.types";
import type { ExerciseCatalogOption } from "../../exercise-catalog";

export interface SnapshotBuilderExercise {
  id: string;
  name: string;
  displayName: string;
  catalogExerciseId?: string;
  sets: number;
  reps: string;
  weight: string;
  restSeconds: number;
  memo: string;
  order: number;
}

export interface SnapshotBuilderState {
  title: string;
  category: ProgramFormValues["category"];
  difficulty: ProgramFormValues["difficulty"];
  memo: string;
  favorite: boolean;
  exercises: SnapshotBuilderExercise[];
}

export interface SnapshotBuilderHistory {
  past: SnapshotBuilderState[];
  present: SnapshotBuilderState;
  future: SnapshotBuilderState[];
}

const HISTORY_LIMIT = 10;
const cloneState = (state: SnapshotBuilderState): SnapshotBuilderState => ({
  ...state,
  exercises: state.exercises.map((exercise) => ({ ...exercise })),
});

const clampSets = (value: number): number => Math.max(1, Math.floor(value));
const clampNonNegativeNumberString = (value: string): string => {
  if (!value.trim()) return "0";
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : "0";
};

const reorder = (exercises: SnapshotBuilderExercise[]): SnapshotBuilderExercise[] =>
  exercises.map((exercise, index) => ({ ...exercise, order: index + 1 }));

const pushHistory = (history: SnapshotBuilderHistory, next: SnapshotBuilderState): SnapshotBuilderHistory => ({
  past: [...history.past, cloneState(history.present)].slice(-HISTORY_LIMIT),
  present: cloneState(next),
  future: [],
});

const patchExerciseMemo = (exercise: SnapshotBuilderExercise, text: string): SnapshotBuilderExercise => ({
  ...exercise,
  memo: [exercise.memo.trim(), text].filter(Boolean).join(" | "),
});

export const createSnapshotBuilderState = (program: Program): SnapshotBuilderState => ({
  title: program.title,
  category: program.category,
  difficulty: program.difficulty ?? "GENERAL",
  memo: program.memo ?? "",
  favorite: program.favorite,
  exercises: reorder(
    program.exercises.map((exercise) => ({
      id: crypto.randomUUID(),
      name: exercise.name,
      displayName: exercise.displayName ?? exercise.name,
      catalogExerciseId: exercise.catalogExerciseId,
      sets: clampSets(exercise.sets),
      reps: "",
      weight: "0",
      restSeconds: 60,
      memo: exercise.memo ?? "",
      order: exercise.order,
    })),
  ),
});

export const createSnapshotBuilderHistory = (program: Program): SnapshotBuilderHistory => ({
  past: [],
  present: createSnapshotBuilderState(program),
  future: [],
});

export const snapshotBuilderService = {
  updateMeta(history: SnapshotBuilderHistory, patch: Partial<Omit<SnapshotBuilderState, "exercises">>): SnapshotBuilderHistory {
    return pushHistory(history, { ...history.present, ...patch });
  },
  replaceExercise(history: SnapshotBuilderHistory, exerciseId: string, option: ExerciseCatalogOption | string): SnapshotBuilderHistory {
    const next = cloneState(history.present);
    next.exercises = next.exercises.map((exercise) => {
      if (exercise.id !== exerciseId) return exercise;
      if (typeof option === "string") {
        return { ...exercise, name: option, displayName: option, catalogExerciseId: undefined };
      }
      return { ...exercise, name: option.name, displayName: option.displayName, catalogExerciseId: option.id };
    });
    return pushHistory(history, next);
  },
  patchExercise(history: SnapshotBuilderHistory, exerciseId: string, patch: Partial<SnapshotBuilderExercise>): SnapshotBuilderHistory {
    const next = cloneState(history.present);
    next.exercises = next.exercises.map((exercise) =>
      exercise.id === exerciseId
        ? {
            ...exercise,
            ...patch,
            sets: patch.sets !== undefined ? clampSets(patch.sets) : exercise.sets,
            weight: patch.weight !== undefined ? clampNonNegativeNumberString(patch.weight) : exercise.weight,
            restSeconds: patch.restSeconds !== undefined ? Math.max(0, Math.floor(patch.restSeconds)) : exercise.restSeconds,
          }
        : exercise,
    );
    return pushHistory(history, { ...next, exercises: reorder(next.exercises) });
  },
  move(history: SnapshotBuilderHistory, exerciseId: string, direction: "up" | "down"): SnapshotBuilderHistory {
    const next = cloneState(history.present);
    const index = next.exercises.findIndex((exercise) => exercise.id === exerciseId);
    if (index < 0) return history;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= next.exercises.length) return history;
    const items = [...next.exercises];
    const [moved] = items.splice(index, 1);
    items.splice(targetIndex, 0, moved);
    next.exercises = reorder(items);
    return pushHistory(history, next);
  },
  duplicate(history: SnapshotBuilderHistory, exerciseId: string): SnapshotBuilderHistory {
    const next = cloneState(history.present);
    const index = next.exercises.findIndex((exercise) => exercise.id === exerciseId);
    if (index < 0) return history;
    const duplicate = { ...next.exercises[index], id: crypto.randomUUID() };
    next.exercises.splice(index + 1, 0, duplicate);
    next.exercises = reorder(next.exercises);
    return pushHistory(history, next);
  },
  remove(history: SnapshotBuilderHistory, exerciseId: string): SnapshotBuilderHistory {
    if (history.present.exercises.length <= 1) return history;
    const next = cloneState(history.present);
    next.exercises = reorder(next.exercises.filter((exercise) => exercise.id !== exerciseId));
    return pushHistory(history, next);
  },
  addBlank(history: SnapshotBuilderHistory): SnapshotBuilderHistory {
    const next = cloneState(history.present);
    next.exercises.push({
      id: crypto.randomUUID(),
      name: "",
      displayName: "",
      sets: 1,
      reps: "",
      weight: "0",
      restSeconds: 60,
      memo: "",
      order: next.exercises.length + 1,
    });
    next.exercises = reorder(next.exercises);
    return pushHistory(history, next);
  },
  applyPreset(history: SnapshotBuilderHistory, exerciseId: string, preset: string): SnapshotBuilderHistory {
    const presets: Record<string, (exercise: SnapshotBuilderExercise) => SnapshotBuilderExercise> = {
      plus_set: (exercise) => ({ ...exercise, sets: exercise.sets + 1 }),
      minus_set: (exercise) => ({ ...exercise, sets: Math.max(1, exercise.sets - 1) }),
      reps_8_10: (exercise) => ({ ...exercise, reps: "8~10" }),
      reps_10_12: (exercise) => ({ ...exercise, reps: "10~12" }),
      reps_12_15: (exercise) => ({ ...exercise, reps: "12~15" }),
      reps_15_20: (exercise) => ({ ...exercise, reps: "15~20" }),
      failure: (exercise) => patchExerciseMemo({ ...exercise, reps: "Failure" }, "Failure"),
      drop_set: (exercise) => patchExerciseMemo(exercise, "Drop Set"),
      super_set: (exercise) => patchExerciseMemo(exercise, "Super Set"),
      tempo: (exercise) => patchExerciseMemo(exercise, "Tempo"),
      rest_pause: (exercise) => patchExerciseMemo(exercise, "Rest Pause"),
    };
    const transform = presets[preset];
    if (!transform) return history;
    const next = cloneState(history.present);
    next.exercises = next.exercises.map((exercise) => (exercise.id === exerciseId ? transform(exercise) : exercise));
    next.exercises = reorder(next.exercises);
    return pushHistory(history, next);
  },
  applyGlobal(history: SnapshotBuilderHistory, action: string, sourceProgram: Program): SnapshotBuilderHistory {
    const next = cloneState(history.present);
    switch (action) {
      case "sets_plus":
        next.exercises = next.exercises.map((exercise) => ({ ...exercise, sets: exercise.sets + 1 }));
        break;
      case "sets_minus":
        next.exercises = next.exercises.map((exercise) => ({ ...exercise, sets: Math.max(1, exercise.sets - 1) }));
        break;
      case "rest_plus":
        next.exercises = next.exercises.map((exercise) => ({ ...exercise, restSeconds: exercise.restSeconds + 30 }));
        break;
      case "rest_minus":
        next.exercises = next.exercises.map((exercise) => ({ ...exercise, restSeconds: Math.max(0, exercise.restSeconds - 30) }));
        break;
      case "clear_memo":
        next.memo = "";
        next.exercises = next.exercises.map((exercise) => ({ ...exercise, memo: "" }));
        break;
      case "restore":
        return createSnapshotBuilderHistory(sourceProgram);
      default:
        return history;
    }
    return pushHistory(history, next);
  },
  undo(history: SnapshotBuilderHistory): SnapshotBuilderHistory {
    const previous = history.past.length > 0 ? history.past[history.past.length - 1] : undefined;
    if (!previous) return history;
    return {
      past: history.past.slice(0, -1),
      present: cloneState(previous),
      future: [cloneState(history.present), ...history.future].slice(0, HISTORY_LIMIT),
    };
  },
  redo(history: SnapshotBuilderHistory): SnapshotBuilderHistory {
    const [next, ...future] = history.future;
    if (!next) return history;
    return {
      past: [...history.past, cloneState(history.present)].slice(-HISTORY_LIMIT),
      present: cloneState(next),
      future,
    };
  },
  canUndo(history: SnapshotBuilderHistory): boolean {
    return history.past.length > 0;
  },
  canRedo(history: SnapshotBuilderHistory): boolean {
    return history.future.length > 0;
  },
  toProgramFormValues(state: SnapshotBuilderState): ProgramFormValues {
    return {
      title: state.title.trim(),
      category: state.category,
      difficulty: state.difficulty,
      memo: state.memo.trim(),
      favorite: state.favorite,
      exercises: state.exercises.map((exercise, index) => ({
        id: exercise.id,
        name: exercise.name.trim(),
        displayName: exercise.displayName.trim() || exercise.name.trim(),
        catalogExerciseId: exercise.catalogExerciseId,
        sets: clampSets(exercise.sets),
        memo: [exercise.memo.trim(), exercise.reps ? `Reps ${exercise.reps}` : "", exercise.weight !== "0" ? `Weight ${exercise.weight}` : "", exercise.restSeconds > 0 ? `Rest ${exercise.restSeconds}s` : ""].filter(Boolean).join(" | "),
        order: index + 1,
      })),
    };
  },
};

