import type { HtmlPrintArtifact } from "../gateways/printArtifactFactory";
import type { PrintRuntime } from "../gateways/printRuntimeResolver";

export interface PrintArtifactPreview {
  artifactId: string;
  pages: number;
}

interface PreviewRequestOptions {
  endpoint: string;
  jobId: string;
  artifact: HtmlPrintArtifact;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface PdfPreviewRequestOptions {
  endpoint: string;
  artifactId: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

type ObjectUrlApi = Pick<typeof URL, "createObjectURL" | "revokeObjectURL">;

export const downloadPdfArtifact = async ({ endpoint, artifactId, filename, fetchImpl = fetch, documentImpl = document, objectUrlApi = URL, setTimeoutImpl = globalThis.setTimeout }: PdfPreviewRequestOptions & { filename: string; documentImpl?: Document; objectUrlApi?: ObjectUrlApi; setTimeoutImpl?: typeof setTimeout }): Promise<void> => {
  const bytes = await fetchVisualPdfPreview({ endpoint, artifactId, fetchImpl });
  const buffer = new ArrayBuffer(bytes.byteLength); new Uint8Array(buffer).set(bytes);
  const url = objectUrlApi.createObjectURL(new Blob([buffer], { type: "application/pdf" }));
  const link = documentImpl.createElement("a");
  link.href = url;
  link.download = filename;
  documentImpl.body.appendChild(link);
  link.click();
  link.remove();
  // Some browsers start the download after the click handler returns.
  setTimeoutImpl(() => objectUrlApi.revokeObjectURL(url), 1_000);
};

export const PRINT_PREVIEW_REQUEST_TIMEOUT_MS = 45_000;

const requestWithTimeout = async (input: RequestInfo | URL, init: RequestInit, fetchImpl: typeof fetch, timeoutMs: number): Promise<Response> => {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timer);
  }
};

const messageFor = (error: unknown, fallback: string): string => error instanceof Error ? error.message : fallback;

export const createPrintArtifactPreview = async ({ endpoint, jobId, artifact, fetchImpl = fetch, timeoutMs = PRINT_PREVIEW_REQUEST_TIMEOUT_MS }: PreviewRequestOptions): Promise<PrintArtifactPreview> => {
  try {
    const response = await requestWithTimeout(`${endpoint}/preview`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobId, artifact }) }, fetchImpl, timeoutMs);
    const body = await response.json() as { artifactId?: string; pages?: number; reason?: string };
    if (!response.ok || !body.artifactId) throw new Error(body.reason ?? "preview_unavailable");
    return { artifactId: body.artifactId, pages: body.pages ?? 1 };
  } catch (error) {
    throw new Error(messageFor(error, "print_artifact_creation_failed"));
  }
};

export const fetchVisualPdfPreview = async ({ endpoint, artifactId, fetchImpl = fetch, timeoutMs = PRINT_PREVIEW_REQUEST_TIMEOUT_MS }: PdfPreviewRequestOptions): Promise<Uint8Array> => {
  try {
    const response = await requestWithTimeout(`${endpoint}/preview/${artifactId}`, {}, fetchImpl, timeoutMs);
    if (!response.ok) throw new Error("artifact_fetch_failed");
    if (!(response.headers.get("content-type") ?? "").includes("application/pdf")) throw new Error("artifact_not_pdf");
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength === 0) throw new Error("artifact_empty");
    return new Uint8Array(bytes);
  } catch (error) {
    throw new Error(messageFor(error, "visual_pdf_preview_failed"));
  }
};

export const isPrintDispatchReady = (runtime: PrintRuntime, artifact: PrintArtifactPreview | null, visualPdfReady: boolean): boolean =>
  runtime === "windows-agent" ? Boolean(artifact) : visualPdfReady;
