import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const install = await readFile(new URL("../windows-print-agent/install-print-agent-task.ps1", import.meta.url), "utf8");
const launcher = await readFile(new URL("../windows-print-agent/launch-print-agent.mjs", import.meta.url), "utf8");
const runtime = "C:\\ProgramData\\BaseCamp\\PrintAgent";

assert.ok(install.includes(`$runtimeRoot = '${runtime}'`));
assert.ok(install.includes("Copy-Item -LiteralPath"));
assert.ok(install.includes("Missing required runtime renderer"));
assert.ok(install.includes("SumatraPDF.exe"));
assert.ok(install.includes("Register-ScheduledTask"));
assert.ok(install.includes("-Force | Out-Null"));
assert.ok(install.includes("Join-Path $runtimeRoot 'launch-print-agent.mjs'"));
assert.ok(install.includes("-WorkingDirectory $runtimeRoot"));
assert.ok(install.includes("Stop-Process -Id $listener.OwningProcess -Force"));
assert.equal(install.includes("Z:\\"), false);
assert.equal(/(?:Users\\[^']+|basecamp-program-manager)/iu.test(install), false);
assert.ok(launcher.includes('const root = dirname(fileURLToPath(import.meta.url));'));
assert.equal(launcher.includes("Z:\\"), false);
console.log("Portable Print Agent installation checks: PASS");
