import assert from "node:assert/strict";
import { recommendProgram } from "../src/features/printing/services/conditionRecommendationService";
import { MAX_WORKOUT_TARGET_SELECTIONS, toggleWorkoutTarget } from "../src/features/printing/services/workoutTargetSelectionService";
import type { ConditionInput } from "../src/features/printing/types/condition.types";
import type { Program } from "../src/features/programs/types/program.types";

const select = (...targets: Parameters<typeof toggleWorkoutTarget>[0]) => targets.reduce((result, target) => {
  assert.equal(result.message, undefined, `${target} selection should be accepted`);
  return toggleWorkoutTarget(result.targets, target);
}, { targets: [] } as ReturnType<typeof toggleWorkoutTarget>);

assert.deepEqual(select("RECOVERY").targets, ["RECOVERY"], "recovery-only selection is accepted");
assert.deepEqual(select("BACK", "RECOVERY").targets, ["BACK", "RECOVERY"], "back plus recovery is accepted");
assert.deepEqual(select("SHOULDER", "RECOVERY").targets, ["SHOULDER", "RECOVERY"], "shoulder plus recovery is accepted");
assert.deepEqual(select("BACK", "SHOULDER", "RECOVERY").targets, ["BACK", "SHOULDER", "RECOVERY"], "three-target selection including recovery is accepted");
const overLimit = toggleWorkoutTarget(["BACK", "SHOULDER", "RECOVERY"], "CHEST");
assert.equal(overLimit.message?.includes(`${MAX_WORKOUT_TARGET_SELECTIONS}개까지`), true, "existing maximum selection rule remains enforced");

const program = (id: string, category: Program["category"]): Program => ({
  id: id as Program["id"], schemaVersion: 1, title: id, category, difficulty: "GENERAL", exercises: [{ id: `${id}-exercise`, name: id, order: 1, sets: 3 }], createdAt: new Date(0), updatedAt: new Date(0), usageCount: 0, favorite: false, isArchived: false,
});
const condition: ConditionInput = { condition: "NORMAL", sleep: "NORMAL", workoutTarget: "BACK", workoutTargets: ["BACK", "RECOVERY"], targetFatigue: "NORMAL", fatigueAreas: [], fatigueTargets: [], stress: 3, alcohol: "NO" };
const programs = [program("back-program", "BACK"), program("recovery-program", "RECOVERY")];
assert.equal(recommendProgram(programs, condition, null, null, null, [], [])?.program.id, "back-program", "combined input keeps the ordinary body-part recommendation active");
assert.equal(recommendProgram(programs, { ...condition, workoutTarget: "RECOVERY" }, null, null, null, [], [])?.program.id, "recovery-program", "combined input creates a recovery recommendation without invalid input");

console.log("Workout target selection checks: PASS");
