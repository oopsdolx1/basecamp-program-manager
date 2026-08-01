import { getCategoryLabel } from "../../programs/config/programOptions";
import { sanitizeProgramForm } from "../../programs/services/programService";
import type { Program, ProgramCategory, ProgramDifficulty, ProgramFormValues } from "../../programs/types/program.types";
import type {
  ConditionInput,
  FatigueArea,
  MemberIntelligenceSummary,
  PeriodizationSummary,
  RecommendationResult,
  RecentWorkoutSummary,
} from "../types/condition.types";

const categoryToFatigueArea: Partial<Record<ProgramCategory, FatigueArea>> = {
  CHEST: "CHEST",
  BACK: "BACK",
  SHOULDER: "SHOULDER",
  ARMS: "ARMS",
  LOWER_BODY: "LOWER_BODY",
};

const difficultyWeight: Record<ProgramDifficulty, number> = {
  GENERAL: 0,
  BEGINNER: 8,
  INTERMEDIATE: 4,
  ADVANCED: -6,
};

const areaLabel = (area: FatigueArea): string => {
  switch (area) {
    case "CHEST":
      return "가슴";
    case "BACK":
      return "등";
    case "SHOULDER":
      return "어깨";
    case "ARMS":
      return "팔";
    case "LOWER_BODY":
      return "하체";
  }
};

const scoreCondition = (condition: ConditionInput, program: Program): { score: number; reasons: string[] } => {
  let score = 0;
  const reasons: string[] = [];

  if (condition.condition === "BAD") {
    if (program.difficulty === "ADVANCED") {
      score -= 28;
      reasons.push("오늘 컨디션이 좋지 않아 고강도 프로그램 우선순위를 낮췄습니다.");
    }
    if (program.category === "RECOVERY") {
      score += 26;
      reasons.push("오늘 컨디션이 좋지 않아 회복 프로그램 우선순위를 높였습니다.");
    }
  }

  if (condition.condition === "GOOD") {
    score += difficultyWeight[program.difficulty ?? "GENERAL"];
  }

  if (condition.sleep === "LACK") {
    if (program.difficulty === "ADVANCED") score -= 18;
    if (program.category === "RECOVERY") score += 14;
    reasons.push("수면이 부족해 볼륨과 강도가 낮은 구성을 우선했습니다.");
  }

  if (condition.stress >= 5) {
    if (program.category === "RECOVERY") score += 22;
    if (program.difficulty === "ADVANCED") score -= 16;
    reasons.push("스트레스가 높아 회복 중심 프로그램 우선순위를 높였습니다.");
  } else if (condition.stress >= 4) {
    if (program.category === "RECOVERY") score += 12;
    score -= 4;
  }

  if (condition.alcohol === "YES") {
    if (program.category === "RECOVERY") score += 18;
    if (program.difficulty === "ADVANCED") score -= 18;
    reasons.push("음주 여부를 반영해 저강도 또는 회복 성격의 프로그램을 우선했습니다.");
  }

  const blockedFatigueCategories = new Set(
    condition.fatigueAreas.map((fatigueArea) =>
      Object.entries(categoryToFatigueArea).find(([, area]) => area === fatigueArea)?.[0],
    ),
  );

  if (blockedFatigueCategories.has(program.category)) {
    score -= 32;
    reasons.push(`${getCategoryLabel(program.category)} 피로가 있어 해당 부위 프로그램 우선순위를 낮췄습니다.`);
  }

  return { score, reasons };
};

const scoreRecentWorkout = (recentWorkout: RecentWorkoutSummary | null, program: Program): { score: number; reasons: string[] } => {
  if (!recentWorkout?.category) {
    return { score: 0, reasons: [] };
  }

  if (recentWorkout.category === program.category) {
    return {
      score: recentWorkout.daysAgo !== null && recentWorkout.daysAgo <= 2 ? -16 : -8,
      reasons: [`최근 ${getCategoryLabel(recentWorkout.category)} 운동 이력이 있어 같은 부위 우선순위를 조정했습니다.`],
    };
  }

  return {
    score: 8,
    reasons: [`최근 ${getCategoryLabel(recentWorkout.category)} 운동 이후 다른 부위를 순환하도록 고려했습니다.`],
  };
};

