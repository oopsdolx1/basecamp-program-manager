import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PrintIcon from "@mui/icons-material/Print";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import { Alert, Box, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { routeBuilder } from "../../../app/routeBuilder";
import { Badge, Button, Card, EmptyState, Loading, StatusChip, colors, motion, radius, shadows, spacing } from "../../../design-system";
import { toAppId, toProfileId, toProgramId } from "../../../types/brandedIds";
import { useCreatePrintRequest, type PrintRequestRecord } from "../../print-history";
import { getPrintRequestsByIds } from "../../print-history/services/printRequestService";
import { markWorkoutSessionPrinted } from "../../workout-sessions/services/workoutSessionService";
import { WorkoutPrintTemplateV1 } from "../components/WorkoutPrintTemplateV1/WorkoutPrintTemplateV1";
import { browserPrintGateway } from "../gateways/browserPrintGateway";
import { usePrintPreview } from "../hooks/usePrintPreview";
import "../styles/print.css";

const conditionLabAppId = toAppId(import.meta.env.VITE_CONDITION_LAB_APP_ID ?? "");

const formatDateTime = (date: Date): string => new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "short",
  timeStyle: "short",
}).format(date);

export const PrintPreviewPage = (): JSX.Element => {
  const { programId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const memberId = searchParams.get("memberId");
  const workoutSessionId = searchParams.get("sessionId");
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [markingPrinted, setMarkingPrinted] = useState(false);
  const [completedPrints, setCompletedPrints] = useState(0);
  const [history, setHistory] = useState<PrintRequestRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const state = usePrintPreview({
    appId: conditionLabAppId,
    memberId: memberId ? toProfileId(memberId) : null,
    programId: programId ? toProgramId(programId) : null,
    workoutSessionId,
  });
  const printRequest = useCreatePrintRequest(conditionLabAppId);

  useEffect(() => {
    if (state.status !== "ready" || state.workoutSession.print.historyIds.length === 0) {
      setHistory([]);
      return;
    }
    let active = true;
    setHistoryLoading(true);
    getPrintRequestsByIds(conditionLabAppId, state.workoutSession.print.historyIds)
      .then((records) => { if (active) setHistory(records.sort((left, right) => right.copy - left.copy)); })
      .catch(() => { if (active) setHistory([]); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [state]);

  const goPrint = () => navigate(routeBuilder.print());

  const requestPrint = async () => {
    if (state.status !== "ready" || printRequest.saving || markingPrinted || !workoutSessionId) return;
    setSessionError(null);
    const record = await printRequest.create(state.document, state.workoutSession.print.copyCount + completedPrints + 1);
    if (!record) return;
    setMarkingPrinted(true);
    try {
      await markWorkoutSessionPrinted(conditionLabAppId, workoutSessionId, record.id);
      setCompletedPrints((current) => current + 1);
      setHistory((current) => [record, ...current]);
      browserPrintGateway.print();
    } catch (caught) {
      setSessionError(caught instanceof Error ? caught.message : "Workout Session 출력 상태를 저장하지 못했습니다.");
    } finally {
      setMarkingPrinted(false);
    }
  };

  const printStatus = useMemo(() => {
    if (printRequest.saving || markingPrinted) return { label: "Printing", tone: "info" as const };
    if (completedPrints > 0) return { label: "Completed", tone: "success" as const };
    return { label: "Ready to Print", tone: "success" as const };
  }, [completedPrints, markingPrinted, printRequest.saving]);

  if (state.status === "loading") {
    return <Box sx={{ bgcolor: colors.neutral.black, minHeight: "100vh", p: `${spacing[8]}px` }}><Card><Loading label="A5 Preview를 준비하고 있습니다." progress={75} /></Card></Box>;
  }

  if (state.status === "error") {
    return (
      <Box sx={{ bgcolor: colors.neutral.black, minHeight: "100vh", p: `${spacing[8]}px` }}>
        <Card><Stack spacing={`${spacing[4]}px`}><EmptyState title="Preview를 만들 수 없습니다." description={state.message} /><Button variant="secondary" startIcon={<ArrowBackIcon />} onClick={goPrint}>Program Workspace로 돌아가기</Button></Stack></Card>
      </Box>
    );
  }

  const checklist = [
    ["회원 선택", Boolean(state.member.memberId)],
    ["Program 선택", Boolean(state.program.id)],
    ["운동 8개 이하", state.document.program.exercises.length > 0 && state.document.program.exercises.length <= 8],
    ["QR 준비", Boolean(state.document.workoutSessionId)],
    ["Workout Session 준비", Boolean(state.workoutSession.sessionId)],
    ["저장 완료", Boolean(state.program.id)],
    ["Preview 생성 완료", Boolean(state.document.rows.length)],
  ] as const;
  const ready = checklist.every(([, valid]) => valid);
  const steps = ["Workout Session", "QR 생성", "Preview", "Print Ready"];

  return (
    <Box sx={{ bgcolor: colors.neutral.black, minHeight: "100vh" }}>
      <Box className="no-print" sx={{ margin: "0 auto", maxWidth: 1480, p: { lg: `${spacing[8]}px`, md: `${spacing[6]}px`, xs: `${spacing[4]}px` }, pb: `${spacing[4]}px` }}>
        <Stack spacing={`${spacing[4]}px`}>
          {printRequest.error ? <Alert severity="error">{printRequest.error}</Alert> : null}
          {sessionError ? <Alert severity="error">{sessionError}</Alert> : null}

          <Card variant="analysis">
            <Stack alignItems={{ md: "center", xs: "flex-start" }} direction={{ md: "row", xs: "column" }} justifyContent="space-between" spacing={`${spacing[4]}px`}>
              <Box><Typography color={colors.primary.gold} fontWeight={800} variant="overline">PRINT EXPERIENCE</Typography><Typography variant="h4">A5 Workout Sheet</Typography><Typography color={colors.neutral.gray400}>출력 전에 회원, Program, Session과 인쇄 품질을 확인하세요.</Typography></Box>
              <StatusChip label={printStatus.label} status={printStatus.tone} />
            </Stack>
          </Card>

          <Card>
            <Box sx={{ display: "grid", gap: `${spacing[4]}px`, gridTemplateColumns: { lg: "repeat(4, minmax(0, 1fr))", sm: "repeat(2, minmax(0, 1fr))", xs: "minmax(0, 1fr)" } }}>
              <Box><Typography color={colors.neutral.gray400} variant="caption">회원</Typography><Typography fontWeight={800}>{state.document.member.name}</Typography></Box>
              <Box><Typography color={colors.neutral.gray400} variant="caption">Program</Typography><Typography fontWeight={800}>{state.document.program.title}</Typography></Box>
              <Box><Typography color={colors.neutral.gray400} variant="caption">Workout Session</Typography><Typography fontFamily="monospace" fontWeight={800}>{state.document.workoutSessionId}</Typography></Box>
              <Stack alignItems="flex-start" spacing={`${spacing[1]}px`}><Typography color={colors.neutral.gray400} variant="caption">QR / 출력 준비</Typography><Stack direction="row" spacing={`${spacing[2]}px`}><StatusChip label="QR 준비" status="success" /><StatusChip label={ready ? "출력 준비 완료" : "확인 필요"} status={ready ? "success" : "warning"} /></Stack></Stack>
            </Box>
          </Card>

          <Box sx={{ display: "grid", gap: `${spacing[4]}px`, gridTemplateColumns: { lg: "minmax(0, 1fr) 360px", xs: "minmax(0, 1fr)" }, "& > *": { minWidth: 0 } }}>
            <Stack spacing={`${spacing[4]}px`}>
              <Card sx={{ overflow: "hidden", p: `${spacing[6]}px` }}>
                <Stack alignItems="center" spacing={`${spacing[3]}px`}>
                  <Stack direction="row" flexWrap="wrap" gap={`${spacing[2]}px`} justifyContent="center"><Badge>A5</Badge><Badge>100%</Badge><Badge>여백 없음</Badge><StatusChip label="권장 설정" status="success" /></Stack>
                  <Box sx={{ bgcolor: colors.neutral.gray800, border: `1px dashed ${colors.neutral.gray600}`, borderRadius: `${radius.sm}px`, display: "flex", justifyContent: "center", overflow: "auto", p: { md: `${spacing[6]}px`, xs: `${spacing[3]}px` }, width: "100%" }}>
                    <Box sx={{ boxShadow: shadows.xl, flex: "0 0 auto", transition: motion.transition }}><WorkoutPrintTemplateV1 document={state.document} /></Box>
                  </Box>
                </Stack>
              </Card>

              <Card>
                <Stack spacing={`${spacing[3]}px`}><Typography variant="h6">최근 출력</Typography>{historyLoading ? <Loading label="Print History를 불러오는 중" /> : null}{!historyLoading && history.length === 0 ? <EmptyState title="아직 출력 기록이 없습니다." description="첫 출력 후 시간, 출력자와 Copy 번호가 여기에 표시됩니다." /> : null}{history.map((record) => <Card key={record.id} sx={{ p: `${spacing[3]}px` }}><Stack alignItems="center" direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={`${spacing[2]}px`}><Box><Typography fontWeight={800}>Copy {record.copy}{record.copy > 1 ? " · 재출력" : " · 최초 출력"}</Typography><Typography color={colors.neutral.gray400} variant="body2">{formatDateTime(record.printedAt)} · {record.printedBy ?? "출력자 정보 없음"}</Typography></Box><StatusChip label="출력 완료" status="success" /></Stack></Card>)}</Stack>
              </Card>
            </Stack>

            <Stack spacing={`${spacing[4]}px`}>
              <Card sx={{ position: { lg: "sticky" }, top: `${spacing[4]}px` }}>
                <Stack spacing={`${spacing[4]}px`}>
                  <Box><Typography variant="h6">Print Checklist</Typography><Typography color={colors.neutral.gray400} variant="body2">현재 데이터로 자동 확인합니다.</Typography></Box>
                  <Stack spacing={`${spacing[2]}px`}>{checklist.map(([label, valid]) => <Stack key={label} alignItems="center" direction="row" justifyContent="space-between"><Typography>{label}</Typography><StatusChip label={valid ? "완료" : "확인"} status={valid ? "success" : "warning"} /></Stack>)}</Stack>
                </Stack>
              </Card>

              <Card>
                <Stack spacing={`${spacing[3]}px`}><Typography variant="h6">Print Progress</Typography>{steps.map((step, index) => <Stack key={step} alignItems="center" direction="row" spacing={`${spacing[3]}px`}><Box sx={{ alignItems: "center", bgcolor: colors.alpha.goldMuted, border: `1px solid ${colors.primary.gold}`, borderRadius: `${radius.full}px`, color: colors.primary.gold, display: "flex", height: 32, justifyContent: "center", width: 32 }}><CheckCircleIcon fontSize="small" /></Box><Box><Typography fontWeight={800}>{step}</Typography>{index < steps.length - 1 ? <Typography color={colors.neutral.gray400} variant="caption">완료</Typography> : <Typography color={colors.semantic.success} variant="caption">인쇄 가능</Typography>}</Box></Stack>)}</Stack>
              </Card>

              <Card>
                <Stack alignItems="center" spacing={`${spacing[2]}px`} textAlign="center"><QrCode2Icon sx={{ color: colors.primary.gold, fontSize: 42 }} /><Typography color={colors.neutral.gray400} variant="caption">WORKOUT SESSION</Typography><Typography fontFamily="monospace" fontWeight={800} sx={{ overflowWrap: "anywhere" }}>{state.document.workoutSessionId}</Typography><StatusChip label="QR 준비 완료" status="success" /></Stack>
              </Card>

              <Card><Stack spacing={`${spacing[2]}px`}><Typography variant="h6">출력 품질</Typography><Typography color={colors.neutral.gray300}>용지 A5 · 배율 100% · 여백 없음</Typography><Typography color={colors.neutral.gray400} variant="body2">브라우저 인쇄 창에서도 같은 값을 확인한 뒤 출력하세요.</Typography></Stack></Card>
            </Stack>
          </Box>
        </Stack>
      </Box>

      <Box className="print-only-root" sx={{ display: "none", displayPrint: "block" }}><WorkoutPrintTemplateV1 document={state.document} /></Box>

      <Box className="no-print" sx={{ bgcolor: "rgba(13, 13, 13, 0.96)", borderTop: `1px solid ${colors.neutral.gray700}`, bottom: 0, position: "sticky", px: { sm: `${spacing[6]}px`, xs: `${spacing[4]}px` }, py: `${spacing[3]}px`, zIndex: 20 }}>
        <Stack alignItems="center" direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={`${spacing[2]}px`} sx={{ margin: "0 auto", maxWidth: 1420 }}>
          <Stack alignItems="center" direction="row" spacing={`${spacing[2]}px`}><StatusChip label={ready ? "출력 준비 완료" : "확인 필요"} status={ready ? "success" : "warning"} /><Typography color={colors.neutral.gray400} variant="body2">A5 · 100% · Session {state.workoutSession.status}</Typography></Stack>
          <Stack direction="row" spacing={`${spacing[2]}px`} sx={{ width: { sm: "auto", xs: "100%" } }}>
            <Button variant="secondary" startIcon={<ArrowBackIcon />} disabled={printRequest.saving || markingPrinted} onClick={goPrint}>Workspace</Button>
            <Button variant="secondary" startIcon={<PrintIcon />} disabled={printRequest.saving || markingPrinted} onClick={() => void requestPrint()}>PDF 저장</Button>
            <Button startIcon={<PrintIcon />} loading={printRequest.saving || markingPrinted} disabled={!ready} onClick={() => void requestPrint()} sx={{ flex: { xs: 1, sm: "initial" }, minWidth: 160 }}>출력</Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
};
