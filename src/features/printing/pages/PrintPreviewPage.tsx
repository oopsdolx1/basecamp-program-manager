import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PrintIcon from "@mui/icons-material/Print";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import { Alert, Box, Stack, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { routeBuilder } from "../../../app/routeBuilder";
import { Button, Card, EmptyState, Loading, colors, kiosk, motion, radius, shadows, spacing } from "../../../design-system";
import { toAppId, toProfileId, toProgramId } from "../../../types/brandedIds";
import { useCreatePrintRequest, type PrintRequestRecord } from "../../print-history";
import { getPrintRequestsByIds } from "../../print-history/services/printRequestService";
import { markWorkoutSessionPrinted } from "../../workout-sessions/services/workoutSessionService";
import { WorkoutPrintTemplateV1 } from "../components/WorkoutPrintTemplateV1/WorkoutPrintTemplateV1";
import { configuredPrintAdapter } from "../gateways/configuredPrintAdapter";
import { createRenderedPrintArtifactFactory } from "../gateways/printArtifactFactory";
import { usePrintPreview } from "../hooks/usePrintPreview";
import "../styles/print.css";

const conditionLabAppId = toAppId(import.meta.env.VITE_CONDITION_LAB_APP_ID ?? "");
const printAgentEndpoint = import.meta.env.VITE_PRINT_AGENT_ENDPOINT ?? "http://127.0.0.1:43127";
const formatDateTime = (date: Date): string => new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(date);

export const PrintPreviewPage = (): JSX.Element => {
  const { programId, workoutSessionId: routeWorkoutSessionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const memberId = searchParams.get("memberId");
  const workoutSessionId = routeWorkoutSessionId ?? searchParams.get("sessionId");
  const autoPrint = searchParams.get("autoPrint") === "1";
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [markingPrinted, setMarkingPrinted] = useState(false);
  const [completedPrints, setCompletedPrints] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(30);
  const autoPrintStarted = useRef(false);
  const [history, setHistory] = useState<PrintRequestRecord[]>([]);
  const [pdfPreview, setPdfPreview] = useState<{ artifactId: string; pages: number } | null>(null);
  const [pdfPreviewError, setPdfPreviewError] = useState<string | null>(null);
  const previewStarted = useRef(false);
  const state = usePrintPreview({
    appId: conditionLabAppId,
    memberId: memberId ? toProfileId(memberId) : null,
    programId: programId ? toProgramId(programId) : null,
    workoutSessionId,
  });
  const printRequest = useCreatePrintRequest(conditionLabAppId);

  useEffect(() => {
    if (state.status !== "ready" || previewStarted.current) return;
    previewStarted.current = true;
    void (async () => {
      try {
        const artifact = await createRenderedPrintArtifactFactory().create({ jobId: workoutSessionId ?? state.document.workoutSessionId, document: state.document });
        const response = await fetch(`${printAgentEndpoint}/preview`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobId: workoutSessionId ?? state.document.workoutSessionId, artifact }) });
        const body = await response.json() as { artifactId?: string; pages?: number; reason?: string };
        if (!response.ok || !body.artifactId) throw new Error(body.reason ?? "preview_unavailable");
        setPdfPreview({ artifactId: body.artifactId, pages: body.pages ?? 1 });
      } catch (error) { setPdfPreviewError(error instanceof Error ? error.message : "출력 서비스에 연결할 수 없습니다."); }
    })();
  }, [state, workoutSessionId]);

  useEffect(() => {
    if (state.status !== "ready" || state.workoutSession.print.historyIds.length === 0) {
      setHistory([]);
      return;
    }
    let active = true;
    void getPrintRequestsByIds(conditionLabAppId, state.workoutSession.print.historyIds)
      .then((records) => { if (active) setHistory(records.sort((left, right) => right.copy - left.copy)); })
      .catch(() => { if (active) setHistory([]); });
    return () => { active = false; };
  }, [state]);

  const goWorkspace = () => navigate(routeBuilder.print());
  const requestPrint = async () => {
    if (state.status !== "ready" || printRequest.saving || markingPrinted || !workoutSessionId) return;
    setSessionError(null);
    const nextCopy = Math.max(state.workoutSession.print.copyCount, ...history.map((item) => item.copy), 0) + 1;
    const record = await printRequest.create(state.document, nextCopy);
    if (!record) return;
    setMarkingPrinted(true);
    try {
      await markWorkoutSessionPrinted(conditionLabAppId, workoutSessionId, record.id);
      setHistory((current) => [record, ...current]);
      const printResult = await configuredPrintAdapter.print({ jobId: record.id, document: state.document, copies: 1, artifactId: completedPrints === 0 ? pdfPreview?.artifactId : undefined });
      if (printResult.status === "failed") setSessionError(printResult.reason ?? "인쇄 요청을 전송하지 못했습니다.");
      else setCompletedPrints((current) => current + 1);
    } catch (caught) {
      setSessionError(caught instanceof Error ? caught.message : "운동 세션 출력 상태를 저장하지 못했습니다.");
    } finally {
      setMarkingPrinted(false);
    }
  };

  useEffect(() => {
    if (!autoPrint || state.status !== "ready" || !pdfPreview || autoPrintStarted.current) return;
    autoPrintStarted.current = true;
    void requestPrint();
  }, [autoPrint, pdfPreview, state.status]);

  useEffect(() => {
    if (completedPrints === 0 || markingPrinted || printRequest.saving || sessionError) return;
    setSecondsRemaining(30);
    const intervalId = window.setInterval(() => setSecondsRemaining((current) => Math.max(0, current - 1)), 1_000);
    const timeoutId = window.setTimeout(() => navigate(routeBuilder.print(), { replace: true }), 30_000);
    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [completedPrints, markingPrinted, navigate, printRequest.saving, sessionError]);
  if (state.status === "loading") return <Box sx={{ bgcolor: colors.neutral.black, minHeight: "100vh", p: `${spacing[6]}px` }}><Card><Loading label="A5 가로 미리보기를 준비하고 있습니다." progress={75} /></Card></Box>;
  if (state.status === "error") return <Box sx={{ bgcolor: colors.neutral.black, minHeight: "100vh", p: `${spacing[6]}px` }}><Card><Stack spacing={`${spacing[4]}px`}><EmptyState title="미리보기를 만들 수 없습니다." description={state.message} /><Button variant="secondary" startIcon={<ArrowBackIcon />} onClick={goWorkspace}>프로그램으로 돌아가기</Button></Stack></Card></Box>;

  if (completedPrints > 0) return <Box sx={{ alignItems: "center", bgcolor: colors.neutral.black, display: "flex", justifyContent: "center", minHeight: "100vh", p: { md: `${spacing[8]}px`, xs: `${spacing[4]}px` } }}><Stack alignItems="center" spacing={`${spacing[3]}px`} sx={{ maxWidth: 520, width: "100%" }} textAlign="center"><Typography color={colors.primary.gold} fontWeight={900} letterSpacing="0.12em" variant="overline">BASECAMP</Typography><CheckCircleIcon sx={{ color: colors.semantic.success, fontSize: 56, mt: `${spacing[4]}px` }} /><Box><Typography fontSize={{ md: kiosk.pageTitle, xs: 28 }} fontWeight={900}>출력 요청을 보냈어요</Typography><Typography color={colors.neutral.gray400} sx={{ mt: `${spacing[1]}px` }}>{state.document.member.name} · {state.document.program.title}</Typography><Typography color={colors.neutral.gray400} variant="body2">A5 · {pdfPreview?.pages ?? 1}페이지</Typography></Box>{markingPrinted || printRequest.saving ? <Typography color={colors.neutral.gray400}>다시 출력하고 있습니다.</Typography> : sessionError ? <Typography color="error.main">다시 출력하지 못했습니다. {sessionError}</Typography> : <Typography color={colors.neutral.gray400} variant="body2">{secondsRemaining}초 후 처음 화면으로 돌아갑니다.</Typography>}<Stack spacing={`${spacing[1]}px`} sx={{ mt: `${spacing[2]}px`, width: "100%" }}><Button fullWidth onClick={goWorkspace} sx={{ minHeight: kiosk.primaryActionHeight }}>처음으로 돌아가기</Button><Button fullWidth disabled={markingPrinted || printRequest.saving} loading={markingPrinted || printRequest.saving} variant="secondary" onClick={() => { setSecondsRemaining(30); void requestPrint(); }} sx={{ minHeight: kiosk.standardControlHeight }}>다시 출력</Button></Stack></Stack><Box className="print-only-root" sx={{ display: "none", displayPrint: "block" }}><WorkoutPrintTemplateV1 document={state.document} /></Box></Box>;

  if (autoPrint) return <Box sx={{ bgcolor: colors.neutral.black, minHeight: "100vh", p: `${spacing[6]}px` }}><Card sx={{ margin: "0 auto", maxWidth: 760 }}><Loading label={printRequest.error || sessionError || "운동 세션과 QR을 확인하고 인쇄를 요청하고 있습니다."} progress={printRequest.error || sessionError ? undefined : 85} /></Card><Box className="print-only-root" sx={{ display: "none", displayPrint: "block" }}><WorkoutPrintTemplateV1 document={state.document} /></Box></Box>;
  const checklist = [
    ["회원 선택", Boolean(state.member.memberId)],
    ["프로그램 선택", Boolean(state.program.id)],
    ["운동 8개 이하", state.document.program.exercises.length > 0 && state.document.program.exercises.length <= 8],
    ["QR 준비", Boolean(state.document.workoutSessionId)],
    ["운동 세션 준비", Boolean(state.workoutSession.sessionId)],
    ["미리보기 생성", Boolean(state.document.rows.length)],
  ] as const;
  const ready = checklist.every(([, valid]) => valid) && Boolean(pdfPreview);

  return (
    <Box sx={{ bgcolor: colors.neutral.black, minHeight: "100vh" }}>
      <Box className="no-print" sx={{ margin: "0 auto", maxWidth: 1660, p: { lg: `${spacing[6]}px`, md: `${spacing[4]}px`, xs: `${spacing[3]}px` }, "@media (orientation: portrait)": { maxWidth: kiosk.portraitContentWidth } }}>
        <Stack spacing={`${spacing[3]}px`}>
          {printRequest.error ? <Alert severity="error">{printRequest.error}</Alert> : null}
          {sessionError ? <Alert severity="error">{sessionError}</Alert> : null}

          <Stack alignItems="center" spacing={`${spacing[2]}px`} textAlign="center"><Box sx={{ alignItems: "center", bgcolor: colors.alpha.goldMuted, border: `1px solid ${colors.primary.gold}`, borderRadius: `${radius.full}px`, color: colors.primary.gold, display: "flex", height: 52, justifyContent: "center", width: 52 }}><PrintIcon /></Box><Box><Typography color={colors.primary.gold} fontWeight={800} variant="overline">4 · 출력</Typography><Typography fontFamily="inherit" fontWeight={800} letterSpacing="-0.02em" lineHeight={1.3} variant="h4">출력 준비 완료</Typography><Typography color={colors.neutral.gray400} sx={{ mt: `${spacing[1]}px` }}>{state.document.member.name} · {state.document.program.title}</Typography></Box></Stack>

          <Box sx={{ display: "grid", gap: `${spacing[3]}px`, gridTemplateColumns: { lg: "minmax(0, 1fr) 360px", xs: "1fr" }, minWidth: 0, "@media (orientation: portrait)": { gridTemplateColumns: "1fr" } }}>
            <Card sx={{ minWidth: 0, overflow: "hidden", p: `${spacing[3]}px` }}>
              <Stack alignItems="center" spacing={`${spacing[2]}px`}>
                <Box sx={{ alignItems: "center", bgcolor: colors.neutral.gray800, border: `1px dashed ${colors.neutral.gray600}`, borderRadius: `${radius.sm}px`, display: "flex", justifyContent: "center", overflow: "auto", p: { md: `${spacing[3]}px`, xs: `${spacing[2]}px` }, width: "100%" }}>
                  {pdfPreview ? <Box component="object" data={`${printAgentEndpoint}/preview/${pdfPreview.artifactId}`} sx={{ aspectRatio: "210 / 148", bgcolor: "white", display: "block", height: "auto", maxHeight: "calc(100vh - 240px)", maxWidth: "100%", width: "min(100%, 980px)" }} type="application/pdf" /> : <Loading label={pdfPreviewError ? "출력 서비스에 연결할 수 없습니다." : "운동일지를 준비하고 있습니다."} progress={pdfPreviewError ? undefined : 75} />}
                </Box>
              </Stack>
            </Card>

            <Card><Stack spacing={`${spacing[3]}px`}><Box><Typography color={colors.primary.gold} fontWeight={800} variant="overline">SESSION INFORMATION</Typography><Typography variant="h6">운동 세션</Typography></Box><Box><Typography color={colors.neutral.gray400} variant="caption">회원</Typography><Typography fontWeight={800}>{state.document.member.name}</Typography></Box><Box><Typography color={colors.neutral.gray400} variant="caption">프로그램</Typography><Typography fontWeight={800}>{state.document.program.title}</Typography></Box><Box><Typography color={colors.neutral.gray400} variant="caption">Session ID</Typography><Typography fontFamily="monospace" fontWeight={800} sx={{ overflowWrap: "anywhere" }}>{state.document.workoutSessionId}</Typography></Box><Stack alignItems="center" spacing={`${spacing[1]}px`} sx={{ bgcolor: colors.neutral.gray800, borderRadius: `${radius.md}px`, p: `${spacing[3]}px` }} textAlign="center"><QrCode2Icon sx={{ color: colors.primary.gold, fontSize: 40 }} /><Typography color={colors.neutral.gray400} variant="body2">운동 기록 입력과 다음 프로그램 추천에 사용하는 QR입니다.</Typography></Stack><Stack direction="row" spacing={`${spacing[1]}px`}><CheckCircleIcon sx={{ color: colors.semantic.success }} /><Typography fontWeight={800}>모든 정보가 정상적으로 준비되었습니다.</Typography></Stack>{history[0] ? <Box><Typography color={colors.neutral.gray400} variant="caption">최근 출력</Typography><Typography fontWeight={800}>Copy {history[0].copy} · {formatDateTime(history[0].printedAt)}</Typography></Box> : null}<Stack spacing={`${spacing[2]}px`}><Button fullWidth variant="secondary" startIcon={<ArrowBackIcon />} onClick={goWorkspace}>프로그램 변경</Button><Button fullWidth variant="secondary" startIcon={<PrintIcon />} disabled={!ready || printRequest.saving || markingPrinted} onClick={() => void requestPrint()}>PDF로 저장</Button><Button fullWidth startIcon={<PrintIcon />} loading={printRequest.saving || markingPrinted} disabled={!ready} onClick={() => void requestPrint()} sx={{ minHeight: 52 }}>출력하기</Button></Stack></Stack></Card>
          </Box>
        </Stack>
      </Box>
      <Box className="print-only-root" sx={{ display: "none", displayPrint: "block" }}><WorkoutPrintTemplateV1 document={state.document} /></Box>
    </Box>
  );
};
