import { appendFile, mkdir, rename, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const levels = { debug: 10, info: 20, warn: 30, error: 40 };
const maxBytes = 5 * 1024 * 1024;
const backups = 3;
const clean = (value) => typeof value === "string" ? value.slice(0, 4_000) : value;

export const diagnosticCodeFor = (reason, nativeCode) => {
  if (reason === "invalid_pdf") return nativeCode === 2 || nativeCode === 3 ? `SUMATRA_EXIT_${nativeCode}` : "PDF_INVALID";
  if (reason === "default_printer_unavailable") return "SUMATRA_EXIT_4";
  if (reason === "printer_submission_failed") return "SUMATRA_EXIT_5";
  if (reason === "print_timeout") return "SUMATRA_TIMEOUT";
  if (reason === "physical_printer_unavailable") return "PRINTER_NOT_FOUND";
  if (reason === "spooler_stopped") return "SPOOLER_STOPPED";
  if (reason === "printer_query_failed") return "PRINTER_QUERY_FAILED";
  return nativeCode === 2 || nativeCode === 3 || nativeCode === 4 || nativeCode === 5 ? `SUMATRA_EXIT_${nativeCode}` : "SUMATRA_UNKNOWN_EXIT";
};

export const createDiagnosticLogger = ({ logDir = join(root, "logs"), level = process.env.BASECAMP_PRINT_LOG_LEVEL ?? "info" } = {}) => {
  const threshold = levels[String(level).toLowerCase()] ?? levels.info;
  const rotate = async (path) => {
    try {
      if ((await stat(path)).size < maxBytes) return;
      for (let index = backups - 1; index >= 1; index -= 1) {
        const from = `${path}.${index}`; const to = `${path}.${index + 1}`;
        await rename(from, to).catch(() => undefined);
      }
      await rename(path, `${path}.1`).catch(() => undefined);
    } catch { /* Logging must never interrupt printing. */ }
  };
  const write = async (levelName, scope, event, fields = {}) => {
    if ((levels[levelName] ?? levels.info) < threshold) return;
    const line = `${JSON.stringify({ timestamp: new Date().toISOString(), level: levelName.toUpperCase(), scope, event, ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, clean(value)])) })}\n`;
    const names = scope === "error" || levelName === "error" ? ["print-agent.log", "print-errors.log"] : scope === "print" || scope === "preview" ? ["print-agent.log", "print-jobs.log"] : ["print-agent.log"];
    try { await mkdir(logDir, { recursive: true }); await Promise.all(names.map(async (name) => { const path = join(logDir, name); await rotate(path); await appendFile(path, line, "utf8"); })); } catch { /* Best-effort diagnostics only. */ }
  };
  return { debug: (scope, event, fields) => write("debug", scope, event, fields), info: (scope, event, fields) => write("info", scope, event, fields), warn: (scope, event, fields) => write("warn", scope, event, fields), error: (scope, event, fields) => write("error", scope, event, fields) };
};
