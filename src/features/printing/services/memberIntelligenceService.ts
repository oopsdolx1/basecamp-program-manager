import type { ConditionInput, MemberHistoryEntry, MemberIntelligenceMetadata, MemberIntelligenceSummary, RecentWorkoutSummary } from "../types/condition.types";
import type { ProgramCategory } from "../../programs/types/program.types";
import type { WorkoutHistoryRecord } from "../providers/workoutHistoryProvider";

const DAY_MS = 86_400_000;
const clampScore = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));
const daysBetween = (date: Date | null, now: Date): number | null => (date ? Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS)) : null);

const toHistoryEntries = (history: WorkoutHistoryRecord[]): MemberHistoryEntry[] =>
  history.map((entry) => ({
    performedAt: entry.workoutDate,
    programId: entry.programId,
    programTitle: entry.programTitle,
    category: entry.category,
    exercises: entry.exercises.map((exercise) => ({ name: exercise.name, sets: exercise.sets })),
    completed: entry.completion ?? null,
    source: "logs",
  }));

const dedupeEntries = (entries: MemberHistoryEntry[]): MemberHistoryEntry[] => {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.programId}:${entry.performedAt.toISOString()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getBodyPartBias = (entries: MemberHistoryEntry[]): Array<{ category: ProgramCategory; ratio: number; count: number }> => {
  const counts = new Map<ProgramCategory, number>();
  entries.forEach((entry) => {
    if (!entry.category) return;
    counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
  });
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count, ratio: total > 0 ? count / total : 0 }))
    .sort((left, right) => right.ratio - left.ratio);
};

const countRecent = (entries: MemberHistoryEntry[], days: number, now: Date): number =>
  entries.filter((entry) => now.getTime() - entry.performedAt.getTime() <= days * DAY_MS).length;

const computeRepeatedProgramCount = (entries: MemberHistoryEntry[]): number => {
  if (entries.length === 0) return 0;
  const firstProgramId = entries[0].programId;
  let streak = 0;
  for (const entry of entries) {
    if (entry.programId !== firstProgramId) break;
    streak += 1;
  }
  return streak;
};

const computeVolume = (entries: MemberHistoryEntry[]): { totalSets: number | null; totalExercises: number } => {
  const allExercises = entries.flatMap((entry) => entry.exercises);
  const totalExercises = allExercises.length;
  const knownSets = allExercises.map((exercise) => exercise.sets).filter((value): value is number => value !== null);
  return {
    totalSets: knownSets.length > 0 ? knownSets.reduce((sum, value) => sum + value, 0) : null,
    totalExercises,
  };
};

const computeRecoveryScore = (
  summary: Omit<MemberIntelligenceSummary, "recoveryScore" | "riskScore" | "recommendationVersion" | "historyCount">,
  condition: ConditionInput,
): number => {
  let score = 70;
  if (summary.recentWorkoutDaysAgo !== null) score -= Math.max(0, 18 - summary.recentWorkoutDaysAgo * 3);
  if (summary.gapDays !== null) score += Math.min(18, summary.gapDays);
  score -= Math.min(18, summary.frequency7 * 4);
  score -= Math.min(12, summary.repeatedProgramCount * 3);
  score -= Math.min(10, condition.stress * 2);
  if (condition.sleep === "LACK") score -= 12;
  if (condition.sleep === "ENOUGH") score += 6;
  if (condition.condition === "GOOD") score += 8;
  if (condition.condition === "BAD") score -= 10;
  score -= condition.fatigueAreas.length * 5;
  if (condition.alcohol === "YES") score -= 8;
  return clampScore(score);
};

const computeRiskScore = (
  summary: Omit<MemberIntelligenceSummary, "recoveryScore" | "riskScore" | "recommendationVersion" | "historyCount">,
): number => {
  let score = 15;
  if (summary.repeatedProgramCount >= 6) score += 45;
  else if (summary.repeatedProgramCount >= 4) score += 30;
  else if (summary.repeatedProgramCount >= 3) score += 18;
  const dominantBias = summary.bodyPartBias[0];
  if (dominantBias) score += Math.round(dominantBias.ratio * 40);
  if (summary.gapDays !== null && summary.gapDays >= 30) score += 45;
  else if (summary.gapDays !== null && summary.gapDays >= 14) score += 24;
  else if (summary.gapDays !== null && summary.gapDays >= 7) score += 10;
  if (summary.frequency7 >= 5) score += 12;
  return clampScore(score);
};

export const analyzeMemberIntelligence = (
  workoutHistory: WorkoutHistoryRecord[],
  condition: ConditionInput,
  now: Date = new Date(),
): {
  summary: MemberIntelligenceSummary;
  metadata: MemberIntelligenceMetadata;
  latestEntry: MemberHistoryEntry | null;
  history: MemberHistoryEntry[];
  recentWorkout: RecentWorkoutSummary | null;
} => {
  const entries = dedupeEntries(toHistoryEntries(workoutHistory))
    .sort((left, right) => right.performedAt.getTime() - left.performedAt.getTime())
    .slice(0, 20);

  const latestEntry = entries[0] ?? null;
  const bodyPartBias = getBodyPartBias(entries);
  const frequency7 = countRecent(entries, 7, now);
  const frequency30 = countRecent(entries, 30, now);
  const gapDays = entries.length > 0 ? daysBetween(entries[0].performedAt, now) : null;
  const repeatedProgramCount = computeRepeatedProgramCount(entries);
  const recentPrograms10 = new Set(entries.slice(0, 10).map((entry) => entry.programId)).size;
  const recentCategories10 = new Set(entries.slice(0, 10).map((entry) => entry.category).filter(Boolean)).size;
  const volume = computeVolume(entries);

  const baseSummary = {
    recentWorkoutDaysAgo: latestEntry ? daysBetween(latestEntry.performedAt, now) : null,
    frequency7,
    frequency30,
    gapDays,
    bodyPartBias,
    repeatedProgramCount,
    diversity10: {
      programCount: recentPrograms10,
      categoryCount: recentCategories10,
    },
    volume,
  };

  const recoveryScore = computeRecoveryScore(baseSummary, condition);
  const riskScore = computeRiskScore(baseSummary);

  const summary: MemberIntelligenceSummary = {
    ...baseSummary,
    recoveryScore,
    riskScore,
    recommendationVersion: "3",
    historyCount: entries.length,
  };

  const metadata: MemberIntelligenceMetadata = {
    recoveryScore: summary.recoveryScore,
    riskScore: summary.riskScore,
    bodyBias: summary.bodyPartBias[0]?.category.toLowerCase() ?? "none",
    frequency7: summary.frequency7,
    frequency30: summary.frequency30,
    recommendationVersion: "3",
  };

  const recentWorkout: RecentWorkoutSummary | null = latestEntry
    ? {
        title: latestEntry.programTitle,
        category: latestEntry.category,
        daysAgo: summary.recentWorkoutDaysAgo,
        source: latestEntry.source,
      }
    : null;

  return {
    summary,
    metadata,
    latestEntry,
    history: entries,
    recentWorkout,
  };
};
