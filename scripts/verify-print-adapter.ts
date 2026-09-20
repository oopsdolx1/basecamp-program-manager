import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { browserPrintGateway, type PrintAdapter, type PrintRequest } from "../src/features/printing/gateways/browserPrintGateway";
import { createConfiguredPrintAdapter } from "../src/features/printing/gateways/configuredPrintAdapter";
import { createWindowsPrintAdapter } from "../src/features/printing/gateways/windowsPrintAdapter";

const source = readFileSync("src/features/printing/gateways/browserPrintGateway.ts", "utf8");
const runtimeSource = readFileSync("src/features/printing/gateways/configuredPrintAdapter.ts", "utf8");
const pageSource = readFileSync("src/features/printing/pages/PrintPreviewPage.tsx", "utf8");
const request = { jobId: "print-1", document: {} as PrintRequest["document"], copies: 1 };
const main = async (): Promise<void> => {
  let browserCalls = 0; (globalThis as { window?: { print: () => void } }).window = { print: () => { browserCalls += 1; } };
  assert.deepEqual(await browserPrintGateway.print(request), { status: "submitted" }); assert.equal(browserCalls, 1);
  assert.equal(createConfiguredPrintAdapter("browser"), browserPrintGateway);
  assert.throws(() => createConfiguredPrintAdapter("invalid"), /Unsupported VITE_PRINT_RUNTIME/u);
  let posted; let fetchCalls = 0;
  const windows = createWindowsPrintAdapter({ artifactFactory: { create: async () => ({ type: "html", content: "<!doctype html>controlled" }) }, fetchImpl: async (_input, init) => { fetchCalls += 1; posted = JSON.parse(String(init?.body)); return new Response(JSON.stringify({ status: "submitted" }), { status: 200 }); } });
  assert.deepEqual(await windows.print(request), { status: "submitted" }); assert.deepEqual(posted, { jobId: "print-1", artifact: { type: "html", content: "<!doctype html>controlled" }, copies: 1 }); assert.equal("document" in posted, false);
  const failed = createWindowsPrintAdapter({ artifactFactory: { create: async () => { throw new Error("artifact_failed"); } }, fetchImpl: async () => { fetchCalls += 1; return new Response(); } });
  assert.deepEqual(await failed.print(request), { status: "failed", reason: "artifact_failed" }); assert.equal(fetchCalls, 1); assert.equal(browserCalls, 1);
  assert.equal((source.match(/window\.print\(\)/gu) ?? []).length, 1); assert.equal(pageSource.includes("window.print()"), false); assert.equal(pageSource.includes("configuredPrintAdapter.print"), true); assert.equal(runtimeSource.includes("navigator.userAgent"), false);
  const failingAdapter: PrintAdapter = { print: async () => ({ status: "failed", reason: "test failure" }) }; assert.deepEqual(await failingAdapter.print(request), { status: "failed", reason: "test failure" });
  console.log("PrintAdapter verification passed.");
};
void main().catch((error) => { console.error(error); process.exitCode = 1; });