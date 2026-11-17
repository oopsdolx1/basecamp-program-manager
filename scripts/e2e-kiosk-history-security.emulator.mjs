#!/usr/bin/env node
// Phase 3-E / Sprint 1: workout-history UI security E2E (Firebase Emulator only; real Chromium).
//
// Verifies member isolation and access blocking in the Kiosk workout-history UI against the real
// Condition Lab Kiosk API (member sessions, scoped reads, print records). Server authentication/
// authorization is used as-is; browser Firestore Rules coverage belongs to its separate migration.
//
// Independence: every scenario registers its own Emulator Kiosk device, creates its own fictitious
// members and seeds its own printed workout sessions through the real server API. Scenarios do not
// depend on each other or on the A–M recommendation E2E. A failing scenario is recorded and the
// remaining scenarios still run.
//
//   node scripts/e2e-kiosk-history-security.emulator.mjs [--scenario=A|B|C|D|E]
//
// Requires the Auth (19099) and Firestore (18080) Emulators. Printing goes to a fake backend only.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createPrintAgent } from '../windows-print-agent/server.mjs';

const PROJECT_ID = 'basecamp-e2e-local';
const APP_ID = 'basecamp_e2e_test';
const AUTH_HOST = '127.0.0.1:19099';
const FIRESTORE_HOST = '127.0.0.1:18080';
const API_PORT = 4013;
const PM_PORT = 5179;
const AGENT_PORT = 43192;
const PM_ROOT = process.cwd();
const CL_ROOT = path.resolve(process.env.CONDITION_LAB_ROOT ?? '../condition-lab');
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID !== PROJECT_ID) throw new Error('Refusing to run: non-emulator project.');
process.env.FIREBASE_PROJECT_ID = PROJECT_ID; process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST; process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;

const load = (relative) => import(pathToFileURL(path.join(CL_ROOT, relative)).href);
const { chromium } = createRequire(path.join(CL_ROOT, 'package.json'))('@playwright/test');
const [{ createEmulatorAdminTokenVerifier }, { createEmulatorFirestoreContext }, { createAuthBoundary }, { createTrustedIssuance }, { checksumKnowledgeItems, FIRESTORE_SNAPSHOT_SCHEMA_VERSION }, { createKioskMemberSessionService }, { createKioskMemberSessionHandler }, { createKioskWorkoutSessionSaver }, sessionHttp, { createKioskReadService }, readHttp, handoffHttp, { createKioskPrintRecorder }] = await Promise.all([
  load('server/auth/firebaseAdminVerifier.js'), load('server/auth/firebaseAdminFirestore.js'), load('server/auth/authBoundary.js'), load('server/auth/trustedIssuance.js'),
  load('packages/exercise-knowledge/runtime/firestoreSnapshotStore.js'), load('server/kiosk/kioskMemberSessions.js'), load('server/kiosk/kioskMemberSessionHandler.js'), load('server/kiosk/kioskWorkoutSessionHandler.js'),
  load('server/http/kioskMemberSessionHttpAdapter.js'), load('server/kiosk/kioskReadService.js'), load('server/kiosk/kioskReadHandler.js'), load('server/http/kioskSessionActivationHttpAdapter.js'), load('server/kiosk/kioskPrintRecordHandler.js'),
]);

const requested = process.argv.find((argument) => argument.startsWith('--scenario='))?.slice('--scenario='.length)?.toUpperCase() ?? null;
if (requested && !/^[A-E]$/.test(requested)) throw new Error(`Unknown scenario selector: ${requested}`);
const prefix = `pm_e2e_${Date.now()}`;
const resultsFile = path.join(PM_ROOT, 'outputs', 'e2e-results', `${prefix}-history-security.json`);
const adminUid = `${prefix}_admin`;
const verifier = createEmulatorAdminTokenVerifier({ projectId: PROJECT_ID, authEmulatorHost: AUTH_HOST, appName: `${prefix}_auth` });
const { db } = createEmulatorFirestoreContext({ projectId: PROJECT_ID, firestoreEmulatorHost: FIRESTORE_HOST, appName: `${prefix}_fs` });
const issuance = createTrustedIssuance({ auth: verifier.auth, db, trustedIssuerUids: [adminUid], approvedTrainerUids: [] });
const boundary = createAuthBoundary({ verifyIdToken: verifier.verifyIdToken, expectedProjectId: PROJECT_ID, requireEmulator: true, emulatorHost: AUTH_HOST });
const publicData = `artifacts/${APP_ID}/public/data`; const privateData = `artifacts/${APP_ID}/private/data`;
const profile = (id) => db.doc(`${publicData}/profiles/${id}`);
const knowledge = db.doc(`${publicData}/sharedKnowledgeRuntime/current`);
const knowledgeItem = (id, name, bodyPart) => ({ id, status: 'active', name, englishName: id, aliases: [], tags: [], purpose: [], bodyPart, primaryMuscle: name, secondaryMuscles: [], equipment: 'barbell', coachingCues: [], commonMistakes: [], contraindications: [], progressionExerciseIds: [], regressionExerciseIds: [], relatedExerciseIds: [] });
const until = async (label, predicate, timeout = 15_000) => { const end = Date.now() + timeout; for (;;) { const value = await predicate(); if (value) return value; if (Date.now() > end) throw new Error(`timed out: ${label}`); await new Promise((resolve) => setTimeout(resolve, 200)); } };
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- Results: a failing scenario is recorded; the remaining scenarios still run. ---
const results = [];
const persist = async (final = false) => { await mkdir(path.dirname(resultsFile), { recursive: true }); await writeFile(resultsFile, JSON.stringify({ startedAt: prefix, final, scenarios: results }, null, 2)); };
const step = async (name, fn) => {
  if (requested && name[0] !== requested) { console.log(`SKIP ${name} (--scenario=${requested})`); return; }
  const started = Date.now(); console.log(`START ${name}`);
  const findings = [];
  try { await fn((line) => { findings.push(line); console.log(`[security][${name[0]}] ${line}`); }); results.push({ name, status: 'PASS', durationMs: Date.now() - started, findings }); console.log(`PASS ${name} (${Date.now() - started}ms)`); }
  catch (error) { results.push({ name, status: 'FAIL', durationMs: Date.now() - started, findings, error: error?.stack ?? String(error) }); console.log(`FAIL ${name} — ${String(error?.message ?? error).split('\n')[0]}`); }
  await persist();
};

