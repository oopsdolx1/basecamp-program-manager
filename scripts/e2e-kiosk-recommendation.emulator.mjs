/**
 * Program Manager browser E2E (Emulator only), Trainer default recommendation → Kiosk.
 *
 * Starts the Condition Lab Kiosk API on localhost, runs the Program Manager Vite dev server against
 * the Firebase Emulator, and drives the real Kiosk UI in Chrome. Selecting a member calls
 * GET /v1/kiosk/members/{memberId}/default-workout-program (device-only identity) and shows that
 * member's active default; 추천대로 운동하기 / 수정해서 사용 / 직접 구성하기 reach the existing workout-session +
 * print preview flow. The Trainer handoff API stays available and is not consumed by this flow.
 * Phase 2: selecting a member opens a Kiosk member session (POST /v1/kiosk/sessions) and the workout
 * session is saved only through POST /v1/kiosk/workout-sessions with that session (no Client SDK write).
 * Phase 3-B: the preview prints through a test Windows agent and records the print only through
 * POST /v1/kiosk/workout-sessions/{id}/prints. This is an API/session E2E: its Admin SDK fixtures and
 * Kiosk API do not require the separate Firestore Rules migration.
 * Uses Condition Lab's installed Playwright. Never touches production Firebase or Gemini.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createPrintAgent } from '../windows-print-agent/server.mjs';
import { createKioskDeviceCredential } from '../windows-print-agent/kiosk-device-credential.mjs';

const PROJECT_ID = 'basecamp-e2e-local';
const APP_ID = 'basecamp_e2e_test';
const AUTH_HOST = '127.0.0.1:19099';
const FIRESTORE_HOST = '127.0.0.1:18080';
const API_PORT = 4013;
const PM_PORT = 5179;
const PM_ROOT = process.cwd();
const CL_ROOT = path.resolve(process.env.CONDITION_LAB_ROOT ?? '../condition-lab');
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID !== PROJECT_ID) throw new Error('Refusing to run: non-emulator project.');
process.env.FIREBASE_PROJECT_ID = PROJECT_ID; process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST; process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;

const load = (relative) => import(pathToFileURL(path.join(CL_ROOT, relative)).href);
const { chromium } = createRequire(path.join(CL_ROOT, 'package.json'))('@playwright/test');
const [{ createEmulatorAdminTokenVerifier }, { createEmulatorFirestoreContext }, { createAuthBoundary }, { createTrustedIssuance }, { createKioskSessionActivationHandler }, handoffHttp, { checksumKnowledgeItems, FIRESTORE_SNAPSHOT_SCHEMA_VERSION }, { createKioskMemberSessionService }, { createKioskMemberSessionHandler }, { createKioskWorkoutSessionSaver }, sessionHttp, { createKioskReadService }, readHttp] = await Promise.all([
  load('server/auth/firebaseAdminVerifier.js'), load('server/auth/firebaseAdminFirestore.js'), load('server/auth/authBoundary.js'), load('server/auth/trustedIssuance.js'),
  load('server/kiosk/kioskSessionActivationHandler.js'), load('server/http/kioskSessionActivationHttpAdapter.js'), load('packages/exercise-knowledge/runtime/firestoreSnapshotStore.js'),
  load('server/kiosk/kioskMemberSessions.js'), load('server/kiosk/kioskMemberSessionHandler.js'), load('server/kiosk/kioskWorkoutSessionHandler.js'), load('server/http/kioskMemberSessionHttpAdapter.js'), load('server/kiosk/kioskReadService.js'), load('server/kiosk/kioskReadHandler.js'),
]);
const [{ createKioskDeviceEnrollment }, deviceHttp, { createKioskPrintRecorder }] = await Promise.all([load('server/kiosk/kioskDeviceEnrollment.js'), load('server/http/kioskDeviceAuthHttpAdapter.js'), load('server/kiosk/kioskPrintRecordHandler.js')]);
const AGENT_PORT = 43192;
const requestedScenario = process.argv.find((argument) => argument.startsWith('--scenario='))?.slice('--scenario='.length)?.toUpperCase() ?? null;
if (requestedScenario && !/^[A-M]$/.test(requestedScenario)) throw new Error(`Unknown scenario selector: ${requestedScenario}`);

const prefix = `pm_e2e_${Date.now()}`;
const resultsFile = path.join(PM_ROOT, 'outputs', 'e2e-results', `${prefix}.json`);
const adminUid = `${prefix}_admin`; const trainerUid = `${prefix}_trainer`; const deviceId = `${prefix}_kiosk`;
// G and I each get their own registered, approved device so no scenario inherits another scenario device state.
const gDeviceId = `${prefix}_kiosk_g`;
// Phase 3-E: I revokes its own dedicated device, so the shared device is never left revoked for later scenarios.
const iDeviceId = `${prefix}_kiosk_i`;
const memberA = `${prefix}_a`; const memberB = `${prefix}_b`; const memberC = `${prefix}_c`;
const programIds = { aDefault: `${prefix}_pa`, aSecond: `${prefix}_pa2`, aArchived: `${prefix}_parch`, b: `${prefix}_pb` };
const verifier = createEmulatorAdminTokenVerifier({ projectId: PROJECT_ID, authEmulatorHost: AUTH_HOST, appName: `${prefix}_auth` });
const { db } = createEmulatorFirestoreContext({ projectId: PROJECT_ID, firestoreEmulatorHost: FIRESTORE_HOST, appName: `${prefix}_fs` });
const issuance = createTrustedIssuance({ auth: verifier.auth, db, trustedIssuerUids: [adminUid], approvedTrainerUids: [trainerUid] });
const boundary = createAuthBoundary({ verifyIdToken: verifier.verifyIdToken, expectedProjectId: PROJECT_ID, requireEmulator: true, emulatorHost: AUTH_HOST });
const profile = (id) => db.doc(`artifacts/${APP_ID}/public/data/profiles/${id}`);
const program = (id) => db.doc(`artifacts/${APP_ID}/private/data/memberWorkoutPrograms/${id}`);
const handoffDoc = (id) => db.doc(`authKioskHandoffs/${id}`);
const knowledge = db.doc(`artifacts/${APP_ID}/public/data/sharedKnowledgeRuntime/current`);
const knowledgeItem = (id, name, bodyPart) => ({ id, status: 'active', name, englishName: id, aliases: [], tags: [], purpose: [], bodyPart, primaryMuscle: name, secondaryMuscles: [], equipment: 'barbell', coachingCues: [], commonMistakes: [], contraindications: [], progressionExerciseIds: [], regressionExerciseIds: [], relatedExerciseIds: [] });
const results = [];
const persistResults = async (final = false) => {
  await mkdir(path.dirname(resultsFile), { recursive: true });
  await writeFile(resultsFile, JSON.stringify({ startedAt: prefix, final, scenarios: results.map(({ name, ok, durationMs, error }) => ({ name, status: ok ? 'PASS' : 'FAIL', ...(durationMs !== undefined ? { durationMs } : {}), ...(error ? { error } : {}) })) }, null, 2));
};
process.on('unhandledRejection', (error) => console.error('[e2e] unhandledRejection', error?.stack || error));
process.on('uncaughtException', (error) => console.error('[e2e] uncaughtException', error?.stack || error));
process.on('beforeExit', (code) => console.log(`[e2e] beforeExit code=${code}`));
process.on('exit', (code) => console.log(`[e2e] exit code=${code}`));
const step = async (name, fn) => {
  const scenario = name.match(/^([A-M])\./)?.[1];
  if (requestedScenario && scenario !== requestedScenario) { console.log(`SKIP ${name} (--scenario=${requestedScenario})`); return; }
  const started = Date.now(); console.log(`START ${name}`); try { await fn(); results.push({ name, ok: true, durationMs: Date.now() - started }); await persistResults(); console.log(`PASS ${name} (${Date.now() - started}ms)`); } catch (error) { results.push({ name, ok: false, durationMs: Date.now() - started, error: error?.stack ?? error?.message ?? String(error) }); await persistResults(); console.log(`FAIL ${name} — ${String(error?.message ?? error).split(String.fromCharCode(10))[0]}`); throw error; }
};
const EXPECTED_STEPS = requestedScenario ? 1 : 13;
const kioskSessionsOf = async () => (await db.collection(`artifacts/${APP_ID}/private/data/kioskSessions`).where('deviceId', '==', deviceId).get()).docs.map((doc) => doc.data());
const until = async (label, predicate, timeout = 15_000) => { const end = Date.now() + timeout; for (;;) { const value = await predicate(); if (value) return value; if (Date.now() > end) throw new Error(`timed out: ${label}`); await new Promise((resolve) => setTimeout(resolve, 250)); } };

let previousKnowledge = null; let gateway; let vite; let browser; let agent; let agentDeviceId = null; let credentialDir = null; let physicalSubmits = 0; let printerMode = 'ok';
const cleanup = async () => {
  await browser?.close().catch(() => {});
  // Wait for the whole Vite process tree to exit so no dev server is left on the port.
  if (vite && !vite.killed) { if (process.platform === 'win32') await new Promise((resolve) => spawn('taskkill', ['/pid', String(vite.pid), '/t', '/f'], { stdio: 'ignore' }).on('exit', resolve).on('error', resolve)); else vite.kill(); }
  if (gateway?.listening) await new Promise((resolve) => gateway.close(resolve));
  await agent?.close().catch(() => {});
  if (credentialDir) await rm(credentialDir, { recursive: true, force: true }).catch(() => {});
  if (agentDeviceId) {
    const agentDocs = (await Promise.all(['authKioskEnrollmentCodes', 'authKioskDeviceAudit', 'authKioskDeviceChallenges', `artifacts/${APP_ID}/private/data/kioskSessions`, `artifacts/${APP_ID}/private/data/kioskSessionAudit`, `artifacts/${APP_ID}/private/data/kioskSessionDevices`].map((name) => db.collection(name).where('deviceId', '==', agentDeviceId).get()))).flatMap((snapshot) => snapshot.docs);
    await Promise.all([...agentDocs.map((doc) => doc.ref.delete()), db.doc(`authKioskDevices/${agentDeviceId}`).delete(), verifier.auth.deleteUser(`kiosk:${agentDeviceId}`).catch(() => {})]);
  }
  const privateData = `artifacts/${APP_ID}/private/data`;
  const [handoffs, workoutSessions, prints, ...kioskSessionDocs] = await Promise.all([
    db.collection('authKioskHandoffs').where('deviceId', '==', deviceId).get(),
    db.collection(`artifacts/${APP_ID}/public/data/workoutSessions`).where('memberId', 'in', [memberA, memberB]).get(),
    db.collection(`artifacts/${APP_ID}/public/data/printHistory`).where('memberId', 'in', [memberA, memberB]).get().catch(() => ({ docs: [] })),
    ...['kioskSessions', 'kioskSessionAudit', 'kioskSessionDevices'].flatMap((name) => [deviceId, gDeviceId, iDeviceId].map((id) => db.collection(`${privateData}/${name}`).where('deviceId', '==', id).get())),
  ]);
  await Promise.all([
    ...handoffs.docs.map((doc) => doc.ref.delete()), ...workoutSessions.docs.map((doc) => doc.ref.delete()), ...prints.docs.map((doc) => doc.ref.delete()), ...kioskSessionDocs.flatMap((snapshot) => snapshot.docs).map((doc) => doc.ref.delete()),
    ...Object.values(programIds).map((id) => program(id).delete()), profile(memberA).delete(), profile(memberB).delete(), profile(memberC).delete(),
    issuance.paths.device(deviceId).delete().catch(() => {}), issuance.paths.device(gDeviceId).delete().catch(() => {}), issuance.paths.device(iDeviceId).delete().catch(() => {}),
    ...[adminUid, trainerUid, `kiosk:${deviceId}`, `kiosk:${gDeviceId}`, `kiosk:${iDeviceId}`].map((uid) => verifier.auth.deleteUser(uid).catch(() => {})),
    previousKnowledge ? knowledge.set(previousKnowledge) : knowledge.delete(),
  ]);
};
// Watchdog: always clean up (Vite child, API server, Emulator fixtures) even if a step hangs.
const watchdog = setTimeout(async () => { console.error('E2E watchdog: exceeded 420s'); await cleanup().catch(() => {}); process.exit(1); }, 420_000);

try {
  // Remove fixtures left by an interrupted earlier run (ids prefixed pm_e2e_).
  for (const collectionPath of [`artifacts/${APP_ID}/public/data/profiles`, `artifacts/${APP_ID}/private/data/memberWorkoutPrograms`, 'authKioskDevices', 'authKioskHandoffs']) {
    const stale = await db.collection(collectionPath).get();
    await Promise.all(stale.docs.filter((doc) => (doc.id.startsWith('pm_e2e_') || String(doc.data().deviceId || '').startsWith('pm_e2e_')) && !doc.id.startsWith(prefix)).map((doc) => doc.ref.delete()));
  }
  // --- Emulator fixtures (Admin SDK, bypasses rules). Firestore Rules coverage belongs to its separate migration. ---
  const existing = await knowledge.get(); previousKnowledge = existing.exists ? existing.data() : null;
  const items = [knowledgeItem('squat', '스쿼트', 'legs'), knowledgeItem('lunge', '런지', 'legs'), knowledgeItem('row', '바벨 로우', 'back'), knowledgeItem('bench_press', '벤치 프레스', 'chest')];
  await knowledge.set({ revision: Number(previousKnowledge?.revision || 0) + 1, schemaVersion: FIRESTORE_SNAPSHOT_SCHEMA_VERSION, knowledgeVersion: '3.0.0', updatedAt: new Date().toISOString(), updatedBy: `${prefix}:e2e-seed`, exerciseCount: items.length, checksum: await checksumKnowledgeItems(items), items });
  await Promise.all([adminUid, trainerUid].map((uid) => verifier.auth.createUser({ uid })));
  await Promise.all([profile(memberA).set({ id: memberA, name: '추천회원', role: 'member' }), profile(memberB).set({ id: memberB, name: '추가회원', role: 'member' }), profile(memberC).set({ id: memberC, name: '초보회원', role: 'member' })]);
  const now = new Date();
  await Promise.all([
    program(programIds.aDefault).set({ id: programIds.aDefault, memberId: memberA, name: '트레이너 하체 루틴', description: '내부 메모', isDefault: true, status: 'active', revision: 1, exercises: [{ exerciseId: 'lunge', name: '런지', order: 2, plannedSets: 3 }, { exerciseId: 'squat', name: '스쿼트', order: 1, plannedSets: 4, memo: '무릎 정렬' }], updatedAt: now, createdAt: now }),
    program(programIds.aSecond).set({ id: programIds.aSecond, memberId: memberA, name: '트레이너 상체 루틴', isDefault: false, status: 'active', revision: 1, exercises: [{ exerciseId: 'row', name: '바벨 로우', order: 1, plannedSets: 5 }, { exerciseId: 'bench_press', name: '벤치 프레스', order: 2, plannedSets: 3 }], updatedAt: now, createdAt: now }),
    program(programIds.aArchived).set({ id: programIds.aArchived, memberId: memberA, name: '보관된 루틴', isDefault: false, status: 'archived', revision: 1, exercises: [{ exerciseId: 'row', name: '바벨 로우', order: 1, plannedSets: 1 }], updatedAt: now, createdAt: now }),
    program(programIds.b).set({ id: programIds.b, memberId: memberB, name: '다른 회원 루틴', isDefault: true, status: 'active', revision: 1, exercises: [{ exerciseId: 'row', name: '바벨 로우', order: 1, plannedSets: 2 }], updatedAt: now, createdAt: now }),
  ]);
  const originals = JSON.stringify((await Promise.all(Object.values(programIds).map((id) => program(id).get()))).map((doc) => doc.data()));
  await issuance.issueTrainer({ issuerUid: adminUid, targetUid: trainerUid });
  await issuance.registerKioskDevice({ issuerUid: adminUid, deviceId, label: 'E2E Front Kiosk' });
  const deviceEnrollmentToken = (await issuance.issueKioskDeviceToken({ issuerUid: adminUid, deviceId })).customToken;
  const trainerToken = await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=emulator-test-key`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: await verifier.auth.createCustomToken(trainerUid), returnSecureToken: true }) }).then((response) => response.json()).then((body) => body.idToken);
  const issueHandoff = async (memberId, programId) => {
    const response = await fetch(`http://127.0.0.1:${API_PORT}/v1/trainer/kiosk-handoffs`, { method: 'POST', headers: { authorization: `Bearer ${trainerToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ deviceId, memberId, programId }) });
    const body = await response.json(); assert.equal(response.status, 201, JSON.stringify(body)); return body.handoff.handoffId;
  };
  const handoffStatus = async (handoffId) => (await handoffDoc(handoffId).get()).data()?.status;
  // Phase 3-E fixture helper: a printed (copy 1) workout session for a member, created exactly as the Kiosk does
  // (member session → save → print record) through the real Kiosk API on the shared device. Used by K so it does
  // not depend on the records D/E/F leave behind.
  const signInCustom = async (customToken) => fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=emulator-test-key`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) }).then((response) => response.json()).then((body) => body.idToken);
  const kioskCall = async (method, route, { idToken, session, body } = {}) => {
    const response = await fetch(`http://127.0.0.1:${API_PORT}${route}`, { method, headers: { authorization: `Bearer ${idToken}`, ...(session ? { 'x-basecamp-kiosk-session': session } : {}), ...(method === 'POST' ? { 'content-type': 'application/json' } : {}) }, ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}) });
    return { status: response.status, body: await response.json().catch(() => null) };
  };
  const seedPrintedSession = async (memberId) => {
    const idToken = await signInCustom(deviceEnrollmentToken);
    const opened = await kioskCall('POST', '/v1/kiosk/sessions', { idToken, body: { memberId } }); assert.equal(opened.status, 201, `seed session ${JSON.stringify(opened.body)}`);
    const session = opened.body.kioskSession.token;
    const today = new Date(); const dateKey = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const workoutSessionId = `ws_${dateKey}_${randomBytes(6).toString('hex')}`;
    const saved = await kioskCall('POST', '/v1/kiosk/workout-sessions', { idToken, session, body: { workoutSessionId, memberId, programTitle: 'K 재출력 기준 루틴', source: { type: 'manual' }, category: 'LOWER_BODY', exercises: [{ exerciseId: 'squat', programExerciseId: 'e1', name: '스쿼트', order: 1, plannedSets: 3 }, { exerciseId: 'lunge', programExerciseId: 'e2', name: '런지', order: 2, plannedSets: 3 }] } });
    assert.ok(saved.status === 200 || saved.status === 201, `seed save ${JSON.stringify(saved.body)}`);
    const printed = await kioskCall('POST', `/v1/kiosk/workout-sessions/${workoutSessionId}/prints`, { idToken, session, body: { printRequestId: `pr_${randomBytes(16).toString('hex')}`, printer: 'E2E Printer' } });
    assert.ok(printed.status === 200 || printed.status === 201, `seed print record ${JSON.stringify(printed.body)}`);
    await kioskCall('POST', '/v1/kiosk/sessions/current/close', { idToken, session });
    return workoutSessionId;
  };

  // --- Local Kiosk API: handoff + default program, and the Phase 2 member session + workout-session save ---
  const kioskSessions = createKioskMemberSessionService({ authBoundary: boundary, db, issuance, appId: APP_ID });
  const sessionServer = sessionHttp.createKioskMemberSessionHttpServer({ handleKioskMemberSession: createKioskMemberSessionHandler({ sessions: kioskSessions, saveWorkoutSession: createKioskWorkoutSessionSaver({ sessions: kioskSessions, db, appId: APP_ID }), recordPrint: createKioskPrintRecorder({ sessions: kioskSessions, db, appId: APP_ID }) }) });
  const readServer = readHttp.createKioskReadHttpServer({ handleKioskRead: readHttp.createKioskReadHandler({ authBoundary: boundary, issuance, sessions: kioskSessions, reads: createKioskReadService({ db, appId: APP_ID, rankingCacheMs: 0 }) }) });
  const handoffServer = handoffHttp.createKioskSessionActivationHttpServer({ handleKioskSessionActivation: createKioskSessionActivationHandler({ authBoundary: boundary, db, issuance }) });
  // Phase 3-A production path: device enrollment/auth routes + a real agent holding an approved device key.
  const deviceEnrollment = createKioskDeviceEnrollment({ auth: verifier.auth, db, projectId: PROJECT_ID, appId: APP_ID });
  const deviceServer = deviceHttp.createKioskDeviceAuthHttpServer({ enrollment: deviceEnrollment });
  gateway = handoffHttp.createLocalApiGateway({ routes: [{ match: readHttp.isKioskReadPath, server: readServer }, { match: deviceHttp.isKioskDeviceAuthPath, server: deviceServer }, { match: sessionHttp.isKioskMemberSessionPath, server: sessionServer }, { match: handoffHttp.isKioskSessionActivationPath, server: handoffServer }] });
  await new Promise((resolve, reject) => { gateway.once('error', reject); gateway.listen(API_PORT, '127.0.0.1', resolve); });

  // --- Program Manager dev server against the Emulator (process env overrides .env.local) ---
  const origin = `http://127.0.0.1:${PM_PORT}`;
  // Enroll + approve a device the way an operator would, with the agent's credential module (test cipher instead of DPAPI).
  const operator = { kind: 'admin-cli', operator: 'e2e', host: 'e2e' };
  const issuedCode = await deviceEnrollment.issueEnrollmentCode({ actor: operator, label: 'E2E agent kiosk' }); agentDeviceId = issuedCode.deviceId;
  const cipherKey = randomBytes(32);
  const protector = { kind: 'test-aes-gcm', protect: async (data) => { const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', cipherKey, iv); return Buffer.concat([iv, cipher.update(data), cipher.final(), cipher.getAuthTag()]); }, unprotect: async (data) => { const decipher = createDecipheriv('aes-256-gcm', cipherKey, data.subarray(0, 12)); decipher.setAuthTag(data.subarray(-16)); return Buffer.concat([decipher.update(data.subarray(12, -16)), decipher.final()]); } };
  credentialDir = await mkdtemp(path.join(tmpdir(), 'pm-e2e-cred-'));
  const agentCredential = createKioskDeviceCredential({ config: { apiBaseUrl: `http://127.0.0.1:${API_PORT}`, projectId: PROJECT_ID, appId: APP_ID }, protector, credentialPath: path.join(credentialDir, 'device-credential.json') });
  const redeemed = await agentCredential.enroll(issuedCode.code);
  await deviceEnrollment.approveDevice({ actor: operator, deviceId: redeemed.deviceId, fingerprint: redeemed.keyFingerprint });
  let agentTokenRequests = 0;
  const minimalPdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 420]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF';
  const pdfPipeline = { create: async ({ jobId }) => { const file = path.join(credentialDir, `${String(jobId).replace(/[^A-Za-z0-9_-]/g, '_')}-${Date.now()}.pdf`); await writeFile(file, minimalPdf); return { path: file, cleanup: async () => rm(file, { force: true }), metadata: { pageCount: 1, bytes: minimalPdf.length } }; } };
  const printBackend = { getStatus: async () => ({ printerConfigured: true, configuredPrinter: 'E2E Printer', printerAvailable: true, printerStatus: 'Normal', defaultPrinter: 'E2E Printer' }), submit: async () => { console.log(`[e2e][D-flow] print-backend submit START mode=${printerMode}`); physicalSubmits += 1; const outcome = printerMode === 'fail' ? { status: 'failed', reason: 'physical_printer_unavailable' } : { status: 'submitted', printer: 'E2E Printer' }; console.log(`[e2e][D-flow] print-backend submit ${outcome.status.toUpperCase()} total=${physicalSubmits}`); return outcome; } };
  agent = createPrintAgent({ port: AGENT_PORT, allowedOrigins: [origin], deviceTokenOrigins: [origin], logger: { info: async (message) => console.log(`[e2e][agent] ${String(message)}`), error: async (message) => console.error(`[e2e][agent] ${String(message)}`) }, backend: printBackend, pdfPipeline, deviceCredential: async () => ({ getCustomToken: async () => { agentTokenRequests += 1; return agentCredential.getCustomToken(); } }) });
  await agent.listen();
  vite = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--host', '127.0.0.1', '--port', String(PM_PORT), '--strictPort'], { cwd: PM_ROOT, shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'], env: {
    ...process.env,
    VITE_FIREBASE_USE_EMULATOR: 'true', VITE_FIREBASE_EMULATOR_HOST: '127.0.0.1', VITE_FIRESTORE_EMULATOR_PORT: '18080', VITE_FIREBASE_AUTH_EMULATOR_PORT: '19099',
    VITE_FIREBASE_API_KEY: 'emulator-test-key', VITE_FIREBASE_AUTH_DOMAIN: 'localhost', VITE_FIREBASE_PROJECT_ID: PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET: `${PROJECT_ID}.appspot.com`, VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000', VITE_FIREBASE_APP_ID: '1:000000000000:web:e2etest',
    VITE_CONDITION_LAB_APP_ID: APP_ID, VITE_CONDITION_LAB_API_BASE_URL: origin, VITE_KIOSK_API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}`, VITE_KIOSK_DEVICE_AGENT_ENDPOINT: `http://127.0.0.1:${AGENT_PORT}`,
    VITE_PRINT_RUNTIME: 'windows-agent', VITE_PRINT_AGENT_ENDPOINT: `http://127.0.0.1:${AGENT_PORT}`, VITE_GEMINI_API_KEY: '',
  } });
  let viteLog = ''; vite.stdout.on('data', (chunk) => { viteLog += chunk; }); vite.stderr.on('data', (chunk) => { viteLog += chunk; });
  vite.once('error', (error) => console.error(`[e2e] vite spawn error: ${error.message}`));
  vite.once('exit', (code, signal) => console.error(`[e2e] vite exited before cleanup: code=${code} signal=${signal ?? 'none'}\n${viteLog.slice(-2000)}`));
  console.log(`[e2e] Vite starting pid=${vite.pid} at ${origin}`);
  for (let attempt = 0; attempt < 60; attempt += 1) { try { if ((await fetch(origin)).ok) break; } catch { /* starting */ } await new Promise((resolve) => setTimeout(resolve, 500)); if (attempt === 59) throw new Error(`Program Manager dev server did not start.\n${viteLog.slice(-2000)}`); }
  await fetch(`${origin}/program-manager/print`).catch(() => {});

  console.log('[e2e] Vite ready; launching Chromium');
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || 'chrome', headless: true });
  console.log('[e2e] Chromium launched');
  browser.on('disconnected', () => console.log('[e2e] Chromium disconnected'));
  console.log('[e2e] Creating browser context');
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  console.log('[e2e] Browser context created');
  context.on('close', () => console.log('[e2e] Browser context closed'));
  await context.addInitScript((token) => { window.__kiosk_device_token = token; window.print = () => {}; }, deviceEnrollmentToken);
  console.log('[e2e] Browser init script installed; creating page');
  const page = await context.newPage();
  console.log('[e2e] Browser page created');
  page.on('close', () => console.log('[e2e] Browser page closed'));
  page.on('pageerror', (error) => console.error('[e2e] pageerror', error?.stack || error));
  page.on('console', (message) => { if (message.type() === 'error') console.error(`[e2e] browser console error: ${message.text()}`); });
  page.on('requestfailed', (request) => console.error(`[e2e] request failed: ${new URL(request.url()).pathname} ${request.failure()?.errorText || ''}`));
  page.setDefaultTimeout(30_000); page.setDefaultNavigationTimeout(90_000);
  const consoleErrors = []; page.on('pageerror', (error) => consoleErrors.push(error.message));
  const firebaseHosts = new Set(); page.on('request', (request) => { const host = new URL(request.url()).host; if (/googleapis\.com|firebaseio\.com|firebaseapp\.com/.test(host)) firebaseHosts.add(host); });
  const kioskRequests = []; page.on('request', (request) => { if (request.url().includes('/v1/kiosk/')) kioskRequests.push(request.url()); });
  const dFlow = [];
  const observePrintFlow = (phase, requestOrResponse) => {
    const request = typeof requestOrResponse.request === 'function' ? requestOrResponse.request() : requestOrResponse;
    const url = new URL(request.url());
    const isAgent = url.port === String(AGENT_PORT);
    const isPrintRecord = /\/v1\/kiosk\/workout-sessions\/[^/]+\/prints$/.test(url.pathname);
    if (!isAgent && !isPrintRecord) return;
    const entry = { at: new Date().toISOString(), phase, method: request.method(), target: `${url.host}${url.pathname}`, ...(typeof requestOrResponse.status === 'function' ? { status: requestOrResponse.status() } : {}) };
    dFlow.push(entry); console.log(`[e2e][D-flow] ${phase} ${entry.method} ${entry.target}${entry.status ? ` status=${entry.status}` : ''}`);
  };
  page.on('request', (request) => observePrintFlow('REQUEST', request));
  page.on('response', (response) => observePrintFlow('RESPONSE', response));

  const begin = async (target = page) => {
    console.log('[e2e] Navigating to print page'); await target.goto(`${origin}/program-manager/print`); console.log(`[e2e] Print page loaded url=${new URL(target.url()).pathname}`);
    const start = target.getByRole('button', { name: '프로그램 시작', exact: true });
    console.log('[e2e] Start selector lookup'); await start.waitFor({ state: 'visible', timeout: 15_000 }); console.log('[e2e] Start selector visible');
    console.log(`[e2e] Start enabled=${await start.isEnabled()}`);
    console.log('[e2e] Start click begin'); await start.click({ timeout: 15_000 }); console.log(`[e2e] Start click complete url=${new URL(target.url()).pathname}`);
    console.log('[e2e] Member selection wait begin'); await target.getByText('회원 선택', { exact: false }).first().waitFor({ state: 'visible', timeout: 15_000 }); console.log('[e2e] Member selection wait complete');
  };
  const openMember = async (name, initial = 'ㅊ', target = page) => {
    // The initial filter toggles; only press it when it is not already active.
    const initialButton = target.getByRole('button', { name: initial, exact: true });
    if (await initialButton.getAttribute('aria-pressed') !== 'true') await initialButton.click();
    await target.getByRole('button', { name: `${name} 회원 선택` }).click();
  };
  const card = page.getByRole('region', { name: '트레이너 추천 프로그램' });
  const sessionRecord = async () => {
    await page.waitForURL(/\/program-manager\/print\/session\/ws_\d{8}_[a-z0-9]+/, { timeout: 20_000 }); const sessionId = new URL(page.url()).pathname.split('/').pop();
    const record = (await db.doc(`artifacts/${APP_ID}/public/data/workoutSessions/${sessionId}`).get()).data();
    // Saved by the server API with the Kiosk session: device creator, profile name, no browser-held token anywhere.
    assert.equal(record.trainerId, `kiosk:${deviceId}`); assert.equal(record.createdBy?.deviceId, deviceId); assert.match(record.createdBy?.kioskSessionId ?? '', /^[0-9a-f]{64}$/);
    assert.equal(record.memberSnapshot.name, record.memberId === memberA ? '추천회원' : '추가회원');
    assert.ok(kioskRequests.some((url) => url.endsWith('/v1/kiosk/workout-sessions')), 'saved through the Kiosk API');
    const browserState = await page.evaluate(() => JSON.stringify({ url: location.href, local: { ...localStorage }, session: { ...sessionStorage } }));
    assert.equal(browserState.includes('bks1_'), false, 'session token never in URL or Web Storage');
    assert.equal(kioskRequests.some((url) => url.includes('bks1_')), false, 'session token never in a request URL');
    // The member session is handed to the print preview (still ACTIVE there), which prints and records through the API.
    assert.ok((await kioskSessionsOf()).some((item) => item.status === 'ACTIVE' && item.memberId === record.memberId), 'session handed over to the preview');
    try {
      await page.getByText('출력이 완료되었습니다.').waitFor({ timeout: 30_000 });
    } catch (error) {
      const screenshot = path.join(PM_ROOT, 'outputs', 'e2e-results', `${prefix}-D-print-flow-failure.png`);
      await mkdir(path.dirname(screenshot), { recursive: true });
      await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
      console.error(`[e2e][D-flow] completion timeout url=${new URL(page.url()).pathname} physicalSubmits=${physicalSubmits} screenshot=${screenshot}`);
      console.error(`[e2e][D-flow] observed=${JSON.stringify(dFlow)}`);
      throw error;
    }
    const printed = await printHistoryOf(sessionId, 1);
    assert.equal(printed[0].memberId, record.memberId); assert.equal(printed[0].createdBy, `kiosk:${deviceId}`); assert.equal(printed[0].copy, 1); assert.equal(printed[0].printer, 'E2E Printer');
    assert.equal(printed[0].programId, record.source.type === 'program' ? record.source.programId : sessionId, 'programId as in the A5 document; no programs document needed');
    const after = (await db.doc(`artifacts/${APP_ID}/public/data/workoutSessions/${sessionId}`).get()).data();
    assert.equal(after.status, 'printed'); assert.equal(after.print.copyCount, 1); assert.deepEqual(after.print.historyIds, [printed[0].id]);
    // Leaving the preview ends the member session.
    await page.getByRole('button', { name: '처음으로' }).click();
    await until('session closed after leaving the preview', async () => (await kioskSessionsOf()).every((item) => item.status !== 'ACTIVE'));
    return record;
  };
  const printHistoryOf = async (workoutSessionId, expected) => until(`printHistory x${expected} for ${workoutSessionId}`, async () => { const docs = (await db.collection(`artifacts/${APP_ID}/public/data/printHistory`).where('workoutSessionId', '==', workoutSessionId).get()).docs.map((doc) => doc.data()); return docs.length === expected ? docs.sort((left, right) => left.copy - right.copy) : null; }, 20_000);
  const saveWithRecommendation = async () => { await begin(); await openMember('추천회원'); await card.waitFor({ timeout: 20_000 }); await card.getByRole('button', { name: '추천대로 운동하기' }).click(); await page.getByRole('button', { name: '이 프로그램으로 진행하기' }).click(); await page.waitForURL(/\/program-manager\/print\/session\/ws_\d{8}_[a-z0-9]+/, { timeout: 20_000 }); return new URL(page.url()).pathname.split('/').pop(); };

  const defaultRequest = (memberId) => `/v1/kiosk/members/${encodeURIComponent(memberId)}/default-workout-program`;
  // The existing Trainer → Kiosk handoff API stays available; the default-program flow must not consume it.
  const preservedHandoff = await issueHandoff(memberA, programIds.aSecond);

  await step('A. Selecting A auto-loads only A\'s active default recommendation via the new API', async () => {
    await begin(); await openMember('추천회원');
    await card.waitFor({ timeout: 20_000 });
    assert.ok(await card.getByText('트레이너 하체 루틴').isVisible(), 'default program name shown');
    assert.ok(await card.getByText('스쿼트 · 4세트 · 무릎 정렬').isVisible(), 'ordered exercises with memo');
    for (const hidden of ['트레이너 상체 루틴', '보관된 루틴', '다른 회원 루틴']) assert.equal(await card.getByText(hidden).count(), 0, `${hidden} hidden`);
    assert.ok(kioskRequests.some((url) => url.endsWith(defaultRequest(memberA))), `default program requested for A: ${kioskRequests}`);
    assert.equal(kioskRequests.some((url) => url.includes('/v1/kiosk/handoff')), false, 'no handoff read or close from the Kiosk');
    await until('a Kiosk member session for A', async () => (await kioskSessionsOf()).filter((item) => item.status === 'ACTIVE' && item.memberId === memberA).length === 1);
    for (const name of ['추천대로 운동하기', '수정해서 사용', '직접 구성하기']) {
      const box = await card.getByRole('button', { name }).boundingBox();
      assert.ok(box && box.height >= 64 && box.width >= 200, `${name} is a kiosk-sized touch target: ${JSON.stringify(box)}`);
    }
  });

  await step('B. Switching to B shows B\'s default only; A\'s card is gone', async () => {
    // Phase 3-E: B sets up its own starting state (A selected, A's card shown) instead of inheriting A's screen.
    await begin(); await openMember('추천회원');
    await card.getByText('트레이너 하체 루틴').waitFor({ timeout: 20_000 });
    await until('a Kiosk member session for A before switching', async () => (await kioskSessionsOf()).some((item) => item.status === 'ACTIVE' && item.memberId === memberA));
    await openMember('추가회원');
    await card.getByText('다른 회원 루틴').waitFor({ timeout: 20_000 });
    assert.equal(await card.getByText('트레이너 하체 루틴').count(), 0);
    assert.ok(kioskRequests.some((url) => url.endsWith(defaultRequest(memberB))));
    // Switching members leaves exactly one ACTIVE session, for B; A's session is no longer usable.
    await until('only B active', async () => { const active = (await kioskSessionsOf()).filter((item) => item.status === 'ACTIVE'); return active.length === 1 && active[0].memberId === memberB; });
    assert.ok((await kioskSessionsOf()).filter((item) => item.memberId === memberA).every((item) => item.status !== 'ACTIVE'));
  });

  await step('C. Member without a default → no card; existing flow continues', async () => {
    await begin(); await openMember('초보회원');
    await page.getByRole('button', { name: '초보회원 회원으로 계속하기' }).waitFor();
    await page.waitForTimeout(1500);
    assert.equal(await card.count(), 0, 'program: null → no card');
    assert.equal(await page.getByText(/트레이너 추천/).count(), 0, 'no recommendation notice for a member without one');
    assert.equal(await page.getByRole('progressbar', { name: '트레이너 추천 확인 중' }).count(), 0, 'loading indicator gone');
  });

  await step('D. 수정해서 사용 opens the existing editor → snapshot source=recommendation edited=true', async () => {
    await begin(); await openMember('추천회원');
    await card.waitFor({ timeout: 20_000 });
    await card.getByRole('button', { name: '수정해서 사용' }).click();
    await page.getByRole('button', { name: '2번 운동 세트 줄이기' }).click();
    await page.getByRole('button', { name: '출력 준비하기' }).click();
    await page.getByRole('button', { name: '이 프로그램으로 진행하기' }).click();
    const record = await sessionRecord();
    assert.equal(record.memberId, memberA);
    assert.deepEqual(record.source, { type: 'recommendation', memberProgramId: programIds.aDefault, edited: true });
    assert.equal(record.programId, undefined);
    assert.deepEqual(record.exercises.map((item) => [item.exerciseId, item.order, item.plannedSets]), [['squat', 1, 4], ['lunge', 2, 2]]);
  });

  await step('E. 추천대로 운동하기 (accept): default program as-is → edited=false, order/sets/memo preserved', async () => {
    await begin(); await openMember('추천회원');
    await card.waitFor({ timeout: 20_000 });
    await card.getByRole('button', { name: '추천대로 운동하기' }).click();
    await page.getByRole('button', { name: '이 프로그램으로 진행하기' }).click();
    const record = await sessionRecord();
    assert.deepEqual(record.source, { type: 'recommendation', memberProgramId: programIds.aDefault, edited: false });
    assert.deepEqual(record.exercises.map((item) => [item.exerciseId, item.order, item.plannedSets, item.memo ?? '']), [['squat', 1, 4, '무릎 정렬'], ['lunge', 2, 3, '']]);
  });

  await step('F. 직접 구성하기 (decline) uses the existing manual builder (source=manual)', async () => {
    await begin(); await openMember('추천회원');
    await card.waitFor({ timeout: 20_000 });
    await card.getByRole('button', { name: '직접 구성하기' }).click();
    await page.getByRole('dialog').getByText('벤치 프레스', { exact: true }).first().click();
    await page.getByRole('button', { name: '출력 준비하기' }).click();
    await page.getByRole('button', { name: '이 구성으로 진행하기' }).click();
    const record = await sessionRecord();
    assert.deepEqual(record.source, { type: 'manual' });
    assert.equal(record.exercises[0].exerciseId, 'bench_press');
  });

  await step('K. Reprint from the workout history uses the member chosen there; a preview opened without a selection prints nothing', async () => {
    // Phase 3-E: K seeds its own printed (copy 1) member A session through the Kiosk API instead of relying on D/E/F.
    // It is the newest A record, so it is the first card; any A record printed once would give copy 2 as well.
    const seededId = await seedPrintedSession(memberA);
    await printHistoryOf(seededId, 1);
    await page.goto(`${origin}/program-manager/print`); await page.getByRole('button', { name: '이전 운동 기록 보기' }).click();
    await page.getByPlaceholder('회원명 또는 전화번호 검색').fill('추천회원');
    await page.getByRole('button', { name: '추천회원', exact: true }).click();
    await until('history selection opened a session for A', async () => (await kioskSessionsOf()).some((item) => item.status === 'ACTIVE' && item.memberId === memberA));
    await page.getByRole('button', { name: /종목/ }).first().click();
    await page.getByRole('button', { name: '이 운동기록 다시 출력' }).click();
    await page.getByText('재출력을 요청했습니다.').waitFor({ timeout: 30_000 });
    const reprintedId = new URL(page.url()).pathname.split('/').pop();
    const records = await printHistoryOf(reprintedId, 2);
    assert.deepEqual(records.map((item) => item.copy), [1, 2]); assert.equal(records[1].memberId, memberA); assert.equal(records[1].createdBy, `kiosk:${deviceId}`);
    const reprinted = (await db.doc(`artifacts/${APP_ID}/public/data/workoutSessions/${reprintedId}`).get()).data();
    assert.equal(reprinted.print.copyCount, 2); assert.deepEqual(reprinted.print.historyIds, records.map((item) => item.id));
    const expectedCopy = 2;
    // Opening a preview URL directly (no member selected on this page load) must not print or record anything.
    const submitsBefore = physicalSubmits;
    await page.goto(`${origin}${new URL(page.url()).pathname}?memberId=${encodeURIComponent(memberA)}&autoPrint=1`);
    await page.getByText('선택된 회원 정보가 없습니다', { exact: false }).waitFor({ timeout: 30_000 });
    assert.equal(physicalSubmits, submitsBefore, 'nothing printed without a member selection');
    assert.equal((await printHistoryOf(reprintedId, expectedCopy)).length, expectedCopy, 'no new record');
  });

  await step('L. Physical print failure: error shown, nothing recorded, session print status unchanged', async () => {
    printerMode = 'fail';
    try {
      const sessionId = await saveWithRecommendation();
      await page.getByText('출력하지 못했습니다. 프린터 연결을 확인해 주세요.').waitFor({ timeout: 30_000 });
      assert.equal((await db.collection(`artifacts/${APP_ID}/public/data/printHistory`).where('workoutSessionId', '==', sessionId).get()).size, 0);
      assert.equal((await db.doc(`artifacts/${APP_ID}/public/data/workoutSessions/${sessionId}`).get()).data().status, 'created');
    } finally { printerMode = 'ok'; }
  });

  await step('M. Print succeeded but the record response was lost and retries failed: warning, no re-print, manual retry replays the same record once', async () => {
    let attempts = 0;
    await page.route('**/v1/kiosk/workout-sessions/*/prints', async (route) => {
      attempts += 1;
      if (attempts === 1) { const response = await route.fetch(); assert.equal(response.status(), 201, 'server stored the record'); await route.abort('failed'); return; }
      await route.abort('failed');
    });
    const submitsBefore = physicalSubmits;
    const sessionId = await saveWithRecommendation();
    await page.getByText('출력 기록 저장 상태를 확인해 주세요.').waitFor({ timeout: 30_000 });
    assert.equal(attempts, 3, 'client retried with the same key, then stopped');
    assert.equal(physicalSubmits, submitsBefore + 1, 'the physical print is never repeated');
    const stored = await printHistoryOf(sessionId, 1);
    await page.unroute('**/v1/kiosk/workout-sessions/*/prints');
    const replay = page.waitForResponse((response) => response.url().endsWith('/prints'));
    await page.getByRole('button', { name: '출력 기록 다시 저장' }).click();
    const replayed = await (await replay).json();
    assert.equal(replayed.replayed, true); assert.equal(replayed.printRecord.id, stored[0].id, 'same idempotency key → same record');
    await page.getByText('출력 기록 저장 상태를 확인해 주세요.').waitFor({ state: 'detached', timeout: 10_000 });
    assert.equal((await printHistoryOf(sessionId, 1))[0].copy, 1);
    const after = (await db.doc(`artifacts/${APP_ID}/public/data/workoutSessions/${sessionId}`).get()).data();
    assert.equal(after.print.copyCount, 1); assert.deepEqual(after.print.historyIds, [stored[0].id]);
    assert.equal(physicalSubmits, submitsBefore + 1);
  });

  await step('J. Production device path: no Emulator hook, token from the agent-held approved key → recommendation, session and save work', async () => {
    const agentContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await agentContext.addInitScript(() => { window.print = () => {}; });
    const agentPage = await agentContext.newPage(); agentPage.setDefaultTimeout(30_000); agentPage.setDefaultNavigationTimeout(90_000);
    const agentErrors = []; agentPage.on('pageerror', (error) => agentErrors.push(error.message));
    const agentFlow = [];
    const observeAgent = (phase, item) => { const request = typeof item.request === 'function' ? item.request() : item; const url = new URL(request.url()); if (!(url.port === String(AGENT_PORT) || url.pathname === '/v1/kiosk/members' || url.pathname.includes('/identitytoolkit/'))) return; const entry = { phase, method: request.method(), target: `${url.host}${url.pathname}`, ...(typeof item.status === 'function' ? { status: item.status() } : {}) }; agentFlow.push(entry); console.log(`[e2e][J] ${phase} ${entry.method} ${entry.target}${entry.status ? ` status=${entry.status}` : ''}`); };
    agentPage.on('request', (request) => observeAgent('REQUEST', request)); agentPage.on('response', (response) => observeAgent('RESPONSE', response));
    agentPage.on('requestfailed', (request) => console.error(`[e2e][J] REQUEST_FAILED ${new URL(request.url()).pathname} ${request.failure()?.errorText ?? ''}`));
    agentPage.on('framenavigated', (frame) => { if (frame === agentPage.mainFrame()) console.error(`[e2e][J] FRAME_NAVIGATED at=${Date.now()} url=${frame.url()}`); });
    agentPage.on('domcontentloaded', () => console.error(`[e2e][J] DOM_CONTENT_LOADED at=${Date.now()} url=${agentPage.url()}`));
    agentPage.on('load', () => console.error(`[e2e][J] PAGE_LOAD at=${Date.now()} url=${agentPage.url()}`));
    agentPage.on('close', () => console.error(`[e2e][J] PAGE_CLOSED at=${Date.now()}`));
    agentPage.on('console', (message) => {
      const text = message.text();
      if (message.type() === 'error' || ((message.type() === 'debug' || message.type() === 'info') && (text.startsWith('[J-members]') || text.startsWith('[J-flow]') || text.startsWith('[J-lifecycle]') || text.startsWith('[J-navigation]')))) console.error(`[e2e][J] CONSOLE/${message.type()} ${text}`);
    });
    await agentPage.goto(`${origin}/program-manager/print`); await agentPage.getByRole('button', { name: '프로그램 시작' }).click();
    const initialButton = agentPage.getByRole('button', { name: 'ㅊ', exact: true }); if (await initialButton.getAttribute('aria-pressed') !== 'true') await initialButton.click();
    try { await agentPage.getByRole('button', { name: '추천회원 회원 선택' }).click(); } catch (error) { const screenshot = path.join(PM_ROOT, 'outputs', 'e2e-results', `${prefix}-J-failure.png`); await mkdir(path.dirname(screenshot), { recursive: true }); await agentPage.screenshot({ path: screenshot, fullPage: true }).catch(() => {}); console.error(`[e2e][J] failure url=${new URL(agentPage.url()).pathname} tokenRequests=${agentTokenRequests} screenshot=${screenshot} flow=${JSON.stringify(agentFlow)}`); throw error; }
    const agentCard = agentPage.getByRole('region', { name: '트레이너 추천 프로그램' });
    await agentCard.waitFor({ timeout: 20_000 });
    assert.ok(agentTokenRequests >= 1, 'the browser obtained its device identity from the agent');
    await until('agent device session for A', async () => (await db.collection(`artifacts/${APP_ID}/private/data/kioskSessions`).where('deviceId', '==', agentDeviceId).get()).docs.some((doc) => doc.data().status === 'ACTIVE' && doc.data().memberId === memberA));
    await agentCard.getByRole('button', { name: '추천대로 운동하기' }).click();
    await agentPage.getByRole('button', { name: '이 프로그램으로 진행하기' }).click();
    await agentPage.waitForURL(/\/program-manager\/print\/session\/ws_\d{8}_[a-z0-9]+/, { timeout: 20_000 });
    const record = (await db.doc(`artifacts/${APP_ID}/public/data/workoutSessions/${new URL(agentPage.url()).pathname.split('/').pop()}`).get()).data();
    assert.equal(record.trainerId, `kiosk:${agentDeviceId}`); assert.equal(record.memberId, memberA);
    // In-memory device persistence: no device user or token in Web Storage or Firebase's IndexedDB store.
    const stored = await agentPage.evaluate(async () => {
      const keys = [...Object.keys(localStorage), ...Object.keys(sessionStorage)];
      const dbs = (await indexedDB.databases?.()) ?? [];
      for (const info of dbs) {
        if (!info.name) continue;
        const values = await new Promise((resolve) => { const open = indexedDB.open(info.name); open.onerror = () => resolve([]); open.onsuccess = () => { const database = open.result; const all = []; const names = [...database.objectStoreNames]; if (!names.length) { database.close(); resolve(all); return; } const tx = database.transaction(names, 'readonly'); names.forEach((name) => { const request = tx.objectStore(name).getAll(); request.onsuccess = () => all.push(...request.result); }); tx.oncomplete = () => { database.close(); resolve(all); }; tx.onerror = () => { database.close(); resolve(all); }; }; });
        keys.push(JSON.stringify(values));
      }
      return keys.join('|');
    });
    assert.equal(stored.includes('basecamp-kiosk-device'), false, 'device auth state is not persisted'); assert.equal(stored.includes(`kiosk:${agentDeviceId}`), false, 'device user not persisted');
    assert.deepEqual(agentErrors, []);
    // Revoking the device through the admin path cuts the agent off: a reload yields no device identity.
    // A revoked device reaches no protected data at all, the member list included (fail closed before any API call).
    await deviceEnrollment.revokeDevice({ actor: operator, deviceId: agentDeviceId, reason: 'e2e' });
    const agentSessionsOf = async () => (await db.collection(`artifacts/${APP_ID}/private/data/kioskSessions`).where('deviceId', '==', agentDeviceId).get()).size;
    const agentWorkoutSessionsOf = async () => (await db.collection(`artifacts/${APP_ID}/public/data/workoutSessions`).where('trainerId', '==', `kiosk:${agentDeviceId}`).get()).size;
    const revokedFlowStart = agentFlow.length; const sessionsBeforeRevokedVisit = await agentSessionsOf(); const workoutSessionsBeforeRevokedVisit = await agentWorkoutSessionsOf(); const submitsBeforeRevokedVisit = physicalSubmits;
    await agentPage.goto(`${origin}/program-manager/print`); await agentPage.getByRole('button', { name: '프로그램 시작' }).click();
    const again = agentPage.getByRole('button', { name: 'ㅊ', exact: true }); if (await again.getAttribute('aria-pressed') !== 'true') await again.click();
    // The member-list failure surfaces as ErrorState (role=alert): the agent refuses the token, so the identity is null
    // (KIOSK_DEVICE_NOT_ENROLLED). Phase 3-E: the alert shows Korean guidance; the internal code is never rendered.
    await agentPage.getByRole('alert').filter({ hasText: '키오스크 기기 인증이 필요합니다' }).waitFor({ timeout: 20_000 });
    assert.equal(/KIOSK_[A-Z_]+/.test(await agentPage.locator('body').innerText()), false, 'no raw KIOSK_* code on screen');
    const revokedFlow = agentFlow.slice(revokedFlowStart);
    const revokedTokenResponses = revokedFlow.filter((entry) => entry.phase === 'RESPONSE' && entry.target.endsWith('/kiosk/device-token'));
    assert.ok(revokedTokenResponses.length >= 1, 'the revoked device asked the agent for a token');
    assert.ok(revokedTokenResponses.every((entry) => entry.status === 403), `the agent refuses every token for a revoked device: ${JSON.stringify(revokedTokenResponses)}`);
    assert.equal(revokedFlow.some((entry) => entry.phase === 'RESPONSE' && entry.target.endsWith('/v1/kiosk/members') && entry.status === 200), false, 'no member list is served to a revoked device');
    assert.equal(await agentPage.getByRole('button', { name: /회원 선택$/ }).count(), 0, 'no member selection button is shown');
    assert.equal(await agentPage.getByRole('button', { name: '추천회원 회원 선택' }).count(), 0);
    assert.equal(await agentPage.getByText('회원 목록을 불러오는 중입니다.').count(), 0, 'the list is not stuck loading');
    assert.equal(await agentSessionsOf(), sessionsBeforeRevokedVisit, 'no new member session for a revoked device');
    assert.equal(await agentWorkoutSessionsOf(), workoutSessionsBeforeRevokedVisit, 'no new workout session for a revoked device');
    assert.equal(physicalSubmits, submitsBeforeRevokedVisit, 'nothing printed by a revoked device');
    await agentContext.close();
  });

  await step('I. Device revoked after member selection → save refused, nothing written, user stays on the step', async () => {
    // Phase 3-E: a dedicated, registered Emulator device in its own browser context (same issuance path as the
    // shared fixture). The revocation and every refusal check below are unchanged; only the device is I's own.
    await issuance.registerKioskDevice({ issuerUid: adminUid, deviceId: iDeviceId, label: 'E2E I Kiosk' });
    const iDeviceToken = (await issuance.issueKioskDeviceToken({ issuerUid: adminUid, deviceId: iDeviceId })).customToken;
    const iContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await iContext.addInitScript((token) => { window.__kiosk_device_token = token; window.print = () => {}; }, iDeviceToken);
    const iPage = await iContext.newPage(); iPage.setDefaultTimeout(30_000); iPage.setDefaultNavigationTimeout(90_000);
    // H's checks (page errors, production Firebase hosts) cover I's page too.
    iPage.on('pageerror', (error) => { console.error('[e2e][I] pageerror', error?.stack || error); consoleErrors.push(error.message); });
    iPage.on('request', (request) => { const host = new URL(request.url()).host; if (/googleapis\.com|firebaseio\.com|firebaseapp\.com/.test(host)) firebaseHosts.add(host); });
    const iCard = iPage.getByRole('region', { name: '트레이너 추천 프로그램' });
    const iSessionsOf = async () => (await db.collection(`artifacts/${APP_ID}/private/data/kioskSessions`).where('deviceId', '==', iDeviceId).get()).docs.map((doc) => doc.data());
    try {
      await begin(iPage); await openMember('추천회원', 'ㅊ', iPage);
      await iCard.waitFor({ timeout: 20_000 });
      await until('session for A', async () => (await iSessionsOf()).some((item) => item.status === 'ACTIVE' && item.memberId === memberA));
      await iCard.getByRole('button', { name: '추천대로 운동하기' }).click();
      const before = (await db.collection(`artifacts/${APP_ID}/public/data/workoutSessions`).where('memberId', '==', memberA).get()).size;
      await issuance.revokeKioskDevice({ issuerUid: adminUid, deviceId: iDeviceId });
      const saveResponse = iPage.waitForResponse((response) => response.url().endsWith('/v1/kiosk/workout-sessions'));
      await iPage.getByRole('button', { name: '이 프로그램으로 진행하기' }).click();
      assert.equal((await saveResponse).status(), 403);
      await iPage.getByText('등록되지 않았거나 사용이 중지된 키오스크입니다', { exact: false }).waitFor({ timeout: 20_000 });
      assert.equal(/\/print\/session\//.test(iPage.url()), false, 'did not advance to print preview');
      assert.equal((await db.collection(`artifacts/${APP_ID}/public/data/workoutSessions`).where('memberId', '==', memberA).get()).size, before, 'no document written');
    } finally { await iContext.close(); }
  });

  await step('G. Handoff API preserved and untouched; API down → failure notice only', async () => {
    assert.equal(await handoffStatus(preservedHandoff), 'active', 'default-program flow never closes the Trainer handoff');
    // Isolation: G starts from its own registered, approved Emulator device
    // (same issuance path as the shared fixture) in a fresh browser context. The revoked device stays revoked.
    await issuance.registerKioskDevice({ issuerUid: adminUid, deviceId: gDeviceId, label: 'E2E G Kiosk' });
    const gDeviceToken = (await issuance.issueKioskDeviceToken({ issuerUid: adminUid, deviceId: gDeviceId })).customToken;
    const gContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await gContext.addInitScript((token) => { window.__kiosk_device_token = token; window.print = () => {}; }, gDeviceToken);
    const gPage = await gContext.newPage(); gPage.setDefaultTimeout(30_000); gPage.setDefaultNavigationTimeout(90_000);
    // H's checks (page errors, production Firebase hosts) cover G's page too.
    gPage.on('pageerror', (error) => { console.error('[e2e][G] pageerror', error?.stack || error); consoleErrors.push(error.message); });
    gPage.on('request', (request) => { const host = new URL(request.url()).host; if (/googleapis\.com|firebaseio\.com|firebaseapp\.com/.test(host)) firebaseHosts.add(host); });
    gPage.on('console', (message) => { if (message.type() === 'error') console.error(`[e2e][G] browser console error: ${message.text()}`); });
    // The protected member directory is now a Kiosk API read. Load the
    // selection screen while the gateway is available, then simulate the
    // recommendation API outage for the selected member.
    await begin(gPage);
    await new Promise((resolve) => gateway.close(resolve));
    await openMember('추천회원', 'ㅊ', gPage);
    await gPage.getByText('트레이너 추천 프로그램을 불러오지 못했습니다.', { exact: false }).waitFor({ timeout: 20_000 });
    assert.ok(await gPage.getByRole('button', { name: '추천회원 회원으로 계속하기' }).isVisible());
    assert.equal(await gPage.getByText(/NETWORK_ERROR|Failed to fetch|ECONNREFUSED/).count(), 0, 'no raw network error shown');
    await gContext.close();
  });

  await step('H. originals unchanged; no production Firebase hosts; no page errors', async () => {
    assert.equal(JSON.stringify((await Promise.all(Object.values(programIds).map((id) => program(id).get()))).map((doc) => doc.data())), originals);
    assert.deepEqual([...firebaseHosts], [], `unexpected Firebase hosts: ${[...firebaseHosts]}`);
    assert.deepEqual(consoleErrors, []);
  });
} catch (error) {
  console.error(error);
} finally {
  clearTimeout(watchdog);
  await cleanup().catch((error) => console.error('cleanup failed', error));
  for (const result of results) console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}${result.error ? ` — ${result.error.split(String.fromCharCode(10))[0]}` : ''}`);
  const failed = results.filter((result) => !result.ok).length;
  await persistResults(true).catch((error) => console.error('results persist failed', error));
  console.log(`E2E results: ${resultsFile}`);
  console.log(`\n${results.length - failed}/${results.length} passed (${EXPECTED_STEPS} expected)`);
  process.exit(failed || results.length !== EXPECTED_STEPS ? 1 : 0);
}
