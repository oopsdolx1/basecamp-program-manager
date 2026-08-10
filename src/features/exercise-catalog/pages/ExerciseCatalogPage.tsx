import { useMemo } from "react";
import { Stack, Typography } from "@mui/material";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { PageContainer } from "../../../components/layout/PageContainer";
import { toAppId } from "../../../types/brandedIds";
import { usePrograms } from "../../programs/hooks/usePrograms";
import { ExerciseCatalogDashboard } from "../components/ExerciseCatalogDashboard";
import { ExerciseCatalogFilters } from "../components/ExerciseCatalogFilters";
import { ExerciseCatalogList } from "../components/ExerciseCatalogList";
import { ExerciseResolverTestPanel } from "../components/ExerciseResolverTestPanel";
import { ExerciseCatalogStatistics } from "../components/ExerciseCatalogStatistics";
import { useExerciseCatalog } from "../hooks/useExerciseCatalog";

const conditionLabAppId = toAppId(import.meta.env.VITE_CONDITION_LAB_APP_ID ?? "");

export const ExerciseCatalogPage = (): JSX.Element => {
  const { catalogState, filteredItems, items, filters, setFilters } = useExerciseCatalog(conditionLabAppId);
  const { programs } = usePrograms(conditionLabAppId);
  const usageCounts = useMemo(() => programs.reduce<Record<string, number>>((counts, program) => {
    new Set(program.exercises.map((exercise) => exercise.catalogExerciseId).filter(Boolean)).forEach((id) => {
      if (id) counts[id] = (counts[id] ?? 0) + 1;
    });
    return counts;
  }, {}), [programs]);
  const bodyParts = useMemo(() => [...new Set(items.map((item) => item.bodyPart).filter((value): value is string => Boolean(value)))].sort(), [items]);
  const equipment = useMemo(() => [...new Set(items.map((item) => item.equipment).filter((value): value is string => Boolean(value)))].sort(), [items]);

  return (
    <PageContainer>
      <Stack spacing={3}>
        <Stack spacing={0.5}>
          <Typography variant="h1">Exercise Catalog</Typography>
          <Typography color="text.secondary">Condition Lab의 Shared Knowledge Runtime을 실시간으로 조회합니다.</Typography>
        </Stack>
        <ExerciseCatalogDashboard items={items} />
        <ExerciseCatalogFilters filters={filters} bodyParts={bodyParts} equipment={equipment} onChange={setFilters} />
        {catalogState.status === "loading" ? <LoadingState /> : null}
        {catalogState.status === "error" ? <ErrorState message={catalogState.message} /> : null}
        {catalogState.status === "ready" ? (
          <ExerciseCatalogList items={filteredItems} usageCounts={usageCounts} onEdit={() => undefined} onArchive={() => undefined} onRestore={() => undefined} />
        ) : null}
        <ExerciseResolverTestPanel items={items} />
        <ExerciseCatalogStatistics items={items} />
      </Stack>
    </PageContainer>
  );
};