// --- Fixture bookkeeping (everything created here is removed in cleanup) ---
const deviceIds = []; const memberIds = [];
let previousKnowledge = null; let gateway; let vite; let browser; let agent; let workDir = null; let physicalSubmits = 0;
const cleanup = async () => {
  await browser?.close().catch(() => {});
  if (vite && !vite.killed) { if (process.platform === 'win32') await new Promise((resolve) => spawn('taskkill', ['/pid', String(vite.pid), '/t', '/f'], { stdio: 'ignore' }).on('exit', resolve).on('error', resolve)); else vite.kill(); }
  if (gateway?.listening) await new Promise((resolve) => gateway.close(resolve));
  await agent?.close().catch(() => {});
  if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => {});
  const deletions = [];
  for (const memberId of memberIds) {
    for (const name of ['workoutSessions', 'printHistory']) deletions.push(db.collection(`${publicData}/${name}`).where('memberId', '==', memberId).get().then((snapshot) => Promise.all(snapshot.docs.map((doc) => doc.ref.delete()))).catch(() => {}));
    deletions.push(profile(memberId).delete().catch(() => {}));
  }
  for (const deviceId of deviceIds) {
    for (const name of ['kioskSessions', 'kioskSessionAudit', 'kioskSessionDevices']) deletions.push(db.collection(`${privateData}/${name}`).where('deviceId', '==', deviceId).get().then((snapshot) => Promise.all(snapshot.docs.map((doc) => doc.ref.delete()))).catch(() => {}));
    deletions.push(issuance.paths.device(deviceId).delete().catch(() => {}), verifier.auth.deleteUser(`kiosk:${deviceId}`).catch(() => {}));
  }
  deletions.push(verifier.auth.deleteUser(adminUid).catch(() => {}));
  deletions.push(previousKnowledge ? knowledge.set(previousKnowledge) : knowledge.delete());
  await Promise.all(deletions);
};
const watchdog = setTimeout(async () => { console.error('history security E2E watchdog: exceeded 420s'); await cleanup().catch(() => {}); process.exit(1); }, 420_000);

