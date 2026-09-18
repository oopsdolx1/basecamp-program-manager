import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveA5WorkoutLayout } from "../src/features/printing/services/a5WorkoutLayoutService";
import { programFromSessionPrescription } from "../src/features/printing/services/printPreviewAuthorityResolver";
import type { WorkoutSessionRecord } from "../src/features/workout-sessions/domain/workoutSession.types";

const expected = new Map([[1, "relaxed"], [2, "relaxed"], [3, "relaxed"], [4, "relaxed"], [5, "compact"], [6, "compact"], [7, "compact"], [8, "dense"], [9, "dense"]]);
for (const [count, density] of expected) {
  const layout = resolveA5WorkoutLayout(count);
  assert.equal(layout.density, density);
  assert.equal(layout.exerciseCount, count);
  assert.equal(layout.topBindingSafeAreaMm, 14);
  assert.equal(layout.showExerciseMemo, true);
}
assert.equal(resolveA5WorkoutLayout(0).density, "invalid", "zero is explicit rather than silently treated as one");
assert.equal(resolveA5WorkoutLayout(10).density, "dense", "more than nine uses presentation density without a workout max");
assert.deepEqual(resolveA5WorkoutLayout(9), resolveA5WorkoutLayout(9), "layout resolution is deterministic");

const mapperSource = readFileSync("src/features/printing/mappers/workoutPrintMapper.ts", "utf8");
assert.doesNotMatch(mapperSource, /최대 8개까지만 출력/);
assert.match(mapperSource, /resolveA5WorkoutLayout\(program\.exercises\.length\)/);

const session = { prescription: { sourceProgramId: "program", sourceProgramName: "Prescription", exercises: [{ exerciseId: "catalog-a", programExerciseId: "transient-a", name: "Exercise A", order: 2, plannedSets: 4, memo: "memo A" }, { exerciseId: "catalog-b", programExerciseId: "transient-b", name: "Exercise B", order: 1, plannedSets: 2, memo: "memo B" }] } } as WorkoutSessionRecord;
const prescriptionProgram = programFromSessionPrescription(session);
assert.deepEqual(prescriptionProgram.exercises.map((exercise) => exercise.sets), [2, 4], "final plannedSets survive into print configured sets");
assert.deepEqual(prescriptionProgram.exercises.map((exercise) => exercise.order), [1, 2], "session prescription order survives print mapping");
assert.equal(resolveA5WorkoutLayout(9).minimumRowCount, 9, "all nine exercises receive rows");
assert.equal(resolveA5WorkoutLayout(10).minimumRowCount, 10, "overflow remains representable without a domain max");
console.log("A5 workout layout checks: PASS");
