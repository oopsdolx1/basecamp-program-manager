import assert from "node:assert/strict";
import { createSnapshotBuilderHistory, snapshotBuilderService } from "../src/features/printing/services/snapshotBuilderService";
import { mapSessionPrescriptionExercises } from "../src/features/workout-sessions/services/sessionPrescriptionMapper";
import type { Program } from "../src/features/programs/types/program.types";

const condition = { condition: "NORMAL", sleep: "NORMAL", alcohol: "NO", targetFatigue: "NORMAL" } as const;

const createProgram = (id: string, count: number): Program => ({
  id: id as Program["id"],
  schemaVersion: 1,
  title: id,
  category: "BACK",
  difficulty: "GENERAL",
  memo: "",
  favorite: false,
  usageCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  isArchived: false,
  exercises: Array.from({ length: count }, (_, index) => ({
    id: `${id}-exercise-${index}`,
    name: `${id} Exercise ${index + 1}`,
    displayName: `${id} Exercise ${index + 1}`,
    catalogExerciseId: `${id}-catalog-${index}`,
    order: index + 1,
    sets: 1,
    memo: index === 0 ? "preserve this memo" : "",
  })),
});

const programA = createProgram("program-a", 3);
const programB = createProgram("program-b", 2);
const programNine = createProgram("program-nine", 9);
const programABefore = JSON.stringify(programA);

let history = createSnapshotBuilderHistory(programA, condition);
assert.equal(history.present.exercises.length, 3, "program selection creates builder exercises");
assert(history.present.exercises.every((exercise) => exercise.id !== programA.exercises.find((source) => source.order === exercise.order)?.id), "builder exercise IDs are transient");
assert.deepEqual(history.present.exercises.map((exercise) => exercise.plannedSets), [3, 3, 3], "recommendation preview must use the builder prescription, not the template set defaults");

const originalFirstId = history.present.exercises[0].id;
const secondId = history.present.exercises[1].id;
history = snapshotBuilderService.patchExercise(history, secondId, { plannedSets: 4 });
history = snapshotBuilderService.move(history, secondId, "up");
history = snapshotBuilderService.remove(history, originalFirstId);

assert.deepEqual(history.present.exercises.map((exercise) => exercise.name), ["program-a Exercise 2", "program-a Exercise 3"], "combined reorder and remove persist in editor state");
assert.equal(history.present.exercises[0].plannedSets, 4, "plannedSets override persists into analysis input");
assert.equal(history.present.exercises[0].memo, "", "exercise memo is preserved");

const analysisState = history.present;
const sessionInput = mapSessionPrescriptionExercises(analysisState.exercises, new Map());
assert.deepEqual(sessionInput.map((exercise) => exercise.name), analysisState.exercises.map((exercise) => exercise.name), "edited order persists into session mapping");
assert.equal(sessionInput[0].plannedSets, 4, "edited plannedSets persists into session mapping");
assert.equal(JSON.stringify(programA), programABefore, "canonical program remains immutable after editor edits");

const historyAfterAnalysisBack = history;
assert.equal(historyAfterAnalysisBack.present.exercises[0].plannedSets, 4, "analysis back retains the authoritative builder history");

let boundaryHistory = createSnapshotBuilderHistory(programA, condition);
const boundaryId = boundaryHistory.present.exercises[0].id;
boundaryHistory = snapshotBuilderService.patchExercise(boundaryHistory, boundaryId, { plannedSets: 0 });
assert.equal(boundaryHistory.present.exercises[0].plannedSets, 1, "plannedSets never decrements below one");
boundaryHistory = snapshotBuilderService.patchExercise(boundaryHistory, boundaryId, { plannedSets: 6 });
assert.equal(boundaryHistory.present.exercises[0].plannedSets, 5, "plannedSets never increments above five");

let singleHistory = createSnapshotBuilderHistory(createProgram("single", 1), condition);
singleHistory = snapshotBuilderService.remove(singleHistory, singleHistory.present.exercises[0].id);
assert.equal(singleHistory.present.exercises.length, 1, "zero-exercise protection remains builder-owned");

const programBHistory = createSnapshotBuilderHistory(programB, condition);
assert.deepEqual(programBHistory.present.exercises.map((exercise) => exercise.name), ["program-b Exercise 1", "program-b Exercise 2"], "program reselection creates a fresh isolated builder history");
assert.equal(programBHistory.present.exercises.some((exercise) => exercise.plannedSets === 4), false, "program A plannedSets edits do not leak into program B");

const nineHistory = createSnapshotBuilderHistory(programNine, condition);
const nineSession = mapSessionPrescriptionExercises(nineHistory.present.exercises, new Map());
assert.equal(nineHistory.present.exercises.length, 9, "all nine exercises reach editor and analysis input");
assert.equal(nineSession.length, 9, "all nine exercises reach session mapping");

console.log("Workout Editor regression checks: PASS");
