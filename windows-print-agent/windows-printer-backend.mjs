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
// This is deliberately a deny-list of well-known document destinations, not a
// configured printer list.  A printer name is never persisted by the agent.
export const isVirtualPrinter = (name) => /(?:microsoft\s+(?:print\s+to\s+pdf|xps\s+document\s+writer)|onenote|alpdf|adobe\s+pdf|pdf24|cutepdf|foxit\s+pdf|bullzip|dopdf|virtual\s+printer)/iu.test(name ?? "");

export const createWindowsPrintSystem = ({ platform = process.platform, rendererPath = defaultRendererPath, run = execFile, ensureReadable = access } = {}) => ({
  async getDefaultPrinter() {
    if (platform !== "win32") return null;
    const command = "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $p = Get-CimInstance Win32_Printer | Where-Object Default -eq $true | Select-Object -First 1 -ExpandProperty Name; if ($null -ne $p) { [Console]::Out.Write($p) }";
    const { stdout } = await run("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command], { windowsHide: true, timeout: 2_000 });
    return stdout.trim() || null;
  },
  async submitPdf({ path, copies, printer }) {
    if (platform !== "win32") throw new Error("platform_not_supported");
    if (typeof printer !== "string" || !printer.trim()) throw new Error("physical_printer_unavailable");
    await ensureReadable(rendererPath); await ensureReadable(path);
    // Use the printer returned by the just-in-time Windows query.  SumatraPDF
    // runs silently; a zero native exit result is its acknowledgement that the
    // job was submitted to the Windows printing backend.
    try { await run(rendererPath, ["-print-to", printer, "-silent", "-print-settings", `${copies}x,landscape,noscale`, path], { windowsHide: true, timeout: 15_000 }); }
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
  async getStatus() {
    try {
      const defaultPrinter = await printSystem.getDefaultPrinter();
      return { printerAvailable: Boolean(defaultPrinter) && !isVirtualPrinter(defaultPrinter), defaultPrinter };
    } catch { return { printerAvailable: false, defaultPrinter: null }; }
  },
  async submit(job) {
    try {
      if (!job || !Number.isInteger(job.copies) || job.copies < 1 || typeof job.pdfPath !== "string" || !isWithin(controlledRoot, job.pdfPath) || !job.pdfPath.toLowerCase().endsWith(".pdf")) return { status: "failed", reason: "invalid_job" };
      const { defaultPrinter, printerAvailable } = await this.getStatus();
      if (!defaultPrinter || !printerAvailable) return { status: "failed", reason: "physical_printer_unavailable" };
      await printSystem.submitPdf({ path: job.pdfPath, copies: job.copies, printer: defaultPrinter });
      return { status: "submitted", printer: defaultPrinter };
    } catch (error) { return { status: "failed", reason: safeReason(error) }; }
  },
});
