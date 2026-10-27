import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createArtifactPrintAdapter, createConfiguredPrintAdapter } from "../src/features/printing/gateways/configuredPrintAdapter";
import { resolvePrintRuntime } from "../src/features/printing/gateways/printRuntimeResolver";
import { createWindowsPrintAdapter } from "../src/features/printing/gateways/windowsPrintAdapter";
import { browserPrintGateway, type PrintRequest } from "../src/features/printing/gateways/browserPrintGateway";

const endpoint = "http://127.0.0.1:43127";
const request = { jobId: "production-runtime-job", document: {} as PrintRequest["document"], copies: 1, artifactId: "artifact-1" };
const storage = (value: string | null = null): Pick<Storage, "getItem" | "setItem"> => ({ getItem: () => value, setItem: (_key, next) => { value = next; } });

const main = async (): Promise<void> => {
  const page = readFileSync("src/features/printing/pages/PrintPreviewPage.tsx", "utf8");
  const configured = readFileSync("src/features/printing/gateways/configuredPrintAdapter.ts", "utf8");
  const windows = readFileSync("src/features/printing/gateways/windowsPrintAdapter.ts", "utf8");
  const bundleName = readdirSync("dist/assets").find((name) => /^index-.*\.js$/u.test(name));
  assert.ok(bundleName, "run npm run build before this verification");
  const bundle = readFileSync(join("dist/assets", bundleName), "utf8");

  // Vite replaces an absent VITE_PRINT_RUNTIME with undefined. Runtime resolution
  // is deliberately client-scoped: URL, then localStorage, then the build value.
  assert.equal(resolvePrintRuntime({ storage: storage() }), "browser");
  assert.equal(resolvePrintRuntime({ storage: storage(), environmentRuntime: "windows-agent" }), "windows-agent");
  assert.equal(resolvePrintRuntime({ search: "?printRuntime=windows-agent", storage: storage(), environmentRuntime: "browser" }), "windows-agent");
  assert.equal(resolvePrintRuntime({ storage: storage("windows-agent"), environmentRuntime: "browser" }), "windows-agent");
  assert.equal(createConfiguredPrintAdapter("browser").print, createConfiguredPrintAdapter("browser").print);

  let postedUrl = "";
  // Browser runtime still routes a prepared canonical artifact to Windows Agent;
  // it never falls back to window.print().
  assert.notEqual(createArtifactPrintAdapter("browser", true), browserPrintGateway);
  const injected = createWindowsPrintAdapter({ fetchImpl: async (input) => {
    postedUrl = String(input);
    return new Response(JSON.stringify({ status: "submitted", jobId: request.jobId }), { status: 200 });
  } });
  assert.equal((await injected.print(request)).status, "submitted");
  assert.equal(postedUrl, `${endpoint}/print`);

  assert.match(page, /VITE_PRINT_AGENT_ENDPOINT\s*\?\?\s*"http:\/\/127\.0\.0\.1:43127"/u);
  assert.match(page, /createPrintArtifactPreview\(\{ endpoint: printAgentEndpoint/u);
  assert.match(page, /fetchVisualPdfPreview\(\{ endpoint: printAgentEndpoint/u);
  assert.match(windows, /endpoint = "http:\/\/127\.0\.0\.1:43127"/u);
  assert.equal(configured.includes("VITE_PRINT_AGENT_ENDPOINT"), false, "configured /print adapter currently has no endpoint override wiring");
  assert.match(bundle, /127\.0\.0\.1:43127/u);
  assert.match(bundle, /\/preview/u);
  assert.match(bundle, /\/print/u);
  assert.equal(bundle.includes("VITE_PRINT_AGENT_ENDPOINT"), false, "the current production build used its fallback endpoint");

  console.log(JSON.stringify({
    buildEndpoint: endpoint,
    defaultRuntime: "browser",
    artifactAdapter: "windows-agent",
    previewAndPrintFallbackMatch: true,
    endpointOverrideWiredToPrint: false,
    runtimeDependsOnHostnameOrProtocol: false,
  }, null, 2));
};

void main().catch((error) => { console.error(error); process.exitCode = 1; });
