import type { ExerciseCatalogItem } from "../../exercise-catalog";

export interface ResolveRequest {
  text: string;
  catalog: ExerciseCatalogItem[];
}

export type ResolveStatus = "resolved" | "ambiguous" | "unknown";

export interface ResolveResult {
  status: ResolveStatus;
  exercise: ExerciseCatalogItem | null;
  confidence: number;
  matchedAlias: string | null;
  normalizedText: string;
  candidateExercises: ExerciseCatalogItem[];
  reason: string;
}

export interface BatchResolveRequest {
  texts: string[];
  catalog: ExerciseCatalogItem[];
}
