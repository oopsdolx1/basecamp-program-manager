import http from "node:http";
import { createReadStream } from "node:fs";
import { randomUUID } from "node:crypto";
import { createHtmlPdfPipeline, validateHtmlArtifact } from "./html-pdf-renderer.mjs";
import { createWindowsPrinterBackend } from "./windows-printer-backend.mjs";
export const DEFAULT_PORT = 43127;
export const DEFAULT_ALLOWED_ORIGINS = ["https://basecamp-program-manager.vercel.app", "http://localhost:5173"];
const MAX_COPIES = 10;
const MAX_REQUEST_BYTES = 2_200_000;
const DEFAULT_PREVIEW_TTL_MS = 5 * 60_000;
export const createPrintAgent = ({ backend, pdfPipeline, port = DEFAULT_PORT, allowedOrigins = DEFAULT_ALLOWED_ORIGINS, previewTtlMs = DEFAULT_PREVIEW_TTL_MS } = {}) => {
  const jobs = new Map();
  const previews = new Map();
  const printerBackend = backend ?? createWindowsPrinterBackend();
  const renderer = pdfPipeline ?? createHtmlPdfPipeline();
  const send = (res, code, body, origin) => { const headers = { "content-type": "application/json; charset=utf-8" }; if (origin) headers["access-control-allow-origin"] = origin; res.writeHead(code, headers); res.end(JSON.stringify(body)); };
  const disposePreview = async (artifactId) => { const preview = previews.get(artifactId); if (!preview) return; previews.delete(artifactId); clearTimeout(preview.timer); await preview.cleanup().catch(() => undefined); };
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) return send(res, 403, { status: "failed", reason: "origin_not_allowed" });
    if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": origin ?? "", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type" }); return res.end(); }
    if (req.method === "GET" && req.url === "/health") return send(res, 200, { status: "ok" }, origin);
    const previewMatch = req.url?.match(/^\/preview\/([0-9a-f-]{36})$/iu);
    if (req.method === "GET" && previewMatch) { const preview = previews.get(previewMatch[1]); if (!preview || preview.expiresAt <= Date.now()) { if (preview) await disposePreview(previewMatch[1]); return send(res, 404, { status: "failed", reason: "preview_not_found" }, origin); } res.writeHead(200, { "content-type": "application/pdf", "cache-control": "no-store", ...(origin ? { "access-control-allow-origin": origin } : {}) }); return createReadStream(preview.path).pipe(res); }
    if (req.method === "POST" && req.url === "/preview") {
      let raw = ""; let tooLarge = false; req.setEncoding("utf8"); req.on("data", (chunk) => { if (tooLarge) return; raw += chunk; if (Buffer.byteLength(raw, "utf8") > MAX_REQUEST_BYTES) { tooLarge = true; raw = ""; } }); req.on("end", async () => { try { if (tooLarge) return send(res, 413, { status: "failed", reason: "request_too_large" }, origin); const payload = JSON.parse(raw); if (!payload || typeof payload.jobId !== "string" || !payload.jobId.trim()) return send(res, 400, { status: "failed", reason: "job_id_required" }, origin); validateHtmlArtifact(payload.artifact); const rendered = await renderer.create({ jobId: payload.jobId, artifact: payload.artifact }); const artifactId = randomUUID(); const timer = setTimeout(() => void disposePreview(artifactId), previewTtlMs); previews.set(artifactId, { path: rendered.path, cleanup: rendered.cleanup, timer, expiresAt: Date.now() + previewTtlMs, pages: rendered.metadata?.pageCount ?? 1 }); return send(res, 201, { status: "ready", artifactId, pages: rendered.metadata?.pageCount ?? 1 }, origin); } catch (error) { return send(res, 502, { status: "failed", reason: error instanceof Error ? error.message : "pdf_generation_failed" }, origin); } }); return;
    }
    if (req.method !== "POST" || req.url !== "/print") return send(res, 404, { status: "failed", reason: "not_found" }, origin);
    let raw = ""; let tooLarge = false; req.setEncoding("utf8"); req.on("data", (chunk) => { if (tooLarge) return; raw += chunk; if (Buffer.byteLength(raw, "utf8") > MAX_REQUEST_BYTES) { tooLarge = true; raw = ""; } });
    req.on("end", async () => { try {
      if (tooLarge) return send(res, 413, { status: "failed", reason: "request_too_large" }, origin);
      const payload = JSON.parse(raw);
      if (!payload || typeof payload.jobId !== "string" || !payload.jobId.trim()) return send(res, 400, { status: "failed", reason: "job_id_required" }, origin);
      const copies = payload.copies ?? 1;
      if (!Number.isInteger(copies) || copies < 1 || copies > MAX_COPIES) return send(res, 400, { status: "failed", reason: "invalid_copies" }, origin);
      const preview = typeof payload.artifactId === "string" ? previews.get(payload.artifactId) : null;
      if (payload.artifactId && !preview) return send(res, 404, { status: "failed", reason: "preview_not_found" }, origin);
      if (!preview) try { validateHtmlArtifact(payload.artifact); } catch (error) { return send(res, 400, { status: "failed", reason: error instanceof Error ? error.message : "invalid_artifact" }, origin); }
      const fingerprint = JSON.stringify({ artifact: payload.artifactId ?? payload.artifact, copies });
      const existing = jobs.get(payload.jobId);
      if (existing) return send(res, existing.fingerprint === fingerprint ? 200 : 409, existing.fingerprint === fingerprint ? existing.result : { status: "failed", jobId: payload.jobId, reason: "job_conflict" }, origin);
      let rendered = preview;
      let response;
      try {
        if (!rendered) rendered = await renderer.create({ jobId: payload.jobId, artifact: payload.artifact });
        const result = await printerBackend.submit({ jobId: payload.jobId, pdfPath: rendered.path, copies });
        response = result?.status === "submitted" ? { status: "submitted", jobId: payload.jobId } : { status: "failed", jobId: payload.jobId, reason: result?.reason ?? "backend_failed" };
      } catch (error) { response = { status: "failed", jobId: payload.jobId, reason: error instanceof Error ? error.message : "pdf_generation_failed" }; }
      finally { if (preview && response?.status === "submitted") await disposePreview(payload.artifactId); else if (!preview && rendered) await rendered.cleanup().catch(() => undefined); }
      jobs.set(payload.jobId, { fingerprint, result: response });
      return send(res, response.status === "submitted" ? 200 : 502, response, origin);
    } catch { return send(res, 400, { status: "failed", reason: "invalid_json" }, origin); } });
  });
  return { server, port, listen: () => new Promise((resolve) => server.listen(port, "127.0.0.1", resolve)), close: async () => { await Promise.all([...previews.keys()].map(disposePreview)); return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); } };
};
if (process.argv[1]?.endsWith("server.mjs")) createPrintAgent().listen().then(() => console.log(`BaseCamp Print Agent listening on 127.0.0.1:${DEFAULT_PORT}`));
