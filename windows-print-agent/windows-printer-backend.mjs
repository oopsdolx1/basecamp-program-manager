import { access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative } from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const agentDirectory = dirname(fileURLToPath(import.meta.url));
const defaultRendererPath = join(agentDirectory, "bin", "SumatraPDF.exe");
const defaultControlledRoot = join(tmpdir(), "basecamp-print-agent");
const safeReason = (error) => error instanceof Error && error.message ? error.message : "print_system_failed";
const isWithin = (root, target) => { const value = relative(root, target); return value !== "" && !value.startsWith("..") && !isAbsolute(value); };

export const createWindowsPrintSystem = ({ platform = process.platform, rendererPath = process.env.BASECAMP_SUMATRA_PATH || defaultRendererPath, run = execFile, ensureReadable = access } = {}) => ({
  async getDefaultPrinter() {
    if (platform !== "win32") return null;
    const { stdout } = await run("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "$p = Get-CimInstance Win32_Printer | Where-Object Default -eq $true | Select-Object -First 1 -ExpandProperty Name; if ($null -ne $p) { [Console]::Out.Write($p) }"], { windowsHide: true, timeout: 2_000 });
    return stdout.trim() || null;
  },
  async submitPdf({ path, copies }) {
    if (platform !== "win32") throw new Error("platform_not_supported");
    await ensureReadable(rendererPath); await ensureReadable(path);
    try { await run(rendererPath, ["-print-to-default", "-silent", "-print-settings", `${copies}x,landscape,noscale`, path], { windowsHide: true, timeout: 15_000 }); }
    catch (error) {
      const code = error && typeof error === "object" ? error.code : undefined;
      if (code === 4) throw new Error("default_printer_unavailable");
      if (code === 5) throw new Error("printer_submission_failed");
      if (code === 2 || code === 3) throw new Error("invalid_pdf");
      if (code === "ETIMEDOUT") throw new Error("print_timeout");
      throw new Error("print_engine_failed");
    }
  },
});

export const createWindowsPrinterBackend = ({ printSystem = createWindowsPrintSystem(), controlledRoot = defaultControlledRoot } = {}) => ({
  async submit(job) {
    try {
      if (!job || !Number.isInteger(job.copies) || job.copies < 1 || typeof job.pdfPath !== "string" || !isWithin(controlledRoot, job.pdfPath) || !job.pdfPath.toLowerCase().endsWith(".pdf")) return { status: "failed", reason: "invalid_job" };
      if (!await printSystem.getDefaultPrinter()) return { status: "failed", reason: "default_printer_unavailable" };
      await printSystem.submitPdf({ path: job.pdfPath, copies: job.copies });
      return { status: "submitted" };
    } catch (error) { return { status: "failed", reason: safeReason(error) }; }
  },
});