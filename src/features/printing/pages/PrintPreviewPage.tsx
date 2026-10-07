import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PrintIcon from "@mui/icons-material/Print";
import DownloadIcon from "@mui/icons-material/Download";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import { Alert, Box, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { routeBuilder } from "../../../app/routeBuilder";
import { Button, Card, EmptyState, Loading, colors, kiosk, motion, radius, shadows, spacing } from "../../../design-system";
import { toAppId, toProfileId, toProgramId } from "../../../types/brandedIds";
import { useCreatePrintRequest, type PrintRequestRecord } from "../../print-history";
import { getPrintRequestsByIds } from "../../print-history/services/printRequestService";
import { markWorkoutSessionPrinted } from "../../workout-sessions/services/workoutSessionService";
import { WorkoutPrintTemplateV1 } from "../components/WorkoutPrintTemplateV1/WorkoutPrintTemplateV1";
import { configuredPrintAdapter, configuredPrintRuntime, createArtifactPrintAdapter } from "../gateways/configuredPrintAdapter";
import { createRenderedPrintArtifactFactory, isRenderedPrintDocumentReady } from "../gateways/printArtifactFactory";
import { createPreparedPdfHandoff, type PreparedPdfHandoff } from "../gateways/preparedPdfHandoff";
import { isUserGesturePdfPrintAdapter } from "../gateways/userGesturePdfPrintAdapter";
import { usePrintPreview } from "../hooks/usePrintPreview";
import { createPrintArtifactPreview, downloadPdfArtifact, fetchVisualPdfPreview, isPrintDispatchReady, type PrintArtifactPreview } from "../services/printPreviewReadiness";
import type { WorkoutPrintDocument } from "../types/print.types";
import "../styles/print.css";

const conditionLabAppId = toAppId(import.meta.env.VITE_CONDITION_LAB_APP_ID ?? "");
const printAgentEndpoint = import.meta.env.VITE_PRINT_AGENT_ENDPOINT ?? "http://127.0.0.1:43127";
const formatDateTime = (date: Date): string => new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(date);
const userFacingPrintError = (reason: string): string => {
  if (reason === "print_agent_unavailable" || reason === "preview_artifact_requires_windows_agent") return "인쇄 서비스를 연결하지 못했습니다.";
  if (reason === "default_printer_unavailable" || reason === "physical_printer_unavailable") return "연결된 프린터를 찾을 수 없습니다. PDF 저장은 사용할 수 있습니다.";
  return "인쇄 artifact를 준비하지 못했습니다.";
};

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const PrintSourceDocument = ({ document }: { document: WorkoutPrintDocument }): JSX.Element => (
  <div className="print-only-root print-source-root" aria-hidden="true">
    <WorkoutPrintTemplateV1 document={document} />
  </div>
);

const PdfCanvasPreview = ({ pdfBytes, expectedPages, onPageCount }: { pdfBytes: Uint8Array; expectedPages: number; onPageCount: (pages: number) => void }): JSX.Element => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(expectedPages);
  const [status, setStatus] = useState<"loading" | "fetch-error" | "render-error" | "ready">("loading");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;
    let loadingTask: { destroy: () => Promise<void>; promise: Promise<{ numPages: number; getPage: (pageNumber: number) => Promise<{ cleanup: () => void; getViewport: (options: { scale: number }) => { width: number; height: number }; render: (context: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number }; transform: [number, number, number, number, number, number] }) => { promise: Promise<void>; cancel: () => void } }> }> } | null = null;
    const render = async (): Promise<void> => {
      setStatus("loading");
      try {
        if (pdfBytes.byteLength === 0) throw new Error("artifact_empty");
        loadingTask = getDocument({ data: pdfBytes.slice().buffer as ArrayBuffer });
        const pdf = await loadingTask.promise;
        if (!active) return;
        setPageCount(pdf.numPages);
        onPageCount(pdf.numPages);
        const page = await pdf.getPage(Math.min(currentPage, pdf.numPages));
        const canvas = canvasRef.current;
        if (!canvas) return;
        const viewport = page.getViewport({ scale: 1 });
        const maxWidth = Math.min(canvas.parentElement?.clientWidth ?? 980, 980);
        const cssWidth = Math.max(1, maxWidth);
        const cssHeight = cssWidth * (viewport.height / viewport.width);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(cssWidth * dpr);
        canvas.height = Math.round(cssHeight * dpr);
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("canvas_unavailable");
        renderTask = page.render({ canvasContext: context, transform: [dpr, 0, 0, dpr, 0, 0], viewport });
        await renderTask.promise;
        page.cleanup();
        if (active) setStatus("ready");
      } catch (error) {
        if (!active || (error instanceof Error && error.name === "RenderingCancelledException")) return;
        setStatus(error instanceof Error && error.message.startsWith("artifact_") ? "fetch-error" : "render-error");
      }
    };
    void render();
    return () => { active = false; renderTask?.cancel(); void loadingTask?.destroy(); };
  }, [currentPage, onPageCount, pdfBytes, retryKey]);

  return <Stack alignItems="center" spacing={`${spacing[2]}px`} sx={{ minHeight: "min(70vh, 760px)", position: "relative", width: "100%" }}>
    <canvas aria-label={`운동일지 ${currentPage}페이지 미리보기`} ref={canvasRef} style={{ background: "white", display: status === "ready" ? "block" : "none", maxWidth: "100%" }} />
    {status !== "ready" ? <Stack alignItems="center" justifyContent="center" spacing={`${spacing[2]}px`} sx={{ bgcolor: "white", minHeight: "min(70vh, 760px)", position: "absolute", width: "100%" }}><Typography color="text.primary">{status === "fetch-error" ? "운동일지를 불러오지 못했습니다." : status === "render-error" ? "운동일지 미리보기를 표시하지 못했습니다." : "운동일지를 준비하고 있습니다."}</Typography>{status !== "loading" ? <Button variant="secondary" onClick={() => setRetryKey((current) => current + 1)}>다시 시도</Button> : null}</Stack> : null}
    {pageCount > 1 ? <Stack alignItems="center" direction="row" spacing={`${spacing[2]}px`}><Button disabled={currentPage === 1} variant="secondary" onClick={() => setCurrentPage((current) => current - 1)}>이전</Button><Typography color={colors.neutral.gray400}>{currentPage} / {pageCount}</Typography><Button disabled={currentPage === pageCount} variant="secondary" onClick={() => setCurrentPage((current) => current + 1)}>다음</Button></Stack> : null}
  </Stack>;
};

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
  const [printArtifact, setPrintArtifact] = useState<PrintArtifactPreview | null>(null);
  const [printArtifactError, setPrintArtifactError] = useState<string | null>(null);
  const [visualPdfPreview, setVisualPdfPreview] = useState<({ bytes: Uint8Array } & PreparedPdfHandoff) | null>(null);
  const [visualPdfPreviewError, setVisualPdfPreviewError] = useState<string | null>(null);
  const [previewRetryKey, setPreviewRetryKey] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [pdfSaveInProgress, setPdfSaveInProgress] = useState(false);
  const updatePdfPageCount = useCallback((pages: number) => setPrintArtifact((current) => current && current.pages !== pages ? { ...current, pages } : current), []);
  const state = usePrintPreview({
    appId: conditionLabAppId,
    memberId: memberId ? toProfileId(memberId) : null,
    programId: programId ? toProgramId(programId) : null,
    workoutSessionId,
  });
  const printRequest = useCreatePrintRequest(conditionLabAppId);
  const documentWorkoutSessionId = state.status === "ready" ? state.document.workoutSessionId : null;
  const pdfDownloadName = state.status === "ready" ? state.document.member.name || state.document.workoutSessionId : null;
  const printArtifactId = printArtifact?.artifactId ?? null;

  useEffect(() => {
    if (state.status !== "ready") return;
    const artifactRequest = { jobId: workoutSessionId ?? state.document.workoutSessionId, document: state.document };
    const hasRequiredPrintData = Boolean(
      state.document.workoutSessionId
      && state.workoutSession.sessionId
      && state.workoutSession.prescription?.exercises.length
      && state.document.rows.length,
    );
    if (!hasRequiredPrintData || !isRenderedPrintDocumentReady(artifactRequest)) {
      setPrintArtifactError("print_dom_unavailable");
      return;
    }
    let active = true;
    setPrintArtifact(null);
    setPrintArtifactError(null);
    setVisualPdfPreview(null);
    setVisualPdfPreviewError(null);
    void (async () => {
      try {
        const artifact = await createRenderedPrintArtifactFactory().create(artifactRequest);
        const preview = await createPrintArtifactPreview({ endpoint: printAgentEndpoint, jobId: workoutSessionId ?? state.document.workoutSessionId, artifact });
        if (active) setPrintArtifact(preview);
      } catch (error) { if (active) setPrintArtifactError(error instanceof Error ? error.message : "print_artifact_creation_failed"); }
    })();
    return () => { active = false; };
  }, [previewRetryKey, state, workoutSessionId]);

  useEffect(() => {
    if (!printArtifactId) return;
    let active = true;
    setVisualPdfPreview(null);
    setVisualPdfPreviewError(null);
    void (async () => {
      try {
        const bytes = await fetchVisualPdfPreview({ endpoint: printAgentEndpoint, artifactId: printArtifactId });
        const pdfBuffer = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(pdfBuffer).set(bytes);
        const prepared = createPreparedPdfHandoff(pdfBuffer, `basecamp-workout-${documentWorkoutSessionId ?? printArtifactId}.pdf`);
        if (active) setVisualPdfPreview({ bytes, ...prepared });
        else URL.revokeObjectURL(prepared.blobUrl);
      } catch (error) { if (active) setVisualPdfPreviewError(error instanceof Error ? error.message : "인쇄용 문서를 준비하지 못했습니다."); }
    })();
    return () => { active = false; };
  }, [documentWorkoutSessionId, printArtifactId]);

  useEffect(() => () => { if (visualPdfPreview) URL.revokeObjectURL(visualPdfPreview.blobUrl); }, [visualPdfPreview]);

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
  const openPreparedPdf = async () => {
    if (!visualPdfPreview || !isUserGesturePdfPrintAdapter(configuredPrintAdapter)) return;
    const result = await configuredPrintAdapter.handoffPdf(visualPdfPreview, false);
    if (result.status === "failed") setSessionError(result.reason ?? "PDF를 열지 못했습니다.");
  };
  const savePdf = async () => {
    if (!printArtifactId || pdfSaveInProgress) return;
    setDownloadError(null);
    setPdfSaveInProgress(true);
    const safe = String(pdfDownloadName ?? printArtifactId).replace(/[\\/:*?"<>|]/g, "_").trim() || printArtifactId;
    try { await downloadPdfArtifact({ endpoint: printAgentEndpoint, artifactId: printArtifactId, filename: `BaseCamp_${safe}_${new Date().toISOString().slice(0, 10)}.pdf` }); }
    catch { setDownloadError("PDF를 저장하지 못했습니다. 다시 시도해 주세요."); }
    finally { setPdfSaveInProgress(false); }
  };
  const requestPrint = async () => {
    if (state.status !== "ready" || printRequest.saving || markingPrinted || !workoutSessionId) return;
    setSessionError(null);
    const userGestureAdapter = isUserGesturePdfPrintAdapter(configuredPrintAdapter) ? configuredPrintAdapter : null;
    if (userGestureAdapter) {
      if (!visualPdfPreview) { setSessionError("인쇄용 문서를 준비하지 못했습니다."); return; }
      const handoff = await userGestureAdapter.handoffPdf(visualPdfPreview);
      if (handoff.status === "failed") { setSessionError(handoff.reason ?? "PDF를 열지 못했습니다."); return; }
    }
    const nextCopy = Math.max(state.workoutSession.print.copyCount, ...history.map((item) => item.copy), 0) + 1;
    const printAdapter = createArtifactPrintAdapter(configuredPrintRuntime, Boolean(printArtifact?.artifactId));
    const record = await printRequest.create(state.document, nextCopy);
    if (!record) return;
    setMarkingPrinted(true);
    try {
      await markWorkoutSessionPrinted(conditionLabAppId, workoutSessionId, record.id);
      setHistory((current) => [record, ...current]);
      const printResult = userGestureAdapter ? { status: "submitted" as const } : await printAdapter.print({ jobId: record.id, document: state.document, copies: 1, artifactId: completedPrints === 0 ? printArtifact?.artifactId : undefined });
      if (printResult.status === "failed") setSessionError(userFacingPrintError(printResult.reason ?? "print_submission_failed"));
      else setCompletedPrints((current) => current + 1);
    } catch {
      setSessionError("운동 세션 출력 상태를 저장하지 못했습니다.");
    } finally {
      setMarkingPrinted(false);
    }
  };

  useEffect(() => {
    if (!autoPrint || isUserGesturePdfPrintAdapter(configuredPrintAdapter) || state.status !== "ready" || !isPrintDispatchReady(configuredPrintRuntime, printArtifact, Boolean(visualPdfPreview)) || autoPrintStarted.current) return;
    autoPrintStarted.current = true;
    void requestPrint();
  }, [autoPrint, printArtifact, state.status, visualPdfPreview]);

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

  if (completedPrints > 0) return <><PrintSourceDocument document={state.document} /><Box sx={{ alignItems: "center", bgcolor: colors.neutral.black, display: "flex", justifyContent: "center", minHeight: "100vh", p: { md: `${spacing[8]}px`, xs: `${spacing[4]}px` } }}><Stack alignItems="center" spacing={`${spacing[3]}px`} sx={{ maxWidth: 520, width: "100%" }} textAlign="center"><Typography color={colors.primary.gold} fontWeight={900} letterSpacing="0.12em" variant="overline">BASECAMP</Typography><CheckCircleIcon sx={{ color: colors.semantic.success, fontSize: 56, mt: `${spacing[4]}px` }} /><Box><Typography fontSize={{ md: kiosk.pageTitle, xs: 28 }} fontWeight={900}>출력 요청을 보냈어요</Typography><Typography color={colors.neutral.gray400} sx={{ mt: `${spacing[1]}px` }}>{state.document.member.name} · {state.document.program.title}</Typography><Typography color={colors.neutral.gray400} variant="body2">A5 · {printArtifact?.pages ?? 1}페이지</Typography></Box>{markingPrinted || printRequest.saving ? <Typography color={colors.neutral.gray400}>다시 출력하고 있습니다.</Typography> : sessionError ? <Typography color="error.main">다시 출력하지 못했습니다. {sessionError}</Typography> : <Typography color={colors.neutral.gray400} variant="body2">{secondsRemaining}초 후 처음 화면으로 돌아갑니다.</Typography>}<Stack spacing={`${spacing[1]}px`} sx={{ mt: `${spacing[2]}px`, width: "100%" }}><Button fullWidth variant="secondary" startIcon={<DownloadIcon />} disabled={!printArtifactId || pdfSaveInProgress} onClick={() => void savePdf()}>PDF 저장</Button><Button fullWidth onClick={goWorkspace} sx={{ minHeight: kiosk.primaryActionHeight }}>처음으로 돌아가기</Button><Button fullWidth disabled={markingPrinted || printRequest.saving} loading={markingPrinted || printRequest.saving} variant="secondary" onClick={() => { setSecondsRemaining(30); void requestPrint(); }} sx={{ minHeight: kiosk.standardControlHeight }}>다시 출력</Button></Stack></Stack></Box></>;

  if (autoPrint && !isUserGesturePdfPrintAdapter(configuredPrintAdapter) && printArtifactError) return <><PrintSourceDocument document={state.document} /><Box sx={{ bgcolor: colors.neutral.black, minHeight: "100vh", p: `${spacing[6]}px` }}><Card sx={{ margin: "0 auto", maxWidth: 760 }}><Stack spacing={`${spacing[3]}px`}><EmptyState title={userFacingPrintError(printArtifactError)} description="인쇄 서비스를 확인한 뒤 다시 시도해 주세요." /><Button onClick={() => setPreviewRetryKey((current) => current + 1)}>다시 시도</Button><Button variant="secondary" onClick={goWorkspace}>프로그램으로 돌아가기</Button></Stack></Card></Box></>;
  if (autoPrint && !isUserGesturePdfPrintAdapter(configuredPrintAdapter)) return <><PrintSourceDocument document={state.document} /><Box sx={{ bgcolor: colors.neutral.black, minHeight: "100vh", p: `${spacing[6]}px` }}><Card sx={{ margin: "0 auto", maxWidth: 760 }}><Stack spacing={`${spacing[3]}px`}><Loading label={printRequest.error || sessionError || "운동 세션과 QR을 확인하고 인쇄를 요청하고 있습니다."} progress={printRequest.error || sessionError ? undefined : 85} /><Button fullWidth variant="secondary" startIcon={<DownloadIcon />} disabled={!printArtifactId || pdfSaveInProgress} onClick={() => void savePdf()}>PDF 저장</Button>{downloadError ? <Alert severity="error">{downloadError}</Alert> : null}</Stack></Card></Box></>;
  const checklist = [
    ["회원 선택", Boolean(state.member.memberId)],
    ["프로그램 선택", Boolean(state.program.id)],
    ["운동 8개 이하", state.document.program.exercises.length > 0 && state.document.program.exercises.length <= 8],
    ["QR 준비", Boolean(state.document.workoutSessionId)],
    ["운동 세션 준비", Boolean(state.workoutSession.sessionId)],
    ["미리보기 생성", Boolean(state.document.rows.length)],
  ] as const;
  const ready = checklist.every(([, valid]) => valid) && isPrintDispatchReady(configuredPrintRuntime, printArtifact, Boolean(visualPdfPreview));

  return (
    <><PrintSourceDocument document={state.document} /><Box sx={{ bgcolor: colors.neutral.black, minHeight: "100vh" }}>
      <Box className="no-print" sx={{ margin: "0 auto", maxWidth: 1660, p: { lg: `${spacing[6]}px`, md: `${spacing[4]}px`, xs: `${spacing[3]}px` }, "@media (orientation: portrait)": { maxWidth: kiosk.portraitContentWidth } }}>
        <Stack spacing={`${spacing[3]}px`}>
          {printRequest.error ? <Alert severity="error">{printRequest.error}</Alert> : null}
          {sessionError ? <Alert severity="error">{sessionError}</Alert> : null}

          <Stack alignItems="center" spacing={`${spacing[2]}px`} textAlign="center"><Box sx={{ alignItems: "center", bgcolor: colors.alpha.goldMuted, border: `1px solid ${colors.primary.gold}`, borderRadius: `${radius.full}px`, color: colors.primary.gold, display: "flex", height: 52, justifyContent: "center", width: 52 }}><PrintIcon /></Box><Box><Typography color={colors.primary.gold} fontWeight={800} variant="overline">4 · 출력</Typography><Typography fontFamily="inherit" fontWeight={800} letterSpacing="-0.02em" lineHeight={1.3} variant="h4">출력 준비 완료</Typography><Typography color={colors.neutral.gray400} sx={{ mt: `${spacing[1]}px` }}>{state.document.member.name} · {state.document.program.title}</Typography></Box></Stack>

          <Box sx={{ alignItems: "start", display: "grid", gap: { lg: `${spacing[6]}px`, xs: `${spacing[3]}px` }, gridTemplateColumns: { lg: "minmax(0, 1fr) 320px", xs: "1fr" }, minWidth: 0, "@media (orientation: portrait)": { gridTemplateColumns: "1fr" } }}>
            <Box sx={{ minWidth: 0, overflow: "hidden", py: { md: `${spacing[2]}px`, xs: 0 } }}>
              <Stack alignItems="center" spacing={`${spacing[2]}px`}>
                <Box sx={{ alignItems: "center", bgcolor: colors.neutral.gray800, border: `1px dashed ${colors.neutral.gray600}`, borderRadius: `${radius.sm}px`, display: "flex", justifyContent: "center", overflow: "auto", p: { md: `${spacing[3]}px`, xs: `${spacing[2]}px` }, width: "100%" }}>
                  {visualPdfPreview && printArtifact ? <PdfCanvasPreview pdfBytes={visualPdfPreview.bytes} expectedPages={printArtifact.pages} onPageCount={updatePdfPageCount} /> : visualPdfPreviewError ? <Stack alignItems="center" spacing={`${spacing[2]}px`}><Typography>인쇄 미리보기를 표시하지 못했습니다.</Typography><Button variant="secondary" onClick={() => setPreviewRetryKey((current) => current + 1)}>다시 시도</Button></Stack> : printArtifactError ? <Stack alignItems="center" spacing={`${spacing[2]}px`}><Typography>{userFacingPrintError(printArtifactError)}</Typography><Button variant="secondary" onClick={() => setPreviewRetryKey((current) => current + 1)}>다시 시도</Button></Stack> : <Loading label="운동 기록을 인쇄용으로 준비하고 있습니다." progress={75} />}
                </Box>
              </Stack>
            </Box>

            <Card><Stack spacing={`${spacing[3]}px`}><Box><Typography color={colors.primary.gold} fontWeight={800} variant="overline">SESSION INFORMATION</Typography><Typography variant="h6">운동 세션</Typography></Box><Box><Typography color={colors.neutral.gray400} variant="caption">회원</Typography><Typography fontWeight={800}>{state.document.member.name}</Typography></Box><Box><Typography color={colors.neutral.gray400} variant="caption">프로그램</Typography><Typography fontWeight={800}>{state.document.program.title}</Typography></Box><Box><Typography color={colors.neutral.gray400} variant="caption">Session ID</Typography><Typography fontFamily="monospace" fontWeight={800} sx={{ overflowWrap: "anywhere" }}>{state.document.workoutSessionId}</Typography></Box><Stack alignItems="center" spacing={`${spacing[1]}px`} sx={{ bgcolor: colors.neutral.gray800, borderRadius: `${radius.md}px`, p: `${spacing[3]}px` }} textAlign="center"><QrCode2Icon sx={{ color: colors.primary.gold, fontSize: 40 }} /><Typography color={colors.neutral.gray400} variant="body2">운동 기록 입력과 다음 프로그램 추천에 사용하는 QR입니다.</Typography></Stack><Stack direction="row" spacing={`${spacing[1]}px`}><CheckCircleIcon sx={{ color: colors.semantic.success }} /><Typography fontWeight={800}>{isUserGesturePdfPrintAdapter(configuredPrintAdapter) ? "인쇄 준비가 완료되었습니다." : "모든 정보가 정상적으로 준비되었습니다."}</Typography></Stack>{history[0] ? <Box><Typography color={colors.neutral.gray400} variant="caption">최근 출력</Typography><Typography fontWeight={800}>Copy {history[0].copy} · {formatDateTime(history[0].printedAt)}</Typography></Box> : null}{downloadError ? <Alert severity="error">{downloadError}</Alert> : null}<Stack spacing={`${spacing[2]}px`}><Button fullWidth variant="secondary" startIcon={<ArrowBackIcon />} onClick={goWorkspace}>프로그램 변경</Button><Button fullWidth variant="secondary" startIcon={<DownloadIcon />} disabled={!printArtifactId || pdfSaveInProgress} onClick={() => void savePdf()}>PDF 저장</Button>{isUserGesturePdfPrintAdapter(configuredPrintAdapter) ? <Button fullWidth variant="secondary" startIcon={<PrintIcon />} disabled={!ready} onClick={() => void openPreparedPdf()}>PDF 열기</Button> : null}<Button fullWidth startIcon={<PrintIcon />} loading={printRequest.saving || markingPrinted} disabled={!ready} onClick={() => void requestPrint()} sx={{ minHeight: 52 }}>인쇄하기</Button></Stack></Stack></Card>
          </Box>
        </Stack>
      </Box>
    </Box></>
  );
};
