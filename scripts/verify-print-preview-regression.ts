import assert from "node:assert/strict";
import { toAppId } from "../src/types/brandedIds";
import type { MemberSelectionItem } from "../src/features/members/types/memberViewModel.types";
import { createWorkoutPrintDocument } from "../src/features/printing/mappers/workoutPrintMapper";
import { assertPrintPreviewSessionContext, resolvePrintPreviewSource } from "../src/features/printing/services/printPreviewAuthorityResolver";
import { createSnapshotProgramId } from "../src/features/printing/services/printSnapshotSession";
import { createSnapshotBuilderHistory, snapshotBuilderService } from "../src/features/printing/services/snapshotBuilderService";
import type { Program } from "../src/features/programs/types/program.types";
import type { WorkoutSessionRecord } from "../src/features/workout-sessions/domain/workoutSession.types";
import { mapSessionPrescriptionExercises } from "../src/features/workout-sessions/services/sessionPrescriptionMapper";
import { buildWorkoutSessionRecord } from "../src/features/workout-sessions/services/workoutSessionRecordBuilder";

const run = async (): Promise<void> => {
  const sourceProgramId = "program-source";
  const sourceProgram = {
    id: sourceProgramId,
    schemaVersion: 1,
    category: "BACK",
    title: "Original Back Day",
    difficulty: "GENERAL",
    memo: "",
    exercises: [
      { id: "source-a", catalogExerciseId: "catalog-a", name: "Lat Pulldown", displayName: "Lat Pulldown", order: 1, sets: 3, memo: "" },
      { id: "source-b", catalogExerciseId: "catalog-b", name: "Seated Row", displayName: "Seated Row", order: 2, sets: 3, memo: "" },
      { id: "source-c", catalogExerciseId: "catalog-c", name: "Cable Row", displayName: "Cable Row", order: 3, sets: 3, memo: "" },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    usageCount: 0,
    favorite: false,
    isArchived: false,
  } as Program;

  let history = createSnapshotBuilderHistory(sourceProgram);
  const idForCatalog = (catalogExerciseId: string): string => {
    const id = history.present.exercises.find((exercise) => exercise.catalogExerciseId === catalogExerciseId)?.id;
    assert.ok(id);
    return id;
  };

  history = snapshotBuilderService.move(history, idForCatalog("catalog-c"), "up");
  history = snapshotBuilderService.move(history, idForCatalog("catalog-c"), "up");
  history = snapshotBuilderService.remove(history, idForCatalog("catalog-b"));
  const added = snapshotBuilderService.addExercise(history, { id: "catalog-new", name: "Face Pull", displayName: "Face Pull" });
  assert.equal(added.eligibility.allowed, true);
  history = added.history;
  history = snapshotBuilderService.move(history, idForCatalog("catalog-new"), "up");
  history = snapshotBuilderService.patchExercise(history, idForCatalog("catalog-c"), { plannedSets: 5, memo: "Tempo" });
  history = snapshotBuilderService.patchExercise(history, idForCatalog("catalog-new"), { plannedSets: 2, memo: "Added cue" });
  history = snapshotBuilderService.patchExercise(history, idForCatalog("catalog-a"), { plannedSets: 4, memo: "Pause" });

  const builderExercises = history.present.exercises;
  assert.deepEqual(builderExercises.map((exercise) => exercise.catalogExerciseId), ["catalog-c", "catalog-new", "catalog-a"]);
  const resolved = new Map(builderExercises.map((exercise) => [exercise.id, { id: exercise.catalogExerciseId ?? exercise.id, name: exercise.name }]));
  const prescriptionExercises = mapSessionPrescriptionExercises(builderExercises, resolved);
  const persisted = buildWorkoutSessionRecord({
    appId: toAppId("condition-lab"),
    memberId: "member-1",
    memberName: "Regression Member",
    programId: sourceProgramId,
    programTitle: "Edited Back Day",
    exercises: prescriptionExercises,
  }, "trainer-1", "ws-regression");
  const session = { ...persisted, createdAt: new Date(), updatedAt: new Date(), printedAt: null, lastPrintedAt: null } satisfies WorkoutSessionRecord;

  assert.ok(session.prescription);
  assert.deepEqual(session.prescription.exercises.map((exercise) => exercise.programExerciseId), builderExercises.map((exercise) => exercise.id));
  assert.deepEqual(session.prescription.exercises.map((exercise) => exercise.plannedSets), [5, 2, 4]);
  assert.deepEqual(session.prescription.exercises.map((exercise) => exercise.memo), ["Tempo", "Added cue", "Pause"]);

  const snapshotRouteProgramId = createSnapshotProgramId(sourceProgramId);
  assert.doesNotThrow(() => assertPrintPreviewSessionContext(session, "member-1", snapshotRouteProgramId));
  assert.doesNotThrow(() => assertPrintPreviewSessionContext(session, "member-1", sourceProgramId));
  assert.throws(() => assertPrintPreviewSessionContext(session, "member-1", createSnapshotProgramId("different-program")), /프로그램/);
  assert.throws(() => assertPrintPreviewSessionContext(session, "member-1", `${sourceProgramId}-extra`), /프로그램/);
  assert.throws(() => assertPrintPreviewSessionContext(session, "member-1", `random--${sourceProgramId}`), /프로그램/);
  assert.throws(() => assertPrintPreviewSessionContext(session, "another-member", snapshotRouteProgramId), /회원/);

  let legacyCalls = 0;
  const authoritativeProgram = await resolvePrintPreviewSource(session, async () => {
    legacyCalls += 1;
    throw new Error("A prescription Session must not load a snapshot or remote Program");
  });
  assert.equal(legacyCalls, 0);

  const member = { memberId: "member-1", displayName: "Regression Member" } as MemberSelectionItem;
  const document = createWorkoutPrintDocument({ member, program: authoritativeProgram, workoutSessionId: session.sessionId, printDate: new Date("2026-09-21T00:00:00Z") });
  assert.equal(document.workoutSessionId, "ws-regression");
  assert.equal(document.member.name, "Regression Member");
  assert.deepEqual(document.program.exercises.map((exercise) => exercise.name), ["Cable Row", "Face Pull", "Lat Pulldown"]);
  assert.deepEqual(document.program.exercises.map((exercise) => exercise.configuredSets), [5, 2, 4]);
  assert.deepEqual(document.program.exercises.map((exercise) => exercise.memo), ["Tempo", "Added cue", "Pause"]);

  const legacySession = { ...session, prescription: undefined };
  assert.throws(() => assertPrintPreviewSessionContext(legacySession, "member-1", snapshotRouteProgramId), /프로그램/);
  console.log("Print preview regression checks: PASS");
};

void run();
