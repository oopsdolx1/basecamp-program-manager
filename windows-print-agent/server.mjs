import http from "node:http";
export const DEFAULT_PORT = 43127;
export const DEFAULT_ALLOWED_ORIGINS = ["https://basecamp-program-manager.vercel.app", "http://localhost:5173"];
const MAX_COPIES = 10;
export const createPrintAgent = ({ backend, port = DEFAULT_PORT, allowedOrigins = DEFAULT_ALLOWED_ORIGINS } = {}) => {
  const jobs = new Map();
  const printerBackend = backend ?? { submit: async (request) => ({ status: "submitted", jobId: request.jobId }) };
  const send = (res, code, body) => { res.writeHead(code, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify(body)); };
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) return send(res, 403, { status: "failed", reason: "origin_not_allowed" });
    if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": origin ?? "", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type" }); return res.end(); }
    if (req.method === "GET" && req.url === "/health") return send(res, 200, { status: "ok" });
    if (req.method !== "POST" || req.url !== "/print") return send(res, 404, { status: "failed", reason: "not_found" });
    let raw = ""; req.setEncoding("utf8"); req.on("data", (chunk) => { raw += chunk; });
    req.on("end", async () => { try {
      const payload = JSON.parse(raw);
      if (!payload || typeof payload.jobId !== "string" || !payload.jobId.trim()) return send(res, 400, { status: "failed", reason: "job_id_required" });
      if (!payload.document || typeof payload.document !== "object") return send(res, 400, { status: "failed", reason: "document_required" });
      const copies = payload.copies ?? 1;
      if (!Number.isInteger(copies) || copies < 1 || copies > MAX_COPIES) return send(res, 400, { status: "failed", reason: "invalid_copies" });
      const fingerprint = JSON.stringify({ document: payload.document, copies });
      const existing = jobs.get(payload.jobId);
      if (existing) return send(res, existing.fingerprint === fingerprint ? 200 : 409, existing.result);
      const result = await printerBackend.submit({ jobId: payload.jobId, document: payload.document, copies });
      const response = result?.status === "submitted" ? { status: "submitted", jobId: payload.jobId } : { status: "failed", jobId: payload.jobId, reason: result?.reason ?? "backend_failed" };
      jobs.set(payload.jobId, { fingerprint, result: response }); return send(res, response.status === "submitted" ? 200 : 502, response);
    } catch { return send(res, 400, { status: "failed", reason: "invalid_json" }); } });
  });
  return { server, port, listen: () => new Promise((resolve) => server.listen(port, "127.0.0.1", resolve)), close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
};
if (process.argv[1]?.endsWith("server.mjs")) createPrintAgent().listen().then(() => console.log(`BaseCamp Print Agent listening on 127.0.0.1:${DEFAULT_PORT}`));
