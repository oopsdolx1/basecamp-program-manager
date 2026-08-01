import { getCategoryLabel } from "../../programs/config/programOptions";
import { sanitizeProgramForm } from "../../programs/services/programService";
import type { Program, ProgramCategory, ProgramDifficulty, ProgramFormValues } from "../../programs/types/program.types";
import type {
  ConditionInput,
  FatigueArea,
  MemberIntelligenceSummary,
  PeriodizationSummary,
  RecommendationResult,
  RecommendationTrace,
  RecommendationTraceFactor,
  RecommendationTraceFactorKey,
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

const ENGINE_VERSION = "1" as const;

interface ScoreFactorInput {
  key: RecommendationTraceFactorKey;
  label: string;
  score: number;
  reason: string;
}

interface ScoreResult {
  score: number;
  reasons: string[];
  factors: RecommendationTraceFactor[];
}

const createFactor = ({ key, label, score, reason }: ScoreFactorInput): RecommendationTraceFactor => ({ key, label, score, reason });

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

const scoreCondition = (condition: ConditionInput, program: Program): ScoreResult => {
  let score = 0;
  const reasons: string[] = [];
  const factors: RecommendationTraceFactor[] = [];

  if (condition.condition === "BAD") {
    if (program.difficulty === "ADVANCED") {
      score -= 28;
      const reason = "오늘 컨디션이 좋지 않아 고강도 프로그램 우선순위를 낮췄습니다.";
      reasons.push(reason);
      factors.push(createFactor({ key: "condition", label: "Today's Condition", score: -28, reason }));
    }
    if (program.category === "RECOVERY") {
      score += 26;
      const reason = "오늘 컨디션이 좋지 않아 회복 프로그램 우선순위를 높였습니다.";
      reasons.push(reason);
      factors.push(createFactor({ key: "condition", label: "Today's Condition", score: 26, reason }));
    }
  }

  if (condition.condition === "GOOD") {
    const delta = difficultyWeight[program.difficulty ?? "GENERAL"];
    score += delta;
    if (delta !== 0) {
      const reason = "오늘 컨디션이 좋아 난이도 가중치를 반영했습니다.";
      reasons.push(reason);
      factors.push(createFactor({ key: "condition", label: "Today's Condition", score: delta, reason }));
    }
  }

  if (condition.sleep === "LACK") {
    let delta = 0;
    if (program.difficulty === "ADVANCED") delta -= 18;
    if (program.category === "RECOVERY") delta += 14;
    score += delta;
    const reason = "수면이 부족해 볼륨과 강도가 낮은 구성을 우선했습니다.";
    reasons.push(reason);
    if (delta !== 0) factors.push(createFactor({ key: "condition", label: "Today's Condition", score: delta, reason }));
  }

  if (condition.stress >= 5) {
    let delta = 0;
    if (program.category === "RECOVERY") delta += 22;
    if (program.difficulty === "ADVANCED") delta -= 16;
    score += delta;
    const reason = "스트레스가 높아 회복 중심 프로그램 우선순위를 높였습니다.";
    reasons.push(reason);
    if (delta !== 0) factors.push(createFactor({ key: "condition", label: "Today's Condition", score: delta, reason }));
  } else if (condition.stress >= 4) {
    let delta = 0;
    if (program.category === "RECOVERY") delta += 12;
    delta -= 4;
    score += delta;
    if (delta !== 0) {
      const reason = "스트레스 수준을 반영해 강도를 보수적으로 조정했습니다.";
      reasons.push(reason);
      factors.push(createFactor({ key: "condition", label: "Today's Condition", score: delta, reason }));
    }
  }

  if (condition.alcohol === "YES") {
    let delta = 0;
    if (program.category === "RECOVERY") delta += 18;
    if (program.difficulty === "ADVANCED") delta -= 18;
    score += delta;
    const reason = "음주 여부를 반영해 저강도 또는 회복 성격의 프로그램을 우선했습니다.";
    reasons.push(reason);
    if (delta !== 0) factors.push(createFactor({ key: "condition", label: "Today's Condition", score: delta, reason }));
  }

  const blockedFatigueCategories = new Set(
    condition.fatigueAreas.map((fatigueArea) =>
      Object.entries(categoryToFatigueArea).find(([, area]) => area === fatigueArea)?.[0],
    ),
  );

  if (blockedFatigueCategories.has(program.category)) {
    score -= 32;
    const reason = `${getCategoryLabel(program.category)} 피로가 있어 해당 부위 프로그램 우선순위를 낮췄습니다.`;
    reasons.push(reason);
    factors.push(createFactor({ key: "condition", label: "Today's Condition", score: -32, reason }));
  }

  return { score, reasons, factors };
};

const scoreRecentWorkout = (recentWorkout: RecentWorkoutSummary | null, program: Program): ScoreResult => {
  if (!recentWorkout?.category) {
    return { score: 0, reasons: [], factors: [] };
  }

  if (recentWorkout.category === program.category) {
    const delta = recentWorkout.daysAgo !== null && recentWorkout.daysAgo <= 2 ? -16 : -8;
    const reason = `최근 ${getCategoryLabel(recentWorkout.category)} 운동 이력이 있어 같은 부위 우선순위를 조정했습니다.`;
    return {
      score: delta,
      reasons: [reason],
      factors: [createFactor({ key: "recentWorkout", label: "History", score: delta, reason })],
    };
  }

  const reason = `최근 ${getCategoryLabel(recentWorkout.category)} 운동 이후 다른 부위를 순환하도록 고려했습니다.`;
  return {
    score: 8,
    reasons: [reason],
    factors: [createFactor({ key: "recentWorkout", label: "History", score: 8, reason })],
  };
};

const scoreIntelligence = (
  intelligence: MemberIntelligenceSummary | null,
  program: Program,
): ScoreResult => {
  if (!intelligence) {
    return { score: 0, reasons: [], factors: [] };
  }

  let score = 0;
  const reasons: string[] = [];
  const factors: RecommendationTraceFactor[] = [];

  if (intelligence.recoveryScore < 40) {
    let delta = 0;
    if (program.category === "RECOVERY") delta += 32;
    if (program.difficulty === "ADVANCED") delta -= 24;
    score += delta;
    const reason = `회복 점수 ${intelligence.recoveryScore}점으로 낮아 Recovery 우선순위를 높였습니다.`;
    reasons.push(reason);
    if (delta !== 0) factors.push(createFactor({ key: "recovery", label: "Recovery", score: delta, reason }));
  } else if (intelligence.recoveryScore >= 75 && program.difficulty === "BEGINNER") {
    score -= 4;
    const reason = `회복 점수 ${intelligence.recoveryScore}점으로 높아 Beginner 강도 가중치를 일부 낮췄습니다.`;
    reasons.push(reason);
    factors.push(createFactor({ key: "recovery", label: "Recovery", score: -4, reason }));
  }

  if (intelligence.riskScore > 70) {
    const dominantBias = intelligence.bodyPartBias[0]?.category;
    if (dominantBias && dominantBias === program.category) {
      score -= 30;
      const reason = `위험 점수 ${intelligence.riskScore}점으로 높아 편중된 ${getCategoryLabel(program.category)} 부위를 제외 방향으로 조정했습니다.`;
      reasons.push(reason);
      factors.push(createFactor({ key: "risk", label: "Risk", score: -30, reason }));
    }
  }

  if (intelligence.repeatedProgramCount > 3) {
    score -= 18;
    const reason = `최근 동일 Program 반복이 ${intelligence.repeatedProgramCount}회 있어 다른 Program 우선순위를 높였습니다.`;
    reasons.push(reason);
    factors.push(createFactor({ key: "programRepeat", label: "Program Repeat", score: -18, reason }));
  }

  const dominantBias = intelligence.bodyPartBias[0];
  if (dominantBias && dominantBias.category === program.category && dominantBias.ratio >= 0.4) {
    score -= 14;
    const reason = `${getCategoryLabel(program.category)} 비중이 ${Math.round(dominantBias.ratio * 100)}%로 높아 편중 완화를 고려했습니다.`;
    reasons.push(reason);
    factors.push(createFactor({ key: "bias", label: "Bias", score: -14, reason }));
  }

  if ((intelligence.gapDays ?? 0) >= 14) {
    let delta = 0;
    if (program.difficulty === "ADVANCED") delta -= 16;
    if (program.category === "RECOVERY") delta += 12;
    score += delta;
    const reason = `운동 공백이 ${intelligence.gapDays}일 있어 재적응에 유리한 구성을 우선했습니다.`;
    reasons.push(reason);
    if (delta !== 0) factors.push(createFactor({ key: "history", label: "History", score: delta, reason }));
  }

  return { score, reasons, factors };
};

const scorePeriodization = (periodization: PeriodizationSummary | null, program: Program): ScoreResult => {
  if (!periodization) {
    return { score: 0, reasons: [], factors: [] };
  }

  let score = 0;
  const reasons: string[] = [];
  const factors: RecommendationTraceFactor[] = [];
  const normalizedTitle = program.title.trim().toLowerCase();
  const nextHint = periodization.nextProgramHint?.toLowerCase() ?? null;

  if (periodization.plateau && periodization.repeatedProgramCount >= 5) {
    const sameRecentProgram = periodization.recentProgramSequence[0]?.trim().toLowerCase() === normalizedTitle;
    if (sameRecentProgram) {
      score -= 28;
      const reason = "Plateau 신호가 있어 같은 Program 반복 점수를 낮췄습니다.";
      reasons.push(reason);
      factors.push(createFactor({ key: "plateau", label: "Plateau", score: -28, reason }));
    } else {
      score += 10;
      const reason = "Plateau 완화를 위해 변형 가능한 다른 Program 우선순위를 높였습니다.";
      reasons.push(reason);
      factors.push(createFactor({ key: "plateau", label: "Plateau", score: 10, reason }));
    }
  }

  if (periodization.recommendedMode === "RECOVERY") {
    let delta = 0;
    if (program.category === "RECOVERY") delta += 30;
    if (program.difficulty === "ADVANCED") delta -= 14;
    score += delta;
    const reason = "회복 추세를 반영해 Recovery 성격의 Program을 우선했습니다.";
    reasons.push(reason);
    if (delta !== 0) factors.push(createFactor({ key: "periodization", label: "Periodization", score: delta, reason }));
  }

  if (periodization.recommendedMode === "DELOAD") {
    let delta = 0;
    if (program.category === "RECOVERY") delta += 26;
    if (program.difficulty === "BEGINNER" || program.difficulty === "GENERAL") delta += 12;
    if (program.difficulty === "ADVANCED") delta -= 22;
    score += delta;
    const reason = "Deload 구간으로 판단해 저강도 Program 가중치를 높였습니다.";
    reasons.push(reason);
    if (delta !== 0) factors.push(createFactor({ key: "periodization", label: "Periodization", score: delta, reason }));
  }

  if (periodization.recommendedMode === "RESTART") {
    let delta = 0;
    if (program.difficulty === "BEGINNER" || program.difficulty === "GENERAL") delta += 16;
    if (program.category === "RECOVERY") delta += 12;
    if (program.difficulty === "ADVANCED") delta -= 20;
    score += delta;
    const reason = "운동 재시작 구간으로 판단해 재적응형 Program을 우선했습니다.";
    reasons.push(reason);
    if (delta !== 0) factors.push(createFactor({ key: "periodization", label: "Periodization", score: delta, reason }));
  }

  if (periodization.recommendedMode === "VARIATION") {
    const delta = periodization.recentProgramSequence.some((title) => title.trim().toLowerCase() === normalizedTitle) ? -14 : 12;
    score += delta;
    const reason = "최근 반복 흐름을 완화하기 위해 Variation 우선순위를 반영했습니다.";
    reasons.push(reason);
    factors.push(createFactor({ key: "periodization", label: "Periodization", score: delta, reason }));
  }

  if (nextHint && normalizedTitle.includes(nextHint)) {
    score += 12;
    const reason = `다음 운동 흐름으로 ${periodization.nextProgramHint} 순환을 우선했습니다.`;
    reasons.push(reason);
    factors.push(createFactor({ key: "weeklyFrequency", label: "Weekly Frequency", score: 12, reason }));
  }

  return { score, reasons, factors };
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
  const factors: RecommendationTraceFactor[] = [];

  const conditionResult = scoreCondition(condition, program);
  score += conditionResult.score;
  reasons.push(...conditionResult.reasons);
  factors.push(...conditionResult.factors);

  const recentResult = scoreRecentWorkout(recentWorkout, program);
  score += recentResult.score;
  reasons.push(...recentResult.reasons);
  factors.push(...recentResult.factors);

  const intelligenceResult = scoreIntelligence(intelligence, program);
  score += intelligenceResult.score;
  reasons.push(...intelligenceResult.reasons);
  factors.push(...intelligenceResult.factors);

  const periodizationResult = scorePeriodization(periodization, program);
  score += periodizationResult.score;
  reasons.push(...periodizationResult.reasons);
  factors.push(...periodizationResult.factors);

  if (program.favorite) {
    score += 4;
    factors.push(createFactor({ key: "favorite", label: "Favorite", score: 4, reason: "즐겨찾기 Program이라 우선순위를 소폭 높였습니다." }));
  }
  if (program.isArchived) score -= 999;
  const usageBonus = Math.min(program.usageCount, 12);
  score += usageBonus;
  if (usageBonus !== 0) {
    factors.push(createFactor({ key: "usageCount", label: "Usage", score: usageBonus, reason: `누적 사용 ${program.usageCount}회를 반영해 안정적인 Program 점수를 보정했습니다.` }));
  }

  const trace: RecommendationTrace = {
    candidatePrograms: [{ programId: program.id, title: program.title, score, factors }],
    selectedProgram: {
      programId: program.id,
      title: program.title,
      score,
      reason: "Highest Score",
    },
    decisionFactors: factors,
    scores: [{ programId: program.id, title: program.title, score }],
    engineVersion: ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
  };

  return { program, score, reasons, trace };
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

  const selected = candidates[0] ?? null;
  if (!selected) return null;

  const topCandidates = candidates.slice(0, 5);
  selected.trace = {
    candidatePrograms: topCandidates.map((candidate) => ({
      programId: candidate.program.id,
      title: candidate.program.title,
      score: candidate.score,
      factors: candidate.trace.decisionFactors,
    })),
    selectedProgram: {
      programId: selected.program.id,
      title: selected.program.title,
      score: selected.score,
      reason: "Highest Score",
    },
    decisionFactors: selected.trace.decisionFactors,
    scores: topCandidates.map((candidate) => ({
      programId: candidate.program.id,
      title: candidate.program.title,
      score: candidate.score,
    })),
    engineVersion: ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
  };

  if (import.meta.env.DEV) {
    console.group(`[RecommendationTrace] ${selected.trace.selectedProgram.title}`);
    console.log("selectedProgram", selected.trace.selectedProgram);
    console.log("engineVersion", selected.trace.engineVersion);
    console.table(selected.trace.candidatePrograms.map((candidate) => ({
      program: candidate.title,
      score: candidate.score,
      selected: candidate.programId === selected.trace.selectedProgram.programId,
      factors: candidate.factors.map((factor) => `${factor.label} ${factor.score >= 0 ? "+" : ""}${factor.score}`).join(", "),
    })));
    console.table(selected.trace.decisionFactors.map((factor) => ({
      label: factor.label,
      score: factor.score,
      reason: factor.reason,
    })));
    console.groupEnd();
  }

  return selected;
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





