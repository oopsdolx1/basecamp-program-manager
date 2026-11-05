import assert from "node:assert/strict";
import { getSingleTargetRecommendationAlternatives } from "../src/features/printing/services/singleTargetRecommendationSelectionService";
import type { Program } from "../src/features/programs/types/program.types";

const rankedPrograms = ["rank-1", "rank-2", "rank-3"].map((id) => ({ program: { id } as Program }));
const alternativesFor = (selectedProgramId: string) => getSingleTargetRecommendationAlternatives(rankedPrograms, selectedProgramId as Program["id"]).map(({ program, rank }) => ({ id: program.id, rank }));

assert.deepEqual(alternativesFor("rank-1"), [{ id: "rank-2", rank: 2 }, { id: "rank-3", rank: 3 }], "initial BEST selection renders ranks 2 and 3");
assert.deepEqual(alternativesFor("rank-3"), [{ id: "rank-1", rank: 1 }, { id: "rank-2", rank: 2 }], "rank 3 selection returns 01 BEST to the DOM alternatives");
assert.deepEqual(alternativesFor("rank-1"), [{ id: "rank-2", rank: 2 }, { id: "rank-3", rank: 3 }], "BEST can be reselected after rank 3");
assert.deepEqual(alternativesFor("rank-2"), [{ id: "rank-1", rank: 1 }, { id: "rank-3", rank: 3 }], "rank 2 selection preserves original rank labels");
assert.deepEqual(alternativesFor("rank-1"), [{ id: "rank-2", rank: 2 }, { id: "rank-3", rank: 3 }], "BEST -> 02 -> BEST -> 03 -> BEST ends on the original alternatives");
console.log("Single-target BEST reselection checks: PASS");
