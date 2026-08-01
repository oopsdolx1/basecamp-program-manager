import type { ProgramFormValues } from "../../programs/types/program.types";
import type {
  AiRecommendationResult,
  ConditionInput,
  MemberIntelligenceMetadata,
  MemberIntelligenceSummary,
  PeriodizationSummary,
  ProgramSnapshotPayload,
  RecommendationTrace,
  RecentWorkoutSummary,
} from "../types/condition.types";

const STORAGE_KEY = "basecamp.quick-print.snapshot";

export const createSnapshotProgramId = (sourceProgramId: string): string => `snapshot--${sourceProgramId}`;

export const isSnapshotProgramId = (programId: string | null | undefined): boolean =>
  typeof programId === "string" && programId.startsWith("snapshot--");

export const savePrintSnapshot = (input: {
  sourceProgramId: string;
  sourceProgramTitle: string;
  recommendationReasons: string[];
  aiRecommendation: AiRecommendationResult | null;
  intelligence: MemberIntelligenceSummary | null;
  metadata: MemberIntelligenceMetadata | null;
  periodization: PeriodizationSummary | null;
  recommendationTrace: RecommendationTrace | null;
  condition: ConditionInput;
  recentWorkout: RecentWorkoutSummary | null;
  formValues: ProgramFormValues;
}): string => {
  const payload: ProgramSnapshotPayload = {
    sourceProgramId: input.sourceProgramId,
    sourceProgramTitle: input.sourceProgramTitle,
    recommendationReasons: input.recommendationReasons,
    aiRecommendation: input.aiRecommendation,
    intelligence: input.intelligence,
    metadata: input.metadata,
    periodization: input.periodization,
    recommendationTrace: input.recommendationTrace,
    condition: input.condition,
    recentWorkout: input.recentWorkout,
    formValues: input.formValues,
  };

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  return createSnapshotProgramId(input.sourceProgramId);
};

export const loadPrintSnapshot = (): ProgramSnapshotPayload | null => {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw) as ProgramSnapshotPayload;
    return {
      ...payload,
      recommendationTrace: payload.recommendationTrace ?? null,
    };
  } catch {
    return null;
  }
};



