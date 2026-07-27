import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Stack, Typography } from "@mui/material";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { PageContainer } from "../../../components/layout/PageContainer";
import { toAppId } from "../../../types/brandedIds";
import { PrintHistoryFilters } from "../components/PrintHistoryFilters";
import { PrintRequestDetailDialog } from "../components/PrintRequestDetailDialog";
import { PrintRequestList } from "../components/PrintRequestList";
import type { PrintRequestRecord } from "../domain/printRequest.types";
import { usePrintRequests, type PrintHistoryFilters as Filters } from "../hooks/usePrintRequests";

const conditionLabAppId = toAppId(import.meta.env.VITE_CONDITION_LAB_APP_ID ?? "");

export const PrintHistoryPage = (): JSX.Element => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedRecord, setSelectedRecord] = useState<PrintRequestRecord | null>(null);
  const filters = useMemo<Filters>(
    () => ({
      search: searchParams.get("search") ?? "",
      category: (searchParams.get("category") as Filters["category"]) ?? "ALL",
      memberId: searchParams.get("memberId") ?? undefined,
      programId: searchParams.get("programId") ?? undefined,
    }),
    [searchParams],
  );
  const { state, records } = usePrintRequests(conditionLabAppId, filters);

  const updateFilters = (next: Filters) => {
    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.category !== "ALL") params.set("category", next.category);
    if (next.memberId) params.set("memberId", next.memberId);
    if (next.programId) params.set("programId", next.programId);
    setSearchParams(params);
  };

  return (
    <PageContainer>
      <Stack spacing={3}>
        <Stack spacing={0.5}>
          <Typography variant="h1">인쇄 요청 기록</Typography>
          <Typography color="text.secondary">브라우저 인쇄 버튼을 누른 요청 기록입니다.</Typography>
        </Stack>
        <PrintHistoryFilters filters={filters} onChange={updateFilters} />
        {state.status === "loading" ? <LoadingState /> : null}
        {state.status === "error" ? <ErrorState message={state.message} /> : null}
        {state.status === "ready" ? <PrintRequestList records={records} onSelect={setSelectedRecord} /> : null}
      </Stack>
      <PrintRequestDetailDialog record={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </PageContainer>
  );
};
