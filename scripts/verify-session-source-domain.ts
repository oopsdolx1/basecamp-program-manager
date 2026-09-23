import assert from "node:assert/strict";
import { assertPrintPreviewSessionContext } from "../src/features/printing/services/printPreviewAuthorityResolver";
import type { WorkoutSessionRecord } from "../src/features/workout-sessions/domain/workoutSession.types";
import { buildWorkoutSessionRecord } from "../src/features/workout-sessions/services/workoutSessionRecordBuilder";
import { normalizeWorkoutSource } from "../src/features/workout-sessions/services/workoutSessionSourceResolver";

let checks = 0;
const equal = (actual: unknown, expected: unknown, message?: string) => { checks += 1; assert.deepEqual(actual, expected, message); };
const rejects = (fn: () => void, message?: string) => { checks += 1; assert.throws(fn, message); };

const exercises = [
  { exerciseId: "catalog-b", programExerciseId: "entry-b", name: "Second", order: 2, plannedSets: 3, memo: "second memo" },
  { exerciseId: "catalog-a", programExerciseId: "entry-a", name: "First", order: 1, plannedSets: 2, memo: "first memo" },
];

const record = (overrides: Partial<WorkoutSessionRecord> = {}): WorkoutSessionRecord => ({
  sessionId: "session-a", schemaVersion: 1, memberId: "member-a", trainerId: "trainer-a", status: "created",
  exerciseIds: exercises.map(({ exerciseId }) => exerciseId), memberSnapshot: { name: "Member" },
  programSnapshot: { title: "Workout" }, exercises, print: { format: "A5-portrait", templateKey: "basecamp-workout-log-v1", templateVersion: 1, printHistoryId: null, historyIds: [], copyCount: 0 },
  createdAt: new Date(), updatedAt: new Date(), printedAt: null, lastPrintedAt: null, ...overrides,
});

const source = (session: Pick<WorkoutSessionRecord, "programId" | "source" | "prescription">) => normalizeWorkoutSource(session);
const authority = (session: WorkoutSessionRecord, routeProgramId = "program-a") => assertPrintPreviewSessionContext(session, "member-a", routeProgramId);

const legacy = record({ programId: "program-a", prescription: { sourceProgramId: "program-a", sourceProgramName: "Program A", exercises } });
equal(source(legacy), { type: "program", programId: "program-a" }, "legacy session source");
equal(source({ programId: legacy.prescription?.sourceProgramId }), { type: "program", programId: "program-a" }, "legacy prescription source");
authority(legacy);
checks += 1;

const program = record({ programId: "program-a", source: { type: "program", programId: "program-a" }, prescription: { source: { type: "program", programId: "program-a" }, sourceProgramId: "program-a", sourceProgramName: "Program A", exercises } });
equal(source(program), { type: "program", programId: "program-a" }, "explicit program session source");
equal(source({ programId: program.prescription?.sourceProgramId, source: program.prescription?.source }), { type: "program", programId: "program-a" }, "explicit program prescription source");
authority(program);
checks += 1;

const manual = record({ source: { type: "manual" }, prescription: { source: { type: "manual" }, sourceProgramName: "Manual Workout", exercises } });
equal(source(manual), { type: "manual" }, "manual session source");
equal(source({ source: manual.prescription?.source }), { type: "manual" }, "manual prescription source");
authority(manual, "not-required-for-manual-authority");
checks += 1;

const programMismatch = record({ programId: "program-a", source: { type: "program", programId: "program-a" }, prescription: { source: { type: "program", programId: "program-b" }, sourceProgramId: "program-b", sourceProgramName: "Program B", exercises } });
rejects(() => authority(programMismatch), "program mismatch fails closed");
const manualProgram = record({ source: { type: "manual" }, prescription: { source: { type: "program", programId: "program-a" }, sourceProgramId: "program-a", sourceProgramName: "Program A", exercises } });
rejects(() => authority(manualProgram), "manual/program mismatch fails closed");
const programManual = record({ programId: "program-a", source: { type: "program", programId: "program-a" }, prescription: { source: { type: "manual" }, sourceProgramName: "Manual", exercises } });
rejects(() => authority(programManual), "program/manual mismatch fails closed");

rejects(() => source({ programId: "program-a", source: { type: "manual" } }), "manual plus legacy id fails closed");
rejects(() => authority(record({ programId: "program-a", source: { type: "manual" }, prescription: { source: { type: "manual" }, sourceProgramName: "Manual", exercises } })), "authority cannot rescue malformed manual");
rejects(() => source({ programId: "program-b", source: { type: "program", programId: "program-a" } }), "explicit program conflict fails closed");
rejects(() => source({ source: { type: "unknown" } } as unknown as Pick<WorkoutSessionRecord, "programId" | "source" | "prescription">), "unknown explicit source fails closed");
rejects(() => source({ source: { type: "program", programId: "" } } as unknown as Pick<WorkoutSessionRecord, "programId" | "source" | "prescription">), "empty explicit program id fails closed");
rejects(() => source({}), "missing source fails closed");
rejects(() => source({ programId: "   " }), "empty legacy id fails closed");

const programBuilt = buildWorkoutSessionRecord({ appId: "app" as never, memberId: "member-a", memberName: "Member", programId: "program-a", source: { type: "program", programId: "program-a" }, programTitle: "Program A", exercises }, "trainer-a", "built-program");
equal(source(programBuilt), { type: "program", programId: "program-a" }, "program builder round trip");
equal(programBuilt.programId, "program-a", "program builder compatibility id");
equal(programBuilt.prescription.sourceProgramId, "program-a", "program builder prescription compatibility id");

const manualBuilt = buildWorkoutSessionRecord({ appId: "app" as never, memberId: "member-a", memberName: "Member", source: { type: "manual" }, programTitle: "Manual Workout", exercises }, "trainer-a", "built-manual");
equal(source(manualBuilt), { type: "manual" }, "manual builder round trip");
equal(manualBuilt.programId, undefined, "manual builder has no program id");
equal(manualBuilt.prescription.sourceProgramId, undefined, "manual builder has no prescription program id");
equal(manualBuilt.source, { type: "manual" }, "manual builder uses no sentinel source");
equal(manualBuilt.exercises.map(({ exerciseId, order, plannedSets, memo }) => ({ exerciseId, order, plannedSets, memo })), [
  { exerciseId: "catalog-a", order: 1, plannedSets: 2, memo: "first memo" },
  { exerciseId: "catalog-b", order: 2, plannedSets: 3, memo: "second memo" },
], "manual builder preserves ordered prescription content");
equal(manualBuilt.prescription.exercises, manualBuilt.exercises, "manual prescription preserves catalog identities");

console.log(`Session source domain checks: PASS (${checks} assertions)`);
