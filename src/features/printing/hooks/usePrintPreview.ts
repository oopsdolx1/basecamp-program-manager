import { useEffect, useState } from "react";
import { ensureFirebaseAuth } from "../../../firebase/firebaseAuth";
import type { AppId, ProfileId, ProgramId } from "../../../types/brandedIds";
import { getMemberById } from "../../members/repositories/profileRepository";
import type { MemberSelectionItem } from "../../members/types/memberViewModel.types";
import { programRepository } from "../../programs/repositories/programRepository";
import type { Program } from "../../programs/types/program.types";
import { createWorkoutPrintDocument, PrintMapperError } from "../mappers/workoutPrintMapper";
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
          programRepository.getProgram(appId, programId),
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
