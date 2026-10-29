import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveA5WorkoutLayout } from "../src/features/printing/services/a5WorkoutLayoutService";
import { programFromSessionPrescription } from "../src/features/printing/services/printPreviewAuthorityResolver";
import type { WorkoutSessionRecord } from "../src/features/workout-sessions/domain/workoutSession.types";

const expected = new Map([[1, "standard"], [2, "standard"], [3, "standard"], [4, "standard"], [5, "standard"], [6, "standard"], [7, "standard"], [8, "standard"]]);
for (const [count, density] of expected) {
  const layout = resolveA5WorkoutLayout(count);
  assert.equal(layout.density, density);
  assert.equal(layout.exerciseCount, count);
  assert.equal(layout.topBindingSafeAreaMm, 14);
  assert.equal(layout.showExerciseMemo, true);
  assert.equal(layout.setLayout, "four-set-with-note");
}
assert.equal(resolveA5WorkoutLayout(0).density, "invalid", "zero is explicit rather than silently treated as one");
assert.equal(resolveA5WorkoutLayout(9).density, "standard", "legacy overflow remains structurally representable");
assert.deepEqual(resolveA5WorkoutLayout(9), resolveA5WorkoutLayout(9), "layout resolution is deterministic");

const mapperSource = readFileSync("src/features/printing/mappers/workoutPrintMapper.ts", "utf8");
assert.doesNotMatch(mapperSource, /최대 8개까지만 출력/);
assert.match(mapperSource, /resolveA5WorkoutLayout\(program\.exercises\.length, program\.exercises\.map/);

const session = { programSnapshot: { title: "Prescription" }, prescription: { sourceProgramId: "program", sourceProgramName: "Prescription", exercises: [{ exerciseId: "catalog-a", programExerciseId: "transient-a", name: "Exercise A", order: 2, plannedSets: 4, memo: "memo A" }, { exerciseId: "catalog-b", programExerciseId: "transient-b", name: "Exercise B", order: 1, plannedSets: 2, memo: "memo B" }] } } as WorkoutSessionRecord;
const prescriptionProgram = programFromSessionPrescription(session);
assert.deepEqual(prescriptionProgram.exercises.map((exercise) => exercise.sets), [2, 4], "final plannedSets survive into print configured sets");
assert.deepEqual(prescriptionProgram.exercises.map((exercise) => exercise.order), [1, 2], "session prescription order survives print mapping");
assert.equal(resolveA5WorkoutLayout(4).minimumRowCount, 6, "four exercises receive two handwritten rows");
assert.equal(resolveA5WorkoutLayout(5).minimumRowCount, 7, "five exercises receive two handwritten rows");
assert.equal(resolveA5WorkoutLayout(6).minimumRowCount, 8, "six exercises reach the A5 maximum");
assert.equal(resolveA5WorkoutLayout(8).minimumRowCount, 8, "the A5 template never exceeds eight rows");
assert.equal(resolveA5WorkoutLayout(5, [4, 4, 5, 4, 4]).setLayout, "five-set", "one five-set exercise selects the document-wide five-set layout");
assert.equal(resolveA5WorkoutLayout(5, [4, 4, 5, 4, 4]).showExerciseMemo, false, "five-set layout removes the note column from every row");
console.log("A5 workout layout checks: PASS");
