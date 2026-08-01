import type { MemberSelectionItem } from "../../members";
import type { Program } from "../../programs/types/program.types";
import type { ProgramFormValues } from "../../programs/types/program.types";
import type { ConditionInput, MemberIntelligenceSummary, PeriodizationSummary, RecentWorkoutSummary } from "../types/condition.types";

interface BuildRecommendationPromptParams {
  member: MemberSelectionItem;
  condition: ConditionInput;
  recentWorkout: RecentWorkoutSummary | null;
  intelligence: MemberIntelligenceSummary | null;
  periodization: PeriodizationSummary | null;
  recommendedProgram: Program;
  snapshot: ProgramFormValues;
  ruleReason: string;
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
        "Periodization is context for explanation only",
        "AI explains and coaches but does not override rule ownership",
      ],
    },
    null,
    2,
  );
