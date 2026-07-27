import { useEffect, useMemo, useState } from "react";
import { ensureFirebaseAuth } from "../../../firebase/firebaseAuth";
import type { AppId } from "../../../types/brandedIds";
import type { Loadable } from "../../../types/common.types";
import { programRepository } from "../repositories/programRepository";
import { filterAndMapPrograms } from "../services/programService";
import type { Program } from "../types/program.types";
import type { ProgramFilters, ProgramListItem } from "../types/programViewModel.types";

const initialFilters: ProgramFilters = {
  query: "",
  category: "ALL",
  difficulty: "ALL",
  favoriteOnly: false,
  includeArchived: false,
};

export const usePrograms = (appId: AppId) => {
  const [programState, setProgramState] = useState<Loadable<Program[]>>({
    status: "loading",
    data: [],
  });
  const [filters, setFilters] = useState<ProgramFilters>(initialFilters);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let active = true;

    setProgramState({ status: "loading", data: [] });

    ensureFirebaseAuth()
      .then(() => {
        if (!active) return;
        unsubscribe = programRepository.subscribePrograms(
          appId,
          (programs) => setProgramState({ status: "ready", data: programs }),
          (message) =>
            setProgramState({
              status: "error",
              data: [],
              message: `프로그램 목록을 읽지 못했습니다. (${message})`,
            }),
        );
      })
      .catch((caught: unknown) => {
        const message = caught instanceof Error ? caught.message : "Unknown auth error";
        setProgramState({
          status: "error",
          data: [],
          message: `Firebase 인증에 실패했습니다. (${message})`,
        });
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [appId]);

  const listItems: ProgramListItem[] = useMemo(
    () => filterAndMapPrograms(programState.data, filters),
    [filters, programState.data],
  );

  return {
    programState,
    programs: programState.data,
    listItems,
    filters,
    setFilters,
  };
};
