import assert from "node:assert/strict";
import { recommendProgram } from "../src/features/printing/services/conditionRecommendationService";
import type { WorkoutHistoryRecord } from "../src/features/printing/providers/workoutHistoryProvider";
import type { ConditionInput, PeriodizationSummary } from "../src/features/printing/types/condition.types";
import type { Program, ProgramCategory, ProgramDifficulty } from "../src/features/programs/types/program.types";

const makeProgram = (id: string, category: ProgramCategory, exercise: string, difficulty: ProgramDifficulty = "INTERMEDIATE", usageCount = 0): Program => ({
  id: id as Program["id"], title: id, category, difficulty, memo: "", favorite: false, usageCount, lastUsedAt: null,
  createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"), createdBy: null, updatedBy: null, isArchived: false,
  exercises: [{ id: `${id}-exercise`, name: exercise, sets: 3, memo: "", order: 1 }],
});
const condition = (workoutTarget: ConditionInput["workoutTarget"], targetFatigue: ConditionInput["targetFatigue"] = "NORMAL"): ConditionInput => ({
  workoutTarget, targetFatigue, fatigueAreas: [],
  stress: targetFatigue === "HIGH" ? 5 : targetFatigue === "LOW" ? 1 : 3, condition: "NORMAL", sleep: "NORMAL", alcohol: "NO",
});
const history = (exercise: string, category: ProgramCategory, daysAgo = 0): WorkoutHistoryRecord => ({
  memberId: "member-test" as WorkoutHistoryRecord["memberId"], programId: "performed", programTitle: "performed", category, categories: [category],
  workoutDate: new Date(Date.now() - daysAgo * 86_400_000), completion: true, exercises: [{ name: exercise, sets: 3 }],
});
const restart: PeriodizationSummary = { currentCycle: "Upper", recentProgramSequence: [], repeatedProgramCount: 0, cycleDistribution: [], plateau: false, deload: false, recoveryTrend: "STABLE", weeklyFrequency: 0, recommendedMode: "RESTART", nextProgramHint: null, engineVersion: "1" };
const programs = [makeProgram("back-a", "BACK", "랫풀다운"), makeProgram("back-b", "BACK", "바벨 로우"), makeProgram("chest-a", "CHEST", "체스트 프레스"), makeProgram("lower-a", "LOWER_BODY", "스쿼트"), makeProgram("arms-a", "ARMS", "바벨 컬")];
const rank = (items: Program[], input: ConditionInput, records: WorkoutHistoryRecord[] = [], periodization: PeriodizationSummary | null = null) => recommendProgram(items, input, null, null, periodization, records, []);

const back = rank(programs, condition("BACK"));
assert(back && back.trace.candidatePrograms.every((item) => item.programId.startsWith("back-")), "BACK target isolation");
const chest = rank(programs, condition("CHEST"));
assert(chest && chest.trace.candidatePrograms.length === 1 && chest.program.category === "CHEST", "CHEST only");
const arms = rank(programs, condition("ARMS"));
assert.equal(arms?.trace.candidatePrograms.length, 1, "candidate count below three");
assert.equal(rank(programs, condition("RECOVERY")), null, "empty RECOVERY");
assert(!back?.trace.candidatePrograms.some((item) => item.programId === "lower-a"), "no cross-category fallback");
const changed = rank(programs, condition("BACK"), [history("랫풀다운", "BACK")]);
assert.equal(changed?.program.id, "back-b", "history changes ordering");
assert((changed?.trace.candidatePrograms.find((item) => item.programId === "back-a")?.score ?? 0) < (changed?.trace.candidatePrograms.find((item) => item.programId === "back-b")?.score ?? 0), "exercise overlap penalty");
const fatiguePrograms = [makeProgram("advanced", "BACK", "A", "ADVANCED"), makeProgram("beginner", "BACK", "B", "BEGINNER")];
assert.equal(rank(fatiguePrograms, condition("BACK", "HIGH"))?.program.id, "beginner", "target fatigue affects ranking");
const activeAdvanced = makeProgram("active-advanced", "BACK", "A", "ADVANCED", 12); activeAdvanced.favorite = true;
assert.equal(rank([makeProgram("restart-beginner", "BACK", "B", "BEGINNER"), activeAdvanced], condition("BACK"), [], restart)?.program.id, "active-advanced", "long inactivity is bounded");
const first = rank(programs, condition("BACK"), [history("랫풀다운", "BACK")])?.trace.candidatePrograms.map((item) => item.programId);
const second = rank(programs, condition("BACK"), [history("랫풀다운", "BACK")])?.trace.candidatePrograms.map((item) => item.programId);
assert.deepEqual(first, second, "deterministic ranking");
console.log("Phase 2 recommendation checks: 10/10 PASS");