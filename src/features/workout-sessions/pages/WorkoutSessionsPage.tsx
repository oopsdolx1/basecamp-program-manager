import SearchIcon from "@mui/icons-material/Search";
import { Alert, Box, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  Loading,
  colors,
  motion,
  shadows,
  spacing,
} from "../../../design-system";
import { routeBuilder } from "../../../app/routeBuilder";
import { toAppId } from "../../../types/brandedIds";
import { getCategoryLabel } from "../../programs/config/programOptions";
import type { WorkoutSessionRecord } from "../domain/workoutSession.types";
import { formatSessionDate } from "../presentation/workoutSessionPresentation";
import { filterWorkoutHistory, isRecordedWorkoutSession, type WorkoutHistoryPeriod, workoutHistoryDate } from "../services/workoutSessionHistoryService";
import { subscribeWorkoutSessions } from "../services/workoutSessionService";

const conditionLabAppId = toAppId(import.meta.env.VITE_CONDITION_LAB_APP_ID ?? "");
const periodFilters: Array<{ value: WorkoutHistoryPeriod; label: string }> = [
  { value: "month", label: "최근 1개월" },
  { value: "quarter", label: "최근 3개월" },
  { value: "all", label: "전체" },
];

const isManual = (record: WorkoutSessionRecord): boolean => record.source?.type === "manual" || record.prescription?.source?.type === "manual";
const sourceLabel = (record: WorkoutSessionRecord): string => isManual(record) ? "직접 구성 운동" : record.programSnapshot.title;
const categoryLabel = (record: WorkoutSessionRecord): string => getCategoryLabel(record.prescription?.category ?? record.programSnapshot.category ?? "CUSTOM");
const plannedSetCount = (record: WorkoutSessionRecord): number => record.exercises.reduce((total, exercise) => total + (exercise.plannedSets ?? 0), 0);
const listDate = (record: WorkoutSessionRecord): string => new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(workoutHistoryDate(record));

