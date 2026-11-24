import { useEffect, useState } from "react";
import { ensureFirebaseAuth } from "../../../firebase/firebaseAuth";
import { toProgramId, type AppId, type ProfileId, type ProgramId } from "../../../types/brandedIds";
import { getMemberById } from "../../members/repositories/profileRepository";
import type { MemberSelectionItem } from "../../members/types/memberViewModel.types";
import { sanitizeProgramForm } from "../../programs/services/programService";
import { programRepository } from "../../programs/repositories/programRepository";
import type { Program } from "../../programs/types/program.types";
import { createWorkoutPrintDocument, PrintMapperError } from "../mappers/workoutPrintMapper";
import { isSnapshotProgramId, loadPrintSnapshot } from "../services/printSnapshotSession";
import type { WorkoutPrintDocument } from "../types/print.types";
import { programManagerRuntime } from "../../../shared-knowledge/programManagerRuntime";
import { getWorkoutSession } from "../../workout-sessions/services/workoutSessionService";
import type { WorkoutSessionRecord } from "../../workout-sessions/domain/workoutSession.types";
import { assertPrintPreviewSessionContext, resolvePrintPreviewSource } from "../services/printPreviewAuthorityResolver";
import { normalizeWorkoutSource } from "../../workout-sessions/services/workoutSessionSourceResolver";
import { KioskApiError } from "../../kiosk-recommendations/kioskRecommendationClient";
import { kioskErrorMessage } from "../../print-history/services/kioskPrintRecordService";
import { logKioskError } from "../../kiosk-diagnostics/kioskErrorLog";

// Kiosk API errors while loading the preview get the product's Korean guidance instead of a raw code.
// Only the message changes: the load still fails, so nothing is shown or printed.
const PREVIEW_SESSION_EXPIRED_MESSAGE = "회원 선택 시간이 만료되었거나 종료되었습니다. 처음 화면에서 회원을 다시 선택해 주세요.";
const PREVIEW_SESSION_UNVERIFIABLE_MESSAGE = "회원 선택 정보를 확인할 수 없습니다. 처음 화면에서 회원을 다시 선택해 주세요.";
const PREVIEW_SERVER_ERROR_MESSAGE = "서버 오류로 미리보기를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
const MEMBER_SELECTION_CODES = new Set(["KIOSK_SESSION_MEMBER_CHANGED", "KIOSK_SESSION_STALE", "KIOSK_SESSION_MEMBER_MISMATCH"]);
const SESSION_EXPIRED_CODES = new Set(["KIOSK_SESSION_EXPIRED", "KIOSK_SESSION_ENDED"]);
const SESSION_UNVERIFIABLE_CODES = new Set(["KIOSK_SESSION_INVALID", "KIOSK_SESSION_NOT_FOUND", "KIOSK_SESSION_REQUIRED"]);
const DEVICE_AUTH_CODES = new Set(["KIOSK_DEVICE_NOT_ENROLLED", "KIOSK_DEVICE_IDENTITY_REQUIRED", "KIOSK_DEVICE_AUTH_FAILED"]);

const PREVIEW_GENERAL_MESSAGE = "미리보기를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
const PREVIEW_SHARED_CODES = new Set(["KIOSK_DEVICE_NOT_REGISTERED", "NETWORK_ERROR", "WORKOUT_SESSION_NOT_FOUND", "PRINT_SCOPE_DENIED", "KIOSK_SESSION_RATE_LIMITED"]);

export const previewErrorMessage = (caught: unknown): string => {
  if (caught instanceof KioskApiError) {
    logKioskError("print preview", caught);
    if (MEMBER_SELECTION_CODES.has(caught.code)) return kioskErrorMessage("KIOSK_SESSION_MEMBER_CHANGED")!;
    if (SESSION_EXPIRED_CODES.has(caught.code)) return PREVIEW_SESSION_EXPIRED_MESSAGE;
    if (SESSION_UNVERIFIABLE_CODES.has(caught.code)) return PREVIEW_SESSION_UNVERIFIABLE_MESSAGE;
    if (caught.code === "KIOSK_DEVICE_STARTING") return kioskErrorMessage("KIOSK_DEVICE_STARTING")!;
    if (DEVICE_AUTH_CODES.has(caught.code)) return kioskErrorMessage("KIOSK_DEVICE_NOT_ENROLLED")!;
    if (PREVIEW_SHARED_CODES.has(caught.code)) return kioskErrorMessage(caught.code)!;
    if (caught.status >= 500 || caught.code === "INTERNAL_ERROR" || caught.code === "INVALID_API_RESPONSE") return PREVIEW_SERVER_ERROR_MESSAGE;
    // Phase 3-E: an unknown API code gets safe general guidance; the code is only in the diagnostic log.
    return PREVIEW_GENERAL_MESSAGE;
  }
  // Non-API errors (e.g. PrintMapperError) already carry product Korean messages.
  return caught instanceof PrintMapperError || caught instanceof Error ? caught.message : "출력 문서를 만들지 못했습니다.";
};

