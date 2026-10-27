import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createWindowsPrintAdapter } from "../src/features/printing/gateways/windowsPrintAdapter";
import { submitPhysicalPrintAndPersist } from "../src/features/printing/services/physicalPrintSubmissionService";
import { createPrintArtifactPreview, fetchVisualPdfPreview, isPrintDispatchReady } from "../src/features/printing/services/printPreviewReadiness";
import type { PrintRequest } from "../src/features/printing/gateways/browserPrintGateway";

const artifact = { type: "html" as const, content: "<!doctype html><article class=\"a5-workout-document\">Workout</article>" };
const pdf = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]);

const startMockAgent = async (failPrints = 0) => {
  const calls = { preview: 0, previewPdf: 0, print: 0 };
  let remainingFailures = failPrints;
  const server = createServer((request, response) => {
    const url = request.url ?? "";
    if (request.method === "POST" && url === "/preview") {
      calls.preview += 1;
      request.resume();
      response.writeHead(201, { "content-type": "application/json" });
      response.end(JSON.stringify({ artifactId: "artifact-1", pages: 1 }));
      return;
    }
    if (request.method === "GET" && url === "/preview/artifact-1") {
      calls.previewPdf += 1;
      response.writeHead(200, { "content-type": "application/pdf" });
      response.end(pdf);
      return;
    }
    if (request.method === "POST" && url === "/print") {
      calls.print += 1;
      request.resume();
      if (remainingFailures > 0) {
        remainingFailures -= 1;
        response.writeHead(502, { "content-type": "application/json" });
        response.end(JSON.stringify({ status: "failed", reason: "physical_printer_unavailable" }));
      } else {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ status: "submitted", jobId: "mock-job", printer: "Mock Printer" }));
      }
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return {
    calls,
    endpoint: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
};

const prepare = async (endpoint: string) => {
  const preview = await createPrintArtifactPreview({ endpoint, jobId: "session-1", artifact });
  const visualPdf = await fetchVisualPdfPreview({ endpoint, artifactId: preview.artifactId });
  assert.equal(isPrintDispatchReady("windows-agent", preview, Boolean(visualPdf.byteLength)), true);
  return preview;
};

const submit = async (endpoint: string, artifactId: string, history: "saved" | "failed" = "saved") => {
  const adapter = createWindowsPrintAdapter({ endpoint });
  const request: PrintRequest = { jobId: crypto.randomUUID(), document: {} as PrintRequest["document"], copies: 1, artifactId };
  return submitPhysicalPrintAndPersist({
    submit: () => adapter.print(request),
    saveHistory: async () => history === "saved" ? { id: "history-1" } : null,
    markSessionPrinted: async () => undefined,
  });
};

const main = async () => {
  const page = await import("node:fs/promises").then(({ readFile }) => readFile("src/features/printing/pages/PrintPreviewPage.tsx", "utf8"));
  assert.match(page, /const retryAutoPrint = \(\) =>/u);
  assert.match(page, /autoPrintStarted\.current = false;/u);
  assert.match(page, /physicalPrintInFlight\.current = false;/u);
  assert.match(page, /<Button onClick=\{retryAutoPrint\}>다시 시도<\/Button>/u);

  const normal = await startMockAgent();
  try {
    const preview = await prepare(normal.endpoint);
    const result = await submit(normal.endpoint, preview.artifactId);
    assert.deepEqual(result, { physical: "submitted", history: "saved", record: { id: "history-1" } });
    assert.deepEqual(normal.calls, { preview: 1, previewPdf: 1, print: 1 });
  } finally { await normal.close(); }

  const retry = await startMockAgent(1);
  try {
    const preview = await prepare(retry.endpoint);
    assert.deepEqual(await submit(retry.endpoint, preview.artifactId), { physical: "failed", reason: "physical_printer_unavailable" });
    // The page retry intentionally reuses this validated artifact and issues one new physical request.
    assert.deepEqual(await submit(retry.endpoint, preview.artifactId), { physical: "submitted", history: "saved", record: { id: "history-1" } });
    assert.deepEqual(retry.calls, { preview: 1, previewPdf: 1, print: 2 });
  } finally { await retry.close(); }

  const reprint = await startMockAgent();
  try {
    const preview = await prepare(reprint.endpoint);
    assert.equal((await submit(reprint.endpoint, preview.artifactId)).physical, "submitted");
    assert.deepEqual(reprint.calls, { preview: 1, previewPdf: 1, print: 1 });
  } finally { await reprint.close(); }

  const historyFailure = await startMockAgent();
  try {
    const preview = await prepare(historyFailure.endpoint);
    assert.deepEqual(await submit(historyFailure.endpoint, preview.artifactId, "failed"), { physical: "submitted", history: "failed" });
    assert.equal(historyFailure.calls.print, 1, "history persistence failure must not duplicate the physical print");
  } finally { await historyFailure.close(); }
  console.log("Print autoPrint mock-agent flow checks: PASS");
};

void main().catch((error) => { console.error(error); process.exitCode = 1; });
