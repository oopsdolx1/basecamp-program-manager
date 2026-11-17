import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PrintIcon from "@mui/icons-material/Print";
import DownloadIcon from "@mui/icons-material/Download";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import { Alert, Box, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { routeBuilder } from "../../../app/routeBuilder";
import { Button, Card, EmptyState, Loading, colors, kiosk, motion, radius, shadows, spacing } from "../../../design-system";
import { toAppId, toProfileId, toProgramId } from "../../../types/brandedIds";
import type { PrintRequestRecord } from "../../print-history";
import { getPrintRequestsByIds } from "../../print-history/services/printRequestService";
import { createPrintRequestId, ensureKioskPrintSession, recordKioskPrint, type PendingPrintRecord } from "../../print-history/services/kioskPrintRecordService";
import { getDefaultKioskMemberSessionRuntime } from "../../kiosk-session/defaultKioskMemberSession";
import { useKioskSessionScope } from "../../kiosk-session/kioskSessionScope";
import { WorkoutPrintTemplateV1 } from "../components/WorkoutPrintTemplateV1/WorkoutPrintTemplateV1";
import { configuredPrintAdapter, configuredPrintAgentEndpoint, configuredPrintRuntime, createArtifactPrintAdapter } from "../gateways/configuredPrintAdapter";
import { createRenderedPrintArtifactFactory, isRenderedPrintDocumentReady } from "../gateways/printArtifactFactory";
import { createPreparedPdfHandoff, type PreparedPdfHandoff } from "../gateways/preparedPdfHandoff";
import { isUserGesturePdfPrintAdapter } from "../gateways/userGesturePdfPrintAdapter";
import { usePrintPreview } from "../hooks/usePrintPreview";
import { createPrintArtifactPreview, downloadPdfArtifact, fetchVisualPdfPreview, isPrintDispatchReady, type PrintArtifactPreview } from "../services/printPreviewReadiness";
import { submitPhysicalPrintAndPersist } from "../services/physicalPrintSubmissionService";
import type { WorkoutPrintDocument } from "../types/print.types";
import "../styles/print.css";

const conditionLabAppId = toAppId(import.meta.env.VITE_CONDITION_LAB_APP_ID ?? "");
const formatDateTime = (date: Date): string => new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(date);
export const userFacingPrintError = (reason: string): string => {
  if (reason === "print_agent_unavailable" || reason === "preview_artifact_requires_windows_agent") return "인쇄 서비스에 연결하지 못했습니다. Print Agent가 실행 중인지 확인한 뒤 다시 시도해 주세요.";
  if (reason === "agent_http_401" || reason === "agent_http_403") return "인쇄 서비스 인증이 만료되었거나 권한이 없습니다. 관리자에게 문의해 주세요.";
  if (reason === "agent_http_404") return "인쇄 문서를 찾을 수 없습니다. 새로고침 후 다시 준비해 주세요.";
  if (reason.startsWith("agent_http_")) return "인쇄 서비스가 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  if (reason === "preview_unavailable" || reason === "pdf_get_failed") return "인쇄 문서를 불러오지 못했습니다. 인쇄하지 않았으므로 다시 준비해 주세요.";
  if (reason === "print_status_unknown" || reason === "print_status_timeout") return "출력 요청 결과를 확인하지 못했습니다. 프린터 대기열을 확인한 뒤 필요할 때만 다시 출력해 주세요.";
  if (reason === "print_request_conflict" || reason === "REQUEST_PAYLOAD_CONFLICT") return "같은 출력 요청이 이미 처리 중이거나 기록되어 있습니다. 출력 기록을 먼저 확인해 주세요.";
  if (reason === "default_printer_unavailable" || reason === "physical_printer_unavailable") return "연결된 프린터를 찾을 수 없습니다. PDF 저장은 사용할 수 있습니다.";
  if (reason === "printer_not_configured") return "출력 프린터가 설정되지 않았습니다. 관리자에게 문의해 주세요.";
  if (reason === "config_missing" || reason === "config_invalid") return "출력 프린터 설정을 확인해 주세요. 관리자에게 문의해 주세요.";
  if (reason === "configured_printer_not_found") return "설정된 프린터를 찾을 수 없습니다. 프린터 연결을 확인해 주세요.";
  if (reason === "configured_printer_virtual" || reason === "configured_printer_unavailable") return "설정된 프린터를 사용할 수 없습니다. 프린터 연결을 확인해 주세요.";
  if (reason === "printer_queue_access_denied") return "프린터 오류 작업을 자동으로 정리할 수 없습니다. 관리자 점검이 필요합니다.";
  if (reason === "printer_queue_recovery_required" || reason === "printer_spooler_error" || reason === "spooler_stopped") return "프린터 대기열에 오류가 있습니다. 프린터 상태를 확인해 주세요.";
  if (reason === "printer_submission_failed" || reason === "print_timeout" || reason === "print_engine_failed") return "출력 요청을 보내지 못했습니다. 프린터 연결을 확인한 뒤 다시 시도해 주세요.";
  return "인쇄 처리 중 문제가 발생했습니다. 출력 성공 여부를 확인한 뒤 필요할 때만 다시 시도해 주세요.";
};

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const PrintSourceDocument = ({ document }: { document: WorkoutPrintDocument }): JSX.Element => (
  <div className="print-only-root print-source-root" aria-hidden="true">
    <WorkoutPrintTemplateV1 document={document} />
  </div>
);

// AppLayout already owns the viewport and gives this route the height below the
// header.  Every state view must consume that area rather than creating a new
// viewport-height box, which would make the document scroll behind the header.
const printStateSx = {
  alignItems: "center",
  bgcolor: colors.neutral.black,
  display: "flex",
  flex: 1,
  flexDirection: "column",
  justifyContent: "center",
  minHeight: 0,
  overflow: "hidden",
};

export const PdfCanvasPreview = ({ pdfBytes, expectedPages, onPageCount }: { pdfBytes: Uint8Array; expectedPages: number; onPageCount: (pages: number) => void }): JSX.Element => {
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
        const pageSize = page.getViewport({ scale: 1 });
        const maxWidth = Math.min(canvas.parentElement?.clientWidth ?? 980, 980);
        const cssWidth = Math.max(1, maxWidth);
        // Scale the PDF page to the canvas width; at scale 1 it only filled the top-left 595pt of the canvas.
        const viewport = page.getViewport({ scale: cssWidth / pageSize.width });
        const cssHeight = viewport.height;
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

  return <Stack alignItems="center" spacing={`${spacing[2]}px`} sx={{ minHeight: status === "ready" ? 0 : "min(70vh, 760px)", position: "relative", width: "100%" }}>
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
  const reprint = searchParams.get("reprint") === "1";
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [historyWarning, setHistoryWarning] = useState<string | null>(null);
  const [markingPrinted, setMarkingPrinted] = useState(false);
  const [completedPrints, setCompletedPrints] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(30);
  const autoPrintStarted = useRef(false);
  const physicalPrintInFlight = useRef(false);
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
  // Phase 3-B: the print record is saved by the Condition Lab API with the Kiosk member session handed over
  // from the selection flow / workout history. No Client SDK write, no fallback.
  const kioskSessionRuntime = useMemo(() => getDefaultKioskMemberSessionRuntime(), []);
  useKioskSessionScope(kioskSessionRuntime, { receivesHandoff: true });
  const [recordSaving, setRecordSaving] = useState(false);
  const [pendingPrintRecord, setPendingPrintRecord] = useState<PendingPrintRecord | null>(null);
  const [kioskSessionError, setKioskSessionError] = useState<string | null>(null);
  const printRequest = { saving: recordSaving, error: null as string | null };
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
        const preview = await createPrintArtifactPreview({ endpoint: configuredPrintAgentEndpoint, jobId: workoutSessionId ?? state.document.workoutSessionId, artifact });
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
        const bytes = await fetchVisualPdfPreview({ endpoint: configuredPrintAgentEndpoint, artifactId: printArtifactId });
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
    try { await downloadPdfArtifact({ endpoint: configuredPrintAgentEndpoint, artifactId: printArtifactId, filename: `BaseCamp_${safe}_${new Date().toISOString().slice(0, 10)}.pdf` }); }
    catch { setDownloadError("PDF를 저장하지 못했습니다. 다시 시도해 주세요."); }
    finally { setPdfSaveInProgress(false); }
  };
  const retryAutoPrint = () => {
    // A physical submission failure is safe to retry.  Reuse the already
    // previewed artifact so the retry cannot race the preview regeneration
    // effect, and reopen the one-shot auto-print guard for this attempt.
    autoPrintStarted.current = false;
    physicalPrintInFlight.current = false;
    setSessionError(null);
    setHistoryWarning(null);
    void requestPrint();
  };
  const retryPreview = () => {
    // Preview failures occur before physical submission.  Regenerate the
    // canonical artifact and let the readiness effect dispatch once its PDF
    // is available again.
    autoPrintStarted.current = false;
    physicalPrintInFlight.current = false;
    setSessionError(null);
    setHistoryWarning(null);
    setPreviewRetryKey((current) => current + 1);
  };
  const requestPrint = async () => {
    if (state.status !== "ready" || printRequest.saving || markingPrinted || physicalPrintInFlight.current || !workoutSessionId) return;
    physicalPrintInFlight.current = true;
    setSessionError(null);
    setHistoryWarning(null);
    setKioskSessionError(null);
    // Confirm the selected member's session before anything is printed: a print that cannot be recorded
    // (no selection, other member, revoked device, API down) is not started.
    try {
      await ensureKioskPrintSession(state.workoutSession.memberId, kioskSessionRuntime);
    } catch (error) {
      setKioskSessionError(error instanceof Error ? error.message : "출력 준비를 완료하지 못했습니다.");
      physicalPrintInFlight.current = false;
      return;
    }
    const userGestureAdapter = isUserGesturePdfPrintAdapter(configuredPrintAdapter) ? configuredPrintAdapter : null;
    if (userGestureAdapter) {
      if (!visualPdfPreview) { setSessionError("인쇄용 문서를 준비하지 못했습니다."); physicalPrintInFlight.current = false; return; }
      const handoff = await userGestureAdapter.handoffPdf(visualPdfPreview);
      if (handoff.status === "failed") { setSessionError(handoff.reason ?? "PDF를 열지 못했습니다."); physicalPrintInFlight.current = false; return; }
    }
    const nextCopy = Math.max(state.workoutSession.print.copyCount, ...history.map((item) => item.copy), 0) + 1;
    const printAdapter = createArtifactPrintAdapter(configuredPrintRuntime, Boolean(printArtifact?.artifactId));
    // One idempotency key per physical print: retries of the record (network, lost response) reuse it.
    const printRequestId = createPrintRequestId();
    let outcome;
    try {
      outcome = await submitPhysicalPrintAndPersist({
        submit: () => userGestureAdapter ? Promise.resolve({ status: "submitted" as const }) : printAdapter.print({ jobId: crypto.randomUUID(), document: state.document, copies: 1, artifactId: completedPrints === 0 ? printArtifact?.artifactId : undefined }),
        saveHistory: async (printer) => {
          const pending: PendingPrintRecord = { printRequestId, workoutSessionId, memberId: state.workoutSession.memberId, printer, copy: nextCopy };
          setPendingPrintRecord(pending);
          setRecordSaving(true);
          try {
            const record = await recordKioskPrint(pending, kioskSessionRuntime);
            setPendingPrintRecord(null);
            return record;
          } finally {
            setRecordSaving(false);
          }
        },
        onPhysicalSubmitted: () => { setCompletedPrints((current) => current + 1); setMarkingPrinted(true); },
      });
    } catch {
      setSessionError("인쇄 요청을 처리하지 못했습니다.");
      physicalPrintInFlight.current = false;
      return;
    }
    physicalPrintInFlight.current = false;
    if (outcome.physical === "failed") { setSessionError(userFacingPrintError(outcome.reason ?? "print_submission_failed")); return; }
    // A native submission has already succeeded. Never retry it automatically
    // when either Firestore write above fails.
    if (outcome.history === "failed") {
      if (import.meta.env.DEV) console.error("Physical print succeeded but print history persistence failed");
      setHistoryWarning("출력은 완료됐지만, 출력 기록 저장에 실패했습니다.");
      setMarkingPrinted(false);
      return;
    }
    setHistory((current) => [outcome.record, ...current]);
    setMarkingPrinted(false);
  };
  // The physical print already happened: only the record is retried, with the same idempotency key.
  const retryPrintRecord = async () => {
    if (!pendingPrintRecord || recordSaving) return;
    setRecordSaving(true);
    setHistoryWarning(null);
    try {
      const record = await recordKioskPrint(pendingPrintRecord, kioskSessionRuntime);
      setPendingPrintRecord(null);
      setHistory((current) => [record, ...current]);
    } catch (error) {
      setHistoryWarning(error instanceof Error ? error.message : "출력 기록 저장에 실패했습니다.");
    } finally {
      setRecordSaving(false);
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
  if (state.status === "loading") return <Box sx={{ ...printStateSx, p: `${spacing[6]}px` }}><Card><Loading label="A5 가로 미리보기를 준비하고 있습니다." progress={75} /></Card></Box>;
  if (state.status === "error") return <Box sx={{ ...printStateSx, p: `${spacing[6]}px` }}><Card><Stack spacing={`${spacing[4]}px`}><EmptyState title="미리보기를 만들 수 없습니다." description={state.message} /><Button variant="secondary" startIcon={<ArrowBackIcon />} onClick={goWorkspace}>프로그램으로 돌아가기</Button></Stack></Card></Box>;

  if (completedPrints > 0 && reprint) return <><PrintSourceDocument document={state.document} /><Box sx={{ ...printStateSx, alignItems: "center", display: "flex", justifyContent: "center", p: { md: `${spacing[8]}px`, xs: `${spacing[4]}px` } }}><Stack alignItems="center" spacing={`${spacing[3]}px`} sx={{ maxWidth: 560, width: "100%" }} textAlign="center"><CheckCircleIcon sx={{ color: colors.semantic.success, fontSize: 64 }} /><Typography fontSize={{ md: 42, xs: 30 }} fontWeight={900}>재출력을 요청했습니다.</Typography><Typography color={colors.neutral.gray400}>{state.document.member.name} · {state.document.program.title}</Typography><Typography color={colors.neutral.gray400} variant="body2">{secondsRemaining}초 후 처음 화면으로 돌아갑니다.</Typography><Button fullWidth onClick={goWorkspace} sx={{ fontSize: { md: 28, xs: 23 }, minHeight: 92 }}>처음으로</Button></Stack></Box></>;
  if (completedPrints > 0) return <><PrintSourceDocument document={state.document} /><Box sx={{ ...printStateSx, alignItems: "center", display: "flex", justifyContent: "center", p: { md: `${spacing[8]}px`, xs: `${spacing[4]}px` } }}><Stack alignItems="center" spacing={`${spacing[3]}px`} sx={{ maxWidth: 560, width: "100%" }} textAlign="center"><CheckCircleIcon sx={{ color: colors.semantic.success, fontSize: 64 }} /><Box><Typography fontSize={{ md: 42, xs: 30 }} fontWeight={900}>출력이 완료되었습니다.</Typography><Typography color={colors.neutral.gray400} sx={{ fontSize: { md: 22, xs: 17 }, mt: `${spacing[1]}px` }}>{state.document.member.name} · {state.document.program.title}</Typography></Box>{markingPrinted || printRequest.saving ? <Typography color={colors.neutral.gray400}>출력 기록을 저장하고 있습니다.</Typography> : historyWarning ? <Stack spacing={`${spacing[2]}px`} sx={{ width: "100%" }}><Alert severity="warning">출력 기록 저장 상태를 확인해 주세요.</Alert>{pendingPrintRecord ? <Button fullWidth variant="secondary" onClick={() => void retryPrintRecord()}>출력 기록 다시 저장</Button> : null}</Stack> : <Typography color={colors.neutral.gray400} variant="body2">{secondsRemaining}초 후 처음 화면으로 돌아갑니다.</Typography>}<Stack spacing={`${spacing[2]}px`} sx={{ mt: `${spacing[2]}px`, width: "100%" }}><Button fullWidth onClick={goWorkspace} sx={{ fontSize: { md: 28, xs: 23 }, minHeight: 92 }}>처음으로</Button><Button fullWidth disabled={markingPrinted || printRequest.saving} loading={markingPrinted || printRequest.saving} variant="secondary" onClick={() => { setSecondsRemaining(30); void requestPrint(); }} sx={{ fontSize: { md: 22, xs: 18 }, minHeight: 72 }}>다시 출력</Button><Button fullWidth variant="tertiary" startIcon={<DownloadIcon />} disabled={!printArtifactId || pdfSaveInProgress} onClick={() => void savePdf()}>PDF 저장</Button></Stack></Stack></Box></>;

  if (kioskSessionError && completedPrints === 0) return <><PrintSourceDocument document={state.document} /><Box sx={{ ...printStateSx, p: `${spacing[6]}px` }}><Card sx={{ margin: "0 auto", maxWidth: 760 }}><Stack spacing={`${spacing[3]}px`}><EmptyState title={kioskSessionError} description="출력하지 않았습니다. 처음 화면에서 회원을 선택한 뒤 다시 진행해 주세요." /><Button onClick={goWorkspace}>처음으로</Button></Stack></Card></Box></>;
  if (autoPrint && !isUserGesturePdfPrintAdapter(configuredPrintAdapter) && printArtifactError) return <><PrintSourceDocument document={state.document} /><Box sx={{ ...printStateSx, p: `${spacing[6]}px` }}><Card sx={{ margin: "0 auto", maxWidth: 760 }}><Stack spacing={`${spacing[3]}px`}><EmptyState title={userFacingPrintError(printArtifactError)} description="인쇄 서비스를 확인한 뒤 다시 시도해 주세요." /><Button onClick={() => setPreviewRetryKey((current) => current + 1)}>다시 시도</Button><Button variant="secondary" onClick={goWorkspace}>프로그램으로 돌아가기</Button></Stack></Card></Box></>;
  if (autoPrint && !isUserGesturePdfPrintAdapter(configuredPrintAdapter) && visualPdfPreviewError) return <><PrintSourceDocument document={state.document} /><Box sx={{ ...printStateSx, p: `${spacing[6]}px` }}><Card sx={{ margin: "0 auto", maxWidth: 760 }}><Stack spacing={`${spacing[3]}px`}><EmptyState title="인쇄 미리보기를 준비하지 못했습니다." description="인쇄 서비스를 확인한 뒤 다시 시도해 주세요." /><Button onClick={retryPreview}>다시 시도</Button><Button variant="secondary" onClick={goWorkspace}>프로그램으로 돌아가기</Button></Stack></Card></Box></>;
  if (autoPrint && !isUserGesturePdfPrintAdapter(configuredPrintAdapter) && (printRequest.error || sessionError)) return <><PrintSourceDocument document={state.document} /><Box sx={{ ...printStateSx, p: `${spacing[6]}px` }}><Card sx={{ margin: "0 auto", maxWidth: 760 }}><Stack spacing={`${spacing[3]}px`}><EmptyState title="출력하지 못했습니다. 프린터 연결을 확인해 주세요." description="잠시 후 다시 시도해 주세요." /><Button onClick={retryAutoPrint}>다시 시도</Button><Button variant="secondary" onClick={goWorkspace}>프로그램으로 돌아가기</Button></Stack></Card></Box></>;
  if (autoPrint && !isUserGesturePdfPrintAdapter(configuredPrintAdapter)) return <><PrintSourceDocument document={state.document} /><Box sx={{ ...printStateSx, p: `${spacing[6]}px` }}><Card sx={{ margin: "0 auto", maxWidth: 760 }}><Stack spacing={`${spacing[3]}px`}><Loading label={printRequest.error || sessionError || "운동 세션과 QR을 확인하고 인쇄를 요청하고 있습니다."} progress={printRequest.error || sessionError ? undefined : 85} /><Button fullWidth variant="secondary" startIcon={<DownloadIcon />} disabled={!printArtifactId || pdfSaveInProgress} onClick={() => void savePdf()}>PDF 저장</Button>{downloadError ? <Alert severity="error">{downloadError}</Alert> : null}</Stack></Card></Box></>;
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
    <><PrintSourceDocument document={state.document} /><Box sx={{ ...printStateSx, alignItems: "center", display: "flex", justifyContent: "center" }}>
      <Box className="no-print" sx={{ margin: "0 auto", maxWidth: 1660, p: { lg: `${spacing[6]}px`, md: `${spacing[4]}px`, xs: `${spacing[3]}px` }, "@media (orientation: portrait)": { maxWidth: kiosk.portraitContentWidth } }}>
        <Stack spacing={`${spacing[3]}px`}>
          {printRequest.error ? <Alert severity="error">출력할 수 없습니다. 프린터 연결 상태를 확인한 뒤 다시 시도해 주세요.</Alert> : null}
          {sessionError ? <Alert severity="error">출력 준비를 완료하지 못했습니다. 다시 시도해 주세요.</Alert> : null}

          <Stack alignItems="center" spacing={`${spacing[2]}px`} textAlign="center"><Box sx={{ alignItems: "center", bgcolor: colors.alpha.goldMuted, border: `1px solid ${colors.primary.gold}`, borderRadius: `${radius.full}px`, color: colors.primary.gold, display: "flex", height: 64, justifyContent: "center", width: 64 }}><PrintIcon sx={{ fontSize: 32 }} /></Box><Box><Typography fontFamily="inherit" fontSize={{ md: 46, xs: 34 }} fontWeight={900} letterSpacing="-0.03em" lineHeight={1.15}>출력 준비</Typography><Typography color={colors.neutral.gray400} sx={{ fontSize: { md: 23, xs: 18 }, lineHeight: 1.5, mt: `${spacing[1]}px` }}>운동 프로그램을 확인하고 출력해 주세요.</Typography></Box></Stack>

          <Box sx={{ alignItems: "start", display: "grid", gap: { lg: `${spacing[4]}px`, xs: `${spacing[3]}px` }, gridTemplateColumns: { lg: "minmax(0, 1fr) 360px", xs: "1fr" }, minWidth: 0, "@media (orientation: portrait)": { gridTemplateColumns: "1fr" } }}>
            <Box sx={{ minWidth: 0, overflow: "hidden", py: { md: `${spacing[2]}px`, xs: 0 } }}>
              <Stack alignItems="center" spacing={`${spacing[2]}px`}><Stack alignItems={{ sm: "center", xs: "flex-start" }} direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={1} sx={{ bgcolor: colors.neutral.gray800, border: `1px solid ${colors.neutral.gray700}`, borderRadius: `${radius.sm}px`, px: { md: `${spacing[3]}px`, xs: `${spacing[2]}px` }, py: `${spacing[2]}px`, width: "100%" }}><Box><Typography fontSize={{ md: 28, xs: 22 }} fontWeight={900}>{state.document.member.name}</Typography><Typography color={colors.neutral.gray400} fontSize={{ md: 23, xs: 18 }} fontWeight={700} sx={{ mt: 0.5 }}>{state.document.program.title}</Typography></Box><Typography color={colors.neutral.gray400} fontSize={{ md: 21, xs: 17 }} fontWeight={700}>운동 {state.document.program.exercises.length}개 · 총 {state.document.program.exercises.reduce((sum, exercise) => sum + (exercise.configuredSets ?? 0), 0)}세트</Typography></Stack>
                <Box sx={{ alignItems: "center", bgcolor: colors.neutral.gray800, border: `1px solid ${colors.neutral.gray600}`, borderRadius: `${radius.sm}px`, display: "flex", justifyContent: "center", maxHeight: "calc(100dvh - 470px)", overflow: "auto", p: { md: `${spacing[3]}px`, xs: `${spacing[2]}px` }, width: "100%" }}>
                  {visualPdfPreview && printArtifact ? <PdfCanvasPreview pdfBytes={visualPdfPreview.bytes} expectedPages={printArtifact.pages} onPageCount={updatePdfPageCount} /> : visualPdfPreviewError ? <Stack alignItems="center" spacing={`${spacing[2]}px`}><Typography>인쇄 미리보기를 표시하지 못했습니다.</Typography><Button variant="secondary" onClick={() => setPreviewRetryKey((current) => current + 1)}>다시 시도</Button></Stack> : printArtifactError ? <Stack alignItems="center" spacing={`${spacing[2]}px`}><Typography>{userFacingPrintError(printArtifactError)}</Typography><Button variant="secondary" onClick={() => setPreviewRetryKey((current) => current + 1)}>다시 시도</Button></Stack> : <Loading label="운동 기록을 인쇄용으로 준비하고 있습니다." progress={75} />}
                </Box>
              </Stack>
            </Box>

            <Card><Stack spacing={`${spacing[3]}px`}><Stack alignItems="center" direction="row" spacing={`${spacing[1]}px`}><CheckCircleIcon sx={{ color: colors.semantic.success, fontSize: 28 }} /><Box><Typography fontSize={{ md: 22, xs: 18 }} fontWeight={900}>출력 준비 완료</Typography><Typography color={colors.neutral.gray400} fontSize={{ md: 18, xs: 15 }}>프린터 연결됨</Typography></Box></Stack>{downloadError ? <Alert severity="error">PDF를 저장하지 못했습니다. 다시 시도해 주세요.</Alert> : null}<Stack spacing={`${spacing[2]}px`}><Button fullWidth variant="secondary" startIcon={<ArrowBackIcon />} onClick={goWorkspace} sx={{ fontSize: { md: 22, xs: 18 }, minHeight: 72 }}>운동 구성 다시 보기</Button><Button fullWidth variant="secondary" startIcon={<DownloadIcon />} disabled={!printArtifactId || pdfSaveInProgress} onClick={() => void savePdf()} sx={{ fontSize: { md: 22, xs: 18 }, minHeight: 72 }}>PDF 저장</Button>{isUserGesturePdfPrintAdapter(configuredPrintAdapter) ? <Button fullWidth variant="secondary" startIcon={<PrintIcon />} disabled={!ready} onClick={() => void openPreparedPdf()} sx={{ fontSize: { md: 22, xs: 18 }, minHeight: 72 }}>PDF 열기</Button> : null}<Button fullWidth startIcon={<PrintIcon sx={{ fontSize: 32 }} />} loading={printRequest.saving || markingPrinted} disabled={!ready} onClick={() => void requestPrint()} sx={{ fontSize: { md: 32, xs: 25 }, minHeight: { md: 104, xs: 88 } }}>{printRequest.saving || markingPrinted ? "출력 중..." : "운동 프로그램 출력하기"}</Button></Stack></Stack></Card>
          </Box>
        </Stack>
      </Box>
    </Box></>
  );
};
