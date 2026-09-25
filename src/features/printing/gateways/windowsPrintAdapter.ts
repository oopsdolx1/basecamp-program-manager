import type { PrintAdapter, PrintRequest, PrintSubmissionResult } from "./browserPrintGateway";
import { createRenderedPrintArtifactFactory, type PrintArtifactFactory } from "./printArtifactFactory";
export interface WindowsPrintAdapterOptions { endpoint?: string; timeoutMs?: number; fetchImpl?: typeof fetch; artifactFactory?: PrintArtifactFactory; }
export const createWindowsPrintAdapter = ({ endpoint = "http://127.0.0.1:43127", timeoutMs = 45_000, fetchImpl = fetch, artifactFactory = createRenderedPrintArtifactFactory() }: WindowsPrintAdapterOptions = {}): PrintAdapter => ({ print: async (request: PrintRequest): Promise<PrintSubmissionResult> => {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const artifact = request.artifactId ? undefined : await artifactFactory.create(request);
    const response = await fetchImpl(`${endpoint}/print`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobId: request.jobId, artifactId: request.artifactId, artifact, copies: request.copies }), signal: controller.signal });
    const body = await response.json() as { status?: string; reason?: string };
    if (!response.ok || body.status !== "submitted") return { status: "failed", reason: body.reason ?? `agent_http_${response.status}` };
    return { status: "submitted" };
  } catch (error) { return { status: "failed", reason: error instanceof Error ? error.message : "agent_unavailable" }; }
  finally { clearTimeout(timer); }
} });
