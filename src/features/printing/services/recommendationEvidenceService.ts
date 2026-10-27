import { getCategoryLabel } from "../../programs/config/programOptions";
import type { Program } from "../../programs/types/program.types";
import type { WorkoutHistoryRecord } from "../providers/workoutHistoryProvider";
import type { ConditionInput, RecommendationEvidence, RecommendationTraceFactor } from "../types/condition.types";

const dayMs = 86_400_000;

export const buildRecommendationEvidence = ({
  factors,
  history,
  program,
  condition,
  now = new Date(),
}: {
  factors: RecommendationTraceFactor[];
  history: WorkoutHistoryRecord[];
  program: Program;
  condition: ConditionInput;
  now?: Date;
}): RecommendationEvidence[] => {
  const selectedFactors = factors.filter((factor) => factor.score !== 0);
  const evidence: RecommendationEvidence[] = [];
  const targetHistory = history.filter((entry) => entry.category === program.category || entry.categories?.includes(program.category));
  const historyFactor = selectedFactors.find((factor) => factor.key === "history");
  if (historyFactor && history.length <= 1) evidence.push({ type: "history_fallback", title: "운동기록이 아직 적어요", description: "최근 운동기록이 충분하지 않아 오늘의 컨디션과 기본 프로그램 기준을 우선 반영했습니다.", impact: Math.abs(historyFactor.score), direction: historyFactor.score > 0 ? "positive" : "negative" });
  else if (historyFactor && targetHistory.length === 0) evidence.push({ type: "low_body_part_frequency", title: `최근 ${getCategoryLabel(program.category)} 운동이 적었어요`, description: `최근 14일 동안 ${getCategoryLabel(program.category)} 운동 기록이 없습니다.`, impact: Math.abs(historyFactor.score), direction: historyFactor.score > 0 ? "positive" : "negative" });
  else if (historyFactor && targetHistory[0]) {
    const days = Math.max(0, Math.floor((now.getTime() - targetHistory[0].workoutDate.getTime()) / dayMs));
    if (days >= 7) evidence.push({ type: "body_part_rest_days", title: "충분한 회복 시간이 지났어요", description: `마지막 ${getCategoryLabel(program.category)} 운동 후 ${days}일이 지났습니다.`, impact: Math.abs(historyFactor.score), direction: historyFactor.score > 0 ? "positive" : "negative" });
  }
  const recentFactor = selectedFactors.find((factor) => factor.key === "recentWorkout" && factor.score < 0);
  if (recentFactor) {
    const recent = history.slice(0, 3).filter((entry) => entry.category === program.category || entry.categories?.includes(program.category)).length;
    if (recent > 0) evidence.push({ type: "recent_body_part_repetition", title: `최근 ${getCategoryLabel(program.category)} 운동 비중이 높았어요`, description: `최근 3회 운동 중 ${recent}회에 ${getCategoryLabel(program.category)} 운동이 포함되어 중복을 줄였습니다.`, impact: Math.abs(recentFactor.score), direction: "negative" });
  }
  const overlap = selectedFactors.find((factor) => factor.key === "exerciseOverlap" && factor.score < 0);
  if (overlap) evidence.push({ type: "exercise_repetition", title: "최근 운동 종목 중복을 줄였어요", description: overlap.reason, impact: Math.abs(overlap.score), direction: "negative" });
  const conditionFactor = selectedFactors.find((factor) => factor.key === "condition");
  if (conditionFactor) evidence.push({ type: "condition_adjustment", title: "오늘 컨디션을 반영했어요", description: conditionFactor.reason, impact: Math.abs(conditionFactor.score), direction: conditionFactor.score > 0 ? "positive" : "negative" });
  return evidence.sort((left, right) => right.impact - left.impact).slice(0, 3);
};
