import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handoffPreparedPdf, type PreparedPdfHandoff } from "../src/features/printing/gateways/preparedPdfHandoff";

const pageSource = readFileSync("src/features/printing/pages/PrintPreviewPage.tsx", "utf8");
const runtimeSource = readFileSync("src/features/printing/gateways/configuredPrintAdapter.ts", "utf8");
const handoffSource = readFileSync("src/features/printing/gateways/userGesturePdfPrintAdapter.ts", "utf8");
const prepared = { blob: new Blob(["%PDF-1.4"], { type: "application/pdf" }), blobUrl: "blob:basecamp-a5", file: { name: "basecamp-workout-session-a.pdf", type: "application/pdf" } as File } satisfies PreparedPdfHandoff;

const main = async (): Promise<void> => {
  let shareCalls = 0;
  let openCalls = 0;
  const shared = await handoffPreparedPdf(prepared, true, { canShare: ({ files }) => files?.[0] === prepared.file, share: async ({ files }) => { shareCalls += 1; assert.equal(files?.[0], prepared.file); } }, { open: () => { openCalls += 1; return null; }, location: { assign: () => { throw new Error("share should not navigate"); } } } as Window);
  assert.deepEqual(shared, { status: "submitted" });
  assert.equal(shareCalls, 1);
  assert.equal(openCalls, 0);

  let fallbackUrl = "";
  const opened = await handoffPreparedPdf(prepared, true, { canShare: () => false, share: async () => { throw new Error("share should not run"); } }, { open: (url) => { fallbackUrl = url; return {}; }, location: { assign: () => { throw new Error("open should succeed"); } } } as Window);
  assert.deepEqual(opened, { status: "submitted" });
  assert.equal(fallbackUrl, prepared.blobUrl);

  assert.equal(runtimeSource.includes('"browser-user-gesture"'), true);
  assert.equal(handoffSource.includes("requiresUserGesturePdfHandoff: true"), true);
  assert.equal(pageSource.includes("createRenderedPrintArtifactFactory"), true);
  assert.equal(pageSource.includes("createPreparedPdfHandoff"), true);
  assert.equal(pageSource.includes("PdfCanvasPreview pdfBytes={pdfPreview.bytes}"), true);
  assert.equal(pageSource.includes("autoPrint && !isUserGesturePdfPrintAdapter"), true);
  assert.equal(pageSource.includes("userGestureAdapter.handoffPdf(pdfPreview)"), true);
  assert.equal(pageSource.includes("window.print()"), false);
  assert.equal(pageSource.includes("WorkoutPrintTemplateV1 document={state.document}"), true);
  assert.equal(pageSource.includes("state.document.workoutSessionId"), true);
  assert.equal(pageSource.includes("다시 시도"), true);
  assert.equal(pageSource.includes("PDF 열기"), true);
  console.log("Android print handoff checks: PASS (share, fallback, prepared PDF, ready/retry, no auto print, session reuse)");
};

void main().catch((error) => { console.error(error); process.exitCode = 1; });
