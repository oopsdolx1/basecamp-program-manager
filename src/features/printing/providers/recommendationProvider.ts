import type { ProfileId } from "../../../types/brandedIds";
import type { MemberProfile } from "./memberProvider";
import type { WorkoutHistoryRecord } from "./workoutHistoryProvider";
import type {
  ConditionInput,
  MemberIntelligenceMetadata,
  MemberIntelligenceSummary,
  PeriodizationSummary,
  RecentWorkoutSummary,
} from "../types/condition.types";

export interface RecommendationContext {
  memberProfile: MemberProfile | null;
  workoutHistory: WorkoutHistoryRecord[];
  recentWorkout: RecentWorkoutSummary | null;
  intelligence: MemberIntelligenceSummary | null;
  metadata: MemberIntelligenceMetadata | null;
  periodization?: PeriodizationSummary | null;
}

export interface RecommendationProvider {
  getRecommendationContext: (memberId: ProfileId, condition: ConditionInput) => Promise<RecommendationContext>;
}
