import { useEffect, useMemo, useState } from "react";
import { ensureFirebaseAuth } from "../../../firebase/firebaseAuth";
import type { AppId } from "../../../types/brandedIds";
import type { Loadable } from "../../../types/common.types";
import type { ExerciseCatalogFilters, ExerciseCatalogItem } from "../domain/exerciseCatalog.types";
import { exerciseCatalogRepository } from "../repositories/exerciseCatalogRepository";
import { searchExerciseCatalog, toCatalogOptions } from "../services/exerciseCatalogService";

const initialFilters: ExerciseCatalogFilters = {
  search: "",
  category: "ALL",
  equipmentType: "ALL",
  primaryMuscle: "ALL",
  includeArchived: false,
};

export const useExerciseCatalog = (appId: AppId) => {
  const [catalogState, setCatalogState] = useState<Loadable<ExerciseCatalogItem[]>>({
    status: "loading",
    data: [],
  });
  const [filters, setFilters] = useState<ExerciseCatalogFilters>(initialFilters);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let active = true;
    setCatalogState({ status: "loading", data: [] });

    ensureFirebaseAuth()
      .then(() => {
        if (!active) return;
        unsubscribe = exerciseCatalogRepository.subscribeCatalog(
          appId,
          (items) => setCatalogState({ status: "ready", data: items }),
          (message) =>
            setCatalogState({
              status: "error",
              data: [],
              message: `운동 카탈로그를 불러오지 못했습니다. (${message})`,
            }),
        );
      })
      .catch((caught: unknown) => {
        const message = caught instanceof Error ? caught.message : "Unknown auth error";
        setCatalogState({
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

  const filteredItems = useMemo(
    () => searchExerciseCatalog(catalogState.data, filters),
    [catalogState.data, filters],
  );
  const options = useMemo(() => toCatalogOptions(catalogState.data), [catalogState.data]);

  return {
    catalogState,
    items: catalogState.data,
    filteredItems,
    options,
    filters,
    setFilters,
  };
};
