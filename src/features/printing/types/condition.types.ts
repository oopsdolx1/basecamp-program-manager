import type { Program, ProgramCategory, ProgramFormValues } from "../../programs/types/program.types";

export type ConditionStatus = "GOOD" | "NORMAL" | "BAD";
export type SleepQuality = "ENOUGH" | "NORMAL" | "LACK";
export type FatigueArea = "CHEST" | "BACK" | "SHOULDER" | "ARMS" | "LOWER_BODY";
export type AlcoholStatus = "YES" | "NO";

export interface ConditionInput {
  condition: ConditionStatus | null;
  sleep: SleepQuality | null;
  fatigueAreas: FatigueArea[];
  stress: number;
  alcohol: AlcoholStatus | null;
}

export interface RecentWorkoutSummary {
  title: string;
  category: ProgramCategory | null;
  daysAgo: number | null;
  source: "logs" | "print-history";
}

export interface MemberHistoryEntry {
  performedAt: Date;
  programId: string;
  programTitle: string;
  category: ProgramCategory | null;
  exercises: Array<{ name: string; sets: number | null }>;
  completed: boolean | null;
  source: "logs" | "print-history";
}

export interface MemberIntelligenceMetadata {
  recoveryScore: number;
  riskScore: number;
  bodyBias: string;
  frequency7: number;
  frequency30: number;
  recommendationVersion: "3";
}

export interface MemberIntelligenceSummary {
  recentWorkoutDaysAgo: number | null;
  frequency7: number;
  frequency30: number;
  gapDays: number | null;
  bodyPartBias: Array<{ category: ProgramCategory; ratio: number; count: number }>;
  repeatedProgramCount: number;
  diversity10: {
    programCount: number;
    categoryCount: number;
  };
  volume: {
    totalSets: number | null;
    totalExercises: number;
  };
  recoveryScore: number;
  riskScore: number;
  recommendationVersion: "3";
  historyCount: number;
}

export type PeriodizationRecommendationMode = "NORMAL" | "VARIATION" | "RECOVERY" | "DELOAD" | "RESTART";

export interface PeriodizationCycleDistribution {
  cycle: string;
  count: number;
  ratio: number;
}

export interface PeriodizationSummary {
  currentCycle: string;
  recentProgramSequence: string[];
  repeatedProgramCount: number;
  cycleDistribution: PeriodizationCycleDistribution[];
  plateau: boolean;
  deload: boolean;
  recoveryTrend: "UP" | "DOWN" | "STABLE";
  weeklyFrequency: number;
  recommendedMode: PeriodizationRecommendationMode;
  nextProgramHint: string | null;
  engineVersion: "1";
}

export type RecommendationTraceFactorKey =
  | "condition"
  | "recentWorkout"
  | "exerciseOverlap"
  | "recovery"
  | "risk"
  | "programRepeat"
  | "bias"
  | "history"
  | "periodization"
  | "plateau"
  | "weeklyFrequency"
  | "favorite"
  | "usageCount";

export interface RecommendationTraceFactor {
  key: RecommendationTraceFactorKey;
  label: string;
  score: number;
  reason: string;
}

export interface RecommendationTraceCandidate {
  programId: string;
  title: string;
  score: number;
  factors: RecommendationTraceFactor[];
}

export interface RecommendationTraceScore {
  programId: string;
  title: string;
  score: number;
}

export interface RecommendationTrace {
  candidatePrograms: RecommendationTraceCandidate[];
  selectedProgram: {
    programId: string;
    title: string;
    score: number;
    reason: string;
  };
  decisionFactors: RecommendationTraceFactor[];
  scores: RecommendationTraceScore[];
  engineVersion: "1";
  generatedAt: string;
}

export interface RecommendationResult {
  program: Program;
  score: number;
  reasons: string[];
  trace: RecommendationTrace;
}

export interface AiRecommendationChange {
  exercise: string;
  sets?: number;
  reps?: string;
  memo?: string;
  order?: number;
}

export interface AiRecommendationResult {
  reason: string;
  coach: string;
  warning: string;
  changes: AiRecommendationChange[];
  rawJson: string;
}

export interface ProgramSnapshotPayload {
  sourceProgramId: string;
  sourceProgramTitle: string;
  recommendationReasons: string[];
  aiRecommendation: AiRecommendationResult | null;
  intelligence: MemberIntelligenceSummary | null;
  metadata: MemberIntelligenceMetadata | null;
  periodization: PeriodizationSummary | null;
  recommendationTrace?: RecommendationTrace | null;
  condition: ConditionInput;
  recentWorkout: RecentWorkoutSummary | null;
  formValues: ProgramFormValues;
}

