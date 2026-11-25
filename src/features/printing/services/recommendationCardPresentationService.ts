import type { SnapshotBuilderExercise } from "./snapshotBuilderService";

/**
 * The recommendation card is a prescription preview, not a Program-template
 * preview. Keep the template's base sets and today's planned sets distinct so
 * the card and the session built from the same snapshot agree.
 */
export interface RecommendationCardExercise {
  id: string;
  name: string;
  order: number;
  baseSets: number;
  plannedSets: number;
}

export const createRecommendationCardExercises = (exercises: SnapshotBuilderExercise[]): RecommendationCardExercise[] =>
  [...exercises]
    .sort((left, right) => left.order - right.order)
    .map((exercise) => ({
      id: exercise.id,
      name: exercise.displayName || exercise.name,
      order: exercise.order,
      baseSets: exercise.sets,
      plannedSets: exercise.plannedSets,
    }));

export const formatRecommendationSets = ({ baseSets, plannedSets }: Pick<RecommendationCardExercise, "baseSets" | "plannedSets">): string =>
  baseSets === plannedSets ? `${plannedSets} SET` : `오늘 ${plannedSets}세트 · 기본 ${baseSets}세트`;
