import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DownloadIcon from "@mui/icons-material/Download";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import PrintIcon from "@mui/icons-material/Print";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { routeBuilder } from "../../../app/routeBuilder";
import { Button, colors, kiosk, radius, spacing } from "../../../design-system";
import { WorkoutPrintTemplateV1 } from "../components/WorkoutPrintTemplateV1/WorkoutPrintTemplateV1";
import { configuredPrintAdapter, configuredPrintAgentEndpoint, configuredPrintRuntime, createArtifactPrintAdapter } from "../gateways/configuredPrintAdapter";
import { createRenderedPrintArtifactFactory, isRenderedPrintDocumentReady } from "../gateways/printArtifactFactory";
import { createPreparedPdfHandoff, type PreparedPdfHandoff } from "../gateways/preparedPdfHandoff";
import { isUserGesturePdfPrintAdapter } from "../gateways/userGesturePdfPrintAdapter";
import { createBlankWorkoutPrintDocument } from "../mappers/workoutPrintMapper";
import { createPrintArtifactPreview, downloadPdfArtifact, fetchVisualPdfPreview, isPrintDispatchReady, type PrintArtifactPreview } from "../services/printPreviewReadiness";
import type { WorkoutPrintDocument } from "../types/print.types";
import { PdfCanvasPreview, userFacingPrintError } from "./PrintPreviewPage";
import "../styles/print.css";

const BLANK_LOG_JOB_PREFIX = "blank-workout-log";
// The A5 landscape sheet at CSS 96dpi (210mm x 148mm).
const A5_SHEET_WIDTH_PX = (210 * 96) / 25.4;
const A5_SHEET_HEIGHT_PX = (148 * 96) / 25.4;
const PREVIEW_MAX_WIDTH_PX = 980;

/**
 * The A5 document as the HTML the PDF is rendered from, scaled to the preview width. Shown until the
 * Print Agent's PDF is available, so an unreachable agent never leaves the preview empty.
 */
