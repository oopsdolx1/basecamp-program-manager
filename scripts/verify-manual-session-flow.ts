import assert from "node:assert/strict";
import { routeBuilder } from "../src/app/routeBuilder";
import { createManualWorkoutBuilderHistory } from "../src/features/printing/services/manualWorkoutBuilderService";
import { snapshotBuilderService } from "../src/features/printing/services/snapshotBuilderService";
import { buildWorkoutSessionRecord } from "../src/features/workout-sessions/services/workoutSessionRecordBuilder";

const condition = { condition: "NORMAL" as const, sleep: "NORMAL" as const, alcohol: "NO" as const, targetFatigue: "NORMAL" as const };
const first = { id: "catalog-a", name: "A", displayName: "A" } as never;
const second = { id: "catalog-b", name: "B", displayName: "B" } as never;
const third = { id: "catalog-c", name: "C", displayName: "C" } as never;
let checks = 0; const equal = (a: unknown, b: unknown) => { checks += 1; assert.deepEqual(a, b); };
const createSubmissionGuard = () => { let pending = false; return async (create: () => Promise<string>, navigate: (id: string) => void): Promise<void> => { if (pending) return; pending = true; try { navigate(await create()); } finally { pending = false; } }; };
const run = async (): Promise<void> => {
let history = createManualWorkoutBuilderHistory(first, condition);
history = snapshotBuilderService.addExercise(history, second).history;
history = snapshotBuilderService.addExercise(history, third).history;
history = snapshotBuilderService.move(history, history.present.exercises[2].id, "up");
history = snapshotBuilderService.patchExercise(history, history.present.exercises[0].id, { plannedSets: 5, memo: "final memo" });
const record = buildWorkoutSessionRecord({ appId: "app" as never, memberId: "member-a", memberName: "Member", source: { type: "manual" }, programTitle: history.present.title, exercises: history.present.exercises.map((item) => ({ exerciseId: item.catalogExerciseId ?? item.id, programExerciseId: item.id, name: item.name, order: item.order, plannedSets: item.plannedSets, memo: item.memo })) }, "trainer", "manual-session-a");
equal(record.source, { type: "manual" }); equal(record.prescription.source, { type: "manual" }); equal(record.programId, undefined); equal(record.prescription.sourceProgramId, undefined);
equal(record.prescription.exercises.map((item) => ({ id: item.exerciseId, order: item.order, sets: item.plannedSets, memo: item.memo })), history.present.exercises.map((item) => ({ id: item.catalogExerciseId, order: item.order, sets: item.plannedSets, memo: item.memo })));
equal(record.prescription.exercises[0].plannedSets, 5); equal(record.prescription.exercises[0].memo, "final memo");
equal(routeBuilder.printPreviewSession("member-a", "manual-session-a", true), "/program-manager/print/session/manual-session-a?memberId=member-a&autoPrint=1");
const program = buildWorkoutSessionRecord({ appId: "app" as never, memberId: "member-a", memberName: "Member", programId: "program-a", programTitle: "Program", exercises: record.prescription.exercises }, "trainer", "program-session-a");
equal(program.source, { type: "program", programId: "program-a" }); equal(program.programId, "program-a");
let failureCalls = 0; let failureNavigation = 0; const guardedFailure = createSubmissionGuard();
await guardedFailure(async () => { failureCalls += 1; throw new Error("write failed"); }, () => { failureNavigation += 1; }).catch(() => undefined);
equal(failureCalls, 1); equal(failureNavigation, 0);
await guardedFailure(async () => { failureCalls += 1; return "retry-session"; }, () => { failureNavigation += 1; }); equal(failureCalls, 2); equal(failureNavigation, 1);
let resolvePending!: (id: string) => void; let pendingCalls = 0; let pendingNavigation = 0; const guardedPending = createSubmissionGuard(); const pending = guardedPending(() => { pendingCalls += 1; return new Promise<string>((resolve) => { resolvePending = resolve; }); }, () => { pendingNavigation += 1; });
void guardedPending(async () => { pendingCalls += 1; return "duplicate"; }, () => { pendingNavigation += 1; }); equal(pendingCalls, 1); equal(pendingNavigation, 0); resolvePending("pending-session"); await pending; equal(pendingNavigation, 1);
console.log(`Manual session flow checks: PASS (${checks} assertions)`);
};

void run();
