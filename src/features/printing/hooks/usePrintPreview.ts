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

type PreviewState =
  | { status: "loading" }
  | { status: "ready"; document: WorkoutPrintDocument; member: MemberSelectionItem; program: Program }
  | { status: "error"; message: string };

interface UsePrintPreviewParams {
  appId: AppId;
  memberId: ProfileId | null;
  programId: ProgramId | null;
}

export const usePrintPreview = ({ appId, memberId, programId }: UsePrintPreviewParams): PreviewState => {
  const [state, setState] = useState<PreviewState>({ status: "loading" });

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

      setState({ status: "loading" });

      try {
        await ensureFirebaseAuth();
        const [member, program] = await Promise.all([
          getMemberById(appId, memberId),
          isSnapshotProgramId(programId)
            ? Promise.resolve(createSnapshotProgram(programId))
            : programRepository.getProgram(appId, programId),
        ]);

        if (!active) return;

        const document = createWorkoutPrintDocument({ member, program });
        setState({ status: "ready", document, member: member as MemberSelectionItem, program: program as Program });
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
  }, [appId, memberId, programId]);

  return state;
};

const createSnapshotProgram = (programId: ProgramId): Program => {
  const snapshot = loadPrintSnapshot();
  if (!snapshot) {
    throw new PrintMapperError("저장된 Snapshot이 없습니다. 추천 화면에서 다시 진행해 주세요.");
  }

  const values = sanitizeProgramForm(snapshot.formValues);

  return {
    id: programId,
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
