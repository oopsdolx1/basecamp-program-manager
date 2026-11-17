import assert from "node:assert/strict";
import { KioskApiError } from "../src/features/kiosk-recommendations/kioskRecommendationClient";
import { previewErrorMessage } from "../src/features/printing/hooks/usePrintPreview";
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
    category: "BACK",
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
  assert.equal(document.program.category, "BACK");
  assert.equal(document.program.categoryLabel, "등");
  assert.deepEqual(document.program.exercises.map((exercise) => exercise.name), ["Cable Row", "Face Pull", "Lat Pulldown"]);
  assert.deepEqual(document.program.exercises.map((exercise) => exercise.configuredSets), [5, 2, 4]);
  assert.deepEqual(document.program.exercises.map((exercise) => exercise.memo), ["Tempo", "Added cue", "Pause"]);
  assert.deepEqual(document.rows.slice(0, 3).map((row) => row.configuredSets), [5, 2, 4]);
  assert.equal(document.rows.length, 5, "three exercises receive two blank handwritten rows");
  assert.equal(document.layout.setLayout, "five-set", "a five-set exercise selects one document-wide layout");
  assert.equal(document.layout.showExerciseMemo, false, "five-set layout removes the note column for every row");
  assert.equal(document.rows[3]?.isBlank, true, "blank rows are real writable exercise rows");
  assert.equal(document.rows[1]?.exerciseMemo, "Added cue", "4-set rows retain their program memo for the print point cell");
  assert.equal(document.rows[0]?.exerciseMemo, "Tempo", "5-set rows retain data even though the point cell is omitted");
  const categoryLabels = new Map([ ["LOWER_BODY", "하체"], ["BACK", "등"], ["CHEST", "가슴"], ["FULL_BODY", "전신"] ]);
  for (const [category, label] of categoryLabels) {
    const categorized = { ...session, programSnapshot: { ...session.programSnapshot, category: category as Program["category"] }, prescription: { ...session.prescription!, category: category as Program["category"] } };
    const printed = createWorkoutPrintDocument({ member, program: await resolvePrintPreviewSource(categorized, async () => { throw new Error("unexpected legacy lookup"); }), workoutSessionId: categorized.sessionId });
    assert.equal(printed.program.categoryLabel, label);
  }
  const manualWithTarget = { ...session, source: { type: "manual" as const }, programId: undefined, programSnapshot: { ...session.programSnapshot, category: "SHOULDER" as const }, prescription: { ...session.prescription!, source: { type: "manual" as const }, sourceProgramId: undefined, category: "SHOULDER" as const } };
  assert.equal((await resolvePrintPreviewSource(manualWithTarget, async () => { throw new Error("unexpected legacy lookup"); })).category, "SHOULDER");
  const manualWithoutTarget = { ...manualWithTarget, programSnapshot: { title: manualWithTarget.programSnapshot.title }, prescription: { ...manualWithTarget.prescription!, category: undefined } };
  assert.equal((await resolvePrintPreviewSource(manualWithoutTarget, async () => { throw new Error("unexpected legacy lookup"); })).category, "CUSTOM");

  const legacySession = { ...session, prescription: undefined };
  assert.throws(() => assertPrintPreviewSessionContext(legacySession, "member-1", snapshotRouteProgramId), /프로그램/);
  // Preview load errors: Kiosk API codes become the product's Korean guidance, never a raw code.
  const memberGuidance = "선택된 회원 정보가 없습니다. 처음 화면에서 회원을 다시 선택해 주세요.";
  for (const code of ["KIOSK_SESSION_MEMBER_CHANGED", "KIOSK_SESSION_STALE", "KIOSK_SESSION_MEMBER_MISMATCH"]) assert.equal(previewErrorMessage(new KioskApiError(code, 0)), memberGuidance, code);
  for (const code of ["KIOSK_SESSION_EXPIRED", "KIOSK_SESSION_ENDED"]) assert.equal(previewErrorMessage(new KioskApiError(code, 401)), "회원 선택 시간이 만료되었거나 종료되었습니다. 처음 화면에서 회원을 다시 선택해 주세요.", code);
  for (const code of ["KIOSK_SESSION_INVALID", "KIOSK_SESSION_NOT_FOUND", "KIOSK_SESSION_REQUIRED"]) {
    const message = previewErrorMessage(new KioskApiError(code, 401));
    assert.equal(message, "회원 선택 정보를 확인할 수 없습니다. 처음 화면에서 회원을 다시 선택해 주세요.", code);
    assert.doesNotMatch(message, /만료|종료/, `${code} is not described as an expiry`);
  }
  for (const code of ["KIOSK_DEVICE_NOT_ENROLLED", "KIOSK_DEVICE_IDENTITY_REQUIRED", "KIOSK_DEVICE_AUTH_FAILED"]) assert.equal(previewErrorMessage(new KioskApiError(code, 401)), "키오스크 기기 인증이 되어 있지 않아 출력할 수 없습니다.", code);
  assert.equal(previewErrorMessage(new KioskApiError("KIOSK_DEVICE_NOT_REGISTERED", 403)), "등록되지 않았거나 사용이 중지된 키오스크입니다.");
  assert.equal(previewErrorMessage(new KioskApiError("NETWORK_ERROR", 0)), "서버에 연결하지 못했습니다.");
  assert.equal(previewErrorMessage(new KioskApiError("WORKOUT_SESSION_NOT_FOUND", 404)), "운동 세션을 찾지 못했습니다.");
  assert.match(previewErrorMessage(new KioskApiError("INTERNAL", 500)), /서버 오류로 미리보기를 불러오지 못했습니다/);
  for (const code of ["KIOSK_SESSION_MEMBER_CHANGED", "KIOSK_SESSION_EXPIRED", "KIOSK_DEVICE_NOT_ENROLLED", "INTERNAL"]) assert.doesNotMatch(previewErrorMessage(new KioskApiError(code, 500)), /KIOSK_|INTERNAL/, `${code} is not shown raw`);
  // Phase 3-E: an unknown API code gets safe general guidance (the code is only in the diagnostic log).
  assert.equal(previewErrorMessage(new KioskApiError("SOMETHING_NEW", 409)), "미리보기를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
  assert.equal(previewErrorMessage(new KioskApiError("INVALID_API_RESPONSE", 200)), "서버 오류로 미리보기를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
  assert.doesNotMatch(previewErrorMessage(new KioskApiError("PRINT_REQUEST_CONFLICT", 409)), /PRINT_|기록하지 못했습니다/, "print-record wording is not reused for the preview");
  // Non-API errors keep their product (Korean) messages.
  assert.equal(previewErrorMessage(new Error("plain error")), "plain error");
  assert.equal(previewErrorMessage("not an error"), "출력 문서를 만들지 못했습니다.");
  console.log("Print preview regression checks: PASS");
};

void run();
