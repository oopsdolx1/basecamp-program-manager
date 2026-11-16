import assert from "node:assert/strict";
import { recommendProgram } from "../src/features/printing/services/conditionRecommendationService";
import { MAX_WORKOUT_TARGET_SELECTIONS, toggleWorkoutTarget } from "../src/features/printing/services/workoutTargetSelectionService";
import { mapProgramDocument } from "../src/features/programs/mappers/programMapper";
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
const fullBody = toggleWorkoutTarget(["BACK"], "FULL_BODY");
assert.deepEqual(fullBody.targets, ["FULL_BODY"], "full body clears other recommendation targets");
assert.equal(fullBody.directComposition, true, "full body opens the existing direct-composition flow");
assert.equal(toggleWorkoutTarget(["FULL_BODY"], "BACK").message, "전신 운동은 원하는 운동 종목을 직접 선택해 주세요.", "full body combination gives a direct-composition instruction");

const program = (id: string, category: Program["category"]): Program => ({
  id: id as Program["id"], schemaVersion: 1, title: id, category, difficulty: "GENERAL", exercises: [{ id: `${id}-exercise`, name: id, order: 1, sets: 3 }], createdAt: new Date(0), updatedAt: new Date(0), usageCount: 0, favorite: false, isArchived: false,
});
const condition: ConditionInput = { condition: "NORMAL", sleep: "NORMAL", workoutTarget: "BACK", workoutTargets: ["BACK", "RECOVERY"], targetFatigue: "NORMAL", fatigueAreas: [], fatigueTargets: [], stress: 3, alcohol: "NO" };
const administratorStoredRecovery = mapProgramDocument("recovery-document", {
  title: "회복 전면 테스트", category: "CUSTOM", difficulty: "BEGINNER", memo: "회복 리커버리", exercises: [{ id: "recovery-exercise", name: "회복 운동", sets: 3, order: 1 }], favorite: false, usageCount: 0, isArchived: false, createdAt: new Date(0), updatedAt: new Date(0),
} as never);
assert.equal(administratorStoredRecovery.category, "RECOVERY", "actual administrator recovery document shape maps to RECOVERY");
assert.equal(mapProgramDocument("legacy-label", { category: "리커버리", title: "legacy", exercises: [] } as never).category, "RECOVERY", "Korean recovery goal label maps to RECOVERY");
for (const [stored, category] of [["CHEST", "CHEST"], ["BACK", "BACK"], ["SHOULDER", "SHOULDER"], ["LOWER_BODY", "LOWER_BODY"]] as const) {
  assert.equal(mapProgramDocument(`normal-${stored}`, { category: stored, title: stored, exercises: [] } as never).category, category, `${stored} mapping remains unchanged`);
}
const programs = [program("back-program", "BACK"), administratorStoredRecovery];
assert.equal(recommendProgram(programs, condition, null, null, null, [], [])?.program.id, "back-program", "combined input keeps the ordinary body-part recommendation active");
assert.equal(recommendProgram(programs, { ...condition, workoutTarget: "RECOVERY" }, null, null, null, [], [])?.program.id, "recovery-document", "combined input creates a recovery recommendation from the mapped administrator document");
assert.equal(recommendProgram([program("back-only", "BACK")], { ...condition, workoutTarget: "RECOVERY" }, null, null, null, [], []), null, "only a genuinely absent recovery program yields no recommendation");

console.log("Workout target selection checks: PASS");