const scoreIntelligence = (
  intelligence: MemberIntelligenceSummary | null,
  program: Program,
): { score: number; reasons: string[] } => {
  if (!intelligence) {
    return { score: 0, reasons: [] };
  }

  let score = 0;
  const reasons: string[] = [];

  if (intelligence.recoveryScore < 40) {
    if (program.category === "RECOVERY") score += 32;
    if (program.difficulty === "ADVANCED") score -= 24;
    reasons.push(`회복 점수 ${intelligence.recoveryScore}점으로 낮아 Recovery 우선순위를 높였습니다.`);
  } else if (intelligence.recoveryScore >= 75 && program.difficulty === "BEGINNER") {
    score -= 4;
  }

  if (intelligence.riskScore > 70) {
    const dominantBias = intelligence.bodyPartBias[0]?.category;
    if (dominantBias && dominantBias === program.category) {
      score -= 30;
      reasons.push(`위험 점수 ${intelligence.riskScore}점으로 높아 편중된 ${getCategoryLabel(program.category)} 부위를 제외 방향으로 조정했습니다.`);
    }
  }

  if (intelligence.repeatedProgramCount > 3) {
    score -= 18;
    reasons.push(`최근 동일 Program 반복이 ${intelligence.repeatedProgramCount}회 있어 다른 Program 우선순위를 높였습니다.`);
  }

  const dominantBias = intelligence.bodyPartBias[0];
  if (dominantBias && dominantBias.category === program.category && dominantBias.ratio >= 0.4) {
    score -= 14;
    reasons.push(`${getCategoryLabel(program.category)} 비중이 ${Math.round(dominantBias.ratio * 100)}%로 높아 편중 완화를 고려했습니다.`);
  }

  if ((intelligence.gapDays ?? 0) >= 14) {
    if (program.difficulty === "ADVANCED") score -= 16;
    if (program.category === "RECOVERY") score += 12;
    reasons.push(`운동 공백이 ${intelligence.gapDays}일 있어 재적응에 유리한 구성을 우선했습니다.`);
  }

  return { score, reasons };
};

const scorePeriodization = (periodization: PeriodizationSummary | null, program: Program): { score: number; reasons: string[] } => {
  if (!periodization) {
    return { score: 0, reasons: [] };
  }

  let score = 0;
  const reasons: string[] = [];
  const normalizedTitle = program.title.trim().toLowerCase();
  const nextHint = periodization.nextProgramHint?.toLowerCase() ?? null;

  if (periodization.plateau && periodization.repeatedProgramCount >= 5) {
    const sameRecentProgram = periodization.recentProgramSequence[0]?.trim().toLowerCase() === normalizedTitle;
    if (sameRecentProgram) {
      score -= 28;
      reasons.push("Plateau 신호가 있어 같은 Program 반복 점수를 낮췄습니다.");
    } else {
      score += 10;
      reasons.push("Plateau 완화를 위해 변형 가능한 다른 Program 우선순위를 높였습니다.");
    }
  }

  if (periodization.recommendedMode === "RECOVERY") {
    if (program.category === "RECOVERY") score += 30;
    if (program.difficulty === "ADVANCED") score -= 14;
    reasons.push("회복 추세를 반영해 Recovery 성격의 Program을 우선했습니다.");
  }

  if (periodization.recommendedMode === "DELOAD") {
    if (program.category === "RECOVERY") score += 26;
    if (program.difficulty === "BEGINNER" || program.difficulty === "GENERAL") score += 12;
    if (program.difficulty === "ADVANCED") score -= 22;
    reasons.push("Deload 구간으로 판단해 저강도 Program 가중치를 높였습니다.");
  }

  if (periodization.recommendedMode === "RESTART") {
    if (program.difficulty === "BEGINNER" || program.difficulty === "GENERAL") score += 16;
    if (program.category === "RECOVERY") score += 12;
    if (program.difficulty === "ADVANCED") score -= 20;
    reasons.push("운동 재시작 구간으로 판단해 재적응형 Program을 우선했습니다.");
  }

  if (periodization.recommendedMode === "VARIATION") {
    if (periodization.recentProgramSequence.some((title) => title.trim().toLowerCase() === normalizedTitle)) {
      score -= 14;
    } else {
      score += 12;
    }
    reasons.push("최근 반복 흐름을 완화하기 위해 Variation 우선순위를 반영했습니다.");
  }

  if (nextHint && normalizedTitle.includes(nextHint)) {
    score += 12;
    reasons.push(`다음 운동 흐름으로 ${periodization.nextProgramHint} 순환을 우선했습니다.`);
  }

  return { score, reasons };
};

