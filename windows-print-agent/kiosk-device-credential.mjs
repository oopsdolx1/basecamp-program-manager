// Kiosk device credential held by the local BaseCamp agent (Phase 3-A).
//
// - The Ed25519 private key is generated here, never leaves this machine and is stored only
//   DPAPI-protected (CurrentUser scope + fixed entropy) in device-credential.json. The browser never
//   sees it; the browser only receives a short-lived Firebase custom token from POST /kiosk/device-token.
// - The server stores only the public key. Signing a fresh, single-use server challenge proves
//   possession of the key; copying device-credential.json to another Windows account/machine does
//   not work because DPAPI cannot decrypt it there.
// - Key rotation: a re-enrollment stores a *pending* key next to the current one; the pending key is
//   promoted the first time it authenticates (i.e. after the administrator approved it).
// Nothing in this module logs codes, keys, nonces, signatures or tokens.
import { spawn } from "node:child_process";
import { createHash, createPrivateKey, generateKeyPairSync, sign } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const runtimeRoot = dirname(fileURLToPath(import.meta.url));
export const defaultCredentialPath = join(runtimeRoot, "device-credential.json");
export const defaultDeviceAuthConfigPath = join(runtimeRoot, "config.json");
const CHALLENGE_PREFIX = "basecamp-kiosk-device-auth/v1";
const DPAPI_ENTROPY = "basecamp-kiosk-device-key/v1";
const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);

export class DeviceCredentialError extends Error {
  constructor(reason, status = 0) { super(reason); this.name = "DeviceCredentialError"; this.reason = reason; this.status = status; }
}

/** Windows DPAPI via PowerShell. Secrets travel over stdin only, never on the command line. */
export const createDpapiProtector = ({ powershell = "powershell.exe" } = {}) => {
  const run = (operation, input) => new Promise((resolve, reject) => {
    const script = `$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; $i=[Convert]::FromBase64String([Console]::In.ReadToEnd().Trim()); $e=[Text.Encoding]::UTF8.GetBytes('${DPAPI_ENTROPY}'); $o=[Security.Cryptography.ProtectedData]::${operation}($i,$e,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($o))`;
    const child = spawn(powershell, ["-NoProfile", "-NonInteractive", "-Command", script], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = ""; child.stdout.on("data", (chunk) => { stdout += chunk; }); child.stderr.resume();
    child.on("error", () => reject(new DeviceCredentialError("credential_protection_unavailable")));
    child.on("close", (code) => (code === 0 && stdout ? resolve(Buffer.from(stdout.trim(), "base64")) : reject(new DeviceCredentialError("credential_protection_failed"))));
    child.stdin.end(input.toString("base64"));
  });
  return Object.freeze({ kind: "dpapi-currentuser", protect: (buffer) => run("Protect", buffer), unprotect: (buffer) => run("Unprotect", buffer) });
};

export const keyFingerprint = (spkiBase64) => createHash("sha256").update(Buffer.from(spkiBase64, "base64")).digest("hex").slice(0, 16).toUpperCase().match(/.{4}/g).join("-");

/** Extra browser origins (https only) allowed to request the device token, e.g. the Condition Lab kiosk page (Phase 3-C). */
export const loadDeviceBrowserOrigins = async ({ configPath = defaultDeviceAuthConfigPath, read = readFile } = {}) => {
  try {
    const list = JSON.parse(await read(configPath, "utf8"))?.deviceAuth?.browserOrigins;
    return Array.isArray(list) ? list.filter((origin) => { try { const url = new URL(origin); return url.protocol === "https:" && url.origin === origin; } catch { return false; } }) : [];
  } catch { return []; }
};

/** `deviceAuth` block of config.json: { apiBaseUrl, projectId, appId }. https only (http allowed for loopback). */
export const loadDeviceAuthConfig = async ({ configPath = defaultDeviceAuthConfigPath, read = readFile } = {}) => {
  try {
    const block = JSON.parse(await read(configPath, "utf8"))?.deviceAuth;
    const apiBaseUrl = typeof block?.apiBaseUrl === "string" ? block.apiBaseUrl.trim().replace(/\/$/, "") : "";
    const url = new URL(apiBaseUrl);
    if (!(url.protocol === "https:" || (url.protocol === "http:" && LOOPBACK.has(url.hostname)))) return null;
    if (typeof block.projectId !== "string" || !block.projectId.trim() || typeof block.appId !== "string" || !block.appId.trim()) return null;
    return { apiBaseUrl, projectId: block.projectId.trim(), appId: block.appId.trim() };
  } catch { return null; }
};

const generateKey = async (protector) => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeySpki = publicKey.export({ format: "der", type: "spki" }).toString("base64");
  const protectedPrivateKey = (await protector.protect(privateKey.export({ format: "der", type: "pkcs8" }))).toString("base64");
  return { publicKeySpki, keyFingerprint: keyFingerprint(publicKeySpki), protectedPrivateKey };
};

