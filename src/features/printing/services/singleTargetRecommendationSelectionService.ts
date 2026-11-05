import type { Program } from "../../programs/types/program.types";

export const getSingleTargetRecommendationAlternatives = (rankedPrograms: Array<{ program: Program }>, selectedProgramId: Program["id"]) => rankedPrograms
  .map(({ program }, index) => ({ program, rank: index + 1 }))
  .filter(({ program }) => program.id !== selectedProgramId)
  .slice(0, 2);
