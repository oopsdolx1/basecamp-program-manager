import assert from "node:assert/strict";
import { mapSessionPrescriptionExercises } from "../src/features/workout-sessions/services/sessionPrescriptionMapper";
const input = Array.from({ length: 9 }, (_, i) => ({ id: `t${i}`, name: `Exercise ${i}`, displayName: `Exercise ${i}`, order: i + 1, plannedSets: [1,2,3,4,5,2,3,4,5][i], memo: i % 2 ? "" : `memo-${i}`, sets: 1, reps: "", weight: "0", restSeconds: 60, ...(i === 1 ? { catalogExerciseId: "catalog-fallback" } : i === 2 ? {} : { catalogExerciseId: `catalog-${i}` }) }));
const before = JSON.stringify(input); const resolved = new Map([["t0", { id: "resolved-id", name: "Resolved" }]]);
const output = mapSessionPrescriptionExercises(input, resolved);
assert.equal(output.length, 9); output.forEach((item, i) => { assert.equal(item.order, i + 1); assert.equal(item.plannedSets, input[i].plannedSets); assert.equal(item.memo, input[i].memo); });
assert.equal(output[0].exerciseId, "resolved-id"); assert.equal(output[1].exerciseId, "catalog-fallback"); assert.equal(output[2].exerciseId, "t2"); assert.equal(JSON.stringify(input), before); assert.notEqual(output[0], input[0]);
console.log("Session prescription mapper checks: PASS");
