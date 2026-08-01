import type { MemberSelectionItem } from "../../members";
import type { Program, ProgramFormValues } from "../../programs/types/program.types";
import type {
  ConditionInput,
  MemberIntelligenceSummary,
  PeriodizationSummary,
  RecommendationTrace,
  RecentWorkoutSummary,
} from "../types/condition.types";

interface BuildRecommendationPromptParams {
  member: MemberSelectionItem;
  condition: ConditionInput;
  recentWorkout: RecentWorkoutSummary | null;
  intelligence: MemberIntelligenceSummary | null;
  periodization: PeriodizationSummary | null;
  recommendedProgram: Program;
  snapshot: ProgramFormValues;
  ruleReason: string;
  recommendationTrace: RecommendationTrace | null;
}

export const buildRecommendationPrompt = ({
  member,
  condition,
  recentWorkout,
  intelligence,
  periodization,
  recommendedProgram,
  snapshot,
  ruleReason,
  recommendationTrace,
}: BuildRecommendationPromptParams): string =>
  JSON.stringify(
    {
      task: "Return JSON for coaching and snapshot-only adjustments.",
      member: {
        name: member.displayName,
        gender: "unknown",
        age: "unknown",
        status: member.status ?? null,
      },
      todayCondition: condition,
      recentWorkout,
      memberIntelligence: intelligence,
      periodization,
      recommendationTrace: recommendationTrace
        ? {
            selectedProgram: recommendationTrace.selectedProgram,
            finalScore: recommendationTrace.selectedProgram.score,
            decisionFactors: recommendationTrace.decisionFactors.map((factor) => ({
              label: factor.label,
              score: factor.score,
              reason: factor.reason,
            })),
            candidatePrograms: recommendationTrace.candidatePrograms.map((candidate) => ({
              title: candidate.title,
              score: candidate.score,
              selected: candidate.programId === recommendationTrace.selectedProgram.programId,
            })),
            engineVersion: recommendationTrace.engineVersion,
          }
        : null,
      ruleRecommendation: {
        title: recommendedProgram.title,
        category: recommendedProgram.category,
        difficulty: recommendedProgram.difficulty ?? "GENERAL",
        reason: ruleReason,
        exercises: recommendedProgram.exercises.map((exercise) => ({
          name: exercise.name,
          sets: exercise.sets,
          memo: exercise.memo ?? "",
          order: exercise.order,
        })),
      },
      snapshot: {
        title: snapshot.title,
        category: snapshot.category,
        difficulty: snapshot.difficulty,
        memo: snapshot.memo,
        exercises: snapshot.exercises.map((exercise) => ({
          name: exercise.name,
          sets: exercise.sets,
          memo: exercise.memo,
          order: exercise.order,
        })),
      },
      constraints: [
        "JSON only",
        "No new program creation",
        "Do not modify repository",
        "Adjust snapshot only",
        "Periodization and recommendation trace are explanation-only context",
        "Rule recommendation is the final decision",
        "AI must not replace or override the selected program",
        "AI may only explain the recommendation and adjust the editable snapshot within existing constraints",
      ],
    },
    null,
    2,
  );
