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

const categoryAliases: Record<string, ProgramCategory> = {
  full_body: "FULL_BODY",
  "전신": "FULL_BODY",
  chest: "CHEST",
  "가슴": "CHEST",
  back: "BACK",
  "등": "BACK",
  lower_body: "LOWER_BODY",
  "하체": "LOWER_BODY",
  shoulder: "SHOULDER",
  "어깨": "SHOULDER",
  arms: "ARMS",
  arm: "ARMS",
  "팔": "ARMS",
  recovery: "RECOVERY",
  "리커버리": "RECOVERY",
  "회복": "RECOVERY",
  etc: "ETC",
  "기타": "ETC",
  custom: "CUSTOM",
  "직접작성": "CUSTOM",
};

/** Converts persisted display labels and legacy values to the program domain key. */
export const normalizeProgramCategory = (value: unknown): ProgramCategory | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const canonical = trimmed.toUpperCase();
  if (programCategories.some((option) => option.value === canonical)) return canonical as ProgramCategory;
  return categoryAliases[trimmed.toLocaleLowerCase("ko-KR")] ?? null;
};

export const getDifficultyLabel = (difficulty?: ProgramDifficulty): string =>
  difficulty ? programDifficulties.find((option) => option.value === difficulty)?.label ?? difficulty : "공통";
