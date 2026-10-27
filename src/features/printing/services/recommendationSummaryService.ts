import type { ConditionInput, RecommendationEvidence } from "../types/condition.types";

export type RecommendationCautionSeverity = "mild" | "caution" | "high";

export type RecommendationSummary = {
  confirmations: string[];
  cautions: Array<{ message: string; severity: RecommendationCautionSeverity }>;
};

const isConfirmationEvidence = (evidence: RecommendationEvidence): boolean => evidence.type !== "condition_adjustment";

/**
 * Converts already-calculated recommendation evidence into short kiosk copy.
 * It deliberately does not score or infer recommendation data.
 */
export const buildRecommendationSummary = ({
  condition,
  evidence = [],
}: {
  condition: ConditionInput;
  evidence?: RecommendationEvidence[];
}): RecommendationSummary => {
  const confirmationEvidence = evidence.filter(isConfirmationEvidence);
  const lowFrequency = confirmationEvidence.find((item) => item.type === "low_body_part_frequency");
  const longRest = confirmationEvidence.find((item) => item.type === "body_part_rest_days");
  const confirmations: string[] = [];

  if (lowFrequency && longRest) {
    confirmations.push(`${lowFrequency.description} ${longRest.description}`);
  } else {
    confirmations.push(...confirmationEvidence.slice(0, 2).map((item) => item.description));
  }

  const cautions: RecommendationSummary["cautions"] = [];
  if (condition.targetFatigue === "HIGH") cautions.push({ severity: "high", message: "오늘은 평소보다 중량을 낮추고 세트 사이 휴식 시간을 충분히 확보하세요." });
  if (condition.condition === "BAD") cautions.push({ severity: "high", message: "동작 중 통증이나 불편감이 느껴지면 즉시 중량을 낮추거나 운동을 중단하세요." });
  if (condition.sleep === "LACK") cautions.push({ severity: "caution", message: "집중력과 반응 속도가 떨어질 수 있으니 고중량 동작은 무리하지 마세요." });
  if (condition.alcohol === "YES") cautions.push({ severity: "caution", message: "균형감각과 심박 반응을 고려해 고강도 운동은 피하고 수분을 충분히 섭취하세요." });

  return { confirmations, cautions: cautions.slice(0, 2) };
};
