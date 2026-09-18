import assert from "node:assert/strict";
import { createSnapshotBuilderHistory, evaluateExerciseAdd, snapshotBuilderService } from "../src/features/printing/services/snapshotBuilderService";
import { mapSessionPrescriptionExercises } from "../src/features/workout-sessions/services/sessionPrescriptionMapper";
import type { ExerciseCatalogOption } from "../src/features/exercise-catalog";
import type { Program } from "../src/features/programs/types/program.types";

const condition = { condition: "NORMAL", sleep: "NORMAL", alcohol: "NO", targetFatigue: "NORMAL" } as const;
const catalog = (id: string, name: string): ExerciseCatalogOption => ({ id, name, displayName: name, englishName: null, aliases: [], category: "chest", categoryLabel: "가슴", equipmentType: "machine", equipmentLabel: "머신", bodyPart: "chest", equipment: "machine" });
const program: Program = {
  id: "program" as Program["id"], schemaVersion: 1, title: "Fixture", category: "CHEST", difficulty: "GENERAL", memo: "", favorite: false, usageCount: 0, createdAt: new Date(), updatedAt: new Date(), isArchived: false,
  exercises: [
    { id: "source-a", name: "Chest Press", displayName: "Chest Press", catalogExerciseId: "catalog-a", order: 1, sets: 3, memo: "" },
    { id: "source-b", name: "Incline Chest Press", displayName: "Incline Chest Press", catalogExerciseId: "catalog-b", order: 2, sets: 3, memo: "" },
  ],
};
const original = JSON.stringify(program);
let history = createSnapshotBuilderHistory(program, condition);
const beforeDuplicate = JSON.stringify(history);

assert.deepEqual(evaluateExerciseAdd(history.present.exercises, catalog("catalog-a", "Chest Press")), { allowed: false, reason: "duplicate" }, "same catalog identity is duplicate despite a different transient row ID");
const duplicate = snapshotBuilderService.addExercise(history, catalog("catalog-a", "Chest Press"));
assert.deepEqual(duplicate.eligibility, { allowed: false, reason: "duplicate" });
assert.equal(JSON.stringify(duplicate.history), beforeDuplicate, "duplicate add attempt is mutation-free");
assert.deepEqual(evaluateExerciseAdd(history.present.exercises, catalog("catalog-c", "Cable Fly")), { allowed: true }, "different catalog exercise is eligible");
assert.deepEqual(evaluateExerciseAdd(history.present.exercises, catalog("catalog-d", "Chest Press")), { allowed: true }, "similar names with different catalog identities are not false positives");

const legacyHistory = createSnapshotBuilderHistory({ ...program, exercises: [{ id: "legacy", name: "Lat Pulldown", displayName: "Lat Pulldown", order: 1, sets: 3, memo: "" }] }, condition);
assert.deepEqual(evaluateExerciseAdd(legacyHistory.present.exercises, " lat   pulldown "), { allowed: false, reason: "duplicate" }, "legacy rows use normalized-name fallback only when both sides lack catalog identity");

const added = snapshotBuilderService.addExercise(history, catalog("catalog-c", "Cable Fly"));
assert.deepEqual(added.eligibility, { allowed: true });
history = added.history;
const addedExercise = history.present.exercises.at(-1)!;
assert.equal(history.present.exercises.length, 3);
assert.notEqual(addedExercise.id, "source-a", "successful add creates a transient identity");
assert.notEqual(addedExercise.id, history.present.exercises[0].id, "new transient identity is unique");
assert.equal(addedExercise.catalogExerciseId, "catalog-c", "catalog semantic identity is retained");
assert.equal(addedExercise.plannedSets, 3, "existing addBlank plannedSets contract is retained");
assert.equal(JSON.stringify(program), original, "successful add leaves canonical Program immutable");

const session = mapSessionPrescriptionExercises(history.present.exercises, new Map());
assert.equal(session.at(-1)?.exerciseId, "catalog-c", "added catalog identity survives session mapping");
console.log("Exercise ADD duplicate protection checks: PASS");