export const WorkoutSessionsPage = ({ initialSessionId = null }: { initialSessionId?: string | null }): JSX.Element => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<WorkoutSessionRecord[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<WorkoutHistoryPeriod>("month");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reprinting, setReprinting] = useState(false);
  const reprintInFlight = useRef(false);

  useEffect(() => subscribeWorkoutSessions(conditionLabAppId, (next) => {
    setRecords(next);
    setSelectedId((current) => {
      if (current && next.some(({ sessionId }) => sessionId === current)) return current;
      if (initialSessionId && next.some((record) => record.sessionId === initialSessionId && isRecordedWorkoutSession(record))) return initialSessionId;
      return next.find(isRecordedWorkoutSession)?.sessionId ?? null;
    });
    setStatus("ready");
  }, () => {
    setStatus("error");
  }), [initialSessionId]);

  const filtered = useMemo(() => filterWorkoutHistory(records, { period, search: query }), [period, query, records]);
  const selected = useMemo(() => filtered.find(({ sessionId }) => sessionId === selectedId) ?? null, [filtered, selectedId]);
  const reprint = (): void => {
    if (!selected || reprintInFlight.current) return;
    reprintInFlight.current = true;
    setReprinting(true);
    navigate(routeBuilder.printPreviewSession(selected.memberId, selected.sessionId, true, true));
  };

  return (
    <Box sx={{ bgcolor: colors.neutral.black, display: "flex", height: "100%", minHeight: 0, overflow: "hidden", p: { md: `${spacing[6]}px`, xs: `${spacing[4]}px` } }}>
      <Stack justifyContent="center" spacing={`${spacing[4]}px`} sx={{ flex: "1 1 auto", margin: "0 auto", maxHeight: "100%", maxWidth: 1040, minHeight: 0, overflow: "hidden" }}>
        <Box textAlign="center"><Typography color={colors.primary.gold} fontWeight={800} variant="overline">WORKOUT HISTORY</Typography><Typography fontWeight={800} variant="h4">이전 운동기록</Typography><Typography color={colors.neutral.gray400}>회원의 출력·저장된 운동 기록을 확인할 수 있습니다.</Typography></Box>
        <Card><Stack spacing={`${spacing[3]}px`}><Input fullWidth label="회원명 또는 운동명으로 검색" value={query} onChange={(event) => setQuery(event.target.value)} InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1 }} /> }} /><Stack direction="row" flexWrap="wrap" gap={`${spacing[2]}px`} justifyContent="center">{periodFilters.map((item) => <Chip key={item.value} clickable label={item.label} selected={period === item.value} onClick={() => setPeriod(item.value)} sx={{ minHeight: 48 }} />)}</Stack></Stack></Card>
        {status === "loading" ? <Card><Loading label="운동기록을 불러오는 중" /></Card> : null}
        {status === "error" ? <Alert severity="error">운동기록을 불러오지 못했습니다.</Alert> : null}
        {status === "ready" && records.length === 0 ? <Card><EmptyState title="저장된 운동기록이 없습니다." description="운동을 출력하면 이곳에서 기록을 확인할 수 있습니다." /></Card> : null}
        {status === "ready" && records.length > 0 && filtered.length === 0 ? <Card><EmptyState title="조건에 맞는 운동기록이 없습니다." description="검색어 또는 기간을 변경해 보세요. 출력 전 초안은 이력에 표시되지 않습니다." /></Card> : null}
        {filtered.length > 0 ? (
          <Box sx={{ display: "grid", flex: "1 1 auto", gap: `${spacing[4]}px`, gridTemplateColumns: { lg: "minmax(0, 3fr) minmax(340px, 2fr)", xs: "minmax(0, 1fr)" }, minHeight: 0, "& > *": { minWidth: 0 } }}>
            <Stack spacing={`${spacing[3]}px`} sx={{ minHeight: 0, overflowY: "auto", pr: { lg: 1 } }}>
              {filtered.map((record) => {
                const isSelected = selectedId === record.sessionId;
                return <Card aria-pressed={isSelected} key={record.sessionId} onClick={() => setSelectedId(record.sessionId)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(record.sessionId); } }} role="button" sx={{ bgcolor: isSelected ? colors.alpha.goldMuted : colors.neutral.gray900, borderColor: isSelected ? colors.primary.gold : colors.neutral.gray700, boxShadow: isSelected ? shadows.md : shadows.sm, cursor: "pointer", minHeight: 154, transition: motion.transition, "&:focus-visible": { outline: `3px solid ${colors.alpha.goldFocus}`, outlineOffset: 2 }, "&:hover": { borderColor: colors.primary.goldDark, transform: "translateY(-1px)" } }} tabIndex={0}>
                  <Stack spacing={`${spacing[2]}px`}>
                    <Typography color={isSelected ? colors.primary.goldLight : colors.neutral.gray300} fontWeight={800} variant="body1">{listDate(record)}</Typography>
                    <Typography fontWeight={900} variant="h6">{record.memberSnapshot.name}</Typography>
                    <Typography color={colors.neutral.gray100} fontWeight={700}>{categoryLabel(record)} · {record.exercises.length}종목</Typography>
                    <Typography color={colors.neutral.gray400} variant="body2">{sourceLabel(record)}</Typography>
                  </Stack>
                </Card>;
              })}
            </Stack>
            <Card sx={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
              {!selected ? <EmptyState title="운동기록을 선택하세요." description="목록에서 기록을 선택하면 운동 구성을 볼 수 있습니다." /> : <>
                <Stack spacing={`${spacing[3]}px`} sx={{ minHeight: 0, overflowY: "auto", p: `${spacing[2]}px` }}>
                  <Box><Typography color={colors.neutral.gray400} variant="body2">{formatSessionDate(workoutHistoryDate(selected))}</Typography><Typography fontWeight={900} variant="h5">{selected.memberSnapshot.name}</Typography><Typography color={colors.primary.gold} fontWeight={800}>{sourceLabel(selected)}</Typography></Box>
                  <Stack direction="row" flexWrap="wrap" gap={`${spacing[2]}px`}><Chip label={categoryLabel(selected)} /><Chip label={`운동 ${selected.exercises.length}종목`} /><Chip label={`총 ${plannedSetCount(selected)}세트`} /></Stack>
                  <Box><Typography color={colors.neutral.gray400} fontWeight={800} variant="body2">운동 목록</Typography><Stack spacing={`${spacing[2]}px`} sx={{ mt: `${spacing[2]}px` }}>{selected.exercises.slice().sort((left, right) => left.order - right.order).map((exercise) => <Box key={`${exercise.programExerciseId}-${exercise.order}`} sx={{ borderBottom: `1px solid ${colors.neutral.gray700}`, pb: `${spacing[2]}px` }}><Typography fontWeight={800}>{exercise.order}. {exercise.name}</Typography><Typography color={colors.neutral.gray400} variant="body2">{exercise.plannedSets ?? 0}세트{exercise.memo ? ` · ${exercise.memo}` : ""}</Typography></Box>)}</Stack></Box>
                </Stack>
                <Box sx={{ borderTop: `1px solid ${colors.neutral.gray700}`, p: `${spacing[3]}px` }}><Button fullWidth loading={reprinting} onClick={reprint} sx={{ fontSize: { md: 24, xs: 21 }, minHeight: { md: 84, xs: 76 } }}>이 운동기록 다시 출력</Button></Box>
              </>}
            </Card>
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
};
