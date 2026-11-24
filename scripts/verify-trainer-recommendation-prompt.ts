import assert from "node:assert/strict";
import { createTrainerPromptMemory, decideTrainerPrompt, TRAINER_PROMPT_MEMORY_TTL_MS, type KioskRecommendationState } from "../src/features/kiosk-recommendations/trainerRecommendationPrompt";
import type { RecommendedProgram } from "../src/features/printing/services/recommendationBuilderService";

const program: RecommendedProgram = { id: "member_program_a", name: "트레이너 하체 루틴", isDefault: true, exercises: [{ exerciseId: "squat", name: "스쿼트", order: 1, plannedSets: 4 }] };
const A = "member_a"; const B = "member_b";
const cases: Array<[string, KioskRecommendationState, string | null, boolean, string]> = [
  ["no member selected", { status: "idle" }, null, false, "none"],
  ["Kiosk API not configured", { status: "disabled" }, A, false, "none"],
  ["selected, lookup not started yet (idle) is not 'no recommendation'", { status: "idle" }, A, false, "checking"],
  ["loading is not 'no recommendation'", { status: "loading", memberId: A }, A, false, "checking"],
  ["previous member's program is never shown for the new member", { status: "ready", memberId: A, program }, B, false, "checking"],
  ["previous member's null is not this member's null", { status: "none", memberId: A }, B, false, "checking"],
  ["previous member's error is not this member's error", { status: "error", memberId: A }, B, false, "checking"],
  ["program for this member → prompt", { status: "ready", memberId: A, program }, A, false, "prompt"],
  ["already shown in this flow → no repeat", { status: "ready", memberId: A, program }, A, true, "none"],
  ["null response → no popup", { status: "none", memberId: A }, A, false, "none"],
  ["error is distinct from null", { status: "error", memberId: A }, A, false, "error"],
];
for (const [name, state, memberId, prompted, expected] of cases) {
  const decision = decideTrainerPrompt(state, memberId, prompted);
  assert.equal(decision.kind, expected, name);
  if (decision.kind === "prompt") assert.equal(decision.program, program, `${name}: the original program object, unchanged`);
  console.log(`PASS ${name}`);
}

let clock = 1_000;
const memory = createTrainerPromptMemory({ now: () => clock });
assert.equal(memory.has(A), false);
memory.mark(A);
assert.equal(memory.has(A), true, "marked member is remembered");
assert.equal(memory.has(B), false, "other members unaffected");
clock += TRAINER_PROMPT_MEMORY_TTL_MS - 1;
assert.equal(memory.has(A), true, "still the same flow just before the TTL");
clock += 1;
assert.equal(memory.has(A), false, "a later visit after the TTL is a new flow");
memory.mark(B); memory.clear();
assert.equal(memory.has(B), false, "clear forgets everything");
console.log("PASS prompt memory: per member, TTL-bounded, memory only");
console.log(`\n${cases.length + 1}/${cases.length + 1} passed`);
