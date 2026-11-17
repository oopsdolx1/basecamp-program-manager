/**
 * Phase 3-A device enrollment / authentication, end to end against the Firebase Emulator:
 * the real windows-print-agent credential module + /kiosk/device-token route ↔ the real Condition Lab
 * device-auth routes (server/kiosk/kioskDeviceEnrollment.js, server/http/kioskDeviceAuthHttpAdapter.js)
 * and its device check (trustedIssuance.verifyKioskDevice). Only Condition Lab modules from its main branch
 * are used; member sessions, workout sessions and print records are out of scope here.
 * Emulator only; prefixed fixtures removed at the end.
 */
import assert from "node:assert/strict";
import { createCipheriv, createDecipheriv, generateKeyPairSync, randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createPrintAgent } from "../windows-print-agent/server.mjs";
import { createDpapiProtector, createKioskDeviceCredential, keyFingerprint } from "../windows-print-agent/kiosk-device-credential.mjs";

const PROJECT_ID = "basecamp-e2e-local"; const APP_ID = "basecamp_e2e_test"; const AUTH_HOST = "127.0.0.1:19099"; const FIRESTORE_HOST = "127.0.0.1:18080";
const CL_ROOT = path.resolve(process.env.CONDITION_LAB_ROOT ?? "../condition-lab");
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST; process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;
const load = (relative) => import(pathToFileURL(path.join(CL_ROOT, relative)).href);
const [{ createEmulatorAdminTokenVerifier }, { createEmulatorFirestoreContext }, { createAuthBoundary }, { createTrustedIssuance }, { createKioskDeviceEnrollment, deviceChallengeMessage }, { createKioskDeviceAuthHttpServer }] = await Promise.all([
  load("server/auth/firebaseAdminVerifier.js"), load("server/auth/firebaseAdminFirestore.js"), load("server/auth/authBoundary.js"), load("server/auth/trustedIssuance.js"),
  load("server/kiosk/kioskDeviceEnrollment.js"), load("server/http/kioskDeviceAuthHttpAdapter.js"),
]);

const prefix = `pm_devauth_${Date.now()}`; let clock = Date.now(); const now = () => clock;
const verifier = createEmulatorAdminTokenVerifier({ projectId: PROJECT_ID, authEmulatorHost: AUTH_HOST, appName: `${prefix}_auth` });
const { db } = createEmulatorFirestoreContext({ projectId: PROJECT_ID, firestoreEmulatorHost: FIRESTORE_HOST, appName: `${prefix}_fs` });
const boundary = createAuthBoundary({ verifyIdToken: verifier.verifyIdToken, expectedProjectId: PROJECT_ID, requireEmulator: true, emulatorHost: AUTH_HOST });
const issuance = createTrustedIssuance({ auth: verifier.auth, db, trustedIssuerUids: [], approvedTrainerUids: [] });
const enrollment = createKioskDeviceEnrollment({ auth: verifier.auth, db, projectId: PROJECT_ID, appId: APP_ID, now });
const operator = { kind: "admin-cli", operator: "e2e operator", host: "test" };
const serverLogs = []; const agentLogs = [];
const devices = new Set(); const tempDirs = [];
let deviceServer; let baseUrl; const agents = [];

