import type { MemberSelectionItem } from "../../members/types/memberViewModel.types";
import { getCategoryLabel, getDifficultyLabel } from "../../programs/config/programOptions";
import type { Program } from "../../programs/types/program.types";
import {
  PRINT_EXERCISE_ROW_COUNT,
  PRINT_FORMAT,
  PRINT_TEMPLATE_KEY,
  PRINT_TEMPLATE_VERSION,
} from "../constants/print.constants";
import type { PrintExerciseRow, WorkoutPrintDocument } from "../types/print.types";

export class PrintMapperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrintMapperError";
  }
}

interface CreateWorkoutPrintDocumentParams {
  member: MemberSelectionItem | null;
  program: Program | null;
  printDate?: Date;
}

const truncateText = (value: string, maxLength: number): string =>
  value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 1))}…` : value;

const toRows = (program: Program): PrintExerciseRow[] => {
  if (program.exercises.length > PRINT_EXERCISE_ROW_COUNT) {
    throw new PrintMapperError("운동은 최대 8개까지만 출력할 수 있습니다.");
  }

  const rows: PrintExerciseRow[] = program.exercises
    .map((exercise) => ({
      order: exercise.order,
      exerciseName: truncateText(exercise.name, 34),
      exerciseMemo: truncateText(exercise.memo ?? "", 28),
      configuredSets: exercise.sets,
      isBlank: false,
    }))
    .sort((left, right) => left.order - right.order);

  if (rows.some((row) => !row.exerciseName.trim())) {
    throw new PrintMapperError("운동명이 없는 운동은 출력할 수 없습니다.");
  }

  while (rows.length < PRINT_EXERCISE_ROW_COUNT) {
    rows.push({
      order: rows.length + 1,
      exerciseName: "",
      exerciseMemo: "",
      configuredSets: null,
      isBlank: true,
    });
  }

  return rows;
};

export const createWorkoutPrintDocument = ({
  member,
  program,
  printDate,
}: CreateWorkoutPrintDocumentParams): WorkoutPrintDocument => {
  if (!member) {
    throw new PrintMapperError("회원을 선택해 주세요.");
  }

  if (!program) {
    throw new PrintMapperError("프로그램을 선택해 주세요.");
  }

  if (program.isArchived) {
    throw new PrintMapperError("Archive된 프로그램은 출력할 수 없습니다.");
  }

  const rows = toRows(program);

  return {
    templateKey: PRINT_TEMPLATE_KEY,
    templateVersion: PRINT_TEMPLATE_VERSION,
    format: PRINT_FORMAT,
    member: {
      memberId: member.memberId,
      name: member.displayName,
    },
    program: {
      programId: program.id,
      title: program.title,
      category: program.category,
      categoryLabel: getCategoryLabel(program.category),
      difficulty: program.difficulty ?? "GENERAL",
      difficultyLabel: getDifficultyLabel(program.difficulty),
      memo: truncateText(program.memo ?? "", 120),
      exercises: program.exercises
        .map((exercise) => ({
          id: exercise.id,
          name: truncateText(exercise.name, 34),
          memo: truncateText(exercise.memo ?? "", 28),
          order: exercise.order,
          configuredSets: exercise.sets,
        }))
        .sort((left, right) => left.order - right.order),
    },
    printDate: printDate ?? new Date(),
    rows,
  };
};
