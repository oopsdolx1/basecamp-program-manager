import assert from "node:assert/strict";
import { createWorkoutPrintDocument } from "../src/features/printing/mappers/workoutPrintMapper";
import { resolvePrintPreviewSource } from "../src/features/printing/services/printPreviewAuthorityResolver";
import { assertPrintPreviewSessionContext } from "../src/features/printing/services/printPreviewAuthorityResolver";
import { mapWorkoutSessionRecord } from "../src/features/workout-sessions/repositories/firestoreWorkoutSessionRepository";
import { normalizeWorkoutSource } from "../src/features/workout-sessions/services/workoutSessionSourceResolver";

const raw = (overrides: Record<string, unknown> = {}) => ({
  memberId: "member-a",
  trainerId: "trainer-a",
  status: "created",
  exerciseIds: [],
  memberSnapshot: { name: "Member A" },
  programSnapshot: { title: "Workout" },
  exercises: [],
  prescription: { source: { type: "manual" }, sourceProgramName: "Manual Workout", exercises: [] },
  source: { type: "manual" },
  ...overrides,
});

const mapped = (data: Record<string, unknown>) => mapWorkoutSessionRecord("session-a", data as never);

const cleanManual = mapped(raw());
assert.equal(cleanManual.programId, undefined);
assert.equal(cleanManual.prescription?.sourceProgramId, undefined);
assert.deepEqual(cleanManual.source, { type: "manual" });
assert.deepEqual(cleanManual.prescription?.source, { type: "manual" });
assert.deepEqual(normalizeWorkoutSource(cleanManual), { type: "manual" });
assert.doesNotThrow(() => assertPrintPreviewSessionContext(cleanManual, "member-a"));

for (const identity of ["", "undefined", "null"]) {
  const polluted = mapped(raw({ programId: identity, prescription: { source: { type: "manual" }, sourceProgramId: identity, sourceProgramName: "Manual Workout", exercises: [] } }));
  assert.equal(polluted.programId, undefined, `programId ${JSON.stringify(identity)} is removed`);
  assert.equal(polluted.prescription?.sourceProgramId, undefined, `sourceProgramId ${JSON.stringify(identity)} is removed`);
  assert.deepEqual(normalizeWorkoutSource(polluted), { type: "manual" });
}

const program = mapped(raw({
  programId: "program-123",
  source: { type: "program", programId: "program-123" },
  prescription: { source: { type: "program", programId: "program-123" }, sourceProgramId: "program-123", sourceProgramName: "Program", exercises: [] },
}));
assert.equal(program.programId, "program-123");
assert.equal(program.prescription?.sourceProgramId, "program-123");
assert.deepEqual(normalizeWorkoutSource(program), { type: "program", programId: "program-123" });

const verifyLiveManualShape = async (): Promise<void> => {
  const liveManualShape = mapped(raw({
    memberId: "member-a",
    exerciseIds: ["shoulder-press", "deadlift", "leg-extension"],
    programSnapshot: { title: "Direct workout", category: "BACK" },
    exercises: [
      { exerciseId: "shoulder-press", programExerciseId: "entry-1", name: "Shoulder press", order: 1, plannedSets: 4, memo: "" },
      { exerciseId: "deadlift", programExerciseId: "entry-2", name: "Deadlift", order: 2, plannedSets: 4, memo: "" },
      { exerciseId: "leg-extension", programExerciseId: "entry-3", name: "Leg extension", order: 3, plannedSets: 4, memo: "" },
    ],
    prescription: {
      source: { type: "manual" },
      sourceProgramName: "Direct workout",
      category: "BACK",
      exercises: [
        { exerciseId: "shoulder-press", programExerciseId: "entry-1", name: "Shoulder press", order: 1, plannedSets: 4, memo: "" },
        { exerciseId: "deadlift", programExerciseId: "entry-2", name: "Deadlift", order: 2, plannedSets: 4, memo: "" },
        { exerciseId: "leg-extension", programExerciseId: "entry-3", name: "Leg extension", order: 3, plannedSets: 4, memo: "" },
      ],
    },
    source: { type: "manual" },
  }));
  assert.deepEqual(normalizeWorkoutSource(liveManualShape), { type: "manual" });
  assert.equal(liveManualShape.programId, undefined);
  assert.equal(liveManualShape.prescription?.sourceProgramId, undefined);
  const liveManualProgram = await resolvePrintPreviewSource(liveManualShape, async () => { throw new Error("manual prescription must not load a program"); });
  const liveManualDocument = createWorkoutPrintDocument({ member: { memberId: "member-a" as never, displayName: "Member", searchText: "member" }, program: liveManualProgram, workoutSessionId: liveManualShape.sessionId });
  assert.equal(liveManualDocument.workoutSessionId, "session-a");
  assert.equal(liveManualDocument.rows.filter((row) => !row.isBlank).length, 3);
};

void verifyLiveManualShape().then(() => console.log("Firestore workout session mapping checks: PASS"));