// Test-only stand-in for DPAPI: AES-256-GCM with a key held in this process (a real DPAPI round trip runs separately).
const testProtector = () => { const key = randomBytes(32); return { kind: "test-aes-gcm", protect: async (data) => { const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key, iv); return Buffer.concat([iv, cipher.update(data), cipher.final(), cipher.getAuthTag()]); }, unprotect: async (data) => { const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12)); decipher.setAuthTag(data.subarray(-16)); return Buffer.concat([decipher.update(data.subarray(12, -16)), decipher.final()]); } }; };
const deviceConfig = () => ({ apiBaseUrl: baseUrl, projectId: PROJECT_ID, appId: APP_ID });
const newCredential = async () => { const dir = await mkdtemp(path.join(tmpdir(), "kiosk-cred-")); tempDirs.push(dir); const credentialPath = path.join(dir, "device-credential.json"); const protector = testProtector(); return { credentialPath, protector, credential: createKioskDeviceCredential({ config: deviceConfig(), protector, credentialPath }) }; };
const exchange = async (customToken) => (await (await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=emulator-test-key`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) })).json());
const api = async (method, route, { body } = {}) => { const response = await fetch(`${baseUrl}${route}`, { method, headers: body !== undefined ? { "content-type": "application/json" } : {}, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }); return { status: response.status, body: await response.json().catch(() => null) }; };
const code = (result) => result.body?.error?.code;
const enrollNew = async (label) => { const issued = await enrollment.issueEnrollmentCode({ actor: operator, label }); devices.add(issued.deviceId); return issued; };
const approvedDevice = async (label) => { const issued = await enrollNew(label); const { credential, credentialPath, protector } = await newCredential(); const redeemed = await credential.enroll(issued.code); await enrollment.approveDevice({ actor: operator, deviceId: redeemed.deviceId, fingerprint: redeemed.keyFingerprint }); await credential.getCustomToken(); return { ...redeemed, credential, credentialPath, protector }; };
const idTokenFor = async (credential) => (await exchange(await credential.getCustomToken())).idToken;
// The server-side device check every Kiosk API applies: a verified kiosk ID token whose device is registered,
// not revoked and on its current credentialVersion. Any rejection on the way counts as "refused".
const deviceAccepted = async (idToken) => {
  try { await issuance.verifyKioskDevice({ principal: await boundary.requireRole({ authorization: `Bearer ${idToken}` }, ["kiosk"]) }); return true; } catch { return false; }
};
const results = []; const CHECKS = 7;
const check = async (name, fn) => { await fn(); results.push(name); console.log(`PASS ${name}`); };

try {
  deviceServer = createKioskDeviceAuthHttpServer({ enrollment, log: (entry) => serverLogs.push(entry) });
  await new Promise((resolve) => deviceServer.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${deviceServer.address().port}`;

  await check("A1. enrollment: code redeemed with a new key → pending, no access before approval; wrong fingerprint refused", async () => {
    const issued = await enrollNew("Front desk");
    assert.match(issued.code, /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/); assert.match(issued.deviceId, /^kiosk_[0-9a-f]{16}$/, "server-chosen device id");
    const { credential, credentialPath } = await newCredential();
    const redeemed = await credential.enroll(issued.code);
    assert.equal(redeemed.deviceId, issued.deviceId); assert.equal(redeemed.status, "pending_approval");
    const device = (await enrollment.paths.device(issued.deviceId).get()).data();
    assert.equal(device.status, "pending_approval"); assert.equal(device.pendingKey.keyFingerprint, redeemed.keyFingerprint); assert.equal(device.publicKeySpki, undefined);
    await assert.rejects(credential.getCustomToken(), (error) => error.reason === "KIOSK_DEVICE_AUTH_FAILED", "pending device cannot authenticate");
    assert.equal(code(await api("POST", "/v1/kiosk/device-auth/challenge", { body: { deviceId: issued.deviceId } })), "KIOSK_DEVICE_AUTH_FAILED");
    // Stored credential: DPAPI-style protected private key only; nothing usable in plaintext.
    const stored = JSON.parse(await readFile(credentialPath, "utf8"));
    assert.deepEqual(Object.keys(stored.pending).sort(), ["keyFingerprint", "protectedPrivateKey", "publicKeySpki", "redeemedAt"]);
    assert.equal(JSON.stringify(stored).includes("PRIVATE KEY"), false); assert.equal(keyFingerprint(stored.pending.publicKeySpki), redeemed.keyFingerprint);
    await assert.rejects(enrollment.approveDevice({ actor: operator, deviceId: issued.deviceId, fingerprint: "0000-0000-0000-0000" }), (error) => error.code === "FINGERPRINT_MISMATCH");
    assert.equal((await enrollment.paths.device(issued.deviceId).get()).data().status, "pending_approval", "a wrong fingerprint leaves the device unregistered");
    await assert.rejects(enrollment.approveDevice({ actor: { operator: "" }, deviceId: issued.deviceId, fingerprint: redeemed.keyFingerprint }), (error) => error.code === "OPERATOR_REQUIRED");
    const approved = await enrollment.approveDevice({ actor: operator, deviceId: issued.deviceId, fingerprint: redeemed.keyFingerprint });
    assert.deepEqual(approved, { deviceId: issued.deviceId, credentialVersion: 1, rotated: false });
    const signedIn = await exchange(await credential.getCustomToken());
    assert.ok(signedIn.idToken, "approved device signs in");
    assert.equal(await deviceAccepted(signedIn.idToken), true, "the issued token passes the server's kiosk device check");
    const after = JSON.parse(await readFile(credentialPath, "utf8")); assert.equal(after.pending, null); assert.equal(after.current.keyFingerprint, redeemed.keyFingerprint, "pending key promoted after approval");
  });

  await check("A2. codes: wrong, expired, reused and malformed codes are refused identically; a pending device cannot be enrolled twice", async () => {
    const { credential } = await newCredential();
    for (const bad of ["ZZZZ-ZZZZ-ZZZZ", "short", "", "ABCD-EFGH-JKMN-PQRS"]) await assert.rejects(credential.enroll(bad), (error) => error.reason === "KIOSK_ENROLLMENT_INVALID", bad);
    const expiring = await enrollNew("expiring"); clock += 15 * 60_000; await assert.rejects((await newCredential()).credential.enroll(expiring.code), (error) => error.reason === "KIOSK_ENROLLMENT_INVALID", "expired"); clock = Date.now();
    const once = await enrollNew("once"); const first = await newCredential(); await first.credential.enroll(once.code);
    await assert.rejects((await newCredential()).credential.enroll(once.code), (error) => error.reason === "KIOSK_ENROLLMENT_INVALID", "reused code");
    await assert.rejects((await newCredential()).credential.enroll(once.code.toLowerCase()), (error) => error.reason === "KIOSK_ENROLLMENT_INVALID", "reused code, other spelling");
    await assert.rejects(first.credential.enroll(once.code), (error) => error.reason === "enrollment_already_pending", "agent refuses a second pending enrollment");
    const rotation = await enrollment.issueEnrollmentCode({ actor: operator, deviceId: once.deviceId });
    const raw = await api("POST", "/v1/kiosk/device-enrollments", { body: { code: rotation.code, publicKey: newPublicKeySpki() } });
    assert.equal(raw.status, 409); assert.equal(code(raw), "KIOSK_ENROLLMENT_PENDING", "server refuses a second pending key for one device");
    assert.equal(code(await api("POST", "/v1/kiosk/device-enrollments", { body: { code: (await enrollNew("bad key")).code, publicKey: "AAAA" } })), "INVALID_REQUEST", "non-Ed25519 key");
    assert.equal(code(await api("POST", "/v1/kiosk/device-enrollments", { body: { code: "x", publicKey: "y", deviceId: "kiosk_0000000000000000" } })), "INVALID_REQUEST", "client cannot choose a device id");
    const audit = (await enrollment.paths.auditCollection().where("event", "==", "ENROLLMENT_FAILED").get()).docs.map((doc) => doc.data().reason);
    for (const reason of ["unknown_code", "expired_code", "code_redeemed", "malformed_code"]) assert.ok(audit.includes(reason), `audited ${reason}`);
  });

  await check("B1. authentication: replayed, expired, cross-device and forged challenges are refused; unknown devices get nothing", async () => {
    const one = await approvedDevice("one"); const two = await approvedDevice("two");
    const challenge = (await api("POST", "/v1/kiosk/device-auth/challenge", { body: { deviceId: one.deviceId } })).body;
    assert.equal(challenge.challenge, deviceChallengeMessage({ projectId: PROJECT_ID, appId: APP_ID, deviceId: one.deviceId, nonce: challenge.nonce }));
    assert.equal(code(await api("POST", "/v1/kiosk/device-auth/token", { body: { deviceId: one.deviceId, nonce: challenge.nonce, signature: "A".repeat(86) } })), "KIOSK_DEVICE_AUTH_FAILED", "forged signature");
    assert.equal(code(await api("POST", "/v1/kiosk/device-auth/token", { body: { deviceId: one.deviceId, nonce: challenge.nonce, signature: "A".repeat(86) } })), "KIOSK_DEVICE_AUTH_FAILED", "challenge consumed after a failed attempt");
    // A captured, valid token exchange cannot be replayed (single-use nonce).
    const replayDevice = await approvedDevice("replay");
    const captured = [];
    const spy = createKioskDeviceCredential({ config: deviceConfig(), protector: replayDevice.protector, credentialPath: replayDevice.credentialPath, fetchImpl: async (url, init) => { if (String(url).endsWith("/device-auth/token")) captured.push(JSON.parse(init.body)); return fetch(url, init); } });
    assert.ok(await spy.getCustomToken()); assert.equal(captured.length, 1);
    assert.equal(code(await api("POST", "/v1/kiosk/device-auth/token", { body: captured[0] })), "KIOSK_DEVICE_AUTH_FAILED", "replayed signature + nonce refused");
    // The same signed nonce presented for another device is refused too.
    assert.equal(code(await api("POST", "/v1/kiosk/device-auth/token", { body: { ...captured[0], deviceId: two.deviceId } })), "KIOSK_DEVICE_AUTH_FAILED", "other device id refused");
    // A copied credential file is useless without its protection context (DPAPI user/machine): it cannot even sign.
    const sent = [];
    const copied = createKioskDeviceCredential({ config: deviceConfig(), protector: testProtector(), credentialPath: replayDevice.credentialPath, fetchImpl: async (url, init) => { if (String(url).endsWith("/device-auth/token")) sent.push(url); return fetch(url, init); } });
    await assert.rejects(copied.getCustomToken()); assert.equal(sent.length, 0, "no signature produced from a copied file");
    const fresh = (await api("POST", "/v1/kiosk/device-auth/challenge", { body: { deviceId: replayDevice.deviceId } })).body;
    clock += 60_001; assert.equal(code(await api("POST", "/v1/kiosk/device-auth/token", { body: { deviceId: replayDevice.deviceId, nonce: fresh.nonce, signature: "A".repeat(86) } })), "KIOSK_DEVICE_AUTH_FAILED", "expired challenge"); clock = Date.now();
    for (const deviceId of ["kiosk_0123456789abcdef", "../x", ""]) assert.equal(code(await api("POST", "/v1/kiosk/device-auth/challenge", { body: { deviceId } })), "KIOSK_DEVICE_AUTH_FAILED", `unknown device ${deviceId}`);
    // A legacy issuer-registered device without a key cannot use this path.
    await db.doc(`authKioskDevices/${prefix}_legacy`).set({ deviceId: `${prefix}_legacy`, status: "registered", revoked: false }); devices.add(`${prefix}_legacy`);
    assert.equal(code(await api("POST", "/v1/kiosk/device-auth/challenge", { body: { deviceId: `${prefix}_legacy` } })), "KIOSK_DEVICE_AUTH_FAILED");
    assert.equal((await enrollment.paths.auditCollection().where("deviceId", "==", one.deviceId).where("event", "==", "AUTH_FAILED").get()).size >= 2, true, "failed authentications are audited");
  });

  await check("B2. revocation: the device's existing ID token is refused, re-authentication and re-enrollment are refused", async () => {
    const device = await approvedDevice("revoked device");
    const idToken = await idTokenFor(device.credential);
    assert.equal(await deviceAccepted(idToken), true, "accepted before revocation");
    await new Promise((resolve) => setTimeout(resolve, 1100)); // refresh-token revocation is checked at second granularity
    await enrollment.revokeDevice({ actor: operator, deviceId: device.deviceId, reason: "lost" });
    assert.equal(await deviceAccepted(idToken), false, "existing ID token refused after revocation");
    await assert.rejects(device.credential.getCustomToken(), (error) => error.reason === "KIOSK_DEVICE_AUTH_FAILED", "revoked device cannot re-authenticate");
    assert.equal(code(await api("POST", "/v1/kiosk/device-auth/challenge", { body: { deviceId: device.deviceId } })), "KIOSK_DEVICE_AUTH_FAILED", "revoked device gets no challenge");
    await assert.rejects(enrollment.issueEnrollmentCode({ actor: operator, deviceId: device.deviceId }), (error) => error.code === "DEVICE_REVOKED", "revoked device cannot be re-enrolled");
  });

  await check("B3. key rotation: old key keeps working until approval; afterwards old ID tokens are refused (credentialVersion) and the new key is promoted", async () => {
    const device = await approvedDevice("rotating");
    const oldIdToken = await idTokenFor(device.credential);
    assert.equal(await deviceAccepted(oldIdToken), true);
    const rotation = await enrollment.issueEnrollmentCode({ actor: operator, deviceId: device.deviceId });
    const pending = await device.credential.enroll(rotation.code);
    assert.ok(await device.credential.getCustomToken(), "current key still authenticates while the new key is pending");
    await new Promise((resolve) => setTimeout(resolve, 1100));
    assert.deepEqual(await enrollment.approveDevice({ actor: operator, deviceId: device.deviceId, fingerprint: pending.keyFingerprint }), { deviceId: device.deviceId, credentialVersion: 2, rotated: true });
    assert.equal(await deviceAccepted(oldIdToken), false, "ID token of the previous key refused");
    const newIdToken = await idTokenFor(device.credential);
    assert.equal(await deviceAccepted(newIdToken), true, "new key works");
    const principal = await boundary.requireRole({ authorization: `Bearer ${newIdToken}` }, ["kiosk"]); assert.equal(principal.claims.credentialVersion, 2);
    const stored = JSON.parse(await readFile(device.credentialPath, "utf8")); assert.equal(stored.current.keyFingerprint, pending.keyFingerprint); assert.equal(stored.pending, null);
  });

  await check("D1. agent /kiosk/device-token: allowed https origin only, no-store; token, nonce and key never logged; server down → fails closed", async () => {
    const device = await approvedDevice("agent route");
    const agent = createPrintAgent({ port: 43191, allowedOrigins: ["https://kiosk.example", "http://localhost:5173"], logger: { info: async (...args) => agentLogs.push(args), error: async (...args) => agentLogs.push(args) }, backend: { getStatus: async () => ({}), submit: async () => ({ status: "submitted" }) }, pdfPipeline: { create: async () => { throw new Error("unused"); } }, deviceCredential: async () => device.credential });
    agents.push(agent); await agent.listen();
    const post = (origin) => fetch("http://127.0.0.1:43191/kiosk/device-token", { method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: "{}" });
    assert.equal((await post(null)).status, 403, "no Origin (non-browser caller) refused");
    assert.equal((await post("https://evil.example")).status, 403, "foreign origin refused");
    assert.equal((await post("http://localhost:5173")).status, 403, "http origins are not token origins by default");
    const ok = await post("https://kiosk.example"); assert.equal(ok.status, 200); assert.equal(ok.headers.get("cache-control"), "no-store");
    const { customToken } = await ok.json(); const signedIn = await exchange(customToken); assert.ok(signedIn.idToken);
    assert.equal(await deviceAccepted(signedIn.idToken), true, "the agent's token passes the server's kiosk device check");
    const stored = JSON.parse(await readFile(device.credentialPath, "utf8"));
    const agentSerialized = JSON.stringify(agentLogs);
    for (const secret of [customToken.slice(20, 60), stored.current.protectedPrivateKey.slice(0, 40)]) assert.equal(agentSerialized.includes(secret), false, "agent logs never contain the token or the protected key");
    const unreachable = createKioskDeviceCredential({ config: { apiBaseUrl: "http://127.0.0.1:9", projectId: PROJECT_ID, appId: APP_ID }, protector: device.protector, credentialPath: device.credentialPath });
    await assert.rejects(unreachable.getCustomToken(), (error) => error.reason === "device_auth_unavailable", "API down → no token, no bypass");
    const notEnrolled = (await newCredential()).credential; await assert.rejects(notEnrolled.getCustomToken(), (error) => error.reason === "device_not_enrolled");
    const serialized = JSON.stringify(serverLogs);
    for (const secret of [customToken.slice(20, 60), "bks1_", "nonce", stored.current.protectedPrivateKey.slice(0, 40)]) assert.equal(serialized.includes(secret), false, `server logs contain ${secret}`);
    assert.ok(serverLogs.every((entry) => Object.keys(entry).every((key) => ["method", "path", "status", "code"].includes(key))), "server logs: method/path/status/code only");
  });

  await check("D2. real Windows DPAPI round trip (CurrentUser scope)", async () => {
    if (process.platform !== "win32") { console.log("  (skipped: not Windows)"); return; }
    const dpapi = createDpapiProtector(); const secret = randomBytes(48);
    const protectedBytes = await dpapi.protect(secret);
    assert.equal(protectedBytes.includes(secret), false); assert.deepEqual(await dpapi.unprotect(protectedBytes), secret);
    await assert.rejects(dpapi.unprotect(Buffer.from("not-protected")), (error) => error.reason === "credential_protection_failed");
  });
} catch (error) {
  console.error(error);
} finally {
  await Promise.all(agents.map((agent) => agent.close().catch(() => undefined)));
  if (deviceServer?.listening) await new Promise((resolve) => deviceServer.close(resolve));
  const ids = [...devices];
  const byDevice = async (collection) => ids.length ? (await Promise.all(ids.map((id) => db.collection(collection).where("deviceId", "==", id).get()))).flatMap((snapshot) => snapshot.docs) : [];
  const docs = (await Promise.all(["authKioskEnrollmentCodes", "authKioskDeviceAudit", "authKioskDeviceChallenges"].map(byDevice))).flat();
  const failedAudits = (await db.collection("authKioskDeviceAudit").where("event", "==", "ENROLLMENT_FAILED").get()).docs.filter((doc) => !doc.data().deviceId && Math.abs(doc.data().at.toMillis() - Date.now()) < 10 * 60_000);
  await Promise.all([...docs, ...failedAudits].map((doc) => doc.ref.delete().catch(() => undefined)));
  await Promise.all([...ids.map((id) => db.doc(`authKioskDevices/${id}`).delete()), ...ids.map((id) => verifier.auth.deleteUser(`kiosk:${id}`).catch(() => undefined))]);
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  console.log(`\n${results.length}/${CHECKS} passed`);
  process.exit(results.length === CHECKS ? 0 : 1);
}

function newPublicKeySpki() {
  return generateKeyPairSync("ed25519").publicKey.export({ format: "der", type: "spki" }).toString("base64");
}