// --- Server-side helpers (real Kiosk API through the local gateway) ---
const api = `http://127.0.0.1:${API_PORT}`;
const signIn = async (customToken) => (await (await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=emulator-test-key`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) })).json()).idToken;
const call = async (method, route, { idToken, session, body } = {}) => {
  const response = await fetch(`${api}${route}`, { method, headers: { ...(idToken ? { authorization: `Bearer ${idToken}` } : {}), ...(session ? { 'x-basecamp-kiosk-session': session } : {}), ...(method === 'POST' ? { 'content-type': 'application/json' } : {}) }, ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}) });
  return { status: response.status, body: await response.json().catch(() => null) };
};
const createDevice = async (tag) => {
  const id = `${prefix}_kiosk_${tag}`; deviceIds.push(id);
  await issuance.registerKioskDevice({ issuerUid: adminUid, deviceId: id, label: `E2E history security ${tag}` });
  const customToken = (await issuance.issueKioskDeviceToken({ issuerUid: adminUid, deviceId: id })).customToken;
  return { id, customToken, idToken: await signIn(customToken) };
};
const createMember = async (tag, name) => { const id = `${prefix}_${tag}`; memberIds.push(id); await profile(id).set({ id, name, role: 'member' }); return { id, name }; };
const dateKey = () => { const now = new Date(); return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`; };
const EXERCISES = [['squat', '스쿼트'], ['lunge', '런지'], ['row', '바벨 로우']];
/** A printed workout session for `member`, created exactly as the Kiosk does (member session → save → print record). */
const seedPrintedSession = async (device, member, exerciseCount) => {
  const opened = await call('POST', '/v1/kiosk/sessions', { idToken: device.idToken, body: { memberId: member.id } });
  assert.equal(opened.status, 201, `seed: open session ${JSON.stringify(opened.body)}`);
  const session = opened.body.kioskSession.token;
  const workoutSessionId = `ws_${dateKey()}_${randomBytes(6).toString('hex')}`;
  const exercises = EXERCISES.slice(0, exerciseCount).map(([exerciseId, name], index) => ({ exerciseId, programExerciseId: `e${index + 1}`, name, order: index + 1, plannedSets: 3 }));
  const saved = await call('POST', '/v1/kiosk/workout-sessions', { idToken: device.idToken, session, body: { workoutSessionId, memberId: member.id, programTitle: `${member.name} 루틴`, source: { type: 'manual' }, category: 'LOWER_BODY', exercises } });
  assert.ok(saved.status === 200 || saved.status === 201, `seed: save ${JSON.stringify(saved.body)}`);
  const printed = await call('POST', `/v1/kiosk/workout-sessions/${workoutSessionId}/prints`, { idToken: device.idToken, session, body: { printRequestId: `pr_${randomBytes(16).toString('hex')}`, printer: 'E2E Printer' } });
  assert.ok(printed.status === 200 || printed.status === 201, `seed: print record ${JSON.stringify(printed.body)}`);
  await call('POST', '/v1/kiosk/sessions/current/close', { idToken: device.idToken, session });
  return workoutSessionId;
};
const sessionsOf = async (deviceId) => (await db.collection(`${privateData}/kioskSessions`).where('deviceId', '==', deviceId).get()).docs;
const printsOf = async (memberId) => (await db.collection(`${publicData}/printHistory`).where('memberId', '==', memberId).get()).size;
const workoutsOf = async (memberId) => (await db.collection(`${publicData}/workoutSessions`).where('memberId', '==', memberId).get()).size;
const LIST_PATH = '/v1/kiosk/sessions/current/workout-sessions';

let origin;
const openKiosk = async (device) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript((token) => { window.__kiosk_device_token = token; window.print = () => {}; }, device.customToken);
  const page = await context.newPage(); page.setDefaultTimeout(20_000); page.setDefaultNavigationTimeout(90_000);
  const tracker = { sessionTokens: [], responses: [], agentPrints: 0, sessionIssues: 0, pageErrors: [] };
  page.on('request', (request) => {
    const url = new URL(request.url()); const token = request.headers()['x-basecamp-kiosk-session'];
    if (token && !tracker.sessionTokens.includes(token)) tracker.sessionTokens.push(token);
    if (url.port === String(AGENT_PORT) && url.pathname === '/print') tracker.agentPrints += 1;
    if (url.pathname === '/v1/kiosk/sessions' && request.method() === 'POST') tracker.sessionIssues += 1;
  });
  page.on('response', async (response) => {
    const url = new URL(response.url()); if (!url.pathname.startsWith('/v1/kiosk/')) return;
    const entry = { method: response.request().method(), path: url.pathname, status: response.status(), session: response.request().headers()['x-basecamp-kiosk-session'] ?? null, body: null };
    tracker.responses.push(entry);
    if (url.pathname.startsWith(LIST_PATH) && response.ok()) entry.body = await response.json().catch(() => null);
  });
  page.on('pageerror', (error) => tracker.pageErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') console.error(`[e2e][browser] ${message.text()}`); });
  return { context, page, tracker };
};
const cards = (page) => page.getByRole('button', { name: /종목/ });
const bodyText = (page) => page.locator('body').innerText().catch(() => '');
const selectHistoryMember = async (page, member) => { await page.getByPlaceholder('회원명 또는 전화번호 검색').fill(member.name); await page.getByRole('button', { name: member.name, exact: true }).click(); };
const openHistory = async (page, member) => { await page.goto(`${origin}/program-manager/print`); await page.getByRole('button', { name: '이전 운동 기록 보기' }).click(); await selectHistoryMember(page, member); };
const RAW_CODE = /\b(KIOSK_[A-Z_]+|NETWORK_ERROR|INTERNAL_ERROR|INVALID_API_RESPONSE|WORKOUT_SESSION_NOT_FOUND|PRINT_SCOPE_DENIED)\b/;
const assertNoRawCode = async (page, label) => { const found = (await bodyText(page)).match(RAW_CODE); assert.equal(found, null, `${label}: internal code on screen: ${found?.[0]}`); };
const PREVIEW_SETTLED =/미리보기를 만들 수 없습니다|출력 준비를 완료하지 못했습니다|재출력을 요청했습니다|선택된 회원 정보가 없습니다|사용이 중지된|만료되었거나|확인할 수 없습니다/;

try {
  for (const collectionPath of [`${publicData}/profiles`, 'authKioskDevices']) {
    const stale = await db.collection(collectionPath).get();
    await Promise.all(stale.docs.filter((doc) => (doc.id.startsWith('pm_e2e_') || String(doc.data().deviceId || '').startsWith('pm_e2e_')) && !doc.id.startsWith(prefix)).map((doc) => doc.ref.delete()));
  }
  const existing = await knowledge.get(); previousKnowledge = existing.exists ? existing.data() : null;
  const items = [knowledgeItem('squat', '스쿼트', 'legs'), knowledgeItem('lunge', '런지', 'legs'), knowledgeItem('row', '바벨 로우', 'back')];
  await knowledge.set({ revision: Number(previousKnowledge?.revision || 0) + 1, schemaVersion: FIRESTORE_SNAPSHOT_SCHEMA_VERSION, knowledgeVersion: '3.0.0', updatedAt: new Date().toISOString(), updatedBy: `${prefix}:history-security-seed`, exerciseCount: items.length, checksum: await checksumKnowledgeItems(items), items });
  await verifier.auth.createUser({ uid: adminUid });

  // Real Condition Lab Kiosk API: member sessions, workout-session save, print record, scoped reads.
  const kioskSessions = createKioskMemberSessionService({ authBoundary: boundary, db, issuance, appId: APP_ID });
  const sessionServer = sessionHttp.createKioskMemberSessionHttpServer({ handleKioskMemberSession: createKioskMemberSessionHandler({ sessions: kioskSessions, saveWorkoutSession: createKioskWorkoutSessionSaver({ sessions: kioskSessions, db, appId: APP_ID }), recordPrint: createKioskPrintRecorder({ sessions: kioskSessions, db, appId: APP_ID }) }) });
  const readServer = readHttp.createKioskReadHttpServer({ handleKioskRead: readHttp.createKioskReadHandler({ authBoundary: boundary, issuance, sessions: kioskSessions, reads: createKioskReadService({ db, appId: APP_ID, rankingCacheMs: 0 }) }) });
  gateway = handoffHttp.createLocalApiGateway({ routes: [{ match: readHttp.isKioskReadPath, server: readServer }, { match: sessionHttp.isKioskMemberSessionPath, server: sessionServer }] });
  await new Promise((resolve, reject) => { gateway.once('error', reject); gateway.listen(API_PORT, '127.0.0.1', resolve); });

  origin = `http://127.0.0.1:${PM_PORT}`;
  workDir = await mkdtemp(path.join(tmpdir(), 'pm-e2e-security-'));
  const minimalPdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 420]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF';
  const pdfPipeline = { create: async ({ jobId }) => { const file = path.join(workDir, `${String(jobId).replace(/[^A-Za-z0-9_-]/g, '_')}-${Date.now()}.pdf`); await writeFile(file, minimalPdf); return { path: file, cleanup: async () => rm(file, { force: true }), metadata: { pageCount: 1, bytes: minimalPdf.length } }; } };
  // Fake printer only: counts submissions, never reaches a real spooler.
  const printBackend = { getStatus: async () => ({ printerConfigured: true, configuredPrinter: 'E2E Printer', printerAvailable: true, printerStatus: 'Normal', defaultPrinter: 'E2E Printer' }), submit: async () => { physicalSubmits += 1; console.log(`[e2e] fake print-backend submit total=${physicalSubmits}`); return { status: 'submitted', printer: 'E2E Printer' }; } };
  agent = createPrintAgent({ port: AGENT_PORT, allowedOrigins: [origin], deviceTokenOrigins: [origin], logger: { info: async () => {}, error: async (message) => console.error(`[e2e][agent] ${String(message)}`) }, backend: printBackend, pdfPipeline, deviceCredential: async () => null });
  await agent.listen();
  vite = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--host', '127.0.0.1', '--port', String(PM_PORT), '--strictPort'], { cwd: PM_ROOT, shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'], env: {
    ...process.env,
    VITE_FIREBASE_USE_EMULATOR: 'true', VITE_FIREBASE_EMULATOR_HOST: '127.0.0.1', VITE_FIRESTORE_EMULATOR_PORT: '18080', VITE_FIREBASE_AUTH_EMULATOR_PORT: '19099',
    VITE_FIREBASE_API_KEY: 'emulator-test-key', VITE_FIREBASE_AUTH_DOMAIN: 'localhost', VITE_FIREBASE_PROJECT_ID: PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET: `${PROJECT_ID}.appspot.com`, VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000', VITE_FIREBASE_APP_ID: '1:000000000000:web:e2etest',
    VITE_CONDITION_LAB_APP_ID: APP_ID, VITE_CONDITION_LAB_API_BASE_URL: origin, VITE_KIOSK_API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}`, VITE_KIOSK_DEVICE_AGENT_ENDPOINT: `http://127.0.0.1:${AGENT_PORT}`,
    VITE_PRINT_RUNTIME: 'windows-agent', VITE_PRINT_AGENT_ENDPOINT: `http://127.0.0.1:${AGENT_PORT}`, VITE_GEMINI_API_KEY: '',
  } });
  let viteLog = ''; vite.stdout.on('data', (chunk) => { viteLog += chunk; }); vite.stderr.on('data', (chunk) => { viteLog += chunk; });
  for (let attempt = 0; attempt < 60; attempt += 1) { try { if ((await fetch(origin)).ok) break; } catch { /* starting */ } await pause(500); if (attempt === 59) throw new Error(`Program Manager dev server did not start.\n${viteLog.slice(-2000)}`); }
  await fetch(`${origin}/program-manager/print`).catch(() => {});
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || 'chrome', headless: true });
  console.log('[e2e] history security harness ready');

  await step('A. Member A history, then switch to B: B screen and B responses are B-scoped only', async (note) => {
    const device = await createDevice('sa');
    const a = await createMember('sa_a', '격리가회원'); const b = await createMember('sa_b', '격리나회원');
    const aIds = [await seedPrintedSession(device, a, 3), await seedPrintedSession(device, a, 3)]; const bIds = [await seedPrintedSession(device, b, 1)];
    const { context, page, tracker } = await openKiosk(device);
    try {
      await openHistory(page, a);
      await until('A records listed', async () => (await cards(page).count()) === 2);
      const aToken = tracker.sessionTokens.at(-1);
      await page.getByRole('button', { name: '회원 변경' }).click();
      const mark = tracker.responses.length;
      await selectHistoryMember(page, b);
      await until('B records listed', async () => (await cards(page).count()) === 1);
      await pause(800);
      assert.equal(await cards(page).count(), 1, 'only B records on the B screen');
      assert.match(await cards(page).first().innerText(), /1종목/, 'the card is B record (1 exercise)');
      assert.equal(await page.getByRole('button', { name: /3종목/ }).count(), 0, 'no A record (3 exercises) on the B screen');
      const text = await bodyText(page); for (const id of aIds) assert.equal(text.includes(id), false, 'no A session id rendered');
      const bLists = tracker.responses.slice(mark).filter((entry) => entry.path === LIST_PATH && entry.body);
      assert.ok(bLists.length >= 1, 'B history list response observed');
      for (const entry of bLists) {
        const records = entry.body.workoutSessions ?? [];
        assert.ok(records.every((record) => record.memberId === b.id), 'every listed record belongs to B');
        assert.deepEqual(records.map((record) => record.sessionId).sort(), [...bIds].sort(), 'B response holds exactly B sessions');
      }
      // Server: one ACTIVE session on the device, for B; A's browser token is refused.
      await until('only B active', async () => { const active = (await sessionsOf(device.id)).map((doc) => doc.data()).filter((item) => item.status === 'ACTIVE'); return active.length === 1 && active[0].memberId === b.id; });
      const reuseA = await call('GET', LIST_PATH, { idToken: device.idToken, session: aToken });
      assert.ok(reuseA.status === 401 || reuseA.status === 403, `A token refused after switching: ${reuseA.status}`);
      note(`A token after switch → ${reuseA.status} ${reuseA.body?.error?.code}`);
      const bToken = tracker.sessionTokens.at(-1);
      const crossRead = await call('GET', `${LIST_PATH}/${aIds[0]}`, { idToken: device.idToken, session: bToken });
      assert.equal(crossRead.status, 404, 'B session cannot read A workout session'); note(`B token reading A session → ${crossRead.status} ${crossRead.body?.error?.code}`);
      assert.deepEqual(tracker.pageErrors, []);
    } finally { await context.close(); }
  });

  await step('B. A response delayed while switching to B: the late A data never reaches the B screen; A session ends', async (note) => {
    const device = await createDevice('sb');
    const a = await createMember('sb_a', '지연가회원'); const b = await createMember('sb_b', '지연나회원');
    const aIds = [await seedPrintedSession(device, a, 3)]; await seedPrintedSession(device, b, 1);
    const { context, page, tracker } = await openKiosk(device);
    try {
      let release; const gate = new Promise((resolve) => { release = resolve; });
      let intercepted = false; let lateDelivered = false; let lateHadAData = false; let aToken = null;
      await page.route(/\/v1\/kiosk\/sessions\/current\/workout-sessions\?/, async (route) => {
        if (intercepted) { await route.continue(); return; }
        intercepted = true; aToken = route.request().headers()['x-basecamp-kiosk-session'];
        const response = await route.fetch(); // fetched while A is still the active session → real A data
        const body = await response.text(); lateHadAData = aIds.some((id) => body.includes(id));
        await gate;
        await route.fulfill({ status: response.status(), headers: response.headers(), body }).catch(() => {});
        lateDelivered = true;
      });
      await openHistory(page, a);
      await until('A list request intercepted', async () => intercepted);
      await page.getByRole('button', { name: '회원 변경' }).click();
      await selectHistoryMember(page, b);
      await until('B records listed', async () => (await cards(page).count()) === 1);
      release();
      await until('late A response delivered', async () => lateDelivered);
      await pause(1500);
      assert.ok(lateHadAData, 'the delayed response really carried A records');
      assert.equal(await cards(page).count(), 1, 'still only B record after the late A response');
      assert.equal(await page.getByRole('button', { name: /3종목/ }).count(), 0, 'no A record on the B screen');
      const text = await bodyText(page); assert.equal(text.includes(aIds[0]), false);
      assert.match(text, /지연나회원님의 이전 운동기록/, 'B header unchanged');
      const sessions = (await sessionsOf(device.id)).map((doc) => doc.data());
      assert.ok(sessions.filter((item) => item.memberId === a.id && item.status === 'ACTIVE').length === 0, 'A has no ACTIVE session');
      const reuseA = await call('GET', LIST_PATH, { idToken: device.idToken, session: aToken });
      assert.ok(reuseA.status === 401 || reuseA.status === 403, `A token refused: ${reuseA.status}`);
      note(`late A response delivered after B rendered; B screen unchanged; A token → ${reuseA.status} ${reuseA.body?.error?.code}`);
      assert.deepEqual(tracker.pageErrors, []);
    } finally { await context.close(); }
  });

  await step('C. Member session expiry: the expired token is refused; no protected data or print after a failed (re)issue', async (note) => {
    const device = await createDevice('sc');
    const a = await createMember('sc_a', '만료가회원');
    await seedPrintedSession(device, a, 3);
    // C1: server-side expiry of the session the browser holds.
    {
      const { context, page, tracker } = await openKiosk(device);
      try {
        await openHistory(page, a);
        await until('A record listed', async () => (await cards(page).count()) === 1);
        const aToken = tracker.sessionTokens.at(-1);
        const active = (await sessionsOf(device.id)).find((doc) => doc.data().status === 'ACTIVE' && doc.data().memberId === a.id);
        assert.ok(active, 'A session is ACTIVE');
        await active.ref.update({ expiresAt: new Date(Date.now() - 60_000) });
        const direct = await call('GET', LIST_PATH, { idToken: device.idToken, session: aToken });
        assert.ok(direct.status === 401 || direct.status === 403, `expired token refused: ${direct.status}`);
        assert.equal(direct.body?.error?.code, 'KIOSK_SESSION_EXPIRED');
        note(`direct request with the expired token → ${direct.status} ${direct.body.error.code}`);
        const prints = await printsOf(a.id); const submits = physicalSubmits; const issuesBefore = tracker.sessionIssues; const mark = tracker.responses.length;
        await cards(page).first().click();
        await page.getByRole('button', { name: '이 운동기록 다시 출력' }).click();
        await until('preview settled', async () => PREVIEW_SETTLED.test(await bodyText(page)), 30_000);
        await pause(1000);
        const after = tracker.responses.slice(mark);
        assert.ok(after.filter((entry) => entry.session === aToken).every((entry) => entry.status >= 400), 'the expired token is never accepted');
        // Phase 3-E policy: the same, still-selected member's EXPIRED session is renewed exactly once.
        assert.equal(tracker.sessionIssues - issuesBefore, 1, 'renewed exactly once');
        const sessions = (await sessionsOf(device.id)).map((doc) => doc.data());
        assert.ok(sessions.every((item) => item.memberId === a.id), 'the renewed session is for the same member only');
        const newToken = tracker.sessionTokens.at(-1); assert.notEqual(newToken, aToken, 'a new token is used after renewal');
        const outcome = (await bodyText(page)).match(PREVIEW_SETTLED)?.[0];
        note(`UI after expiry: renewals=${tracker.sessionIssues - issuesBefore}; screen="${outcome}"; prints ${prints}→${await printsOf(a.id)}; submits ${submits}→${physicalSubmits}`);
        assert.equal(outcome, '재출력을 요청했습니다', 'reprint completes with the renewed same-member session');
        assert.equal(await printsOf(a.id), prints + 1, 'exactly one new print record'); assert.equal(physicalSubmits, submits + 1, 'printed once (fake printer)');
        await assertNoRawCode(page, 'C1');
      } finally { await context.close(); }
    }
    // C2: the member session cannot be (re)issued → no protected data is shown, nothing printed.
    {
      const { context, page, tracker } = await openKiosk(device);
      try {
        await page.route((url) => url.pathname === '/v1/kiosk/sessions', (route) => route.request().method() === 'POST' ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE', message: 'unavailable', retryable: true } }) }) : route.continue());
        const submits = physicalSubmits; const prints = await printsOf(a.id);
        await openHistory(page, a);
        await page.getByText('운동기록을 불러오지 못했습니다.').waitFor({ timeout: 20_000 });
        await pause(500);
        assert.equal(await cards(page).count(), 0, 'no record shown when the session cannot be issued');
        assert.equal(tracker.responses.filter((entry) => entry.path.startsWith('/v1/kiosk/sessions/current') && entry.status < 400).length, 0, 'no protected read succeeded');
        assert.equal(physicalSubmits, submits); assert.equal(await printsOf(a.id), prints); assert.equal(tracker.agentPrints, 0);
        note('session issue failure → "운동기록을 불러오지 못했습니다.", 0 records, no protected read, nothing printed');
        await assertNoRawCode(page, 'C2');
      } finally { await context.close(); }
    }
    // C3: an explicitly ended (closed) session is not recovered automatically.
    {
      const { context, page, tracker } = await openKiosk(device);
      try {
        await openHistory(page, a);
        await until('A record listed', async () => (await cards(page).count()) === 1);
        await cards(page).first().click();
        const aToken = tracker.sessionTokens.at(-1);
        const closed = await call('POST', '/v1/kiosk/sessions/current/close', { idToken: device.idToken, session: aToken });
        assert.equal(closed.status, 200, 'session closed on the server');
        const prints = await printsOf(a.id); const submits = physicalSubmits; const issuesBefore = tracker.sessionIssues; const mark = tracker.responses.length;
        await page.getByRole('button', { name: '이 운동기록 다시 출력' }).click();
        await until('preview settled', async () => PREVIEW_SETTLED.test(await bodyText(page)), 30_000);
        await pause(1500);
        assert.equal(tracker.sessionIssues, issuesBefore, 'no new session after an explicit end');
        assert.equal(tracker.responses.slice(mark).filter((entry) => entry.path.startsWith('/v1/kiosk/sessions/current') && entry.status < 400).length, 0, 'no protected read succeeded');
        assert.equal(await printsOf(a.id), prints, 'no print record'); assert.equal(physicalSubmits, submits, 'nothing printed'); assert.equal(tracker.agentPrints, 0);
        const outcome = (await bodyText(page)).match(PREVIEW_SETTLED)?.[0];
        assert.notEqual(outcome, '재출력을 요청했습니다');
        await assertNoRawCode(page, 'C3');
        note(`explicitly closed session → no renewal; screen="${outcome}"; nothing printed or recorded`);
      } finally { await context.close(); }
    }
  });

  await step('D. Device revoked: protected APIs refused, no new workout/print record, reprint never reaches the printer', async (note) => {
    const device = await createDevice('sd');
    const a = await createMember('sd_a', '폐기가회원');
    await seedPrintedSession(device, a, 3);
    const { context, page, tracker } = await openKiosk(device);
    try {
      await openHistory(page, a);
      await until('A record listed', async () => (await cards(page).count()) === 1);
      await cards(page).first().click();
      const aToken = tracker.sessionTokens.at(-1);
      const before = { prints: await printsOf(a.id), workouts: await workoutsOf(a.id), submits: physicalSubmits, agentPrints: tracker.agentPrints };
      await issuance.revokeKioskDevice({ issuerUid: adminUid, deviceId: device.id });
      const members = await call('GET', '/v1/kiosk/members', { idToken: device.idToken });
      const reads = await call('GET', LIST_PATH, { idToken: device.idToken, session: aToken });
      const issue = await call('POST', '/v1/kiosk/sessions', { idToken: device.idToken, body: { memberId: a.id } });
      for (const [label, result] of [['members', members], ['history', reads], ['new session', issue]]) assert.ok(result.status === 401 || result.status === 403, `${label} refused after revoke: ${result.status}`);
      note(`after revoke: members ${members.status} ${members.body?.error?.code}; history ${reads.status} ${reads.body?.error?.code}; new session ${issue.status} ${issue.body?.error?.code}`);
      const mark = tracker.responses.length;
      await page.getByRole('button', { name: '이 운동기록 다시 출력' }).click();
      await until('preview settled', async () => PREVIEW_SETTLED.test(await bodyText(page)), 30_000);
      await pause(1500);
      assert.equal(tracker.responses.slice(mark).filter((entry) => entry.path.startsWith('/v1/kiosk/') && entry.status < 400).length, 0, 'no Kiosk API call succeeds after revoke');
      assert.equal(physicalSubmits, before.submits, 'reprint never reached the (fake) printer');
      assert.equal(tracker.agentPrints, before.agentPrints, 'no print request to the agent');
      assert.equal(await printsOf(a.id), before.prints, 'no new print record');
      assert.equal(await workoutsOf(a.id), before.workouts, 'no new workout session');
      await assertNoRawCode(page, 'D preview');
      note(`reprint after revoke → screen "${(await bodyText(page)).match(PREVIEW_SETTLED)?.[0]}"; prints/workouts/submits unchanged`);
      // A fresh visit to the history screen with the revoked device shows no member and no record.
      await page.goto(`${origin}/program-manager/workout-sessions`);
      await page.getByPlaceholder('회원명 또는 전화번호 검색').fill(a.name);
      await pause(2500);
      assert.equal(await page.getByRole('button', { name: a.name, exact: true }).count(), 0, 'no member listed for a revoked device');
      assert.equal(await cards(page).count(), 0);
      // Phase 3-E: the failed member list is an explicit Korean error, not an empty result.
      const alert = page.getByRole('alert').filter({ hasText: /기기 인증이 필요합니다|사용이 중지된 키오스크/ });
      await alert.waitFor({ timeout: 20_000 });
      assert.equal(await page.getByText('일치하는 회원이 없습니다.').count(), 0, 'not shown as "no matching member"');
      await assertNoRawCode(page, 'D history');
      assert.equal(tracker.responses.slice(mark).filter((entry) => entry.path === '/v1/kiosk/sessions' && entry.method === 'POST' && entry.status < 400).length, 0, 'no session issued after revoke');
      note(`revoked device on the history screen → "${(await alert.innerText()).trim()}"`);
    } finally { await context.close(); }
  });

  await step('E. Direct URLs: history detail without a selection, and another member workout session in the preview', async (note) => {
    const device = await createDevice('se');
    const a = await createMember('se_a', '직접가회원'); const b = await createMember('se_b', '직접나회원');
    const wsA = await seedPrintedSession(device, a, 3); const wsB = await seedPrintedSession(device, b, 1);
    const checkPreviewBlocked = async (page, tracker, url, label) => {
      const submits = physicalSubmits; const printsB = await printsOf(b.id); const mark = tracker.responses.length; const agentBefore = tracker.agentPrints;
      await page.goto(url);
      await until(`${label} settled`, async () => PREVIEW_SETTLED.test(await bodyText(page)), 30_000);
      await pause(1500);
      const okB = tracker.responses.slice(mark).filter((entry) => entry.path === `${LIST_PATH}/${wsB}` && entry.status < 400);
      assert.equal(okB.length, 0, `${label}: B workout session never served`);
      assert.equal(physicalSubmits, submits, `${label}: nothing printed`); assert.equal(tracker.agentPrints, agentBefore, `${label}: no print request`);
      assert.equal(await printsOf(b.id), printsB, `${label}: no print record`);
      assert.equal(await page.getByText('재출력을 요청했습니다.').count(), 0);
      await assertNoRawCode(page, label);
      note(`${label} → "${(await bodyText(page)).match(PREVIEW_SETTLED)?.[0]}"`);
    };
    // E1: history detail URL with no member selected.
    {
      const { context, page, tracker } = await openKiosk(device);
      try {
        await page.goto(`${origin}/program-manager/workout-sessions/${wsA}`);
        await page.getByPlaceholder('회원명 또는 전화번호 검색').waitFor({ timeout: 20_000 }); // member selection screen
        await pause(2000);
        assert.equal(await cards(page).count(), 0, 'no record without a selection');
        assert.equal(tracker.sessionIssues, 0, 'no member session opened');
        assert.equal(tracker.responses.filter((entry) => entry.path.startsWith('/v1/kiosk/sessions/current')).length, 0, 'no member-scoped request');
        assert.equal((await bodyText(page)).includes(wsA), false);
        note('detail URL without selection → member search screen only; 0 member-scoped requests');
        // E2/E3: preview of B's workout session by direct URL (fresh load: nothing selected).
        await checkPreviewBlocked(page, tracker, `${origin}/program-manager/print/session/${wsB}?memberId=${encodeURIComponent(a.id)}&autoPrint=1`, 'preview wsB as A (direct)');
        await checkPreviewBlocked(page, tracker, `${origin}/program-manager/print/session/${wsB}?memberId=${encodeURIComponent(b.id)}&autoPrint=1`, 'preview wsB as B (direct, no selection)');
      } finally { await context.close(); }
    }
    // E4: A selected in the history; B's id is refused by the server for A's session, and an in-app
    //     navigation to B's preview shows nothing and prints nothing.
    {
      const { context, page, tracker } = await openKiosk(device);
      try {
        await openHistory(page, a);
        await until('A record listed', async () => (await cards(page).count()) === 1);
        const aToken = tracker.sessionTokens.at(-1);
        const read = await call('GET', `${LIST_PATH}/${wsB}`, { idToken: device.idToken, session: aToken });
        assert.equal(read.status, 404, 'A session cannot read B workout session');
        const printsB = await printsOf(b.id);
        const record = await call('POST', `/v1/kiosk/workout-sessions/${wsB}/prints`, { idToken: device.idToken, session: aToken, body: { printRequestId: `pr_${randomBytes(16).toString('hex')}`, printer: 'E2E Printer' } });
        assert.equal(record.status, 403, 'A session cannot record a print of B workout session');
        assert.equal(record.body?.error?.code, 'PRINT_SCOPE_DENIED');
        assert.equal(await printsOf(b.id), printsB, 'no print record for B');
        note(`A session: read wsB → ${read.status} ${read.body?.error?.code}; print wsB → ${record.status} ${record.body?.error?.code}`);
        const submits = physicalSubmits; const mark = tracker.responses.length;
        await page.evaluate((url) => { window.history.pushState({}, '', url); window.dispatchEvent(new PopStateEvent('popstate')); }, `/program-manager/print/session/${wsB}?memberId=${encodeURIComponent(a.id)}&autoPrint=1`);
        await until('in-app preview settled', async () => PREVIEW_SETTLED.test(await bodyText(page)), 30_000);
        await pause(1500);
        assert.equal(tracker.responses.slice(mark).filter((entry) => entry.path === `${LIST_PATH}/${wsB}` && entry.status < 400).length, 0, 'B workout session never served');
        assert.equal(physicalSubmits, submits); assert.equal(tracker.agentPrints, 0); assert.equal(await printsOf(b.id), printsB);
        note(`in-app navigation to wsB with A selected → "${(await bodyText(page)).match(PREVIEW_SETTLED)?.[0]}"`);
      } finally { await context.close(); }
    }
  });
} catch (error) {
  console.error('[e2e] harness error', error);
} finally {
  clearTimeout(watchdog);
  await cleanup().catch((error) => console.error('cleanup failed', error));
  await persist(true).catch(() => {});
  for (const result of results) console.log(`${result.status} ${result.name}${result.error ? ` — ${result.error.split('\n')[0]}` : ''}`);
  const expected = requested ? 1 : 5; const failed = results.filter((result) => result.status !== 'PASS').length;
  console.log(`History security results: ${resultsFile}\n${results.length - failed}/${results.length} passed (${expected} expected)`);
  process.exit(failed || results.length !== expected ? 1 : 0);
}
