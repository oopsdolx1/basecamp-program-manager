import QrCode2Icon from "@mui/icons-material/QrCode2";
import SearchIcon from "@mui/icons-material/Search";
import { Alert, Box, Stack, Typography } from "@mui/material";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
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
import { normalizeText } from "../../../utils/normalizeText";
import type { PrintRequestRecord } from "../../print-history/domain/printRequest.types";
import { getPrintRequestsByIds } from "../../print-history/services/printRequestService";
import type { WorkoutSessionRecord, WorkoutSessionStatus } from "../domain/workoutSession.types";
import { formatSessionDate, workoutSessionStatusPresentation } from "../presentation/workoutSessionPresentation";
import { subscribeWorkoutSessions } from "../services/workoutSessionService";

const conditionLabAppId = toAppId(import.meta.env.VITE_CONDITION_LAB_APP_ID ?? "");
type StatusFilter = "all" | Exclude<WorkoutSessionStatus, "created">;

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "printed", label: "Printed" },
  { value: "ocr_pending", label: "OCR Pending" },
  { value: "ocr_completed", label: "OCR Completed" },
  { value: "ai_completed", label: "AI Completed" },
  { value: "confirmed", label: "Confirmed" },
];

const lifecycle: Array<{ status: WorkoutSessionStatus; label: string }> = [
  { status: "printed", label: "Printed" },
  { status: "ocr_pending", label: "OCR Pending" },
  { status: "ocr_completed", label: "OCR Completed" },
  { status: "ai_completed", label: "AI Completed" },
  { status: "confirmed", label: "Confirmed" },
];
const statusOrder: WorkoutSessionStatus[] = ["created", "printed", "ocr_pending", "ocr_completed", "ai_completed", "confirmed"];

const toneForStatus = (status: WorkoutSessionStatus): "success" | "warning" | "pending" | "info" => {
  if (status === "confirmed") return "success";
  if (status === "ai_completed" || status === "ocr_completed") return "info";
  if (status === "ocr_pending") return "warning";
  return "pending";
};

const hasReached = (current: WorkoutSessionStatus, target: WorkoutSessionStatus): boolean =>
  statusOrder.indexOf(current) >= statusOrder.indexOf(target);

const isToday = (date: Date): boolean => {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
};

