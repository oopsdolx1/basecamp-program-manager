import assert from "node:assert/strict";
import { browserPrintGateway, type PrintAdapter, type PrintRequest } from "../src/features/printing/gateways/browserPrintGateway";
import { readFileSync } from "node:fs";

const source = readFileSync("src/features/printing/gateways/browserPrintGateway.ts", "utf8");
const pageSource = readFileSync("src/features/printing/pages/PrintPreviewPage.tsx", "utf8");
const adapter: PrintAdapter = browserPrintGateway;
const request = { jobId: "print-1", document: {} as PrintRequest["document"], copies: 1 };
let calls = 0;
(globalThis as { window?: { print: () => void } }).window = { print: () => { calls += 1; } };

void adapter.print(request).then((result) => {
  assert.deepEqual(result, { status: "submitted" });
  assert.equal(calls, 1);
  assert.equal((source.match(/window\.print\(\)/g) ?? []).length, 1);
  assert.equal(pageSource.includes("window.print()"), false);
  assert.equal(source.includes("firebase"), false);
  assert.equal(source.includes("navigator.userAgent"), false);
  const failingAdapter: PrintAdapter = { print: async () => ({ status: "failed", reason: "test failure" }) };
  return failingAdapter.print(request).then((failure) => assert.deepEqual(failure, { status: "failed", reason: "test failure" }));
}).then(() => {
  console.log("PrintAdapter verification passed.");
});
