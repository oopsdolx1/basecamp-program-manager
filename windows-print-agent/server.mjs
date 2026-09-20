import http from "node:http";
import { createHtmlPdfPipeline, validateHtmlArtifact } from "./html-pdf-renderer.mjs";
import { createWindowsPrinterBackend } from "./windows-printer-backend.mjs";
export const DEFAULT_PORT = 43127;
export const DEFAULT_ALLOWED_ORIGINS = ["https://basecamp-program-manager.vercel.app", "http://localhost:5173"];
const MAX_COPIES = 10;
const MAX_REQUEST_BYTES = 2_200_000;
export const createPrintAgent = ({ backend, pdfPipeline, port = DEFAULT_PORT, allowedOrigins = DEFAULT_ALLOWED_ORIGINS } = {}) => {
  const jobs = new Map();
  const printerBackend = backend ?? createWindowsPrinterBackend();
  const renderer = pdfPipeline ?? createHtmlPdfPipeline();
  const send = (res, code, body, origin) => { const headers = { "content-type": "application/json; charset=utf-8" }; if (origin) headers["access-control-allow-origin"] = origin; res.writeHead(code, headers); res.end(JSON.stringify(body)); };
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) return send(res, 403, { status: "failed", reason: "origin_not_allowed" });
    if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": origin ?? "", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type" }); return res.end(); }
    if (req.method === "GET" && req.url === "/health") return send(res, 200, { status: "ok" }, origin);
    if (req.method !== "POST" || req.url !== "/print") return send(res, 404, { status: "failed", reason: "not_found" }, origin);
    let raw = ""; let tooLarge = false; req.setEncoding("utf8"); req.on("data", (chunk) => { if (tooLarge) return; raw += chunk; if (Buffer.byteLength(raw, "utf8") > MAX_REQUEST_BYTES) { tooLarge = true; raw = ""; } });
    req.on("end", async () => { try {
      if (tooLarge) return send(res, 413, { status: "failed", reason: "request_too_large" }, origin);
      const payload = JSON.parse(raw);
      if (!payload || typeof payload.jobId !== "string" || !payload.jobId.trim()) return send(res, 400, { status: "failed", reason: "job_id_required" }, origin);
      const copies = payload.copies ?? 1;
      if (!Number.isInteger(copies) || copies < 1 || copies > MAX_COPIES) return send(res, 400, { status: "failed", reason: "invalid_copies" }, origin);
      try { validateHtmlArtifact(payload.artifact); } catch (error) { return send(res, 400, { status: "failed", reason: error instanceof Error ? error.message : "invalid_artifact" }, origin); }
      const fingerprint = JSON.stringify({ artifact: payload.artifact, copies });
      const existing = jobs.get(payload.jobId);
      if (existing) return send(res, existing.fingerprint === fingerprint ? 200 : 409, existing.fingerprint === fingerprint ? existing.result : { status: "failed", jobId: payload.jobId, reason: "job_conflict" }, origin);
      let rendered;
      let response;
      try {
        rendered = await renderer.create({ jobId: payload.jobId, artifact: payload.artifact });
        const result = await printerBackend.submit({ jobId: payload.jobId, pdfPath: rendered.path, copies });
        response = result?.status === "submitted" ? { status: "submitted", jobId: payload.jobId } : { status: "failed", jobId: payload.jobId, reason: result?.reason ?? "backend_failed" };
      } catch (error) { response = { status: "failed", jobId: payload.jobId, reason: error instanceof Error ? error.message : "pdf_generation_failed" }; }
      finally { if (rendered) await rendered.cleanup().catch(() => undefined); }
      jobs.set(payload.jobId, { fingerprint, result: response });
      return send(res, response.status === "submitted" ? 200 : 502, response, origin);
    } catch { return send(res, 400, { status: "failed", reason: "invalid_json" }, origin); } });
  });
  return { server, port, listen: () => new Promise((resolve) => server.listen(port, "127.0.0.1", resolve)), close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
};
if (process.argv[1]?.endsWith("server.mjs")) createPrintAgent().listen().then(() => console.log(`BaseCamp Print Agent listening on 127.0.0.1:${DEFAULT_PORT}`));