type PreviewState =
  | { status: "loading" }
  | { status: "ready"; document: WorkoutPrintDocument; member: MemberSelectionItem; program: Program; workoutSession: WorkoutSessionRecord }
  | { status: "error"; message: string };

interface UsePrintPreviewParams {
  appId: AppId;
  memberId: ProfileId | null;
  programId: ProgramId | null;
  workoutSessionId: string | null;
}

export const usePrintPreview = ({ appId, memberId, programId, workoutSessionId }: UsePrintPreviewParams): PreviewState => {
  const [state, setState] = useState<PreviewState>({ status: "loading" });
  const [runtimeRevision, setRuntimeRevision] = useState(() => programManagerRuntime.getRevision());

  useEffect(() => programManagerRuntime.subscribe(() => setRuntimeRevision(programManagerRuntime.getRevision())), []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!memberId) {
        setState({ status: "error", message: "memberId가 없습니다." });
        return;
      }

      if (!workoutSessionId) {
        setState({ status: "error", message: "Workout Session ID가 없습니다. Quick Print에서 다시 진행해 주세요." });
        return;
      }

      setState({ status: "loading" });

      try {
        await ensureFirebaseAuth();
        const [member, workoutSession] = await Promise.all([getMemberById(appId, memberId), getWorkoutSession(appId, memberId, workoutSessionId)]);

        if (!active) return;

        if (!workoutSession) throw new PrintMapperError("Workout Session을 찾지 못했습니다.");
        assertPrintPreviewSessionContext(workoutSession, memberId, programId ?? undefined);

        const workoutSource = normalizeWorkoutSource(workoutSession);
        const fallbackProgramId = programId ?? (workoutSource.type === "program" ? toProgramId(workoutSource.programId) : null);
        const authoritativeProgram = await resolvePrintPreviewSource(workoutSession, () => {
          if (!fallbackProgramId) throw new PrintMapperError("Manual Workout Session에는 Prescription이 필요합니다.");
          return isSnapshotProgramId(fallbackProgramId) ? Promise.resolve(createSnapshotProgram(fallbackProgramId)) : programRepository.getProgram(appId, fallbackProgramId) as Promise<Program>;
        });
        const document = createWorkoutPrintDocument({ member, program: authoritativeProgram, workoutSessionId, categories: workoutSession.prescription?.categories ?? workoutSession.programSnapshot.categories ?? (workoutSession.prescription?.category ?? workoutSession.programSnapshot.category ? [workoutSession.prescription?.category ?? workoutSession.programSnapshot.category!] : []) });
        setState({ status: "ready", document, member: member as MemberSelectionItem, program: authoritativeProgram, workoutSession });
      } catch (caught) {
        if (!active) return;
        setState({ status: "error", message: previewErrorMessage(caught) });
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [appId, memberId, programId, runtimeRevision, workoutSessionId]);

  return state;
};

const createSnapshotProgram = (programId: ProgramId): Program => {
  const snapshot = loadPrintSnapshot();
  if (!snapshot) {
    throw new PrintMapperError("저장된 Snapshot이 없습니다. 추천 화면에서 다시 진행해 주세요.");
  }

  const values = sanitizeProgramForm(snapshot.formValues);

  return {
    id: snapshot.sourceProgramId as ProgramId,
    schemaVersion: 1,
    category: values.category,
    title: values.title,
    difficulty: values.difficulty,
    memo: values.memo,
    exercises: values.exercises.map((exercise, index) => ({
      id: exercise.id,
      name: exercise.name,
      sets: exercise.sets,
      memo: exercise.memo,
      order: index + 1,
      catalogExerciseId: exercise.catalogExerciseId,
      displayName: exercise.displayName,
    })),
    createdAt: new Date(),
    updatedAt: new Date(),
    usageCount: 0,
    favorite: values.favorite,
    isArchived: false,
  };
};
