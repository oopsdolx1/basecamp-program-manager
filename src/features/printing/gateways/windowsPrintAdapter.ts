import type { PrintAdapter, PrintRequest, PrintSubmissionResult } from "./browserPrintGateway";
export interface WindowsPrintAdapterOptions { endpoint?: string; timeoutMs?: number; fetchImpl?: typeof fetch; }
export const createWindowsPrintAdapter = ({ endpoint = "http://127.0.0.1:43127", timeoutMs = 3000, fetchImpl = fetch }: WindowsPrintAdapterOptions = {}): PrintAdapter => ({ print: async (request: PrintRequest): Promise<PrintSubmissionResult> => {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { const response = await fetchImpl(`${endpoint}/print`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request), signal: controller.signal }); const body = await response.json() as { status?: string; reason?: string }; if (!response.ok || body.status !== "submitted") return { status: "failed", reason: body.reason ?? `agent_http_${response.status}` }; return { status: "submitted" }; }
  catch (error) { return { status: "failed", reason: error instanceof Error ? error.message : "agent_unavailable" }; } finally { clearTimeout(timer); }
} });
