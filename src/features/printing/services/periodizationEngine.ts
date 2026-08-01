import type { ProgramCategory } from "../../programs/types/program.types";
import type { ConditionInput, MemberHistoryEntry, MemberIntelligenceSummary, PeriodizationSummary } from "../types/condition.types";

const DAY_MS = 86_400_000;
const WINDOW_SIZE = 3;
const ENGINE_VERSION = "1" as const;

const classifyCycle = (entry: Pick<MemberHistoryEntry, "programTitle" | "category">): string => {
  const title = entry.programTitle.trim().toLowerCase();

  if (title.includes("upper")) return "Upper";
  if (title.includes("lower")) return "Lower";
  if (title.includes("push")) return "Push";
  if (title.includes("pull")) return "Pull";
  if (title.includes("leg")) return "Leg";
  if (title.includes("full")) return "Full";
  if (title.includes("recovery") || title.includes("deload")) return "Recovery";

  switch (entry.category) {
    case "LOWER_BODY":
      return "Lower";
    case "FULL_BODY":
      return "Full";
    case "RECOVERY":
      return "Recovery";
    case "CHEST":
    case "BACK":
    case "SHOULDER":
    case "ARMS":
      return "Upper";
    default:
      return "Other";
  }
};

const getAverage = (values: number[]): number => (values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

const getTotalSets = (entry: MemberHistoryEntry): number =>
  entry.exercises.reduce((sum, exercise) => sum + (exercise.sets ?? 0), 0);

const buildRecoverySignal = (entry: MemberHistoryEntry, previous: MemberHistoryEntry | null): number => {
  let score = 55;
  const totalSets = getTotalSets(entry);

  if (entry.category === "RECOVERY") score += 16;
  if (entry.completed === false) score -= 8;
  score -= Math.min(18, totalSets);

  if (previous) {
    const gapDays = Math.max(0, Math.floor((previous.performedAt.getTime() - entry.performedAt.getTime()) / DAY_MS));
    score += Math.min(20, gapDays * 4);
  }

  return Math.max(0, Math.min(100, score));
};

const getTrend = (entries: MemberHistoryEntry[]): "UP" | "DOWN" | "STABLE" => {
  if (entries.length < WINDOW_SIZE * 2) return "STABLE";

  const scores = entries.map((entry, index) => buildRecoverySignal(entry, entries[index - 1] ?? null));
  const recent = getAverage(scores.slice(0, WINDOW_SIZE));
  const previous = getAverage(scores.slice(WINDOW_SIZE, WINDOW_SIZE * 2));

  if (recent - previous >= 6) return "UP";
  if (previous - recent >= 6) return "DOWN";
  return "STABLE";
};

const buildCycleDistribution = (entries: MemberHistoryEntry[]): PeriodizationSummary["cycleDistribution"] => {
  const counts = new Map<string, number>();
  entries.forEach((entry) => {
    const cycle = classifyCycle(entry);
    counts.set(cycle, (counts.get(cycle) ?? 0) + 1);
  });

  const total = entries.length || 1;
  return [...counts.entries()]
    .map(([cycle, count]) => ({ cycle, count, ratio: count / total }))
    .sort((left, right) => right.count - left.count);
};

const inferCurrentCycle = (distribution: PeriodizationSummary["cycleDistribution"]): string => {
  const topTwo = distribution.slice(0, 2).map((item) => item.cycle);
  if (topTwo.includes("Upper") && topTwo.includes("Lower")) return "Upper/Lower";
  if (topTwo.includes("Push") && topTwo.includes("Pull")) return "Push/Pull";
  if (topTwo.includes("Push") && topTwo.includes("Leg")) return "Push/Pull/Leg";
  return topTwo[0] ?? "Unclassified";
};

const inferNextProgramHint = (entries: MemberHistoryEntry[]): string | null => {
  const latest = entries[0];
  if (!latest) return null;
  const latestCycle = classifyCycle(latest);

  if (latestCycle === "Upper") return "Lower";
  if (latestCycle === "Lower") return "Upper";
  if (latestCycle === "Push") return "Pull";
  if (latestCycle === "Pull") return "Leg";
  if (latestCycle === "Leg") return "Push";
  if (latestCycle === "Full") return "Recovery";
  if (latestCycle === "Recovery") return entries[1] ? classifyCycle(entries[1]) : "Upper";
  return null;
};

const isLowIntensityCategory = (category: ProgramCategory | null): boolean => category === "RECOVERY" || category === "FULL_BODY";

export const analyzePeriodization = ({
  intelligence,
  history,
  condition,
}: {
  intelligence: MemberIntelligenceSummary | null;
  history: MemberHistoryEntry[];
  condition: ConditionInput;
}): PeriodizationSummary => {
  const recentEntries = history.slice(0, 12);
  const recentProgramSequence = recentEntries.slice(0, 4).map((entry) => entry.programTitle);
  const cycleDistribution = buildCycleDistribution(recentEntries);
  const currentCycle = inferCurrentCycle(cycleDistribution);
  const repeatedProgramCount = intelligence?.repeatedProgramCount ?? 0;
  const recoveryTrend = getTrend(recentEntries);
  const weeklyFrequency = intelligence?.frequency7 ?? 0;
  const lowRecovery = (intelligence?.recoveryScore ?? 100) < 45;
  const highFrequency = weeklyFrequency >= 5;
  const sustainedLoad = (intelligence?.frequency30 ?? 0) >= 16 || ((intelligence?.volume.totalSets ?? 0) >= 160);
  const lowReadinessCondition = condition.condition === "BAD" || condition.sleep === "LACK" || condition.stress >= 4 || condition.alcohol === "YES";
  const deload = (sustainedLoad && (lowRecovery || recoveryTrend === "DOWN")) || (highFrequency && lowReadinessCondition);
  const plateau = repeatedProgramCount >= 5;

  let recommendedMode: PeriodizationSummary["recommendedMode"] = "NORMAL";
  if ((intelligence?.gapDays ?? 0) >= 14) recommendedMode = "RESTART";
  else if (deload) recommendedMode = "DELOAD";
  else if (lowRecovery || recoveryTrend === "DOWN" || recentEntries[0] && isLowIntensityCategory(recentEntries[0].category) && condition.condition === "BAD") recommendedMode = "RECOVERY";
  else if (plateau) recommendedMode = "VARIATION";

  return {
    currentCycle,
    recentProgramSequence,
    repeatedProgramCount,
    cycleDistribution,
    plateau,
    deload,
    recoveryTrend,
    weeklyFrequency,
    recommendedMode,
    nextProgramHint: inferNextProgramHint(recentEntries),
    engineVersion: ENGINE_VERSION,
  };
};
