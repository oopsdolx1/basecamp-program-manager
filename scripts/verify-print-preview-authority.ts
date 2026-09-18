import assert from "node:assert/strict";
import { resolvePrintPreviewSource } from "../src/features/printing/services/printPreviewAuthorityResolver";
import type { WorkoutSessionRecord } from "../src/features/workout-sessions/domain/workoutSession.types";
import type { Program } from "../src/features/programs/types/program.types";

const exercises = Array.from({ length: 9 }, (_, index) => ({ exerciseId: `catalog-${index + 1}`, programExerciseId: `source-${index + 1}`, name: `Exercise ${index + 1}`, order: index + 1, plannedSets: [2, 3, 4, 5][index % 4], memo: index === 2 ? "paired note" : "" }));
const session = { sessionId: "ws-test", memberId: "member", programId: "program", prescription: { sourceProgramId: "program", sourceProgramName: "Persisted Program", exercises } } as unknown as WorkoutSessionRecord;
let legacyCalls = 0;
const hostileLegacy = async (): Promise<Program> => { legacyCalls += 1; throw new Error("legacy must not run"); };
const run = async () => {
const reconstructed = await resolvePrintPreviewSource(session, hostileLegacy);
assert.equal(legacyCalls, 0);
assert.equal(reconstructed.id, "program"); assert.equal(reconstructed.title, "Persisted Program"); assert.equal(reconstructed.exercises.length, 9);
reconstructed.exercises.forEach((exercise, index) => { assert.equal(exercise.id, exercises[index].programExerciseId); assert.equal(exercise.order, index + 1); assert.equal(exercise.sets, exercises[index].plannedSets); assert.equal(exercise.memo, exercises[index].memo); });
const legacy = { ...session, prescription: undefined };
const legacyProgram = { ...reconstructed, title: "Legacy" };
const legacyResult = await resolvePrintPreviewSource(legacy, async () => { legacyCalls += 1; return legacyProgram; });
assert.equal(legacyCalls, 1); assert.equal(legacyResult.title, "Legacy");
console.log("Print preview authority checks: PASS");
};
void run();
