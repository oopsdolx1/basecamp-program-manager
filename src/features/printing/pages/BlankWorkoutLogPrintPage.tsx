import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";
import { Alert, Box, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { routeBuilder } from "../../../app/routeBuilder";
import { Button, Card, Loading, colors, kiosk, radius, spacing } from "../../../design-system";
import { WorkoutPrintTemplateV1 } from "../components/WorkoutPrintTemplateV1/WorkoutPrintTemplateV1";
import { configuredPrintAdapter, configuredPrintAgentEndpoint, configuredPrintRuntime, createArtifactPrintAdapter } from "../gateways/configuredPrintAdapter";
import { createRenderedPrintArtifactFactory, isRenderedPrintDocumentReady } from "../gateways/printArtifactFactory";
import { createPreparedPdfHandoff, type PreparedPdfHandoff } from "../gateways/preparedPdfHandoff";
import { isUserGesturePdfPrintAdapter } from "../gateways/userGesturePdfPrintAdapter";
import { createBlankWorkoutPrintDocument } from "../mappers/workoutPrintMapper";
import { createPrintArtifactPreview, downloadPdfArtifact, fetchVisualPdfPreview, isPrintDispatchReady, type PrintArtifactPreview } from "../services/printPreviewReadiness";
import { PdfCanvasPreview, userFacingPrintError } from "./PrintPreviewPage";
import "../styles/print.css";

const BLANK_LOG_JOB_PREFIX = "blank-workout-log";

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
      } catch (error) { if (active) setVisualPdfPreviewError(error instanceof Error ? error.message : "인쇄용 문서를 준비하지 못했습니다."); }
    })();
    return () => { active = false; };
  }, [printArtifactId]);

  useEffect(() => () => { if (visualPdfPreview) URL.revokeObjectURL(visualPdfPreview.blobUrl); }, [visualPdfPreview]);

  const ready = isPrintDispatchReady(configuredPrintRuntime, printArtifact, Boolean(visualPdfPreview));
  const goBack = () => navigate(routeBuilder.workoutSessions());
  const retryPreview = () => { setPrintError(null); setPreviewRetryKey((current) => current + 1); };

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
        if (handoff.status === "failed") { setPrintError(handoff.reason ?? "PDF를 열지 못했습니다."); return; }
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

  const savePdf = async () => {
    if (!printArtifactId || pdfSaveInProgress) return;
    setDownloadError(null);
    setPdfSaveInProgress(true);
    try { await downloadPdfArtifact({ endpoint: configuredPrintAgentEndpoint, artifactId: printArtifactId, filename: `BaseCamp_빈운동일지_${new Date().toISOString().slice(0, 10)}.pdf` }); }
    catch { setDownloadError("PDF를 저장하지 못했습니다. 다시 시도해 주세요."); }
    finally { setPdfSaveInProgress(false); }
  };

  const previewError = visualPdfPreviewError ? "인쇄 미리보기를 표시하지 못했습니다." : printArtifactError ? userFacingPrintError(printArtifactError) : null;

  return (
    <>
      <div className="print-only-root print-source-root" aria-hidden="true"><WorkoutPrintTemplateV1 document={document} /></div>
      <Box sx={{ alignItems: "center", bgcolor: colors.neutral.black, display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", minHeight: 0, overflow: "hidden" }}>
        <Box className="no-print" sx={{ margin: "0 auto", maxWidth: 1660, p: { lg: `${spacing[6]}px`, md: `${spacing[4]}px`, xs: `${spacing[3]}px` }, width: "100%", "@media (orientation: portrait)": { maxWidth: kiosk.portraitContentWidth } }}>
          <Stack spacing={`${spacing[3]}px`}>
            <Stack alignItems="center" spacing={`${spacing[1]}px`} textAlign="center">
              <Typography color={colors.primary.gold} fontWeight={800} variant="overline">BLANK WORKOUT LOG</Typography>
              <Typography fontSize={{ md: 40, xs: 30 }} fontWeight={900} letterSpacing="-0.03em" lineHeight={1.15}>빈 운동일지 출력</Typography>
              <Typography color={colors.neutral.gray400} sx={{ fontSize: { md: 20, xs: 16 } }}>운동 8종목 · SET 1~5를 직접 기록할 수 있는 A5 운동일지입니다.</Typography>
            </Stack>
            <Box sx={{ alignItems: "start", display: "grid", gap: { lg: `${spacing[4]}px`, xs: `${spacing[3]}px` }, gridTemplateColumns: { lg: "minmax(0, 1fr) 360px", xs: "1fr" }, minWidth: 0, "@media (orientation: portrait)": { gridTemplateColumns: "1fr" } }}>
              <Box sx={{ alignItems: "center", bgcolor: colors.neutral.gray800, border: `1px solid ${colors.neutral.gray600}`, borderRadius: `${radius.sm}px`, display: "flex", justifyContent: "center", maxHeight: "calc(100dvh - 360px)", minWidth: 0, overflow: "auto", p: { md: `${spacing[3]}px`, xs: `${spacing[2]}px` } }}>
                {visualPdfPreview && printArtifact
                  ? <PdfCanvasPreview pdfBytes={visualPdfPreview.bytes} expectedPages={printArtifact.pages} onPageCount={updatePdfPageCount} />
                  : previewError
                    ? <Stack alignItems="center" spacing={`${spacing[2]}px`}><Typography>{previewError}</Typography><Button variant="secondary" onClick={retryPreview}>다시 시도</Button></Stack>
                    : <Loading label="빈 운동일지를 인쇄용으로 준비하고 있습니다." progress={75} />}
              </Box>
              <Card>
                <Stack spacing={`${spacing[2]}px`}>
                  {completedPrints > 0 ? <Alert severity="success">빈 운동일지 출력을 요청했습니다.</Alert> : null}
                  {printError ? <Alert severity="error">{printError}</Alert> : null}
                  {downloadError ? <Alert severity="error">{downloadError}</Alert> : null}
                  <Button fullWidth startIcon={<PrintIcon sx={{ fontSize: 28 }} />} loading={printing} disabled={!ready} onClick={() => void requestPrint()} sx={{ fontSize: { md: 26, xs: 21 }, minHeight: { md: 88, xs: 76 } }}>{printing ? "출력 중..." : completedPrints > 0 ? "한 장 더 출력" : "빈 운동일지 출력하기"}</Button>
                  <Button fullWidth variant="secondary" startIcon={<DownloadIcon />} disabled={!printArtifactId || pdfSaveInProgress} onClick={() => void savePdf()}>PDF 저장</Button>
                  <Button fullWidth variant="secondary" startIcon={<ArrowBackIcon />} onClick={goBack}>운동기록으로 돌아가기</Button>
                </Stack>
              </Card>
            </Box>
          </Stack>
        </Box>
      </Box>
    </>
  );
};
