import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRecommendationCardExercises, formatRecommendationSets } from "../src/features/printing/services/recommendationCardPresentationService";
import { createSnapshotBuilderState } from "../src/features/printing/services/snapshotBuilderService";
import { mapSessionPrescriptionExercises } from "../src/features/workout-sessions/services/sessionPrescriptionMapper";
import type { Program } from "../src/features/programs/types/program.types";

const program = (sets: number[]): Program => ({
  id: "recommendation-card-fixture" as Program["id"],
  title: "추천 카드 fixture",
  schemaVersion: 1,
  category: "CHEST",
  difficulty: "GENERAL",
  memo: "",
  favorite: false,
  exercises: sets.map((baseSets, index) => ({
    id: `row-${index + 1}`,
    catalogExerciseId: `exercise-${index + 1}`,
    name: `운동 ${index + 1}`,
    displayName: `운동 ${index + 1}`,
    order: index + 1,
    sets: baseSets,
    memo: "",
  })),
  createdAt: new Date(),
  updatedAt: new Date(),
  usageCount: 0,
  isArchived: false,
});

const neutral = { condition: "NORMAL" as const, sleep: "NORMAL" as const, alcohol: "NO" as const };
const sessionRows = (state: ReturnType<typeof createSnapshotBuilderState>) =>
  mapSessionPrescriptionExercises(state.exercises, new Map(state.exercises.map((exercise) => [exercise.id, { id: exercise.catalogExerciseId ?? exercise.id, name: exercise.name }])));

// Case A: all base sets are one, but the neutral daily prescription is three.
const fourState = createSnapshotBuilderState(program([1, 1, 1, 1]), neutral);
const fourCard = createRecommendationCardExercises(fourState.exercises);
assert.equal(fourCard.length, 4);
assert.deepEqual(fourCard.map(({ order, baseSets, plannedSets }) => [order, baseSets, plannedSets]), [[1, 1, 3], [2, 1, 3], [3, 1, 3], [4, 1, 3]]);
assert.ok(fourCard.every((exercise) => formatRecommendationSets(exercise) === "오늘 3세트 · 기본 1세트"));
assert.deepEqual(sessionRows(fourState).map(({ order, plannedSets }) => [order, plannedSets]), fourCard.map(({ order, plannedSets }) => [order, plannedSets]));

// Case B: the presentation keeps every ordered row; its scroll container belongs to the UI, not this data model.
const sixState = createSnapshotBuilderState(program([1, 2, 3, 4, 5, 1]), neutral);
const sixCard = createRecommendationCardExercises(sixState.exercises);
assert.equal(sixCard.length, 6);
assert.deepEqual(sixCard.map(({ order }) => order), [1, 2, 3, 4, 5, 6]);
assert.deepEqual(sessionRows(sixState).map(({ order, plannedSets }) => [order, plannedSets]), sixCard.map(({ order, plannedSets }) => [order, plannedSets]));

// Case C: the concise label is used when base and today values already agree.
const equalState = createSnapshotBuilderState(program([3]), neutral);
assert.equal(formatRecommendationSets(createRecommendationCardExercises(equalState.exercises)[0]), "3 SET");

const flow = readFileSync("src/features/printing/components/QuickPrintFlow/QuickPrintFlow.tsx", "utf8");
assert.doesNotMatch(flow, /selectedRecommendationProgram\.exercises\.slice\(0, 4\)/, "recommendation cards do not truncate the exercise list");
assert.match(flow, /selectedRecommendationExercises\.map\(/, "recommendation cards render the planned-prescription rows");
assert.match(flow, /maxHeight: \{ md: 320, xs: 260 \},[\s\S]*overflowY: "auto"/, "long recommendation lists scroll inside their card");

console.log("Recommendation card prescription checks: PASS (4-row, 6-row, equal-set parity, full-list scroll UI)");
