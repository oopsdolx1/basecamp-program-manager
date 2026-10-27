import SearchIcon from "@mui/icons-material/Search";
import { Alert, Box, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import {
  Card,
  Chip,
  EmptyState,
  Input,
  Loading,
  StatusChip,
  colors,
  motion,
  radius,
  shadows,
  spacing,
} from "../../../design-system";
import { toAppId } from "../../../types/brandedIds";
import type { WorkoutSessionRecord } from "../domain/workoutSession.types";
import { formatSessionDate, workoutSessionStatusPresentation } from "../presentation/workoutSessionPresentation";
import { filterWorkoutHistory, isRecordedWorkoutSession, type WorkoutHistoryPeriod, workoutHistoryDate } from "../services/workoutSessionHistoryService";
import { subscribeWorkoutSessions } from "../services/workoutSessionService";

const conditionLabAppId = toAppId(import.meta.env.VITE_CONDITION_LAB_APP_ID ?? "");
const periodFilters: Array<{ value: WorkoutHistoryPeriod; label: string }> = [
  { value: "month", label: "최근 1개월" },
  { value: "quarter", label: "최근 3개월" },
  { value: "all", label: "전체" },
];

const sourceLabel = (record: WorkoutSessionRecord): string => record.source?.type === "manual" || record.prescription?.source?.type === "manual" ? "직접 구성" : "프로그램 운동";
const plannedSetCount = (record: WorkoutSessionRecord): number => record.exercises.reduce((total, exercise) => total + (exercise.plannedSets ?? 0), 0);

export const WorkoutSessionsPage = ({ initialSessionId = null }: { initialSessionId?: string | null }): JSX.Element => {
  const [records, setRecords] = useState<WorkoutSessionRecord[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<WorkoutHistoryPeriod>("month");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => subscribeWorkoutSessions(conditionLabAppId, (next) => {
    setRecords(next);
    setSelectedId((current) => {
      if (current && next.some(({ sessionId }) => sessionId === current)) return current;
      if (initialSessionId && next.some((record) => record.sessionId === initialSessionId && isRecordedWorkoutSession(record))) return initialSessionId;
      return next.find(isRecordedWorkoutSession)?.sessionId ?? null;
    });
    setStatus("ready");
  }, (message) => {
    setError(message);
    setStatus("error");
  }), [initialSessionId]);

  const filtered = useMemo(() => filterWorkoutHistory(records, { period, search: query }), [period, query, records]);
  const selected = useMemo(() => filtered.find(({ sessionId }) => sessionId === selectedId) ?? null, [filtered, selectedId]);

  return (
    <Box sx={{ bgcolor: colors.neutral.black, minHeight: "calc(100dvh - 52px)", p: { md: `${spacing[6]}px`, xs: `${spacing[4]}px` } }}>
      <Stack spacing={`${spacing[4]}px`} sx={{ margin: "0 auto", maxWidth: 1040 }}>
        <Box textAlign="center"><Typography color={colors.primary.gold} fontWeight={800} variant="overline">WORKOUT HISTORY</Typography><Typography fontWeight={800} variant="h4">이전 운동기록</Typography><Typography color={colors.neutral.gray400}>회원의 출력·저장된 운동 기록을 확인할 수 있습니다.</Typography></Box>
        <Card><Stack spacing={`${spacing[3]}px`}><Input fullWidth label="회원명 또는 운동명으로 검색" value={query} onChange={(event) => setQuery(event.target.value)} InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1 }} /> }} /><Stack direction="row" flexWrap="wrap" gap={`${spacing[2]}px`} justifyContent="center">{periodFilters.map((item) => <Chip key={item.value} clickable label={item.label} selected={period === item.value} onClick={() => setPeriod(item.value)} sx={{ minHeight: 48 }} />)}</Stack></Stack></Card>
        {status === "loading" ? <Card><Loading label="운동기록을 불러오는 중" /></Card> : null}
        {status === "error" ? <Alert severity="error">{error}</Alert> : null}
        {status === "ready" && records.length === 0 ? <Card><EmptyState title="저장된 운동기록이 없습니다." description="운동을 출력하면 이곳에서 기록을 확인할 수 있습니다." /></Card> : null}
        {status === "ready" && records.length > 0 && filtered.length === 0 ? <Card><EmptyState title="조건에 맞는 운동기록이 없습니다." description="검색어 또는 기간을 변경해 보세요. 출력 전 초안은 이력에 표시되지 않습니다." /></Card> : null}
        {filtered.length > 0 ? <Box sx={{ display: "grid", gap: `${spacing[4]}px`, gridTemplateColumns: { lg: "minmax(0, 1fr) 360px", xs: "minmax(0, 1fr)" }, "& > *": { minWidth: 0 } }}>
          <Stack spacing={`${spacing[3]}px`} sx={{ maxHeight: { lg: "calc(100dvh - 300px)" }, overflowY: { lg: "auto" }, pr: { lg: 1 } }}>{filtered.map((record) => { const view = workoutSessionStatusPresentation[record.status]; const isSelected = selectedId === record.sessionId; return <Card aria-pressed={isSelected} key={record.sessionId} onClick={() => setSelectedId(record.sessionId)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(record.sessionId); } }} role="button" sx={{ borderColor: isSelected ? colors.primary.gold : colors.neutral.gray700, boxShadow: isSelected ? shadows.md : shadows.sm, cursor: "pointer", transition: motion.transition, "&:focus-visible": { outline: `3px solid ${colors.alpha.goldFocus}`, outlineOffset: 2 }, "&:hover": { borderColor: colors.primary.goldDark, transform: "translateY(-1px)" } }} tabIndex={0}><Stack spacing={`${spacing[2]}px`}><Stack alignItems="flex-start" direction="row" justifyContent="space-between" spacing={`${spacing[2]}px`}><Box><Typography fontWeight={800} variant="h6">{record.memberSnapshot.name}</Typography><Typography color={colors.neutral.gray300}>{record.programSnapshot.title}</Typography></Box><StatusChip label={view.label} status={record.status === "confirmed" ? "success" : record.status === "ocr_pending" ? "warning" : "info"} /></Stack><Stack direction="row" flexWrap="wrap" gap={`${spacing[2]}px`}><Chip label={sourceLabel(record)} size="small" /><Typography color={colors.neutral.gray400} variant="body2">{formatSessionDate(workoutHistoryDate(record))}</Typography><Typography color={colors.neutral.gray400} variant="body2">운동 {record.exercises.length}개 · {plannedSetCount(record)}세트</Typography></Stack></Stack></Card>; })}</Stack>
          <Card sx={{ alignSelf: "start", position: { lg: "sticky" }, top: `${spacing[4]}px` }}>{!selected ? <EmptyState title="운동기록을 선택하세요." description="목록에서 기록을 선택하면 운동 구성을 볼 수 있습니다." /> : <Stack spacing={`${spacing[3]}px`}><Box><Typography color={colors.primary.gold} fontWeight={800} variant="overline">{sourceLabel(selected)}</Typography><Typography fontWeight={800} variant="h6">{selected.memberSnapshot.name}</Typography><Typography color={colors.neutral.gray300}>{formatSessionDate(workoutHistoryDate(selected))}</Typography></Box><Box><Typography color={colors.neutral.gray400} variant="caption">운동 구성</Typography><Typography fontWeight={700}>{selected.programSnapshot.title}</Typography></Box><Stack spacing={`${spacing[2]}px`}>{selected.exercises.slice().sort((left, right) => left.order - right.order).map((exercise) => <Box key={`${exercise.programExerciseId}-${exercise.order}`} sx={{ borderBottom: `1px solid ${colors.neutral.gray700}`, pb: `${spacing[2]}px` }}><Typography fontWeight={700}>{exercise.order}. {exercise.name}</Typography><Typography color={colors.neutral.gray400} variant="body2">{exercise.plannedSets ?? 0}세트{exercise.memo ? ` · ${exercise.memo}` : ""}</Typography></Box>)}</Stack><Typography color={colors.neutral.gray400} variant="caption">기록 ID · {selected.sessionId}</Typography></Stack>}</Card>
        </Box> : null}
      </Stack>
    </Box>
  );
};
