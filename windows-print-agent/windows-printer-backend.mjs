import { access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative } from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createDiagnosticLogger, diagnosticCodeFor } from "./diagnostics.mjs";

const execFile = promisify(execFileCallback);
const agentDirectory = dirname(fileURLToPath(import.meta.url));
const defaultRendererPath = join(agentDirectory, "bin", "SumatraPDF.exe");
const defaultControlledRoot = join(tmpdir(), "basecamp-print-agent");
const defaultPrinterLookupTimeoutMs = 5_000;
const safeReason = (error) => error instanceof Error && error.message ? error.message : "print_system_failed";
const failure = (reason, details = {}) => Object.assign(new Error(reason), { details, diagnosticCode: diagnosticCodeFor(reason, details.nativeCode) });
const isWithin = (root, target) => { const value = relative(root, target); return value !== "" && !value.startsWith("..") && !isAbsolute(value); };
// This is deliberately a deny-list of well-known document destinations, not a
// configured printer list.  A printer name is never persisted by the agent.
export const isVirtualPrinter = (name) => /(?:microsoft\s+(?:print\s+to\s+pdf|xps\s+document\s+writer)|onenote|alpdf|adobe\s+pdf|pdf24|cutepdf|foxit\s+pdf|bullzip|dopdf|virtual\s+printer)/iu.test(name ?? "");

