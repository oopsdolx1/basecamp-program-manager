import type { ProfileId } from "../../../types/brandedIds";
import { analyzeMemberIntelligence } from "../services/memberIntelligenceService";
import { analyzePeriodization } from "../services/periodizationEngine";
import type { ConditionInput } from "../types/condition.types";
import type { MemberProvider } from "./memberProvider";
import type { RecommendationContext, RecommendationProvider } from "./recommendationProvider";
import type { WorkoutHistoryProvider } from "./workoutHistoryProvider";

export const createRecommendationProvider = (
  memberProvider: MemberProvider,
  workoutHistoryProvider: WorkoutHistoryProvider,
): RecommendationProvider => ({
  async getRecommendationContext(memberId: ProfileId, condition: ConditionInput): Promise<RecommendationContext> {
    const [memberProfile, workoutHistory] = await Promise.all([
      memberProvider.getMemberProfile(memberId),
      workoutHistoryProvider.getRecentWorkoutHistory(memberId, 20),
    ]);

    const intelligenceResult = analyzeMemberIntelligence(workoutHistory, condition);
    const periodization = analyzePeriodization({
      intelligence: intelligenceResult.summary,
      history: intelligenceResult.history,
      condition,
    });

    return {
      memberProfile,
      workoutHistory,
      recentWorkout: intelligenceResult.recentWorkout,
      intelligence: intelligenceResult.summary,
      metadata: intelligenceResult.metadata,
      periodization,
    };
  },
});
