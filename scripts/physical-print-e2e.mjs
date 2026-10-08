import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPrintAgent } from "../windows-print-agent/server.mjs";

const port = 43132;
const jobId = `physical-e2e-${Date.now()}`;
const pdfDirectory = join(tmpdir(), "basecamp-print-agent", jobId);
const pdfPath = join(pdfDirectory, "physical-verification.pdf");
const artifact = {
  type: "html",
  content: `<!doctype html><html><head><meta charset="utf-8"><style>@page { size: A5 landscape; margin: 10mm; } body { font-family: Arial, sans-serif; } .a5-workout-document { width: 190mm; height: 128mm; border: 2px solid #111; box-sizing: border-box; padding: 12mm; } h1 { font-size: 22pt; } p { font-size: 14pt; }</style></head><body><article class="a5-workout-document"><h1>BaseCamp physical print verification</h1><p>Silent Windows Print Agent end-to-end test</p><p>Job: ${jobId}</p><p>This page must arrive on the default physical printer.</p></article></body></html>`,
};
const pdf = (text) => {
  const content = `BT /F1 22 Tf 72 330 Td (BaseCamp physical print verification) Tj 0 -42 Td /F1 15 Tf (Silent Windows Print Agent end-to-end test) Tj 0 -30 Td (Job: ${text}) Tj 0 -30 Td (This page must arrive on the default physical printer.) Tj ET`;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 420] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>", `<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  let output = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(output, "ascii")); output += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(output, "ascii"); output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return output;
};
await mkdir(pdfDirectory, { recursive: true });
await writeFile(pdfPath, pdf(jobId), "ascii");
const agent = createPrintAgent({ port, allowedOrigins: [], pdfPipeline: { create: async () => ({ path: pdfPath, cleanup: async () => rm(pdfDirectory, { recursive: true, force: true }) }) } });
await agent.listen();
try {
  const health = await (await fetch(`http://127.0.0.1:${port}/health`)).json();
  assert.equal(health.printerAvailable, true, `physical_printer_unavailable: ${JSON.stringify(health)}`);
  const response = await fetch(`http://127.0.0.1:${port}/print`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobId, artifact, copies: 1 }) });
  const result = await response.json();
  console.log(JSON.stringify({ health, httpStatus: response.status, result }, null, 2));
  if (!response.ok || result.status !== "submitted") process.exitCode = 1;
} finally {
  await agent.close();
  await rm(pdfDirectory, { recursive: true, force: true }).catch(() => undefined);
}