export const createWindowsPrintSystem = ({ platform = process.platform, rendererPath = defaultRendererPath, run = execFile, ensureReadable = access, logger = createDiagnosticLogger() } = {}) => ({
  async getDefaultPrinter() {
    if (platform !== "win32") return null;
    const command = "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $p = Get-CimInstance Win32_Printer | Where-Object Default -eq $true | Select-Object -First 1 -ExpandProperty Name; if ($null -ne $p) { [Console]::Out.Write($p) }";
    const { stdout } = await run("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command], { windowsHide: true, timeout: defaultPrinterLookupTimeoutMs });
    return stdout.trim() || null;
  },
  async getPrinterMetadata(printer) {
    if (platform !== "win32" || !printer) return { printerStatus: null, driverName: null, portName: null, workOffline: null };
    const startedAt = Date.now();
    try {
      const command = `[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); Get-CimInstance Win32_Printer | Where-Object Name -eq '${String(printer).replace(/'/gu, "''")}' | Select-Object -First 1 Name,DriverName,PortName,PrinterStatus,WorkOffline | ConvertTo-Json -Compress`;
      const { stdout } = await run("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command], { windowsHide: true, timeout: defaultPrinterLookupTimeoutMs });
      const parsed = JSON.parse(stdout || "{}"); const metadata = { printerStatus: parsed.PrinterStatus ?? null, driverName: parsed.DriverName ?? null, portName: parsed.PortName ?? null, workOffline: parsed.WorkOffline ?? null };
      await logger.debug("print", "printer_metadata", { printer, durationMs: Date.now() - startedAt, ...metadata }); return metadata;
    } catch (error) { await logger.warn("print", "printer_metadata_failed", { printer, durationMs: Date.now() - startedAt, message: error instanceof Error ? error.message : String(error) }); return { printerStatus: null, driverName: null, portName: null, workOffline: null }; }
  },
  async getSpoolerStatus() {
    if (platform !== "win32") return null;
    try { const { stdout } = await run("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "Get-Service Spooler | Select-Object -ExpandProperty Status"], { windowsHide: true, timeout: defaultPrinterLookupTimeoutMs }); return stdout.trim() || null; }
    catch (error) { await logger.warn("print", "spooler_query_failed", { message: error instanceof Error ? error.message : String(error) }); return "Unknown"; }
  },
  async submitPdf({ path, copies, printer }) {
    if (platform !== "win32") throw new Error("platform_not_supported");
    if (typeof printer !== "string" || !printer.trim()) throw new Error("physical_printer_unavailable");
    await ensureReadable(rendererPath); await ensureReadable(path);
    // Use the printer returned by the just-in-time Windows query.  SumatraPDF
    // runs silently; a zero native exit result is its acknowledgement that the
    // job was submitted to the Windows printing backend.
    const startedAt = Date.now(); const settings = `${copies}x,fit,paper=A5`;
    await logger.info("print", "sumatra_invoke", { rendererPath, printer, copies, pdfPath: path, printSettings: settings });
    try { const result = await run(rendererPath, ["-print-to", printer, "-silent", "-print-settings", settings, path], { windowsHide: true, timeout: 15_000 }); await logger.info("print", "sumatra_submitted", { rendererPath, printer, copies, pdfPath: path, durationMs: Date.now() - startedAt, stdout: result?.stdout ?? "", stderr: result?.stderr ?? "" }); }
    catch (error) {
      const code = error && typeof error === "object" ? error.code : undefined;
      const reason = code === 4 ? "default_printer_unavailable" : code === 5 ? "printer_submission_failed" : code === 2 || code === 3 ? "invalid_pdf" : code === "ETIMEDOUT" ? "print_timeout" : "print_engine_failed";
      const details = { rendererPath, printer, copies, pdfPath: path, printSettings: settings, nativeCode: code ?? null, nativeSignal: error?.signal ?? null, processKilled: Boolean(error?.killed), command: error?.cmd ?? null, stdout: error?.stdout ?? "", stderr: error?.stderr ?? "", message: error instanceof Error ? error.message : String(error), timeoutMs: code === "ETIMEDOUT" ? 15_000 : null, durationMs: Date.now() - startedAt };
      await logger.error("error", "sumatra_failed", { reason, diagnosticCode: diagnosticCodeFor(reason, code), ...details });
      throw failure(reason, details);
    }
  },
});

export const createWindowsPrinterBackend = ({ printSystem = createWindowsPrintSystem(), controlledRoot = defaultControlledRoot, logger = createDiagnosticLogger() } = {}) => ({
  async getStatus() {
    try {
      const startedAt = Date.now(); const defaultPrinter = await printSystem.getDefaultPrinter(); const metadata = await printSystem.getPrinterMetadata?.(defaultPrinter) ?? {}; const spoolerStatus = await printSystem.getSpoolerStatus?.() ?? null;
      const status = { printerAvailable: Boolean(defaultPrinter) && !isVirtualPrinter(defaultPrinter), defaultPrinter, ...(spoolerStatus === null ? {} : { spoolerStatus }), ...metadata };
      await logger.info("print", "printer_lookup", { durationMs: Date.now() - startedAt, ...status }); return status;
    } catch (error) { await logger.error("error", "printer_lookup_failed", { message: error instanceof Error ? error.message : String(error) }); return { printerAvailable: false, defaultPrinter: null, spoolerStatus: null, driverName: null, portName: null, printerStatus: null }; }
  },
  async submit(job) {
    try {
      if (!job || !Number.isInteger(job.copies) || job.copies < 1 || typeof job.pdfPath !== "string" || !isWithin(controlledRoot, job.pdfPath) || !job.pdfPath.toLowerCase().endsWith(".pdf")) return { status: "failed", reason: "invalid_job" };
      const { defaultPrinter, printerAvailable, spoolerStatus } = await this.getStatus();
      if (!defaultPrinter || !printerAvailable) return { status: "failed", reason: "physical_printer_unavailable", diagnosticCode: "PRINTER_NOT_FOUND" };
      if (String(spoolerStatus).toLowerCase() === "stopped") return { status: "failed", reason: "spooler_stopped", diagnosticCode: "SPOOLER_STOPPED" };
      await printSystem.submitPdf({ path: job.pdfPath, copies: job.copies, printer: defaultPrinter });
      return { status: "submitted", printer: defaultPrinter };
    } catch (error) { const reason = safeReason(error); return { status: "failed", reason, diagnosticCode: error?.diagnosticCode ?? diagnosticCodeFor(reason, error?.details?.nativeCode) }; }
  },
});
