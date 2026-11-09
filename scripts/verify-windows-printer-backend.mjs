import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWindowsPrintSystem, createWindowsPrinterBackend as createBackend, isVirtualPrinter } from "../windows-print-agent/windows-printer-backend.mjs";
import { loadPrintAgentConfig } from "../windows-print-agent/print-agent-config.mjs";
const root = await mkdtemp(join(tmpdir(), "basecamp-print-agent-test-")); const pdfPath = join(root, "document.pdf");
const createWindowsPrinterBackend = (options = {}) => createBackend({ getConfiguredPrinterName: async () => "Office Printer A", ...options });
const calls = []; let currentDefault = "Office Printer A"; const backend = createWindowsPrinterBackend({ controlledRoot: root, printSystem: { getDefaultPrinter: async () => currentDefault, submitPdf: async (job) => { calls.push(job); } } });
assert.deepEqual(await backend.submit({ jobId: "job-1", copies: 2, pdfPath }), { status: "submitted", printer: "Office Printer A" }); assert.deepEqual(calls[0], { path: pdfPath, copies: 2, printer: "Office Printer A" });
currentDefault = "Office Printer B"; assert.deepEqual(await backend.submit({ jobId: "job-default-changed", copies: 1, pdfPath }), { status: "submitted", printer: "Office Printer A" }); assert.equal(calls.at(-1).printer, "Office Printer A");
assert.deepEqual(await createBackend({ controlledRoot: root, getConfiguredPrinterName: async () => null, printSystem: { getDefaultPrinter: async () => "Other Printer" } }).submit({ jobId: "job-2", copies: 1, pdfPath }), { status: "failed", reason: "printer_not_configured", diagnosticCode: "PRINTER_NOT_CONFIGURED" });
const virtual = createWindowsPrinterBackend({ getConfiguredPrinterName: async () => "Microsoft Print to PDF", controlledRoot: root, printSystem: { getDefaultPrinter: async () => "Office Printer A", getPrinterByName: async () => ({ exists: true, printerStatus: "Normal" }) } });
assert.deepEqual(await virtual.getStatus(), { printerConfigured: true, configuredPrinter: "Microsoft Print to PDF", printerAvailable: false, defaultPrinter: "Office Printer A", exists: true, printerStatus: "Normal" });
assert.deepEqual(await virtual.submit({ jobId: "job-virtual", copies: 1, pdfPath }), { status: "failed", reason: "configured_printer_not_found", diagnosticCode: "CONFIGURED_PRINTER_NOT_FOUND" });
assert.equal(isVirtualPrinter("Microsoft XPS Document Writer"), true); assert.equal(isVirtualPrinter("OneNote for Windows 10"), true); assert.equal(isVirtualPrinter("ALPDF"), true); assert.equal(isVirtualPrinter("Office Printer A"), false);
assert.deepEqual(await createWindowsPrinterBackend({ controlledRoot: root, printSystem: { getDefaultPrinter: async () => "Test", submitPdf: async () => { throw new Error("printer_submission_failed"); } } }).submit({ jobId: "job-3", copies: 1, pdfPath }), { status: "failed", reason: "printer_submission_failed", diagnosticCode: "SUMATRA_EXIT_5" });
assert.deepEqual(await backend.submit({ jobId: "job-4", copies: 1, pdfPath: "C:\\untrusted.pdf" }), { status: "failed", reason: "invalid_job" });
assert.deepEqual(await backend.submit({ jobId: "job-5", copies: 0, pdfPath }), { status: "failed", reason: "invalid_job" });
const runs = []; const system = createWindowsPrintSystem({ platform: "win32", rendererPath: "C:\\agent\\SumatraPDF.exe", run: async (file, args, options) => { runs.push({ file, args, options }); return { stdout: "Office Printer A" }; }, ensureReadable: async () => undefined });
assert.equal(await system.getDefaultPrinter(), "Office Printer A"); assert.equal(runs[0].options.timeout, 5_000); await system.submitPdf({ path: "C:\\agent\\job.pdf", copies: 3, printer: "Office Printer A" }); assert.deepEqual(runs[1].args, ["-print-to", "Office Printer A", "-silent", "-print-settings", "3x,fit,paper=A5", "C:\\agent\\job.pdf"]);
const delayedLookupRuns = []; const delayedLookup = createWindowsPrintSystem({ platform: "win32", run: async (file, args, options) => { delayedLookupRuns.push({ file, args, options }); await new Promise((resolve) => setTimeout(resolve, 2_100)); return { stdout: "Samsung C51x Series" }; } });
assert.equal(await delayedLookup.getDefaultPrinter(), "Samsung C51x Series"); assert.equal(delayedLookupRuns[0].options.timeout, 5_000);
const timedOutLookup = createWindowsPrintSystem({ platform: "win32", run: async () => { const error = new Error("Command timed out after 5000 milliseconds"); error.code = "ETIMEDOUT"; throw error; } });
await assert.rejects(timedOutLookup.getDefaultPrinter(), { code: "ETIMEDOUT" });
assert.deepEqual(await createWindowsPrinterBackend({ printSystem: timedOutLookup }).getStatus(), { printerConfigured: true, configuredPrinter: "Office Printer A", printerAvailable: false, defaultPrinter: null, spoolerStatus: "Unknown", exists: false, printerStatus: null, driverName: null, portName: null, workOffline: null });
const diagnosticEvents = []; const logger = { debug: async (...args) => diagnosticEvents.push(args), info: async (...args) => diagnosticEvents.push(args), warn: async (...args) => diagnosticEvents.push(args), error: async (...args) => diagnosticEvents.push(args) };
const sumatraExit = createWindowsPrintSystem({ platform: "win32", rendererPath: "C:\\agent\\SumatraPDF.exe", ensureReadable: async () => undefined, logger, run: async () => { const error = new Error("native failure"); error.code = 5; error.stdout = "native stdout"; error.stderr = "native stderr"; throw error; } });
await assert.rejects(sumatraExit.submitPdf({ path: "C:\\agent\\job.pdf", copies: 1, printer: "Office Printer A" }), (error) => error.message === "printer_submission_failed" && error.diagnosticCode === "SUMATRA_EXIT_5" && error.details.stderr === "native stderr");
assert.ok(diagnosticEvents.some(([, event, fields]) => event === "sumatra_failed" && fields.nativeCode === 5 && fields.stderr === "native stderr"), "native stdout/stderr and exit code are logged");
const spoolerStopped = createWindowsPrinterBackend({ controlledRoot: root, printSystem: { getDefaultPrinter: async () => "Office Printer A", getSpoolerStatus: async () => "Stopped", submitPdf: async () => { throw new Error("must_not_submit"); } } });
assert.deepEqual(await spoolerStopped.submit({ jobId: "job-spooler", copies: 1, pdfPath }), { status: "failed", reason: "spooler_stopped", diagnosticCode: "SPOOLER_STOPPED" });
const recoveryCalls = []; let recoveryInspection = 0;
const recoverableQueue = createWindowsPrinterBackend({ controlledRoot: root, printSystem: {
  getDefaultPrinter: async () => "Office Printer A",
  getPrinterMetadata: async () => ({ printerStatus: "Normal", workOffline: false }),
  getPrintJobs: async () => (++recoveryInspection === 1 ? [{ id: 7, status: "Error, Printing", submittedAt: "2020-01-01T00:00:00.000Z" }] : []),
  removePrintJobs: async (printer, jobs) => { recoveryCalls.push({ type: "remove", printer, jobs }); },
  submitPdf: async (job) => { recoveryCalls.push({ type: "submit", job }); },
} });
assert.deepEqual(await recoverableQueue.submit({ jobId: "recoverable", copies: 1, pdfPath }), { status: "submitted", printer: "Office Printer A" });
assert.equal(recoveryCalls.filter((call) => call.type === "remove").length, 1); assert.equal(recoveryCalls.filter((call) => call.type === "submit").length, 1);
const deniedQueue = createWindowsPrinterBackend({ controlledRoot: root, printSystem: {
  getDefaultPrinter: async () => "Office Printer A", getPrinterMetadata: async () => ({ printerStatus: "Normal", workOffline: false }),
  getPrintJobs: async () => [{ id: 8, status: "Error", submittedAt: "2020-01-01T00:00:00.000Z" }],
  removePrintJobs: async () => { throw Object.assign(new Error("printer_queue_access_denied"), { diagnosticCode: "PRINTER_QUEUE_ACCESS_DENIED" }); }, submitPdf: async () => { throw new Error("must_not_submit"); },
} });
assert.deepEqual(await deniedQueue.submit({ jobId: "denied", copies: 1, pdfPath }), { status: "failed", reason: "printer_queue_access_denied", diagnosticCode: "PRINTER_QUEUE_ACCESS_DENIED" });
let errorStatusSubmissions = 0;
const persistentError = createWindowsPrinterBackend({ controlledRoot: root, printSystem: { getDefaultPrinter: async () => "Office Printer A", getPrinterMetadata: async () => ({ printerStatus: "Error", workOffline: false }), getPrintJobs: async () => [], submitPdf: async () => { errorStatusSubmissions += 1; } } });
assert.deepEqual(await persistentError.submit({ jobId: "persistent-error", copies: 1, pdfPath }), { status: "failed", reason: "printer_queue_recovery_required", diagnosticCode: "PRINTER_QUEUE_RECOVERY_REQUIRED" }); assert.equal(errorStatusSubmissions, 0);
let retryAttempts = 0; let retryInspections = 0;
const retryAfterRecovery = createWindowsPrinterBackend({ controlledRoot: root, printSystem: {
  getDefaultPrinter: async () => "Office Printer A", getPrinterMetadata: async () => ({ printerStatus: "Normal", workOffline: false }),
  getPrintJobs: async () => (++retryInspections === 3 ? [{ id: 9, status: "Error", submittedAt: "2020-01-01T00:00:00.000Z" }] : []), removePrintJobs: async () => undefined,
  submitPdf: async () => { retryAttempts += 1; if (retryAttempts === 1) throw Object.assign(new Error("printer_submission_failed"), { diagnosticCode: "SUMATRA_EXIT_5" }); },
} });
assert.deepEqual(await retryAfterRecovery.submit({ jobId: "retry", copies: 1, pdfPath }), { status: "submitted", printer: "Office Printer A" }); assert.equal(retryAttempts, 2);
let failedRetryAttempts = 0;
const failedRetry = createWindowsPrinterBackend({ controlledRoot: root, printSystem: { getDefaultPrinter: async () => "Office Printer A", getPrinterMetadata: async () => ({ printerStatus: "Normal", workOffline: false }), getPrintJobs: async () => [], submitPdf: async () => { failedRetryAttempts += 1; throw new Error("printer_submission_failed"); } } });
assert.deepEqual(await failedRetry.submit({ jobId: "retry-fails", copies: 1, pdfPath }), { status: "failed", reason: "printer_submission_failed", diagnosticCode: "SUMATRA_EXIT_5" }); assert.equal(failedRetryAttempts, 2);
let freshJobRemoved = false;
const freshJob = createWindowsPrinterBackend({ controlledRoot: root, printSystem: { getDefaultPrinter: async () => "Office Printer A", getPrinterMetadata: async () => ({ printerStatus: "Normal", workOffline: false }), getPrintJobs: async () => [{ id: 10, status: "Printing", submittedAt: new Date().toISOString() }], removePrintJobs: async () => { freshJobRemoved = true; }, submitPdf: async () => undefined } });
assert.equal((await freshJob.submit({ jobId: "fresh", copies: 1, pdfPath })).status, "submitted"); assert.equal(freshJobRemoved, false);
const configPath = join(root, "config.json"); await writeFile(configPath, JSON.stringify({ printerName: "  Samsung C51x Series  " })); assert.deepEqual(await loadPrintAgentConfig({ configPath }), { printerName: "Samsung C51x Series" }); await writeFile(configPath, "not-json"); assert.deepEqual(await loadPrintAgentConfig({ configPath }), { printerName: null });
let configuredSubmission = null;
const configured = createBackend({ controlledRoot: root, getConfiguredPrinterName: async () => "Samsung C51x Series", printSystem: { getDefaultPrinter: async () => "Different Default Printer", getPrinterByName: async (name) => ({ exists: name === "Samsung C51x Series", printerStatus: "Normal", workOffline: false }), getPrintJobs: async () => [], submitPdf: async (job) => { configuredSubmission = job; } } });
assert.deepEqual(await configured.submit({ jobId: "configured", copies: 1, pdfPath }), { status: "submitted", printer: "Samsung C51x Series" }); assert.equal(configuredSubmission.printer, "Samsung C51x Series");
assert.deepEqual(await createBackend({ controlledRoot: root, getConfiguredPrinterName: async () => null, printSystem: { getDefaultPrinter: async () => "Different Default Printer", submitPdf: async () => { throw new Error("must_not_submit"); } } }).submit({ jobId: "no-config", copies: 1, pdfPath }), { status: "failed", reason: "printer_not_configured", diagnosticCode: "PRINTER_NOT_CONFIGURED" });
assert.deepEqual(await createBackend({ controlledRoot: root, getConfiguredPrinterName: async () => "Missing Printer", printSystem: { getDefaultPrinter: async () => "Different Default Printer", getPrinterByName: async () => ({ exists: false }), submitPdf: async () => { throw new Error("must_not_submit"); } } }).submit({ jobId: "missing-configured", copies: 1, pdfPath }), { status: "failed", reason: "configured_printer_not_found", diagnosticCode: "CONFIGURED_PRINTER_NOT_FOUND" });
console.log("Windows PrinterBackend checks: PASS");
