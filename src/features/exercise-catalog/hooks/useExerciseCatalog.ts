import { useEffect, useMemo, useState } from "react";
import { programManagerRuntime } from "../../../shared-knowledge/programManagerRuntime";
import type { AppId } from "../../../types/brandedIds";
import type { Loadable } from "../../../types/common.types";
import type { ExerciseCatalogFilters, ExerciseCatalogItem } from "../domain/exerciseCatalog.types";
import { fromSharedKnowledge } from "../mappers/sharedKnowledgeMapper";
import { searchExerciseCatalog, toCatalogOptions } from "../services/exerciseCatalogService";

const initialFilters: ExerciseCatalogFilters = {
  search: "",
  category: "ALL",
  bodyPart: "ALL",
  equipment: "ALL",
  equipmentType: "ALL",
  primaryMuscle: "ALL",
  status: "ACTIVE",
  quality: "ALL",
};

export const useExerciseCatalog = (_appId: AppId) => {
  const [catalogState, setCatalogState] = useState<Loadable<ExerciseCatalogItem[]>>({ status: "loading", data: [] });
  const [filters, setFilters] = useState<ExerciseCatalogFilters>(initialFilters);

  useEffect(() => {
    const refresh = () => {
      try {
        const runtimeStatus = programManagerRuntime.getStatus();
        const runtimeExercises = programManagerRuntime.getCatalog();
        const items = runtimeExercises.map(fromSharedKnowledge);
        const runtimeIds = runtimeExercises.map(({ id }) => id);
        const catalogIds = items.map(({ id }) => id);
        console.debug("[ProgramManagerRuntime] snapshot", {
          revision: programManagerRuntime.getRevision(),
          runtimeCount: runtimeExercises.length,
          catalogCount: items.length,
          builderSearchableCount: items.length,
          runtimeIds,
          catalogIds,
          identityMatch: runtimeIds.length === catalogIds.length && runtimeIds.every((id, index) => id === catalogIds[index]),
        });
        console.info(`[ProgramManager Hydration] Mapper count=${items.length}`, { exerciseIds: catalogIds });
        console.info(`[ProgramManager Hydration] UI count=${items.length}`, { exerciseIds: catalogIds });
        if (runtimeStatus === "loading") {
          setCatalogState({ status: "loading", data: [] });
        } else if (runtimeStatus === "error") {
          setCatalogState({ status: "error", data: items, message: `Shared Knowledge Runtime을 불러오지 못했습니다. (${programManagerRuntime.getError()})` });
        } else {
          setCatalogState({ status: "ready", data: items });
        }
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Unknown runtime error";
        setCatalogState({ status: "error", data: [], message: `Shared Knowledge Runtime을 읽지 못했습니다. (${message})` });
      }
    };
    refresh();
    return programManagerRuntime.subscribe(refresh);
  }, []);

  const filteredItems = useMemo(() => searchExerciseCatalog(catalogState.data, filters), [catalogState.data, filters]);
  const options = useMemo(() => toCatalogOptions(catalogState.data), [catalogState.data]);

  return { catalogState, items: catalogState.data, filteredItems, options, filters, setFilters };
};
