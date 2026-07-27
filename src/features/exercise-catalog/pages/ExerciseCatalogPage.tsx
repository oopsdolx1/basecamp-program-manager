import { Alert, Button, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { PageContainer } from "../../../components/layout/PageContainer";
import { toAppId } from "../../../types/brandedIds";
import { normalizeText } from "../../../utils/normalizeText";
import { ExerciseCatalogFilters } from "../components/ExerciseCatalogFilters";
import { ExerciseCatalogList } from "../components/ExerciseCatalogList";
import { initialExerciseCatalogSeed } from "../constants/initialExerciseCatalogSeed";
import { useExerciseCatalog } from "../hooks/useExerciseCatalog";
import { exerciseCatalogRepository } from "../repositories/exerciseCatalogRepository";

const conditionLabAppId = toAppId(import.meta.env.VITE_CONDITION_LAB_APP_ID ?? "");

export const ExerciseCatalogPage = (): JSX.Element => {
  const { catalogState, filteredItems, items, filters, setFilters } = useExerciseCatalog(conditionLabAppId);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const seedCatalog = async () => {
    setSeeding(true);
    setMessage(null);
    try {
      const existing = new Set(items.map((item) => normalizeText(item.name)));
      let created = 0;
      for (const seed of initialExerciseCatalogSeed) {
        if (existing.has(normalizeText(seed.name))) continue;
        await exerciseCatalogRepository.createExercise(conditionLabAppId, seed);
        created += 1;
      }
      setMessage(`Seed 완료: ${created}개 생성, 기존 중복 ${initialExerciseCatalogSeed.length - created}개 건너뜀`);
    } catch (caught) {
      const error = caught instanceof Error ? caught.message : "Unknown error";
      setMessage(`Seed 실패: ${error}`);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <PageContainer>
      <Stack spacing={3}>
        <Stack direction={{ md: "row", xs: "column" }} justifyContent="space-between" spacing={2}>
          <Stack spacing={0.5}>
            <Typography variant="h1">Exercise Catalog</Typography>
            <Typography color="text.secondary">Program Editor, OCR, AI가 함께 사용할 표준 운동 사전입니다.</Typography>
          </Stack>
          <Button disabled={seeding || catalogState.status !== "ready"} variant="contained" onClick={seedCatalog}>
            {seeding ? "Seed 실행 중..." : `초기 Seed ${initialExerciseCatalogSeed.length}개`}
          </Button>
        </Stack>
        {message ? <Alert severity={message.includes("실패") ? "error" : "success"}>{message}</Alert> : null}
        <ExerciseCatalogFilters filters={filters} onChange={setFilters} />
        {catalogState.status === "loading" ? <LoadingState /> : null}
        {catalogState.status === "error" ? <ErrorState message={catalogState.message} /> : null}
        {catalogState.status === "ready" ? <ExerciseCatalogList items={filteredItems} /> : null}
      </Stack>
    </PageContainer>
  );
};
