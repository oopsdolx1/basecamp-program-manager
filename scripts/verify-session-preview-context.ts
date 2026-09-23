import assert from "node:assert/strict";
import { routeBuilder } from "../src/app/routeBuilder";
import type { MemberSelectionItem } from "../src/features/members/types/memberViewModel.types";
import { createWorkoutPrintDocument } from "../src/features/printing/mappers/workoutPrintMapper";
import { assertPrintPreviewSessionContext, resolvePrintPreviewSource } from "../src/features/printing/services/printPreviewAuthorityResolver";
import { createSnapshotProgramId, createSnapshotSessionId } from "../src/features/printing/services/printSnapshotSession";
import type { WorkoutSessionRecord } from "../src/features/workout-sessions/domain/workoutSession.types";
import { buildWorkoutSessionRecord } from "../src/features/workout-sessions/services/workoutSessionRecordBuilder";

let checks = 0;
const equal = (actual: unknown, expected: unknown, message?: string): void => { checks += 1; assert.deepEqual(actual, expected, message); };
const accepts = (fn: () => void, message?: string): void => { checks += 1; assert.doesNotThrow(fn, message); };
const rejects = (fn: () => void, message?: string): void => { checks += 1; assert.throws(fn, message); };
const exercises = [
  { exerciseId: "catalog-b", programExerciseId: "entry-b", name: "Second", order: 2, plannedSets: 3, memo: "second memo" },
  { exerciseId: "catalog-a", programExerciseId: "entry-a", name: "First", order: 1, plannedSets: 2, memo: "first memo" },
];
const complete = (record: ReturnType<typeof buildWorkoutSessionRecord>): WorkoutSessionRecord => ({ ...record, createdAt: new Date(), updatedAt: new Date(), printedAt: null, lastPrintedAt: null });
const member = { memberId: "member-a", displayName: "Member A" } as MemberSelectionItem;
const program = complete(buildWorkoutSessionRecord({ appId: "app" as never, memberId: "member-a", memberName: "Member A", source: { type: "program", programId: "program-a" }, programTitle: "Program A", exercises }, "trainer-a", "program-session-a"));
const manual = complete(buildWorkoutSessionRecord({ appId: "app" as never, memberId: "member-a", memberName: "Member A", source: { type: "manual" }, programTitle: "Manual Workout", exercises }, "trainer-a", "manual-session-a"));

const run = async (): Promise<void> => {
equal(routeBuilder.printPreview("program-a", "member-a", "program-session-a"), "/program-manager/print/program-a?memberId=member-a&sessionId=program-session-a", "legacy route remains stable");
equal(routeBuilder.printPreviewSession("member-a", "manual-session-a"), "/program-manager/print/session/manual-session-a?memberId=member-a", "session route has no program context");
accepts(() => assertPrintPreviewSessionContext(program, "member-a", "program-a"), "legacy program route");
accepts(() => assertPrintPreviewSessionContext(program, "member-a", createSnapshotProgramId("program-a")), "legacy snapshot route");
rejects(() => assertPrintPreviewSessionContext(program, "member-a", "program-b"), "legacy route mismatch fails closed");
accepts(() => assertPrintPreviewSessionContext(program, "member-a"), "session-centric program route");
accepts(() => assertPrintPreviewSessionContext(manual, "member-a"), "session-centric manual route");
equal(manual.programId, undefined, "manual has no program id");
equal(manual.prescription.sourceProgramId, undefined, "manual has no prescription program id");

equal(createSnapshotSessionId("manual-session-a"), "snapshot--session--manual-session-a", "manual session snapshot identity");
assert.notEqual(createSnapshotSessionId("manual-session-a"), createSnapshotSessionId("manual-session-b")); checks += 1;
assert.notEqual(createSnapshotSessionId("program-session-a"), createSnapshotSessionId("program-session-b")); checks += 1;

const resolveWithoutLookup = async (session: WorkoutSessionRecord) => {
  let lookups = 0;
  const source = await resolvePrintPreviewSource(session, async () => { lookups += 1; throw new Error("persisted prescription must not look up a program"); });
  equal(lookups, 0, "persisted prescription avoids program lookup");
  return source;
};
const programSource = await resolveWithoutLookup(program);
const manualSource = await resolveWithoutLookup(manual);
const manualDocument = createWorkoutPrintDocument({ member, program: manualSource, workoutSessionId: manual.sessionId, printDate: new Date("2026-09-23T00:00:00Z") });
const manualDocumentAgain = createWorkoutPrintDocument({ member, program: await resolveWithoutLookup(manual), workoutSessionId: manual.sessionId, printDate: new Date("2026-09-23T00:00:00Z") });
const programDocument = createWorkoutPrintDocument({ member, program: programSource, workoutSessionId: program.sessionId, printDate: new Date("2026-09-23T00:00:00Z") });
equal(manualDocument.workoutSessionId, "manual-session-a", "manual document uses session id");
equal(manualDocument.program.programId, "manual-session-a", "manual document uses only transient session identity");
equal(manualDocument.program.exercises.map(({ exerciseId, order, configuredSets, memo }) => ({ exerciseId, order, configuredSets, memo })), [
  { exerciseId: "catalog-a", order: 1, configuredSets: 2, memo: "first memo" },
  { exerciseId: "catalog-b", order: 2, configuredSets: 3, memo: "second memo" },
], "manual prescription content is preserved");
equal(manualDocument.program.exercises, manualDocumentAgain.program.exercises, "same-session manual reprint remains stable");
equal(programDocument.program.exercises.map(({ exerciseId }) => exerciseId), ["catalog-a", "catalog-b"], "program session stays prescription-first");

console.log(`Session preview context checks: PASS (${checks} assertions)`);
};

void run();
