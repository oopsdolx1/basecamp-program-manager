import assert from "node:assert/strict";
import { createTrainerPromptMemory, decideTrainerPrompt, type KioskRecommendationState } from "../src/features/kiosk-recommendations/trainerRecommendationPrompt";
import { createRecommendationBuilderHistory } from "../src/features/printing/services/recommendationBuilderService";
import { createRecommendationCardExercises, formatRecommendationSets } from "../src/features/printing/services/recommendationCardPresentationService";

const program = { id: "p", name: "추천", isDefault: true, exercises: Array.from({ length: 6 }, (_, index) => ({ exerciseId: `e${index + 1}`, name: `운동 ${index + 1}`, order: index + 1, plannedSets: 3, ...(index === 0 ? { memo: "메모" } : {}) })) };
const A = "a"; const B = "b";
const ready: KioskRecommendationState = { status: "ready", memberId: A, program };
assert.equal(decideTrainerPrompt({ status: "loading", memberId: A }, A, false).kind, "checking");
assert.equal(decideTrainerPrompt(ready, A, false).kind, "prompt");
assert.equal(decideTrainerPrompt(ready, B, false).kind, "checking");
assert.equal(decideTrainerPrompt({ status: "none", memberId: A }, A, false).kind, "none");
assert.equal(decideTrainerPrompt({ status: "error", memberId: A }, A, false).kind, "error");
assert.equal(decideTrainerPrompt(ready, A, true).kind, "none");
let clock = 0; const memory = createTrainerPromptMemory({ now: () => clock, ttlMs: 10 }); memory.mark(A); assert(memory.has(A)); clock = 10; assert(!memory.has(A));
const rows = createRecommendationCardExercises(createRecommendationBuilderHistory(program).present.exercises);
assert.equal(rows.length, 6); assert.deepEqual(rows.map((row) => row.order), [1, 2, 3, 4, 5, 6]); assert(rows.every((row) => formatRecommendationSets(row) === "3 SET"));
console.log("Trainer recommendation prompt checks: PASS");