export const WorkoutSessionsPage = ({ initialSessionId = null }: { initialSessionId?: string | null }): JSX.Element => {
  const [records, setRecords] = useState<WorkoutSessionRecord[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<PrintRequestRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => subscribeWorkoutSessions(conditionLabAppId, (next) => {
    setRecords(next);
    setSelectedId((current) => {
      if (current && next.some(({ sessionId }) => sessionId === current)) return current;
      if (initialSessionId && next.some(({ sessionId }) => sessionId === initialSessionId)) return initialSessionId;
      return next[0]?.sessionId ?? null;
    });
    setStatus("ready");
  }, (message) => {
    setError(message);
    setStatus("error");
  }), [initialSessionId]);

  const selected = useMemo(() => records.find(({ sessionId }) => sessionId === selectedId) ?? null, [records, selectedId]);
  const filtered = useMemo(() => {
    const search = normalizeText(query);
    return records
      .filter((record) => filter === "all" || record.status === filter)
      .filter((record) => !search || normalizeText(`${record.sessionId} ${record.memberSnapshot.name} ${record.programSnapshot.title}`).includes(search));
  }, [filter, query, records]);

  useEffect(() => {
    if (!selected || selected.print.historyIds.length === 0) {
      setHistory([]);
      return;
    }
    let active = true;
    setHistoryLoading(true);
    getPrintRequestsByIds(conditionLabAppId, selected.print.historyIds)
      .then((items) => { if (active) setHistory(items.sort((left, right) => right.copy - left.copy)); })
      .catch(() => { if (active) setHistory([]); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [selected]);

  const summary = useMemo(() => [
    ["오늘 생성", records.filter((record) => isToday(record.createdAt)).length],
    ["출력 완료", records.filter((record) => Boolean(record.printedAt)).length],
    ["OCR 대기", records.filter(({ status }) => status === "ocr_pending").length],
    ["OCR 완료", records.filter(({ status }) => status === "ocr_completed").length],
    ["AI 완료", records.filter(({ status }) => status === "ai_completed").length],
    ["Confirmed", records.filter(({ status }) => status === "confirmed").length],
  ] as const, [records]);

  return (
    <Box onKeyDown={(event) => { if (event.key === "Escape") setSelectedId(null); }} sx={{ bgcolor: colors.neutral.black, minHeight: "100vh", p: { lg: `${spacing[8]}px`, md: `${spacing[6]}px`, xs: `${spacing[4]}px` } }}>
      <Stack spacing={`${spacing[6]}px`} sx={{ margin: "0 auto", maxWidth: 1600 }}>
        <Stack alignItems={{ md: "center", xs: "flex-start" }} direction={{ md: "row", xs: "column" }} justifyContent="space-between" spacing={`${spacing[3]}px`}>
          <Box><Typography color={colors.primary.gold} fontWeight={800} variant="overline">SESSION LIFECYCLE</Typography><Typography variant="h4">Workout Session Dashboard</Typography><Typography color={colors.neutral.gray400}>Program 출력 이후 OCR, AI, Confirmed 진행 상태를 읽기 전용으로 확인합니다.</Typography></Box>
          <StatusChip label={status === "loading" ? "동기화 중" : `${records.length} Sessions`} status={status === "error" ? "error" : status === "loading" ? "pending" : "success"} />
        </Stack>

        {status === "loading" ? <Card><Loading label="Workout Session을 불러오는 중" /></Card> : null}
        {status === "error" ? <Alert severity="error">{error}</Alert> : null}
        {status === "ready" && records.length === 0 ? <Card><EmptyState title="Workout Session이 없습니다." description="Program을 출력하면 실제 Session이 여기에 표시됩니다." /></Card> : null}

        {records.length > 0 ? (
          <>
            <Box sx={{ display: "grid", gap: `${spacing[3]}px`, gridTemplateColumns: { xl: "repeat(6, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", xs: "repeat(2, minmax(0, 1fr))" } }}>
              {summary.map(([label, count]) => <Card key={label} variant="stat"><Typography color={colors.neutral.gray400} variant="body2">{label}</Typography><Typography color={count > 0 ? colors.primary.gold : colors.neutral.gray300} fontWeight={800} variant="h4">{count}</Typography></Card>)}
            </Box>

            <Card>
              <Stack spacing={`${spacing[3]}px`}>
                <Input fullWidth label="Session ID · 회원명 · Program 검색" value={query} onChange={(event) => setQuery(event.target.value)} InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1 }} /> }} />
                <Stack direction="row" flexWrap="wrap" gap={`${spacing[2]}px`}>{statusFilters.map((item) => <Chip key={item.value} clickable label={item.label} selected={filter === item.value} onClick={() => setFilter(item.value)} sx={{ minHeight: 48 }} />)}</Stack>
              </Stack>
            </Card>

            <Box sx={{ display: "grid", gap: `${spacing[4]}px`, gridTemplateColumns: { lg: "minmax(0, 1fr) 420px", md: "minmax(0, 1fr) 360px", sm: "minmax(0, 1fr) 320px", xs: "minmax(0, 1fr)" }, "& > *": { minWidth: 0 } }}>
              <Stack spacing={`${spacing[3]}px`}>
                {filtered.length === 0 ? <Card><EmptyState title="조건에 맞는 Session이 없습니다." description="검색어나 Status Filter를 변경해 보세요." /></Card> : null}
                {filtered.map((record) => {
                  const view = workoutSessionStatusPresentation[record.status];
                  return (
                    <Card
                      key={record.sessionId}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selectedId === record.sessionId}
                      onClick={() => setSelectedId(record.sessionId)}
                      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(record.sessionId); } }}
                      sx={{ borderColor: selectedId === record.sessionId ? colors.primary.gold : colors.neutral.gray700, boxShadow: selectedId === record.sessionId ? shadows.md : shadows.sm, cursor: "pointer", minHeight: 184, transition: motion.transition, "&:hover": { borderColor: colors.primary.goldDark, transform: "translateY(-1px)" }, "&:focus-visible": { outline: `3px solid ${colors.alpha.goldFocus}`, outlineOffset: 2 } }}
                    >
                      <Stack spacing={`${spacing[3]}px`}>
                        <Stack alignItems="flex-start" direction="row" justifyContent="space-between" spacing={`${spacing[2]}px`}><Box><Typography fontWeight={800} variant="h6">{record.memberSnapshot.name}</Typography><Typography color={colors.neutral.gray300}>{record.programSnapshot.title}</Typography></Box><StatusChip label={view.label} status={toneForStatus(record.status)} /></Stack>
                        <Box sx={{ display: "grid", gap: `${spacing[2]}px`, gridTemplateColumns: { sm: "repeat(3, minmax(0, 1fr))", xs: "minmax(0, 1fr)" } }}><Box><Typography color={colors.neutral.gray400} variant="caption">출력 시각</Typography><Typography variant="body2">{formatSessionDate(record.printedAt)}</Typography></Box><Box><Typography color={colors.neutral.gray400} variant="caption">마지막 업데이트</Typography><Typography variant="body2">{formatSessionDate(record.updatedAt)}</Typography></Box><Box><Typography color={colors.neutral.gray400} variant="caption">Session ID</Typography><Typography noWrap variant="body2">{record.sessionId}</Typography></Box></Box>
                        <Stack direction="row" spacing={`${spacing[1]}px`}>{lifecycle.map((step) => <Box key={step.status} title={step.label} sx={{ bgcolor: hasReached(record.status, step.status) ? colors.primary.gold : colors.neutral.gray700, borderRadius: `${radius.full}px`, flex: 1, height: 6, transition: motion.transition }} />)}</Stack>
                      </Stack>
                    </Card>
                  );
                })}
              </Stack>

              <Box sx={{ minWidth: 0 }}>
                {!selected ? <Card sx={{ position: { sm: "sticky" }, top: `${spacing[4]}px` }}><EmptyState title="Session을 선택하세요." description="왼쪽 목록에서 Session을 선택하면 상세 진행 상태를 확인할 수 있습니다." /></Card> : (
                  <Stack spacing={`${spacing[3]}px`} sx={{ position: { sm: "sticky" }, top: `${spacing[4]}px` }}>
                    <Card variant="analysis">
                      <Stack spacing={`${spacing[3]}px`}>
                        <Stack alignItems="center" direction="row" justifyContent="space-between"><Badge>{selected.memberSnapshot.name}</Badge><StatusChip label={workoutSessionStatusPresentation[selected.status].label} status={toneForStatus(selected.status)} /></Stack>
                        <Box><Typography color={colors.neutral.gray400} variant="caption">Program</Typography><Typography fontWeight={800}>{selected.programSnapshot.title}</Typography></Box>
                        <Box><Typography color={colors.neutral.gray400} variant="caption">Workout Session ID</Typography><Typography fontFamily="monospace" sx={{ overflowWrap: "anywhere" }}>{selected.sessionId}</Typography></Box>
                        <Box sx={{ display: "grid", gap: `${spacing[2]}px`, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}><Box><Typography color={colors.neutral.gray400} variant="caption">Copy Count</Typography><Typography fontWeight={800}>{selected.print.copyCount}</Typography></Box><Box><Typography color={colors.neutral.gray400} variant="caption">운동</Typography><Typography fontWeight={800}>{selected.exercises.length}개</Typography></Box></Box>
                      </Stack>
                    </Card>

                    <Card>
                      <Stack alignItems="center" spacing={`${spacing[2]}px`}><QRCodeSVG value={selected.sessionId} size={144} level="M" marginSize={1} /><Typography fontFamily="monospace" textAlign="center" variant="caption" sx={{ overflowWrap: "anywhere" }}>{selected.sessionId}</Typography><StatusChip label={selected.sessionId ? "QR Ready" : "QR 없음"} status={selected.sessionId ? "success" : "warning"} /></Stack>
                    </Card>

                    <Card>
                      <Stack spacing={`${spacing[3]}px`}><Typography variant="h6">Lifecycle</Typography>{lifecycle.map((step) => { const reached = hasReached(selected.status, step.status); const current = selected.status === step.status; return <Stack key={step.status} alignItems="center" direction="row" spacing={`${spacing[3]}px`}><Box sx={{ bgcolor: reached ? colors.primary.gold : colors.neutral.gray700, border: current ? `3px solid ${colors.primary.goldLight}` : "none", borderRadius: `${radius.full}px`, height: 18, width: 18 }} /><Box sx={{ flex: 1 }}><Typography color={current ? colors.primary.goldLight : colors.neutral.gray100} fontWeight={current ? 800 : 500}>{step.label}</Typography><Typography color={colors.neutral.gray400} variant="caption">{step.status === "printed" && selected.printedAt ? formatSessionDate(selected.printedAt) : current ? `현재 상태 · ${formatSessionDate(selected.updatedAt)}` : reached ? "완료" : "대기"}</Typography></Box></Stack>; })}</Stack>
                    </Card>

                    <Card>
                      <Stack spacing={`${spacing[3]}px`}><Typography variant="h6">상태 확인</Typography><Stack direction="row" flexWrap="wrap" gap={`${spacing[2]}px`}><StatusChip label={selected.printedAt ? "Printed" : "출력 대기"} status={selected.printedAt ? "success" : "pending"} /><StatusChip label={hasReached(selected.status, "ocr_completed") ? "OCR 완료" : selected.status === "ocr_pending" ? "OCR 대기" : "OCR 미시작"} status={hasReached(selected.status, "ocr_completed") ? "success" : selected.status === "ocr_pending" ? "warning" : "pending"} /><StatusChip label={hasReached(selected.status, "ai_completed") ? "AI 완료" : "AI 미시작"} status={hasReached(selected.status, "ai_completed") ? "info" : "pending"} /><StatusChip label={selected.status === "confirmed" ? "Confirmed" : "확인 대기"} status={selected.status === "confirmed" ? "success" : "pending"} /></Stack><Button disabled variant="secondary">Condition Lab에서 보기</Button><Typography color={colors.neutral.gray400} variant="caption">연결된 Condition Lab route가 없어 비활성화되어 있습니다.</Typography></Stack>
                    </Card>

                    <Card>
                      <Stack spacing={`${spacing[3]}px`}><Typography variant="h6">Print History</Typography>{historyLoading ? <Loading label="출력 이력을 불러오는 중" /> : null}{!historyLoading && history.length === 0 ? <EmptyState title="출력 이력이 없습니다." description="Session이 출력되면 Copy 정보가 표시됩니다." /> : null}{history.map((record) => <Card key={record.id} sx={{ p: `${spacing[3]}px` }}><Stack direction="row" justifyContent="space-between" spacing={`${spacing[2]}px`}><Box><Typography fontWeight={800}>Copy {record.copy}</Typography><Typography color={colors.neutral.gray400} variant="caption">{formatSessionDate(record.printedAt)}</Typography></Box><Box sx={{ textAlign: "right" }}><Typography variant="body2">{record.printedBy ?? "출력자 없음"}</Typography><Typography color={colors.neutral.gray400} variant="caption">{record.printer || "프린터 정보 없음"}</Typography></Box></Stack></Card>)}</Stack>
                    </Card>
                  </Stack>
                )}
              </Box>
            </Box>
          </>
        ) : null}
      </Stack>
    </Box>
  );
};
