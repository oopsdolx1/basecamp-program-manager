import net from "node:net";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

const root = dirname(fileURLToPath(import.meta.url));
const logPath = join(root, "logs", "print-agent.log");
const log = async (message) => { await mkdir(dirname(logPath), { recursive: true }); await appendFile(logPath, `${new Date().toISOString()} ${message}\n`); };
const portIsListening = (port) => new Promise((resolve) => {
  const socket = net.connect({ host: "127.0.0.1", port });
  const done = (value) => { socket.destroy(); resolve(value); };
  socket.once("connect", () => done(true));
  socket.once("error", () => done(false));
  socket.setTimeout(500, () => done(false));
});

try {
  await log(`launcher start pid=${process.pid} cwd=${process.cwd()} execPath=${process.execPath} argv=${JSON.stringify(process.argv)}`);
  await log(`env USERPROFILE=${process.env.USERPROFILE ?? ""} LOCALAPPDATA=${process.env.LOCALAPPDATA ?? ""} PATH=${process.env.PATH ?? ""}`);
  await log(`runtime root=${root} serverExists=${existsSync(join(root, "server.mjs"))} logsExists=${existsSync(dirname(logPath))}`);
  const { DEFAULT_PORT } = await import("./server.mjs");
  if (await portIsListening(DEFAULT_PORT)) {
    await log(`port ${DEFAULT_PORT} already listening; launcher will not start a duplicate.`);
  } else {
    const serverPath = join(root, "server.mjs");
    const startAgent = () => {
      const child = spawn(process.execPath, [serverPath], {
        cwd: root,
        detached: false,
        stdio: "ignore",
      });
      void log(`child spawn attempt pid=${child.pid ?? "unknown"} server=${serverPath}`);
      child.once("error", (error) => {
        void log(`child spawn error=${error.name}: ${error.message}`);
      });
      child.once("exit", (code, signal) => {
        void log(`child exit pid=${child.pid ?? "unknown"} code=${code ?? "null"} signal=${signal ?? "none"}`);
        setTimeout(() => {
          void portIsListening(DEFAULT_PORT).then((listening) => {
            if (listening) {
              void log(`port ${DEFAULT_PORT} is occupied after child exit; supervisor will not start a duplicate.`);
              return;
            }
            startAgent();
          });
        }, 1000);
      });
    };
    await log(`agent supervisor start port=${DEFAULT_PORT}`);
    startAgent();
  }
} catch (error) {
  await log(`launcher exit code=1 error=${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`);
  process.exitCode = 1;
}

