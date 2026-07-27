import type { ProgramCategory, ProgramDifficulty } from "../types/program.types";

export interface ProgramOption<TValue extends string> {
  value: TValue;
  label: string;
}

export const programCategories: Array<ProgramOption<ProgramCategory>> = [
  { value: "FULL_BODY", label: "전신" },
  { value: "CHEST", label: "가슴" },
  { value: "BACK", label: "등" },
  { value: "LOWER_BODY", label: "하체" },
  { value: "SHOULDER", label: "어깨" },
  { value: "ARMS", label: "팔" },
  { value: "RECOVERY", label: "회복" },
  { value: "ETC", label: "기타" },
  { value: "CUSTOM", label: "직접작성" },
];

export const programDifficulties: Array<ProgramOption<ProgramDifficulty>> = [
  { value: "GENERAL", label: "공통" },
  { value: "BEGINNER", label: "초급" },
  { value: "INTERMEDIATE", label: "중급" },
  { value: "ADVANCED", label: "고급" },
];

export const getCategoryLabel = (category: ProgramCategory): string =>
  programCategories.find((option) => option.value === category)?.label ?? category;

export const getDifficultyLabel = (difficulty?: ProgramDifficulty): string =>
  difficulty ? programDifficulties.find((option) => option.value === difficulty)?.label ?? difficulty : "공통";