const A5DocumentPreview = ({ document }: { document: WorkoutPrintDocument }): JSX.Element => {
  const frameRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const update = () => setWidth(frame.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  const scale = Math.min(width, PREVIEW_MAX_WIDTH_PX) / A5_SHEET_WIDTH_PX;
  return (
    <Box aria-label="빈 운동일지 미리보기" ref={frameRef} role="img" sx={{ display: "flex", justifyContent: "center", width: "100%" }}>
      {width > 0 ? (
        <Box sx={{ bgcolor: "white", height: A5_SHEET_HEIGHT_PX * scale, overflow: "hidden", width: A5_SHEET_WIDTH_PX * scale }}>
          <Box sx={{ transform: `scale(${scale})`, transformOrigin: "top left", width: A5_SHEET_WIDTH_PX, "& .a5-workout-document": { boxShadow: "none", margin: 0 } }}>
            <WorkoutPrintTemplateV1 document={document} />
          </Box>
        </Box>
      ) : null}
    </Box>
  );
};

// One quiet status line under the preview, in the page's own type scale (no card or badge).
const PrintStatusNotice = ({ tone, title, description, action }: { tone: "progress" | "warning" | "success"; title: string; description?: string; action?: ReactNode }): JSX.Element => (
  <Stack alignItems={{ sm: "center", xs: "flex-start" }} direction={{ sm: "row", xs: "column" }} justifyContent="center" role="status" spacing={`${spacing[2]}px`} textAlign={{ sm: "left", xs: "center" }}>
    <Stack alignItems="center" direction="row" spacing={`${spacing[2]}px`}>
      {tone === "progress" ? <CircularProgress size={20} sx={{ color: colors.neutral.gray400 }} /> : tone === "success" ? <CheckCircleIcon sx={{ color: colors.semantic.success, fontSize: 26 }} /> : <ErrorOutlineIcon sx={{ color: colors.semantic.warning, fontSize: 26 }} />}
      <Box>
        <Typography fontSize={{ md: 19, xs: 16 }} fontWeight={800}>{title}</Typography>
        {description ? <Typography color={colors.neutral.gray400} fontSize={{ md: 16, xs: 14 }}>{description}</Typography> : null}
      </Box>
    </Stack>
    {action}
  </Stack>
);

/**
 * Blank A5 workout log: the regular A5 template with no member / session data, sent through the same
 * artifact -> Print Agent preview -> Print Agent print pipeline as a session print. It is a template
 * print only: no workout session, print history or kiosk print record is created.
 */
export const BlankWorkoutLogPrintPage = (): JSX.Element => {
  const navigate = useNavigate();
  const document = useMemo(() => createBlankWorkoutPrintDocument(), []);
  const [printArtifact, setPrintArtifact] = useState<PrintArtifactPreview | null>(null);
  const [printArtifactError, setPrintArtifactError] = useState<string | null>(null);
  const [visualPdfPreview, setVisualPdfPreview] = useState<({ bytes: Uint8Array } & PreparedPdfHandoff) | null>(null);
  const [visualPdfPreviewError, setVisualPdfPreviewError] = useState<string | null>(null);
  const [previewRetryKey, setPreviewRetryKey] = useState(0);
  const [printing, setPrinting] = useState(false);
  const [completedPrints, setCompletedPrints] = useState(0);
  const [printError, setPrintError] = useState<string | null>(null);
  const [pdfSaveInProgress, setPdfSaveInProgress] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const printInFlight = useRef(false);
  const printArtifactId = printArtifact?.artifactId ?? null;
  const updatePdfPageCount = useCallback((pages: number) => setPrintArtifact((current) => current && current.pages !== pages ? { ...current, pages } : current), []);

  useEffect(() => {
    const artifactRequest = { jobId: BLANK_LOG_JOB_PREFIX, document };
    if (!isRenderedPrintDocumentReady(artifactRequest)) {
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
        const preview = await createPrintArtifactPreview({ endpoint: configuredPrintAgentEndpoint, jobId: `${BLANK_LOG_JOB_PREFIX}-${crypto.randomUUID()}`, artifact });
        if (active) setPrintArtifact(preview);
      } catch (error) { if (active) setPrintArtifactError(error instanceof Error ? error.message : "print_artifact_creation_failed"); }
    })();
    return () => { active = false; };
  }, [document, previewRetryKey]);

  useEffect(() => {
    if (!printArtifactId) return;
    let active = true;
    void (async () => {
      try {
        const bytes = await fetchVisualPdfPreview({ endpoint: configuredPrintAgentEndpoint, artifactId: printArtifactId });
        const pdfBuffer = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(pdfBuffer).set(bytes);
        const prepared = createPreparedPdfHandoff(pdfBuffer, `basecamp-${BLANK_LOG_JOB_PREFIX}.pdf`);
        if (active) setVisualPdfPreview({ bytes, ...prepared });
        else URL.revokeObjectURL(prepared.blobUrl);
      } catch (error) { if (active) setVisualPdfPreviewError(error instanceof Error ? error.message : "visual_pdf_preview_failed"); }
    })();
    return () => { active = false; };
  }, [printArtifactId]);

  useEffect(() => () => { if (visualPdfPreview) URL.revokeObjectURL(visualPdfPreview.blobUrl); }, [visualPdfPreview]);

  const ready = isPrintDispatchReady(configuredPrintRuntime, printArtifact, Boolean(visualPdfPreview));
  const agentFailed = Boolean(printArtifactError || visualPdfPreviewError);
  const checkingAgent = !ready && !agentFailed;
  const goBack = () => navigate(routeBuilder.workoutSessions());
  // Re-checks only the Print Agent: the same blank document is sent for a new preview artifact.
  const retryAgent = () => { setPrintError(null); setDownloadError(null); setPreviewRetryKey((current) => current + 1); };

  const requestPrint = async () => {
    if (!ready || printInFlight.current) return;
    printInFlight.current = true;
    setPrinting(true);
    setPrintError(null);
    try {
      const userGestureAdapter = isUserGesturePdfPrintAdapter(configuredPrintAdapter) ? configuredPrintAdapter : null;
      if (userGestureAdapter) {
        if (!visualPdfPreview) { setPrintError("인쇄용 문서를 준비하지 못했습니다."); return; }
        const handoff = await userGestureAdapter.handoffPdf(visualPdfPreview);
        if (handoff.status === "failed") { setPrintError("PDF를 열지 못했습니다."); return; }
        setCompletedPrints((current) => current + 1);
        return;
      }
      // The previewed artifact is used for the first print only, like the session print; later copies re-render it.
      const result = await createArtifactPrintAdapter(configuredPrintRuntime, Boolean(printArtifactId)).print({ jobId: `${BLANK_LOG_JOB_PREFIX}-${crypto.randomUUID()}`, document, copies: 1, artifactId: completedPrints === 0 ? printArtifactId ?? undefined : undefined });
      if (result.status === "failed") { setPrintError(userFacingPrintError(result.reason ?? "print_submission_failed")); return; }
      setCompletedPrints((current) => current + 1);
    } catch {
      setPrintError("인쇄 요청을 처리하지 못했습니다.");
    } finally {
      printInFlight.current = false;
      setPrinting(false);
    }
  };

  // The PDF file is produced by the Print Agent, so saving needs the agent's preview artifact.
  const savePdf = async () => {
    if (!printArtifactId || pdfSaveInProgress) return;
    setDownloadError(null);
    setPdfSaveInProgress(true);
    try { await downloadPdfArtifact({ endpoint: configuredPrintAgentEndpoint, artifactId: printArtifactId, filename: `BaseCamp_빈운동일지_${new Date().toISOString().slice(0, 10)}.pdf` }); }
    catch { setDownloadError("PDF를 저장하지 못했습니다. 다시 시도해 주세요."); }
    finally { setPdfSaveInProgress(false); }
  };

  const retryButton = <Button disabled={checkingAgent} onClick={retryAgent} sx={{ color: colors.primary.gold, flexShrink: 0, fontSize: { md: 18, xs: 16 } }} variant="tertiary">다시 시도</Button>;
  const status = printError
    ? <PrintStatusNotice action={retryButton} description={printError} title="출력하지 못했습니다." tone="warning" />
    : agentFailed
      ? <PrintStatusNotice action={retryButton} description={printArtifactError ? userFacingPrintError(printArtifactError) : "인쇄 미리보기를 준비하지 못했습니다."} title="프린터 연결을 확인해 주세요." tone="warning" />
      : downloadError
        ? <PrintStatusNotice description={downloadError} title="PDF를 저장하지 못했습니다." tone="warning" />
        : completedPrints > 0
          ? <PrintStatusNotice description="출력된 운동일지를 프린터에서 가져가 주세요." title="빈 운동일지 출력을 요청했습니다." tone="success" />
          : checkingAgent
            ? <PrintStatusNotice title="인쇄 서비스를 확인하고 있습니다." tone="progress" />
            : null;

  return (
    <>
      <div className="print-only-root print-source-root" aria-hidden="true"><WorkoutPrintTemplateV1 document={document} /></div>
      <Box sx={{ alignItems: "center", bgcolor: colors.neutral.black, display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", minHeight: 0, overflow: "hidden" }}>
        <Box className="no-print" sx={{ display: "flex", flexDirection: "column", margin: "0 auto", maxHeight: "100%", maxWidth: 1180, minHeight: 0, p: { lg: `${spacing[6]}px`, md: `${spacing[4]}px`, xs: `${spacing[3]}px` }, width: "100%", "@media (orientation: portrait)": { maxWidth: kiosk.portraitContentWidth + kiosk.portraitSpacing * 2, px: `${kiosk.portraitSpacing}px` } }}>
          <Stack spacing={{ md: `${spacing[4]}px`, xs: `${spacing[3]}px` }} sx={{ minHeight: 0 }}>
            <Stack alignItems="center" spacing={`${spacing[2]}px`} textAlign="center">
              <Box sx={{ alignItems: "center", bgcolor: colors.alpha.goldMuted, border: `1px solid ${colors.primary.gold}`, borderRadius: `${radius.full}px`, color: colors.primary.gold, display: "flex", height: 64, justifyContent: "center", width: 64 }}><PrintIcon sx={{ fontSize: 32 }} /></Box>
              <Box>
                <Typography fontFamily="inherit" fontSize={{ md: 46, xs: 34 }} fontWeight={900} letterSpacing="-0.03em" lineHeight={1.15}>빈 운동일지 출력</Typography>
                <Typography color={colors.neutral.gray400} sx={{ fontSize: { md: 23, xs: 18 }, lineHeight: 1.5, mt: `${spacing[1]}px` }}>운동 8종목 · SET 1~5를 직접 기록할 수 있는 A5 운동일지입니다.</Typography>
              </Box>
            </Stack>

            <Box sx={{ alignItems: "center", bgcolor: colors.neutral.gray800, border: `1px solid ${colors.neutral.gray600}`, borderRadius: `${radius.sm}px`, display: "flex", flexShrink: 1, justifyContent: "center", minHeight: 0, overflow: "auto", p: { md: `${spacing[3]}px`, xs: `${spacing[2]}px` } }}>
              {visualPdfPreview && printArtifact
                ? <PdfCanvasPreview pdfBytes={visualPdfPreview.bytes} expectedPages={printArtifact.pages} onPageCount={updatePdfPageCount} />
                : <A5DocumentPreview document={document} />}
            </Box>

            {status}

            <Stack spacing={`${spacing[2]}px`}>
              <Box sx={{ display: "grid", gap: `${spacing[2]}px`, gridTemplateColumns: { sm: "minmax(0, 1fr) minmax(0, 2fr)", xs: "1fr" } }}>
                <Button fullWidth startIcon={<ArrowBackIcon />} onClick={goBack} sx={{ fontSize: { md: 22, xs: 18 }, minHeight: { md: 104, xs: 72 }, order: { sm: 0, xs: 1 } }} variant="secondary">운동기록으로 돌아가기</Button>
                <Button fullWidth startIcon={<PrintIcon sx={{ fontSize: 32 }} />} loading={printing} disabled={!ready} onClick={() => void requestPrint()} sx={{ fontSize: { md: 32, xs: 25 }, minHeight: { md: 104, xs: 88 } }}>{printing ? "출력 중..." : completedPrints > 0 ? "한 장 더 출력" : "빈 운동일지 출력"}</Button>
              </Box>
              <Stack direction="row" justifyContent="center">
                <Button startIcon={<DownloadIcon />} disabled={!printArtifactId || pdfSaveInProgress} loading={pdfSaveInProgress} onClick={() => void savePdf()} sx={{ fontSize: { md: 18, xs: 16 } }} variant="tertiary">PDF 저장</Button>
              </Stack>
            </Stack>
          </Stack>
        </Box>
      </Box>
    </>
  );
};
