import assert from "node:assert/strict";
import { buildExerciseAddCandidates } from "../src/features/printing/services/exerciseAddCandidateService";
import { createSnapshotBuilderHistory, snapshotBuilderService } from "../src/features/printing/services/snapshotBuilderService";
import { mapSessionPrescriptionExercises } from "../src/features/workout-sessions/services/sessionPrescriptionMapper";
import type { ExerciseCatalogOption } from "../src/features/exercise-catalog";
import type { Program } from "../src/features/programs/types/program.types";

const option = (id: string, name: string): ExerciseCatalogOption => ({ id, name, displayName: `${name} Display`, englishName: null, aliases: [], category: "chest", categoryLabel: "가슴", equipmentType: "machine", equipmentLabel: "머신", bodyPart: "chest", equipment: "machine" });
const condition = { condition: "NORMAL", sleep: "NORMAL", alcohol: "NO", targetFatigue: "NORMAL" } as const;
const program: Program = { id: "program" as Program["id"], schemaVersion: 1, title: "Fixture", category: "CHEST", difficulty: "GENERAL", memo: "", favorite: false, usageCount: 0, createdAt: new Date(), updatedAt: new Date(), isArchived: false, exercises: [{ id: "source", name: "Chest Press", displayName: "Chest Press", catalogExerciseId: "catalog-a", order: 1, sets: 3, memo: "" }] };
const options = [option("catalog-a", "Chest Press"), option("catalog-b", "Incline Chest Press"), option("catalog-c", "Cable Fly")];
const optionsBefore = JSON.stringify(options);
let history = createSnapshotBuilderHistory(program, condition);
const exercisesBefore = JSON.stringify(history.present.exercises);

const candidates = buildExerciseAddCandidates(options, history.present.exercises);
assert.deepEqual(candidates.map(({ candidate }) => candidate.id), ["catalog-a", "catalog-b", "catalog-c"], "catalog IDs and source order are preserved");
assert.equal(candidates[0].candidate.displayName, "Chest Press Display", "catalog display name is preserved");
assert.deepEqual(candidates.map(({ eligibility }) => eligibility), [{ allowed: false, reason: "duplicate" }, { allowed: true }, { allowed: true }], "duplicate eligibility is retained for future UI feedback");
assert.deepEqual(buildExerciseAddCandidates(options, history.present.exercises), candidates, "candidate order is deterministic");
assert.equal(JSON.stringify(options), optionsBefore, "catalog options are not mutated");
assert.equal(JSON.stringify(history.present.exercises), exercisesBefore, "builder exercises are not mutated");
assert.deepEqual(buildExerciseAddCandidates([], history.present.exercises), [], "empty catalog has no mock fallback");
assert(candidates.every(({ eligibility }) => !eligibility.allowed || eligibility.reason === undefined), "all candidates retain explicit eligibility semantics");

const sameNameDifferentId = buildExerciseAddCandidates([option("catalog-d", "Chest Press")], history.present.exercises);
assert.deepEqual(sameNameDifferentId[0].eligibility, { allowed: true }, "same name with a different stable catalog ID remains eligible");
const legacyHistory = createSnapshotBuilderHistory({ ...program, exercises: [{ id: "legacy", name: "Lat Pulldown", displayName: "Lat Pulldown", order: 1, sets: 3, memo: "" }] }, condition);
assert.deepEqual(buildExerciseAddCandidates([], legacyHistory.present.exercises), [], "identity-less legacy rows do not create candidates without production catalog input");

const allDuplicate = buildExerciseAddCandidates([option("catalog-a", "Chest Press")], history.present.exercises);
assert.deepEqual(allDuplicate[0].eligibility, { allowed: false, reason: "duplicate" }, "all-duplicate result remains explicit rather than falling back");
const addResult = snapshotBuilderService.addExercise(history, candidates[2].candidate);
assert.deepEqual(addResult.eligibility, { allowed: true }, "eligible selector candidate enters guarded add core");
history = addResult.history;
assert.equal(history.present.exercises.at(-1)?.catalogExerciseId, "catalog-c");
assert.equal(mapSessionPrescriptionExercises(history.present.exercises, new Map()).at(-1)?.exerciseId, "catalog-c", "catalog identity continues into session mapping");
console.log("Exercise ADD candidate checks: PASS");
