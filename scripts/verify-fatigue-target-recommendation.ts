import assert from "node:assert/strict";
import { recommendProgram } from "../src/features/printing/services/conditionRecommendationService";
import type { ConditionInput } from "../src/features/printing/types/condition.types";
import type { Program } from "../src/features/programs/types/program.types";

const program = (id: string, category: Program["category"], difficulty: Program["difficulty"], sets: number): Program => ({
  id: id as Program["id"], schemaVersion: 1, title: id, category, difficulty, exercises: [{ id: `${id}-exercise`, name: id, order: 1, sets }], createdAt: new Date(0), updatedAt: new Date(0), usageCount: 0, favorite: false, isArchived: false,
});
const condition = (workoutTarget: ConditionInput["workoutTarget"], fatigueTargets: ConditionInput["fatigueTargets"] = []): ConditionInput => ({ condition: "NORMAL", sleep: "NORMAL", workoutTarget, workoutTargets: workoutTarget ? [workoutTarget] : [], targetFatigue: "NORMAL", fatigueAreas: [], fatigueTargets, stress: 3, alcohol: "NO" });
const rank = (programs: Program[], input: ConditionInput) => recommendProgram(programs, input, null, null, null, [], []);

const shoulderPrograms = [program("shoulder-advanced", "SHOULDER", "ADVANCED", 24), program("shoulder-recovery", "SHOULDER", "BEGINNER", 10)];
assert.equal(rank(shoulderPrograms, condition("SHOULDER"))?.program.id, "shoulder-advanced", "no fatigue preserves the existing score ordering");
const fatiguedShoulder = rank(shoulderPrograms, condition("SHOULDER", ["SHOULDER"]));
assert.equal(fatiguedShoulder?.program.id, "shoulder-recovery", "overlapping fatigue favors lower-demand candidate");
assert.ok(fatiguedShoulder?.trace.decisionFactors.some((factor) => factor.label === "Fatigue Target"), "fatigue modifier remains explainable");
const chestPrograms = [program("chest-advanced", "CHEST", "ADVANCED", 24), program("chest-recovery", "CHEST", "BEGINNER", 10)];
assert.equal(rank(chestPrograms, condition("CHEST"))?.program.id, rank(chestPrograms, condition("CHEST", ["LOWER_BODY"]))?.program.id, "non-overlapping fatigue does not change another target group");
console.log("Fatigue-target recommendation checks: PASS");
