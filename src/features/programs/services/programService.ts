import { normalizeSearchText, normalizeText } from "../../../utils/normalizeText";
import type { Program, ProgramFormExercise, ProgramFormValues } from "../types/program.types";
import { PROGRAM_EXERCISE_LIMIT, PROGRAM_EXERCISE_MIN } from "../types/program.types";
import type { ProgramFilters, ProgramListItem } from "../types/programViewModel.types";
import { toProgramListItem } from "../mappers/programMapper";

export interface ProgramValidationResult {
  valid: boolean;
  errors: string[];
}

export const createBlankExercise = (order: number): ProgramFormExercise => ({
  id: crypto.randomUUID(),
  name: "",
  sets: 1,
  memo: "",
  order,
  catalogExerciseId: undefined,
  displayName: "",
});

export const createInitialProgramFormValues = (): ProgramFormValues => ({
  title: "",
  category: "FULL_BODY",
  difficulty: "GENERAL",
  memo: "",
  favorite: false,
  exercises: [createBlankExercise(1)],
});

export const reorderExercises = (exercises: ProgramFormExercise[]): ProgramFormExercise[] =>
  exercises.map((exercise, index) => ({
    ...exercise,
    order: index + 1,
    name: exercise.name.trim(),
    memo: exercise.memo.trim(),
    sets: Math.max(1, Math.floor(exercise.sets)),
  }));

export const validateProgramForm = (values: ProgramFormValues): ProgramValidationResult => {
  const errors: string[] = [];
  const exercises = reorderExercises(values.exercises).filter((exercise) => exercise.name);

  if (!values.title.trim()) {
    errors.push("프로그램 제목을 입력해 주세요.");
  }

  if (!values.category) {
    errors.push("카테고리를 선택해 주세요.");
  }

  if (exercises.length < PROGRAM_EXERCISE_MIN) {
    errors.push("운동을 1개 이상 입력해 주세요.");
  }

  if (exercises.length > PROGRAM_EXERCISE_LIMIT) {
    errors.push("운동은 최대 8개까지 저장할 수 있습니다.");
  }

  if (exercises.some((exercise) => !exercise.name.trim())) {
    errors.push("운동명을 확인해 주세요.");
  }

  if (exercises.some((exercise) => exercise.order < 1)) {
    errors.push("운동 순서를 확인해 주세요.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const sanitizeProgramForm = (values: ProgramFormValues): ProgramFormValues => ({
  ...values,
  title: values.title.trim(),
  memo: values.memo.trim(),
  exercises: reorderExercises(values.exercises.filter((exercise) => exercise.name.trim())).slice(
    0,
    PROGRAM_EXERCISE_LIMIT,
  ),
});

export const createCopyTitle = (sourceTitle: string, programs: Program[]): string => {
  const baseTitle = sourceTitle.replace(/\s+\(복사\d*\)$/u, "");
  const existingTitles = new Set(programs.map((program) => program.title));
  const firstCopy = `${baseTitle} (복사)`;

  if (!existingTitles.has(firstCopy)) {
    return firstCopy;
  }

  let copyIndex = 2;
  while (existingTitles.has(`${baseTitle} (복사${copyIndex})`)) {
    copyIndex += 1;
  }

  return `${baseTitle} (복사${copyIndex})`;
};

const newestTime = (program: Program): number =>
  program.lastUsedAt?.getTime() || program.updatedAt.getTime() || 0;

export const sortPrograms = (programs: Program[], favoriteFirst: boolean): Program[] =>
  [...programs].sort((left, right) => {
    if (favoriteFirst && left.favorite !== right.favorite) {
      return left.favorite ? -1 : 1;
    }

    const recentDiff = newestTime(right) - newestTime(left);
    if (recentDiff !== 0) {
      return recentDiff;
    }

    const updatedDiff = right.updatedAt.getTime() - left.updatedAt.getTime();
    if (!favoriteFirst && updatedDiff !== 0) {
      return updatedDiff;
    }

    return left.title.localeCompare(right.title, "ko-KR", { numeric: true });
  });

export const filterAndMapPrograms = (
  programs: Program[],
  filters: ProgramFilters,
): ProgramListItem[] => {
  const query = normalizeText(filters.query);

  return sortPrograms(programs, filters.favoriteOnly)
    .filter((program) => (filters.includeArchived ? true : !program.isArchived))
    .filter((program) => (filters.category === "ALL" ? true : program.category === filters.category))
    .filter((program) =>
      filters.difficulty === "ALL" ? true : (program.difficulty ?? "GENERAL") === filters.difficulty,
    )
    .filter((program) => (filters.favoriteOnly ? program.favorite : true))
    .filter((program) => {
      if (!query) {
        return true;
      }

      const searchText = normalizeSearchText([
        program.title,
        program.category,
        ...program.exercises.map((exercise) => exercise.name),
      ]);
      return searchText.includes(query);
    })
    .map(toProgramListItem);
};
