import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSnapshotBuilderHistory, snapshotBuilderService } from "../src/features/printing/services/snapshotBuilderService";
import { buildExerciseAddCandidates } from "../src/features/printing/services/exerciseAddCandidateService";
import { mapSessionPrescriptionExercises } from "../src/features/workout-sessions/services/sessionPrescriptionMapper";
import type { ExerciseCatalogOption } from "../src/features/exercise-catalog";
import type { Program } from "../src/features/programs/types/program.types";

const flowSource = readFileSync("src/features/printing/components/QuickPrintFlow/QuickPrintFlow.tsx", "utf8");
assert.match(flowSource, /useExerciseCatalog/);
assert.match(flowSource, /buildExerciseAddCandidates/);
assert.match(flowSource, /snapshotBuilderService\.addExercise/);
assert.match(flowSource, />운동 추가</);
assert.doesNotMatch(flowSource, /slice\(0, 9\)/);

const option = (id: string, name: string): ExerciseCatalogOption => ({ id, name, displayName: name, englishName: null, aliases: [], category: "back", categoryLabel: "등", equipmentType: "machine", equipmentLabel: "머신", bodyPart: "back", equipment: "machine" });
const program: Program = { id: "program" as Program["id"], schemaVersion: 1, title: "Fixture", category: "BACK", difficulty: "GENERAL", memo: "", favorite: false, usageCount: 0, createdAt: new Date(), updatedAt: new Date(), isArchived: false, exercises: [{ id: "source", name: "Lat Pulldown", displayName: "Lat Pulldown", catalogExerciseId: "catalog-a", order: 1, sets: 3, memo: "" }] };
const original = JSON.stringify(program);
let history = createSnapshotBuilderHistory(program, { condition: "NORMAL", sleep: "NORMAL", alcohol: "NO", targetFatigue: "NORMAL" });
const catalog = [option("catalog-a", "Lat Pulldown"), option("catalog-b", "Cable Row"), option("catalog-c", "Face Pull")];
const candidates = buildExerciseAddCandidates(catalog, history.present.exercises);
assert.deepEqual(candidates.map(({ eligibility }) => eligibility), [{ allowed: false, reason: "duplicate" }, { allowed: true }, { allowed: true }]);

const duplicate = snapshotBuilderService.addExercise(history, candidates[0].candidate);
assert.deepEqual(duplicate.eligibility, { allowed: false, reason: "duplicate" });
assert.equal(JSON.stringify(duplicate.history), JSON.stringify(history));
const first = snapshotBuilderService.addExercise(history, candidates[1].candidate);
assert.deepEqual(first.eligibility, { allowed: true });
history = first.history;
const second = snapshotBuilderService.addExercise(history, candidates[2].candidate);
assert.deepEqual(second.eligibility, { allowed: true });
history = second.history;
assert.deepEqual(history.present.exercises.map((exercise) => exercise.catalogExerciseId), ["catalog-a", "catalog-b", "catalog-c"]);
assert.equal(new Set(history.present.exercises.map((exercise) => exercise.id)).size, 3, "multiple adds retain unique transient row IDs");
const repeated = snapshotBuilderService.addExercise(history, candidates[1].candidate);
assert.deepEqual(repeated.eligibility, { allowed: false, reason: "duplicate" });
assert.equal(JSON.stringify(program), original, "UI integration path does not mutate Program");
assert.deepEqual(mapSessionPrescriptionExercises(history.present.exercises, new Map()).map((exercise) => exercise.exerciseId), ["catalog-a", "catalog-b", "catalog-c"], "added candidates continue into session mapping");
console.log("Exercise ADD UI integration checks: PASS");
