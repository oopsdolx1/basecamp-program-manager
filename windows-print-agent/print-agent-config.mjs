import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const runtimeRoot = dirname(fileURLToPath(import.meta.url));
export const defaultConfigPath = join(runtimeRoot, "config.json");

// Read for each request so an operator can change the dedicated printer without
// rebuilding or restarting the agent. Invalid configuration is intentionally
// treated the same as no configured printer and never crashes the process.
export const loadPrintAgentConfig = async ({ configPath = defaultConfigPath, read = readFile } = {}) => {
  try {
    const parsed = JSON.parse(await read(configPath, "utf8"));
    const printerName = typeof parsed?.printerName === "string" ? parsed.printerName.trim() : "";
    return printerName ? { status: "ok", printerName } : { status: "config_invalid", printerName: null };
  } catch (error) {
    return { status: error?.code === "ENOENT" ? "config_missing" : "config_invalid", printerName: null };
  }
};
