import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Stack, Typography } from "@mui/material";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { toAppId } from "../../../types/brandedIds";
import { PrintHistoryFilters } from "../../print-history/components/PrintHistoryFilters";
import { PrintRequestDetailDialog } from "../../print-history/components/PrintRequestDetailDialog";
import { PrintRequestList } from "../../print-history/components/PrintRequestList";
import type { PrintRequestRecord } from "../../print-history/domain/printRequest.types";
import { usePrintRequests, type PrintHistoryFilters as Filters } from "../../print-history/hooks/usePrintRequests";

const conditionLabAppId = toAppId(import.meta.env.VITE_CONDITION_LAB_APP_ID ?? "");

export const PrintHistorySection = (): JSX.Element => {
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
    const params = new URLSearchParams(searchParams);
    params.set("tab", "history");
    if (next.search) params.set("search", next.search);
    else params.delete("search");
    if (next.category !== "ALL") params.set("category", next.category);
    else params.delete("category");
    if (next.memberId) params.set("memberId", next.memberId);
    else params.delete("memberId");
    if (next.programId) params.set("programId", next.programId);
    else params.delete("programId");
    setSearchParams(params);
  };

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h1">Print History</Typography>
        <Typography color="text.secondary">브라우저 인쇄 버튼을 누른 Print Request 기록을 확인합니다.</Typography>
      </Stack>
      <Alert severity="info" variant="outlined">
        Print History는 완료 기록이 아니라 인쇄 요청 기록입니다. Firestore index가 준비되지 않은 경우 기존 오류를 그대로 안내합니다.
      </Alert>
      <PrintHistoryFilters filters={filters} onChange={updateFilters} />
      {state.status === "loading" ? <LoadingState message="Print Request 기록을 불러오는 중입니다." /> : null}
      {state.status === "error" ? <ErrorState message={state.message} /> : null}
      {state.status === "ready" ? <PrintRequestList records={records} onSelect={setSelectedRecord} /> : null}
      <PrintRequestDetailDialog record={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </Stack>
  );
};
