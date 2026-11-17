// Kiosk device enrollment on the kiosk itself (run as the Windows user that runs the agent task).
//   node enroll-kiosk-device.mjs --code ABCD-EFGH-JKMN   redeem the administrator's one-time code
//   node enroll-kiosk-device.mjs --status                show deviceId and key fingerprints
// After --code, read the printed fingerprint to the administrator, who approves it with
// `scripts/kiosk-device-admin.mjs approve --device <id> --fingerprint <fp>` in Condition Lab.
import { parseArgs } from "node:util";
import { createKioskDeviceCredential, loadDeviceAuthConfig } from "./kiosk-device-credential.mjs";

const { values } = parseArgs({ options: { code: { type: "string" }, status: { type: "boolean" } } });
const config = await loadDeviceAuthConfig();
if (!config) { console.error("deviceAuth is not configured in config.json (apiBaseUrl https, projectId, appId)."); process.exit(1); }
const credential = createKioskDeviceCredential({ config });
try {
  if (values.status) { console.log(JSON.stringify(await credential.status(), null, 2)); process.exit(0); }
  if (!values.code) { console.error("Usage: node enroll-kiosk-device.mjs --code XXXX-XXXX-XXXX | --status"); process.exit(2); }
  const result = await credential.enroll(values.code);
  console.log(`Device ${result.deviceId} enrollment submitted (${result.status}).`);
  console.log(`Key fingerprint for the administrator: ${result.keyFingerprint}`);
  process.exit(0);
} catch (error) {
  console.error(`Enrollment failed: ${error.reason ?? error.code ?? "unknown_error"}`);
  process.exit(1);
}