const scoreProgram = (
  program: Program,
  condition: ConditionInput,
  recentWorkout: RecentWorkoutSummary | null,
  intelligence: MemberIntelligenceSummary | null,
  periodization: PeriodizationSummary | null,
): RecommendationResult => {
  let score = 100;
  const reasons: string[] = [];

  const conditionResult = scoreCondition(condition, program);
  score += conditionResult.score;
  reasons.push(...conditionResult.reasons);

  const recentResult = scoreRecentWorkout(recentWorkout, program);
  score += recentResult.score;
  reasons.push(...recentResult.reasons);

  const intelligenceResult = scoreIntelligence(intelligence, program);
  score += intelligenceResult.score;
  reasons.push(...intelligenceResult.reasons);

  const periodizationResult = scorePeriodization(periodization, program);
  score += periodizationResult.score;
  reasons.push(...periodizationResult.reasons);

  if (program.favorite) score += 4;
  if (program.isArchived) score -= 999;
  score += Math.min(program.usageCount, 12);

  return { program, score, reasons };
};

export const recommendProgram = (
  programs: Program[],
  condition: ConditionInput,
  recentWorkout: RecentWorkoutSummary | null,
  intelligence: MemberIntelligenceSummary | null,
  periodization: PeriodizationSummary | null,
): RecommendationResult | null => {
  const candidates = programs
    .filter((program) => !program.isArchived)
    .map((program) => scoreProgram(program, condition, recentWorkout, intelligence, periodization));

  candidates.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return right.program.updatedAt.getTime() - left.program.updatedAt.getTime();
  });

  return candidates[0] ?? null;
};

export const buildRecommendationReason = (
  result: RecommendationResult,
  condition: ConditionInput,
  recentWorkout: RecentWorkoutSummary | null,
  intelligence: MemberIntelligenceSummary | null,
  periodization: PeriodizationSummary | null,
): string => {
  const summary: string[] = [];

  if (recentWorkout?.category) {
    summary.push(`최근 ${getCategoryLabel(recentWorkout.category)} 운동을 진행했고`);
  }

  if (condition.fatigueAreas.length > 0) {
    summary.push(`오늘 ${condition.fatigueAreas.map((area) => areaLabel(area)).join(", ")} 피로를 선택해`);
  }

  if (intelligence) {
    summary.push(`회복 점수 ${intelligence.recoveryScore}점, 위험 점수 ${intelligence.riskScore}점을 반영해`);
  }

  if (periodization) {
    summary.push(`주기 분석 결과 ${periodization.recommendedMode} 모드와 ${periodization.currentCycle} 흐름을 고려해`);
  }

  summary.push(`${getCategoryLabel(result.program.category)} 프로그램을 추천했습니다.`);

  return [...summary, ...result.reasons.slice(0, 4)].join(" ");
};

export const programToSnapshotFormValues = (program: Program): ProgramFormValues =>
  sanitizeProgramForm({
    title: program.title,
    category: program.category,
    difficulty: program.difficulty ?? "GENERAL",
    memo: program.memo ?? "",
    favorite: program.favorite,
    exercises: program.exercises.map((exercise) => ({
      id: crypto.randomUUID(),
      name: exercise.name,
      sets: exercise.sets,
      memo: exercise.memo ?? "",
      order: exercise.order,
      catalogExerciseId: exercise.catalogExerciseId,
      displayName: exercise.displayName ?? exercise.name,
    })),
  });
