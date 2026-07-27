import type { ProgramCategory, ProgramDifficulty } from "./program.types";

export interface ProgramListItem {
  id: string;
  title: string;
  category: ProgramCategory;
  categoryLabel: string;
  difficulty?: ProgramDifficulty;
  difficultyLabel: string;
  exerciseCount: number;
  exerciseNames: string[];
  favorite: boolean;
  usageCount: number;
  lastUsedLabel: string;
  updatedAtLabel: string;
  isArchived: boolean;
}

export interface ProgramFilters {
  query: string;
  category: "ALL" | ProgramCategory;
  difficulty: "ALL" | ProgramDifficulty;
  favoriteOnly: boolean;
  includeArchived: boolean;
}
