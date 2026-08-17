import { useEffect, useState } from "react";
import { ensureFirebaseAuth } from "../../../firebase/firebaseAuth";
import type { AppId, ProfileId, ProgramId } from "../../../types/brandedIds";
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

      if (!programId) {
        setState({ status: "error", message: "programId가 없습니다." });
        return;
      }

      if (!workoutSessionId) {
        setState({ status: "error", message: "Workout Session ID가 없습니다. Quick Print에서 다시 진행해 주세요." });
        return;
      }

      setState({ status: "loading" });

      try {
        await ensureFirebaseAuth();
        const [member, program, workoutSession] = await Promise.all([
          getMemberById(appId, memberId),
          isSnapshotProgramId(programId)
            ? Promise.resolve(createSnapshotProgram(programId))
            : programRepository.getProgram(appId, programId),
          getWorkoutSession(appId, workoutSessionId),
        ]);

        if (!active) return;

        if (!workoutSession) throw new PrintMapperError("Workout Session을 찾지 못했습니다.");
        if (workoutSession.memberId !== memberId || workoutSession.programId !== program?.id) {
          throw new PrintMapperError("Workout Session의 회원 또는 프로그램이 Preview와 일치하지 않습니다.");
        }
        const document = createWorkoutPrintDocument({ member, program, workoutSessionId });
        setState({ status: "ready", document, member: member as MemberSelectionItem, program: program as Program, workoutSession });
      } catch (caught) {
        if (!active) return;
        const message =
          caught instanceof PrintMapperError || caught instanceof Error
            ? caught.message
            : "출력 문서를 만들지 못했습니다.";
        setState({ status: "error", message });
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
