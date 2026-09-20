import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
export const PRINT_TEMP_ROOT = join(tmpdir(), "basecamp-print-agent");
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const browserCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export const validateHtmlArtifact = (artifact) => {
  if (!artifact || artifact.type !== "html" || typeof artifact.content !== "string") throw new Error("invalid_artifact");
  const size = Buffer.byteLength(artifact.content, "utf8");
  if (size < 256 || size > MAX_HTML_BYTES || !artifact.content.startsWith("<!doctype html>") || !artifact.content.includes("a5-workout-document")) throw new Error("invalid_artifact");
  if (/<script\b/iu.test(artifact.content) || /https?:\/\//iu.test(artifact.content)) throw new Error("external_resource_not_allowed");
  return true;
};

export const inspectA5LandscapePdf = async (pdfPath) => {
  const bytes = await readFile(pdfPath);
  if (bytes.length < 1_024 || !bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("invalid_pdf");
  const source = bytes.toString("latin1");
  if (!source.includes("%%EOF") || !source.includes("startxref")) throw new Error("invalid_pdf");
  const pageCount = (source.match(/\/Type\s*\/Page\b/gu) ?? []).length;
  const mediaBox = source.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/u);
  if (pageCount !== 1 || !mediaBox) throw new Error("invalid_pdf_layout");
  const width = Number(mediaBox[3]) - Number(mediaBox[1]); const height = Number(mediaBox[4]) - Number(mediaBox[2]);
  if (Math.abs(width - 595) > 3 || Math.abs(height - 420) > 3) throw new Error("invalid_pdf_layout");
  return { bytes: bytes.length, pageCount, width, height };
};

export const createChromiumPdfRenderer = ({ executablePath = process.env.BASECAMP_CHROMIUM_PATH, run = execFile, ensureReadable = access } = {}) => ({
  async render({ htmlPath, pdfPath, profilePath }) {
    let selected = executablePath;
    if (selected) await ensureReadable(selected);
    else for (const candidate of browserCandidates) { try { await ensureReadable(candidate); selected = candidate; break; } catch { /* try next controlled path */ } }
    if (!selected) throw new Error("pdf_engine_unavailable");
    await run(selected, ["--headless=new", "--disable-gpu", "--disable-extensions", "--no-pdf-header-footer", `--user-data-dir=${profilePath}`, `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href], { windowsHide: true, timeout: 20_000 });
    for (let attempt = 0; attempt < 40; attempt += 1) { try { if ((await stat(pdfPath)).size > 0) return; } catch { /* wait for flushed output */ } await delay(50); }
    throw new Error("pdf_generation_failed");
  },
});

export const createHtmlPdfPipeline = ({ root = PRINT_TEMP_ROOT, renderer = createChromiumPdfRenderer() } = {}) => ({
  async create({ jobId, artifact }) {
    validateHtmlArtifact(artifact);
    await mkdir(root, { recursive: true });
    const prefix = `${createHash("sha256").update(jobId).digest("hex").slice(0, 16)}-`;
    const directory = await mkdtemp(join(root, prefix));
    const htmlPath = join(directory, "document.html"); const pdfPath = join(directory, "document.pdf"); const profilePath = join(directory, "browser-profile");
    try {
      await writeFile(htmlPath, artifact.content, { flag: "wx", mode: 0o600 });
      await renderer.render({ htmlPath, pdfPath, profilePath });
      const metadata = await inspectA5LandscapePdf(pdfPath);
      return { path: pdfPath, metadata, cleanup: () => rm(directory, { recursive: true, force: true }) };
    } catch (error) { await rm(directory, { recursive: true, force: true }).catch(() => undefined); throw error; }
  },
});