export const createKioskDeviceCredential = ({ config, protector = createDpapiProtector(), credentialPath = defaultCredentialPath, fetchImpl = globalThis.fetch.bind(globalThis) } = {}) => {
  if (!config?.apiBaseUrl || !config.projectId || !config.appId) throw new DeviceCredentialError("device_auth_not_configured");
  const load = async () => { try { return JSON.parse(await readFile(credentialPath, "utf8")); } catch (error) { if (error?.code === "ENOENT") return null; throw new DeviceCredentialError("credential_unreadable"); } };
  const save = async (value) => { const temporary = `${credentialPath}.tmp`; await writeFile(temporary, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600 }); await rename(temporary, credentialPath); };
  const post = async (path, body) => {
    let response;
    try { response = await fetchImpl(`${config.apiBaseUrl}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); } catch { throw new DeviceCredentialError("device_auth_unavailable"); }
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) throw new DeviceCredentialError(data?.error?.code ?? (response.status >= 500 ? "device_auth_unavailable" : "device_auth_failed"), response.status);
    return data;
  };
  const authenticateWith = async (deviceId, key) => {
    const challenge = await post("/v1/kiosk/device-auth/challenge", { deviceId });
    // Sign only a challenge bound to this deployment and this device; anything else is refused.
    const expected = [CHALLENGE_PREFIX, config.projectId, config.appId, deviceId, challenge.nonce].join("\n");
    if (typeof challenge.nonce !== "string" || challenge.challenge !== expected) throw new DeviceCredentialError("device_auth_failed");
    const privateKey = createPrivateKey({ key: await protector.unprotect(Buffer.from(key.protectedPrivateKey, "base64")), format: "der", type: "pkcs8" });
    const signature = sign(null, Buffer.from(expected, "utf8"), privateKey).toString("base64url");
    const result = await post("/v1/kiosk/device-auth/token", { deviceId, nonce: challenge.nonce, signature });
    if (typeof result.customToken !== "string" || !result.customToken) throw new DeviceCredentialError("device_auth_failed");
    return result.customToken;
  };
  let inFlight = null;

  return Object.freeze({
    /** Redeems a one-time enrollment code with a new key. The administrator must still approve it. */
    async enroll(code) {
      const current = await load();
      if (current?.pending) throw new DeviceCredentialError("enrollment_already_pending");
      const key = await generateKey(protector);
      const result = await post("/v1/kiosk/device-enrollments", { code, publicKey: key.publicKeySpki });
      if (current && current.deviceId !== result.deviceId) throw new DeviceCredentialError("enrollment_for_other_device");
      const stored = current
        ? { ...current, pending: { ...key, redeemedAt: new Date().toISOString() } }
        : { version: 1, protection: protector.kind ?? "custom", deviceId: result.deviceId, current: null, pending: { ...key, redeemedAt: new Date().toISOString() } };
      await save(stored);
      return { deviceId: result.deviceId, keyFingerprint: key.keyFingerprint, status: result.status };
    },
    async status() {
      const stored = await load();
      return stored ? { enrolled: Boolean(stored.current), deviceId: stored.deviceId, keyFingerprint: stored.current?.keyFingerprint ?? null, pendingFingerprint: stored.pending?.keyFingerprint ?? null } : { enrolled: false, deviceId: null, keyFingerprint: null, pendingFingerprint: null };
    },
    /** A fresh Firebase custom token for this device (concurrent callers share one exchange). */
    async getCustomToken() {
      if (inFlight) return inFlight;
      inFlight = (async () => {
        const stored = await load();
        if (!stored?.deviceId || (!stored.current && !stored.pending)) throw new DeviceCredentialError("device_not_enrolled");
        if (stored.current) {
          try { return await authenticateWith(stored.deviceId, stored.current); } catch (error) { if (!stored.pending || error.reason === "device_auth_unavailable") throw error; }
        }
        // Current key refused (rotated/approved new key) or first approval: try the pending key and promote it.
        const token = await authenticateWith(stored.deviceId, stored.pending);
        await save({ ...stored, current: { ...stored.pending, promotedAt: new Date().toISOString() }, pending: null });
        return token;
      })().finally(() => { inFlight = null; });
      return inFlight;
    },
  });
};
