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
const stuckPrintingAgeMs = 2 * 60_000;
const safeReason = (error) => error instanceof Error && error.message ? error.message : "print_system_failed";
const failure = (reason, details = {}) => Object.assign(new Error(reason), { details, diagnosticCode: diagnosticCodeFor(reason, details.nativeCode) });
const isWithin = (root, target) => { const value = relative(root, target); return value !== "" && !value.startsWith("..") && !isAbsolute(value); };
const powerShellLiteral = (value) => String(value).replace(/'/gu, "''");
const isPrinterError = (status, workOffline) => Boolean(workOffline) || /(?:error|offline|not\s*available)/iu.test(String(status ?? ""));
const isPrinterOffline = (status, workOffline) => Boolean(workOffline) || /(?:offline|not\s*available)/iu.test(String(status ?? ""));
const jobIsStuck = (job, now = Date.now()) => {
  const status = String(job?.status ?? "");
  if (/error/iu.test(status)) return true;
  if (!/printing/iu.test(status)) return false;
  const submittedAt = Date.parse(job?.submittedAt ?? "");
  return Number.isFinite(submittedAt) && now - submittedAt >= stuckPrintingAgeMs;
};
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
      const command = `[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); $name='${powerShellLiteral(printer)}'; $cim=Get-CimInstance Win32_Printer | Where-Object Name -eq $name | Select-Object -First 1 Name,DriverName,PortName,PrinterStatus,WorkOffline; $printerState=Get-Printer -Name $name -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty PrinterStatus; [pscustomobject]@{ Name=$cim.Name; DriverName=$cim.DriverName; PortName=$cim.PortName; PrinterStatus=if ($null -ne $printerState) { $printerState.ToString() } else { $cim.PrinterStatus }; WorkOffline=$cim.WorkOffline } | ConvertTo-Json -Compress`;
      const { stdout } = await run("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command], { windowsHide: true, timeout: defaultPrinterLookupTimeoutMs });
      const parsed = JSON.parse(stdout || "{}"); const metadata = { printerStatus: parsed.PrinterStatus ?? null, driverName: parsed.DriverName ?? null, portName: parsed.PortName ?? null, workOffline: parsed.WorkOffline ?? null };
      await logger.debug("print", "printer_metadata", { printer, durationMs: Date.now() - startedAt, ...metadata }); return metadata;
    } catch (error) { await logger.warn("print", "printer_metadata_failed", { printer, durationMs: Date.now() - startedAt, message: error instanceof Error ? error.message : String(error) }); return { printerStatus: null, driverName: null, portName: null, workOffline: null }; }
  },
  async getPrinterByName(printer) {
    if (platform !== "win32" || !printer) return { exists: false, printerStatus: null, driverName: null, portName: null, workOffline: null };
    const startedAt = Date.now();
    try {
      const command = `[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); $name='${powerShellLiteral(printer)}'; $cim=Get-CimInstance Win32_Printer | Where-Object Name -eq $name | Select-Object -First 1 Name,DriverName,PortName,PrinterStatus,WorkOffline; $printerState=Get-Printer -Name $name -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty PrinterStatus; [pscustomobject]@{ Exists=($null -ne $cim); DriverName=$cim.DriverName; PortName=$cim.PortName; PrinterStatus=if ($null -ne $printerState) { $printerState.ToString() } else { $cim.PrinterStatus }; WorkOffline=$cim.WorkOffline } | ConvertTo-Json -Compress`;
      const { stdout } = await run("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command], { windowsHide: true, timeout: defaultPrinterLookupTimeoutMs });
      const parsed = JSON.parse(stdout || "{}"); const state = { exists: parsed.Exists === true, printerStatus: parsed.PrinterStatus ?? null, driverName: parsed.DriverName ?? null, portName: parsed.PortName ?? null, workOffline: parsed.WorkOffline ?? null };
      await logger.debug("print", "configured_printer_lookup", { printer, durationMs: Date.now() - startedAt, ...state }); return state;
    } catch (error) { await logger.warn("print", "configured_printer_lookup_failed", { printer, durationMs: Date.now() - startedAt, message: error instanceof Error ? error.message : String(error) }); return { exists: false, printerStatus: null, driverName: null, portName: null, workOffline: null }; }
  },
  async getSpoolerStatus() {
    if (platform !== "win32") return null;
    try { const { stdout } = await run("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "Get-Service Spooler | Select-Object -ExpandProperty Status"], { windowsHide: true, timeout: defaultPrinterLookupTimeoutMs }); return stdout.trim() || null; }
    catch (error) { await logger.warn("print", "spooler_query_failed", { message: error instanceof Error ? error.message : String(error) }); return "Unknown"; }
  },
  async getPrintJobs(printer) {
    if (platform !== "win32" || !printer) return [];
    try {
      const command = `[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); Get-PrintJob -PrinterName '${powerShellLiteral(printer)}' -ErrorAction Stop | Select-Object @{Name='id';Expression={$_.Id}},@{Name='status';Expression={$_.JobStatus.ToString()}},@{Name='submittedAt';Expression={if ($_.SubmittedTime) { $_.SubmittedTime.ToUniversalTime().ToString('o') } else { $null }}},@{Name='documentName';Expression={$_.DocumentName}} | ConvertTo-Json -Compress`;
      const { stdout } = await run("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command], { windowsHide: true, timeout: defaultPrinterLookupTimeoutMs });
      const parsed = JSON.parse(stdout || "[]"); return Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    } catch (error) { await logger.warn("print", "print_jobs_query_failed", { printer, message: error instanceof Error ? error.message : String(error) }); throw failure("printer_queue_recovery_required"); }
  },
  async removePrintJobs(printer, jobs) {
    if (platform !== "win32" || !printer || !jobs.length) return { removed: [] };
    const ids = jobs.map((job) => Number(job.id)).filter(Number.isInteger);
    if (!ids.length) return { removed: [] };
    try {
      const command = `$ErrorActionPreference='Stop'; $name='${powerShellLiteral(printer)}'; @(${ids.join(",")}) | ForEach-Object { Remove-PrintJob -PrinterName $name -ID $_ -ErrorAction Stop }`;
      await run("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command], { windowsHide: true, timeout: defaultPrinterLookupTimeoutMs });
      await logger.info("print", "recoverable_print_jobs_removed", { printer, jobIds: ids }); return { removed: ids };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const reason = /access\s+is\s+denied|access denied|unauthorized/iu.test(message) ? "printer_queue_access_denied" : "printer_queue_recovery_required";
      await logger.warn("print", "recoverable_print_jobs_remove_failed", { printer, jobIds: ids, reason, message }); throw failure(reason);
    }
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

export const createWindowsPrinterBackend = ({ printSystem = createWindowsPrintSystem(), getConfiguredPrinterName = async () => null, getConfiguredPrinterConfig, controlledRoot = defaultControlledRoot, logger = createDiagnosticLogger() } = {}) => ({
  async getStatus() {
    try {
      const startedAt = Date.now();
      const config = getConfiguredPrinterConfig ? await getConfiguredPrinterConfig() : { status: "ok", printerName: await getConfiguredPrinterName() };
      const configuredPrinter = config?.printerName;
      const configStatus = config?.status ?? "config_invalid";
      let defaultPrinter = null;
      // Retained as health-only compatibility data. It is never used for printer
      // selection and a failed lookup must not block the configured printer.
      try { defaultPrinter = await printSystem.getDefaultPrinter?.() ?? null; } catch { /* health compatibility is best-effort */ }
      const configured = typeof configuredPrinter === "string" && configuredPrinter.trim() ? configuredPrinter.trim() : null;
      const state = configured ? (printSystem.getPrinterByName ? await printSystem.getPrinterByName(configured) : { exists: true, ...await printSystem.getPrinterMetadata?.(configured) }) : { exists: false };
      const spoolerStatus = await printSystem.getSpoolerStatus?.() ?? null;
      const virtual = Boolean(configured) && isVirtualPrinter(configured);
      const unavailable = isPrinterError(state.printerStatus, state.workOffline);
      const status = { configStatus, printerConfigured: Boolean(configured), configuredPrinter: configured, printerAvailable: Boolean(configured) && state.exists !== false && !virtual && !unavailable, defaultPrinter, ...(spoolerStatus === null ? {} : { spoolerStatus }), ...state };
      await logger.info("print", "printer_lookup", { durationMs: Date.now() - startedAt, ...status }); return status;
    } catch (error) { await logger.error("error", "printer_lookup_failed", { message: error instanceof Error ? error.message : String(error) }); return { configStatus: "config_invalid", printerConfigured: false, configuredPrinter: null, printerAvailable: false, defaultPrinter: null, spoolerStatus: null, driverName: null, portName: null, printerStatus: null }; }
  },
  async preparePrinterForSubmission() {
    const status = await this.getStatus();
    if (status.configStatus === "config_missing") throw failure("config_missing");
    if (status.configStatus === "config_invalid") throw failure("config_invalid");
    if (!status.printerConfigured) throw failure("printer_not_configured");
    if (isVirtualPrinter(status.configuredPrinter)) throw failure("configured_printer_virtual");
    if (status.exists === false) throw failure("configured_printer_not_found");
    if (isPrinterOffline(status.printerStatus, status.workOffline)) throw failure("configured_printer_unavailable");
    if (String(status.spoolerStatus).toLowerCase() === "stopped") throw failure("spooler_stopped");
    if (!printSystem.getPrintJobs) {
      if (isPrinterError(status.printerStatus, status.workOffline)) throw failure("printer_queue_recovery_required");
      return { printer: status.configuredPrinter };
    }
    const jobs = await printSystem.getPrintJobs(status.configuredPrinter);
    const recoverable = jobs.filter(jobIsStuck);
    if (recoverable.length) await printSystem.removePrintJobs?.(status.configuredPrinter, recoverable);
    const verified = await this.getStatus();
    if (!verified.printerConfigured) throw failure("printer_not_configured");
    if (isVirtualPrinter(verified.configuredPrinter)) throw failure("configured_printer_virtual");
    if (verified.exists === false) throw failure("configured_printer_not_found");
    if (isPrinterOffline(verified.printerStatus, verified.workOffline)) throw failure("configured_printer_unavailable");
    if (String(verified.spoolerStatus).toLowerCase() === "stopped") throw failure("spooler_stopped");
    const remainingJobs = await printSystem.getPrintJobs(verified.configuredPrinter);
    if (isPrinterError(verified.printerStatus, verified.workOffline) || remainingJobs.some(jobIsStuck)) throw failure("printer_queue_recovery_required");
    return { printer: verified.configuredPrinter };
  },
  async submit(job) {
    try {
      if (!job || !Number.isInteger(job.copies) || job.copies < 1 || typeof job.pdfPath !== "string" || !isWithin(controlledRoot, job.pdfPath) || !job.pdfPath.toLowerCase().endsWith(".pdf")) return { status: "failed", reason: "invalid_job" };
      const prepared = await this.preparePrinterForSubmission();
      // Once Sumatra is invoked, Windows may have accepted the job even when it
      // reports failure. Never retry a physical submission automatically.
      await printSystem.submitPdf({ path: job.pdfPath, copies: job.copies, printer: prepared.printer });
      return { status: "submitted", printer: prepared.printer };
    } catch (error) { const reason = safeReason(error); return { status: "failed", reason, diagnosticCode: error?.diagnosticCode ?? diagnosticCodeFor(reason, error?.details?.nativeCode) }; }
  },
});
