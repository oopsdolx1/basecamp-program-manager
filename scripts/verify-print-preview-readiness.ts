import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createPrintArtifactPreview, downloadPdfArtifact, fetchVisualPdfPreview, isPrintDispatchReady } from "../src/features/printing/services/printPreviewReadiness";
import type { PrintAdapter, PrintRequest } from "../src/features/printing/gateways/browserPrintGateway";

const artifact = { type: "html" as const, content: "<!doctype html><article class=\"a5-workout-document\"></article>" };
const request = { jobId: "print-1", document: {} as PrintRequest["document"], copies: 1, artifactId: "artifact-1" };

const dispatchIfReady = async (adapter: PrintAdapter, visualPdfReady: boolean, artifactReady: { artifactId: string; pages: number } | null): Promise<boolean> => {
  if (!isPrintDispatchReady("windows-agent", artifactReady, visualPdfReady)) return false;
  const result = await adapter.print({ ...request, artifactId: artifactReady?.artifactId });
  return result.status === "submitted";
};

const main = async (): Promise<void> => {
  const page = readFileSync("src/features/printing/pages/PrintPreviewPage.tsx", "utf8");
  const factory = readFileSync("src/features/printing/gateways/printArtifactFactory.ts", "utf8");
  const css = readFileSync("src/features/printing/styles/print.css", "utf8");
  assert.equal(page.includes("const PrintSourceDocument"), true);
  assert.equal(page.match(/<PrintSourceDocument document=\{state\.document\} \/>/g)?.length, 4);
  assert.equal(page.includes("isRenderedPrintDocumentReady(artifactRequest)"), true);
  assert.equal(factory.includes("element.isConnected"), true);
  assert.equal(factory.includes("bounds.width > 0 && bounds.height > 0"), true);
  assert.equal(css.includes(".print-source-root"), true);
  assert.equal(css.includes("left: -100000px"), true);
  assert.equal(css.includes(".print-source-root {\n  display: none"), false);

  let calls = 0;
  const adapter: PrintAdapter = { print: async (value) => { calls += 1; assert.equal(value.artifactId, "artifact-1"); return { status: "submitted" }; } };
  const postOnly = await createPrintArtifactPreview({ endpoint: "http://agent", jobId: "session-1", artifact, fetchImpl: async (url) => {
    assert.equal(String(url), "http://agent/preview");
    return new Response(JSON.stringify({ artifactId: "artifact-1", pages: 1 }), { status: 201 });
  } });
  let pendingGetStarted = false;
  const visualPdfStillPending = fetchVisualPdfPreview({ endpoint: "http://agent", artifactId: postOnly.artifactId, fetchImpl: async () => {
    pendingGetStarted = true;
    return await new Promise<Response>(() => undefined);
  } });
  await Promise.resolve();
  assert.equal(pendingGetStarted, true);
  let autoPrintStarted = false;
  if (!autoPrintStarted && isPrintDispatchReady("windows-agent", postOnly, false)) {
    autoPrintStarted = true;
    assert.equal(await dispatchIfReady(adapter, false, postOnly), true);
  }
  assert.equal(calls, 1);
  // A second effect pass cannot duplicate the same automatic print.
  void visualPdfStillPending;
  await assert.rejects(fetchVisualPdfPreview({ endpoint: "http://agent", artifactId: postOnly.artifactId, fetchImpl: async () => { throw new Error("pdf_get_failed"); } }), /pdf_get_failed/);
  // A user-requested same-session reprint remains a separate deliberate dispatch.
  assert.equal(await dispatchIfReady(adapter, false, postOnly), true);
  assert.equal(calls, 2);
  await assert.rejects(createPrintArtifactPreview({ endpoint: "http://agent", jobId: "session-2", artifact, fetchImpl: async () => new Response(JSON.stringify({ reason: "preview_failed" }), { status: 502 }) }), /preview_failed/);
  assert.equal(await dispatchIfReady(adapter, false, null), false);
  assert.equal(calls, 2);
  assert.equal(isPrintDispatchReady("browser", postOnly, false), false);
  assert.equal(isPrintDispatchReady("browser", postOnly, true), true);
  assert.equal(isPrintDispatchReady("windows-agent", postOnly, false), true);
  assert.equal(isPrintDispatchReady("windows-agent", null, true), false);
  let downloaded = false;
  let appended = false;
  let revoked = false;
  let runCleanup: (() => void) | null = null;
  const links: Array<{ download: string; href: string }> = [];
  const documentImpl = {
    body: { appendChild: () => { appended = true; } },
    createElement: () => {
      const link = { download: "", href: "", click: () => { downloaded = true; }, remove: () => undefined };
      links.push(link);
      return link;
    },
  } as unknown as Document;
  await downloadPdfArtifact({ endpoint: "http://agent", artifactId: "artifact-1", filename: "BaseCamp_session-1_2026-10-02.pdf", documentImpl, objectUrlApi: { createObjectURL: () => "blob:pdf", revokeObjectURL: () => { revoked = true; } }, setTimeoutImpl: (callback) => {
    runCleanup = callback as () => void;
    return 0 as ReturnType<typeof setTimeout>;
  }, fetchImpl: async (url) => {
    assert.equal(String(url), "http://agent/preview/artifact-1");
    return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "application/pdf" } });
  } });
  assert.equal(downloaded, true);
  assert.equal(appended, true);
  assert.equal(links[0].download, "BaseCamp_session-1_2026-10-02.pdf");
  assert.equal(revoked, false);
  assert.ok(runCleanup);
  runCleanup();
  assert.equal(revoked, true);
  console.log("Print preview readiness checks: PASS (visual PDF failure does not block Windows artifact print; artifact failure blocks dispatch)");
};

void main().catch((error) => { console.error(error); process.exitCode = 1; });
