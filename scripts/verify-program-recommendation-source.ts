import assert from "node:assert/strict";
import { hydrateProgramExerciseKnowledge, resolveProgramExerciseKnowledgeFromCatalog } from "../src/shared-knowledge/programExerciseMetadata";
import { recommendProgram } from "../src/features/printing/services/conditionRecommendationService";
import type { Program } from "../src/features/programs/types/program.types";

const source = {
  id: "program-source" as Program["id"], schemaVersion: 1, title: "원본 처방", category: "LOWER_BODY", difficulty: "GENERAL",
  memo: "", favorite: false, usageCount: 0, isArchived: false, createdAt: new Date(0), updatedAt: new Date(0),
  exercises: [
    { id: "row-1", name: "프로그램 스쿼트", displayName: "프로그램 스쿼트", catalogExerciseId: "squat", sets: 4, memo: "8회", order: 2 },
    // A duplicate runtime alias used to overwrite this prescribed name with another catalog item.
    { id: "row-2", name: "프로그램 런지", displayName: "프로그램 런지", catalogExerciseId: "missing-id", sets: 3, memo: "시간 40초", order: 1 },
  ],
} satisfies Program;

const catalog = [
  { id: "squat", memberWhy: "catalog metadata", bodyPart: "하체" },
  { id: "other-lunge", memberWhy: "unrelated metadata", bodyPart: "하체" },
];

const hydrated = hydrateProgramExerciseKnowledge([source])[0];
assert.deepEqual(hydrated.exercises, source.exercises, "hydration must preserve the exact persisted exercise list");
const resolved = resolveProgramExerciseKnowledgeFromCatalog(source, catalog);
assert.deepEqual([...resolved.values()].map((item) => [item.id, item.name, item.metadataMissing]), [
  ["squat", "프로그램 스쿼트", false],
  ["missing-id", "프로그램 런지", true],
], "catalog lookup is ID-only and never substitutes a missing exercise");

const programs = Array.from({ length: 36 }, (_, index): Program => ({
  ...source,
  id: `program-${index}` as Program["id"],
  isArchived: index >= 26,
  usageCount: index === 0 ? 12 : 0,
  exercises: source.exercises.map((exercise) => ({ ...exercise })),
}));
const runtimePrograms = hydrateProgramExerciseKnowledge(programs);
assert.equal(runtimePrograms.filter((program) => !program.isArchived).length, 26, "active program count");
assert.equal(runtimePrograms.filter((program) => program.isArchived).length, 10, "archived program count");
const recommendation = recommendProgram(runtimePrograms, {
  workoutTarget: "LOWER_BODY", targetFatigue: "NORMAL", fatigueAreas: [], stress: 3, condition: "NORMAL", sleep: "NORMAL", alcohol: "NO",
}, null, null, null, [], []);
assert.equal(recommendation?.program.id, programs[0].id, "selected programId remains the source document id");
assert.deepEqual(recommendation?.program.exercises.map(({ id, name, order, sets, memo, catalogExerciseId }) => ({ id, name, order, sets, memo, catalogExerciseId })), source.exercises.map(({ id, name, order, sets, memo, catalogExerciseId }) => ({ id, name, order, sets, memo, catalogExerciseId })), "selected card model retains source exercise id/name/order/sets/prescription");
console.log("Program recommendation source-of-truth checks: PASS");
