#!/usr/bin/env node
// Kiosk device sign-in recovery E2E (Firebase Emulator only; real Chromium; real Print Agent HTTP server).
//
// The kiosk browser can start before the local Print Agent after a Windows sign-in. These scenarios drive the real
// Program Manager page against the real Condition Lab Kiosk API and an agent that holds a really enrolled + approved
// device key (test cipher instead of DPAPI), and stop/start that agent while the page stays open:
//   A. agent not running → page shows "키오스크 서비스를 준비하고 있습니다" → agent starts → the member list recovers on
//      the same page (no reload) → name search finds the member
//   B. agent running → member list works from the start
//   C. agent answers device_not_enrolled (no credential file) → "키오스크 기기 인증이 필요합니다", no retry loop
//   D. agent running → page ready → agent stops and the device's Firebase session is lost → page shows the
//      preparing message → agent restarts → same page recovers
//
//   node scripts/e2e-kiosk-device-recovery.emulator.mjs [--scenario=A|B|C|D]
//
// Requires the Auth (19099) and Firestore (18080) Emulators (e.g. in Condition Lab:
// `firebase emulators:start --only auth,firestore --project basecamp-e2e-local`) and Condition Lab at
// CONDITION_LAB_ROOT (default ../condition-lab) with its node_modules (@playwright/test, firebase-admin).
// Nothing here talks to a real Firebase project; the project id is checked.
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
const API_PORT = 4015;
const PM_PORT = 5181;
const AGENT_PORT = 43193;
const PM_ROOT = process.cwd();
const CL_ROOT = path.resolve(process.env.CONDITION_LAB_ROOT ?? '../condition-lab');
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID !== PROJECT_ID) throw new Error('Refusing to run: non-emulator project.');
process.env.FIREBASE_PROJECT_ID = PROJECT_ID; process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST; process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;

const load = (relative) => import(pathToFileURL(path.join(CL_ROOT, relative)).href);
const { chromium } = createRequire(path.join(CL_ROOT, 'package.json'))('@playwright/test');
const [{ createEmulatorAdminTokenVerifier }, { createEmulatorFirestoreContext }, { createAuthBoundary }, { createTrustedIssuance }, { checksumKnowledgeItems, FIRESTORE_SNAPSHOT_SCHEMA_VERSION }, { createKioskMemberSessionService }, { createKioskMemberSessionHandler }, { createKioskWorkoutSessionSaver }, sessionHttp, { createKioskReadService }, readHttp, handoffHttp, { createKioskPrintRecorder }, { createKioskDeviceEnrollment }, deviceHttp] = await Promise.all([
  load('server/auth/firebaseAdminVerifier.js'), load('server/auth/firebaseAdminFirestore.js'), load('server/auth/authBoundary.js'), load('server/auth/trustedIssuance.js'),
  load('packages/exercise-knowledge/runtime/firestoreSnapshotStore.js'), load('server/kiosk/kioskMemberSessions.js'), load('server/kiosk/kioskMemberSessionHandler.js'), load('server/kiosk/kioskWorkoutSessionHandler.js'),
  load('server/http/kioskMemberSessionHttpAdapter.js'), load('server/kiosk/kioskReadService.js'), load('server/kiosk/kioskReadHandler.js'), load('server/http/kioskSessionActivationHttpAdapter.js'), load('server/kiosk/kioskPrintRecordHandler.js'),
  load('server/kiosk/kioskDeviceEnrollment.js'), load('server/http/kioskDeviceAuthHttpAdapter.js'),
]);

const requested = process.argv.find((argument) => argument.startsWith('--scenario='))?.slice('--scenario='.length)?.toUpperCase() ?? null;
if (requested && !/^[A-D]$/.test(requested)) throw new Error(`Unknown scenario selector: ${requested}`);
const prefix = `pm_e2e_${Date.now()}`;
const resultsFile = path.join(PM_ROOT, 'outputs', 'e2e-results', `${prefix}-device-recovery.json`);
const adminUid = `${prefix}_admin`;
const verifier = createEmulatorAdminTokenVerifier({ projectId: PROJECT_ID, authEmulatorHost: AUTH_HOST, appName: `${prefix}_auth` });
const { db } = createEmulatorFirestoreContext({ projectId: PROJECT_ID, firestoreEmulatorHost: FIRESTORE_HOST, appName: `${prefix}_fs` });
const issuance = createTrustedIssuance({ auth: verifier.auth, db, trustedIssuerUids: [adminUid], approvedTrainerUids: [] });
const boundary = createAuthBoundary({ verifyIdToken: verifier.verifyIdToken, expectedProjectId: PROJECT_ID, requireEmulator: true, emulatorHost: AUTH_HOST });
const publicData = `artifacts/${APP_ID}/public/data`;
const profile = (id) => db.doc(`${publicData}/profiles/${id}`);
const knowledge = db.doc(`${publicData}/sharedKnowledgeRuntime/current`);
const knowledgeItem = (id, name, bodyPart) => ({ id, status: 'active', name, englishName: id, aliases: [], tags: [], purpose: [], bodyPart, primaryMuscle: name, secondaryMuscles: [], equipment: 'barbell', coachingCues: [], commonMistakes: [], contraindications: [], progressionExerciseIds: [], regressionExerciseIds: [], relatedExerciseIds: [] });
const until = async (label, predicate, timeout = 20_000) => { const end = Date.now() + timeout; for (;;) { const value = await predicate(); if (value) return value; if (Date.now() > end) throw new Error(`timed out: ${label}`); await new Promise((resolve) => setTimeout(resolve, 200)); } };
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const STARTING = '키오스크 서비스를 준비하고 있습니다';
const ADMIN = '키오스크 기기 인증이 필요합니다';
const MEMBER_NAME = '복구가회원';

// --- Results: a failing scenario is recorded; the remaining scenarios still run. ---
const results = [];
const persist = async (final = false) => { await mkdir(path.dirname(resultsFile), { recursive: true }); await writeFile(resultsFile, JSON.stringify({ startedAt: prefix, final, scenarios: results }, null, 2)); };
const step = async (name, fn) => {
  if (requested && name[0] !== requested) { console.log(`SKIP ${name} (--scenario=${requested})`); return; }
  const started = Date.now(); console.log(`START ${name}`);
  const findings = [];
  try { await fn((line) => { findings.push(line); console.log(`[recovery][${name[0]}] ${line}`); }); results.push({ name, status: 'PASS', durationMs: Date.now() - started, findings }); console.log(`PASS ${name} (${Date.now() - started}ms)`); }
  catch (error) { results.push({ name, status: 'FAIL', durationMs: Date.now() - started, findings, error: error?.stack ?? String(error) }); console.log(`FAIL ${name} — ${String(error?.message ?? error).split('\n')[0]}`); }
  await persist();
};

// --- Fixtures (removed in cleanup) ---
let previousKnowledge = null; let gateway; let vite; let browser; let agent = null; let workDir = null; let memberId = null; const deviceIds = [];
const cleanup = async () => {
  await browser?.close().catch(() => {});
  if (vite && !vite.killed) { if (process.platform === 'win32') await new Promise((resolve) => spawn('taskkill', ['/pid', String(vite.pid), '/t', '/f'], { stdio: 'ignore' }).on('exit', resolve).on('error', resolve)); else vite.kill(); }
  if (gateway?.listening) await new Promise((resolve) => gateway.close(resolve));
  await agent?.close().catch(() => {});
  if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => {});
  const deletions = [];
  if (memberId) deletions.push(profile(memberId).delete().catch(() => {}));
  for (const deviceId of deviceIds) deletions.push(db.doc(`authKioskDevices/${deviceId}`).delete().catch(() => {}), verifier.auth.deleteUser(`kiosk:${deviceId}`).catch(() => {}));
  deletions.push(verifier.auth.deleteUser(adminUid).catch(() => {}));
  deletions.push(previousKnowledge ? knowledge.set(previousKnowledge) : knowledge.delete());
  await Promise.all(deletions);
};
const watchdog = setTimeout(async () => { console.error('device recovery E2E watchdog: exceeded 420s'); await cleanup().catch(() => {}); process.exit(1); }, 420_000);

// --- Agent control: the same real agent server, started and stopped on one port ---
let origin; let pdfPipeline; let enrolledCredential; let tokenRequests = 0;
const printBackend = { getStatus: async () => ({ printerConfigured: true, configuredPrinter: 'E2E Printer', printerAvailable: true, printerStatus: 'Normal', defaultPrinter: 'E2E Printer' }), submit: async () => ({ status: 'submitted', printer: 'E2E Printer' }) };
const startAgent = async (credential) => {
  assert.equal(agent, null, 'agent already running');
  agent = createPrintAgent({ port: AGENT_PORT, allowedOrigins: [origin], deviceTokenOrigins: [origin], logger: { info: async () => {}, error: async (message) => console.error(`[e2e][agent] ${String(message)}`) }, backend: printBackend, pdfPipeline, deviceCredential: async () => ({ getCustomToken: async () => { tokenRequests += 1; return credential.getCustomToken(); } }) });
  await agent.listen();
};
const stopAgent = async () => { if (!agent) return; await agent.close(); agent = null; };

/** Opens Program Manager's member selection. Marks the window so a reload/navigation is detected. */
const openKiosk = async ({ start = true, clock = false } = {}) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  // Fake clock that keeps flowing in real time; fastForward() lets the device ID token expire on demand (scenario D).
  if (clock) await context.clock.install();
  // No __kiosk_device_token: the device identity comes from the agent only (production path).
  await context.addInitScript(() => { window.print = () => {}; });
  const page = await context.newPage(); page.setDefaultTimeout(20_000); page.setDefaultNavigationTimeout(90_000);
  const tracker = { documentLoads: 0, pageErrors: [], memberListOk: 0 };
  page.on('load', () => { tracker.documentLoads += 1; });
  page.on('response', (response) => { if (new URL(response.url()).pathname === '/v1/kiosk/members' && response.ok()) tracker.memberListOk += 1; });
  page.on('pageerror', (error) => tracker.pageErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' && !/Kiosk|device-token|Failed to load resource|ERR_CONNECTION_REFUSED/.test(message.text())) console.error(`[e2e][browser] ${message.text()}`); });
  await page.goto(`${origin}/program-manager/print`);
  if (start) await page.getByRole('button', { name: '프로그램 시작' }).click();
  await page.evaluate(() => { window.__e2eSamePage = true; });
  return { context, page, tracker };
};
let dumpSerial = 0;
/** On a scenario failure: full-page screenshot and the visible text, for diagnosis. */
const dump = async (page, label) => {
  const base = path.join(PM_ROOT, 'outputs', 'e2e-results', `${prefix}-${label}-${++dumpSerial}`);
  await mkdir(path.dirname(base), { recursive: true });
  await page.screenshot({ path: `${base}.png`, fullPage: true }).catch(() => {});
  await writeFile(`${base}.txt`, `url=${page.url()}\n${await page.locator('body').innerText().catch(() => '')}`).catch(() => {});
  console.log(`[e2e] failure dump ${base}.png / .txt`);
};
/** The 초성 filter button (the virtual keyboard has a key with the same label). */
const initialButton = (page, label) => page.locator('button[aria-pressed]').filter({ hasText: new RegExp(`^${label}$`) });
const bodyText = (page) => page.locator('body').innerText().catch(() => '');
const alertText = async (page) => (await page.getByRole('alert').allInnerTexts().catch(() => [])).join('\n');
const samePage = async (page, tracker, loadsBefore) => {
  assert.equal(await page.evaluate(() => window.__e2eSamePage === true), true, 'same document (no reload)');
  assert.equal(tracker.documentLoads, loadsBefore, 'no document load event (no reload)');
};
/** Name search on the member keyboard; falls back to the 초성 filter if the virtual input cannot be typed into. */
const searchMember = async (page, note) => {
  const input = page.getByLabel('회원 이름 또는 전화번호 검색');
  let used = 'name';
  try { await input.fill(MEMBER_NAME, { timeout: 5_000 }); } catch {
    try { await input.click(); await page.keyboard.type(MEMBER_NAME); } catch { used = 'initial'; }
  }
  const button = page.getByRole('button', { name: `${MEMBER_NAME} 회원 선택` });
  if (used === 'name' && !(await button.isVisible().catch(() => false))) { await pause(500); if (!(await button.isVisible().catch(() => false))) used = 'initial'; }
  if (used === 'initial') { await input.fill('').catch(() => {}); const initial = initialButton(page, 'ㅂ'); if (await initial.getAttribute('aria-pressed') !== 'true') await initial.click(); }
  await button.waitFor({ timeout: 20_000 });
  await button.click();
  assert.equal(await button.getAttribute('aria-pressed'), 'true', 'member selected');
  note(`member found and selected via ${used === 'name' ? 'name search' : '초성 filter (virtual keyboard not typeable)'}`);
};

try {
  const existing = await knowledge.get(); previousKnowledge = existing.exists ? existing.data() : null;
  const items = [knowledgeItem('squat', '스쿼트', 'legs'), knowledgeItem('lunge', '런지', 'legs'), knowledgeItem('row', '바벨 로우', 'back')];
  await knowledge.set({ revision: Number(previousKnowledge?.revision || 0) + 1, schemaVersion: FIRESTORE_SNAPSHOT_SCHEMA_VERSION, knowledgeVersion: '3.0.0', updatedAt: new Date().toISOString(), updatedBy: `${prefix}:device-recovery-seed`, exerciseCount: items.length, checksum: await checksumKnowledgeItems(items), items });
  await verifier.auth.createUser({ uid: adminUid });
  memberId = `${prefix}_member`; await profile(memberId).set({ id: memberId, name: MEMBER_NAME, role: 'member' });

  // Real Condition Lab Kiosk API: reads (member list, runtime), member sessions, device enrollment/auth.
  const kioskSessions = createKioskMemberSessionService({ authBoundary: boundary, db, issuance, appId: APP_ID });
  const sessionServer = sessionHttp.createKioskMemberSessionHttpServer({ handleKioskMemberSession: createKioskMemberSessionHandler({ sessions: kioskSessions, saveWorkoutSession: createKioskWorkoutSessionSaver({ sessions: kioskSessions, db, appId: APP_ID }), recordPrint: createKioskPrintRecorder({ sessions: kioskSessions, db, appId: APP_ID }) }) });
  const readServer = readHttp.createKioskReadHttpServer({ handleKioskRead: readHttp.createKioskReadHandler({ authBoundary: boundary, issuance, sessions: kioskSessions, reads: createKioskReadService({ db, appId: APP_ID, rankingCacheMs: 0 }) }) });
  const deviceEnrollment = createKioskDeviceEnrollment({ auth: verifier.auth, db, projectId: PROJECT_ID, appId: APP_ID });
  const deviceServer = deviceHttp.createKioskDeviceAuthHttpServer({ enrollment: deviceEnrollment });
  gateway = handoffHttp.createLocalApiGateway({ routes: [{ match: readHttp.isKioskReadPath, server: readServer }, { match: deviceHttp.isKioskDeviceAuthPath, server: deviceServer }, { match: sessionHttp.isKioskMemberSessionPath, server: sessionServer }] });
  await new Promise((resolve, reject) => { gateway.once('error', reject); gateway.listen(API_PORT, '127.0.0.1', resolve); });

  origin = `http://127.0.0.1:${PM_PORT}`;
  workDir = await mkdtemp(path.join(tmpdir(), 'pm-e2e-recovery-'));
  const minimalPdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 420]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF';
  pdfPipeline = { create: async ({ jobId }) => { const file = path.join(workDir, `${String(jobId).replace(/[^A-Za-z0-9_-]/g, '_')}-${Date.now()}.pdf`); await writeFile(file, minimalPdf); return { path: file, cleanup: async () => rm(file, { force: true }), metadata: { pageCount: 1, bytes: minimalPdf.length } }; } };

  // Enroll + approve one device the way an operator does (agent credential module; test cipher instead of DPAPI).
  const operator = { kind: 'admin-cli', operator: 'e2e', host: 'e2e' };
  const issuedCode = await deviceEnrollment.issueEnrollmentCode({ actor: operator, label: 'E2E recovery kiosk' }); deviceIds.push(issuedCode.deviceId);
  const cipherKey = randomBytes(32);
  const protector = { kind: 'test-aes-gcm', protect: async (data) => { const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', cipherKey, iv); return Buffer.concat([iv, cipher.update(data), cipher.final(), cipher.getAuthTag()]); }, unprotect: async (data) => { const decipher = createDecipheriv('aes-256-gcm', cipherKey, data.subarray(0, 12)); decipher.setAuthTag(data.subarray(-16)); return Buffer.concat([decipher.update(data.subarray(12, -16)), decipher.final()]); } };
  const credentialConfig = { apiBaseUrl: `http://127.0.0.1:${API_PORT}`, projectId: PROJECT_ID, appId: APP_ID };
  enrolledCredential = createKioskDeviceCredential({ config: credentialConfig, protector, credentialPath: path.join(workDir, 'device-credential.json') });
  const redeemed = await enrolledCredential.enroll(issuedCode.code);
  await deviceEnrollment.approveDevice({ actor: operator, deviceId: redeemed.deviceId, fingerprint: redeemed.keyFingerprint });
  // Never enrolled: no credential file → the real credential module answers device_not_enrolled (409).
  const unenrolledCredential = createKioskDeviceCredential({ config: credentialConfig, protector, credentialPath: path.join(workDir, 'missing', 'device-credential.json') });

  vite = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--host', '127.0.0.1', '--port', String(PM_PORT), '--strictPort'], { cwd: PM_ROOT, shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'], env: {
    ...process.env,
    VITE_FIREBASE_USE_EMULATOR: 'true', VITE_FIREBASE_EMULATOR_HOST: '127.0.0.1', VITE_FIRESTORE_EMULATOR_PORT: '18080', VITE_FIREBASE_AUTH_EMULATOR_PORT: '19099',
    VITE_FIREBASE_API_KEY: 'emulator-test-key', VITE_FIREBASE_AUTH_DOMAIN: 'localhost', VITE_FIREBASE_PROJECT_ID: PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET: `${PROJECT_ID}.appspot.com`, VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000', VITE_FIREBASE_APP_ID: '1:000000000000:web:e2etest',
    VITE_CONDITION_LAB_APP_ID: APP_ID, VITE_CONDITION_LAB_API_BASE_URL: origin,
    // Set explicitly: the Kiosk API runtime reads VITE_BASECAMP_API_BASE_URL; never inherit it from a local .env file.
    VITE_BASECAMP_API_BASE_URL: origin, VITE_KIOSK_API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}`, VITE_KIOSK_DEVICE_AGENT_ENDPOINT: `http://127.0.0.1:${AGENT_PORT}`,
    VITE_PRINT_RUNTIME: 'windows-agent', VITE_PRINT_AGENT_ENDPOINT: `http://127.0.0.1:${AGENT_PORT}`, VITE_GEMINI_API_KEY: '',
  } });
  let viteLog = ''; vite.stdout.on('data', (chunk) => { viteLog += chunk; }); vite.stderr.on('data', (chunk) => { viteLog += chunk; });
  for (let attempt = 0; attempt < 60; attempt += 1) { try { if ((await fetch(origin)).ok) break; } catch { /* starting */ } await pause(500); if (attempt === 59) throw new Error(`Program Manager dev server did not start.\n${viteLog.slice(-2000)}`); }
  await fetch(`${origin}/program-manager/print`).catch(() => {});
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || 'chrome', headless: true });
  console.log('[e2e] device recovery harness ready');

  await step('A. agent not running at startup → preparing message → agent starts → same page recovers, name search works', async (note) => {
    await stopAgent();
    const { context, page, tracker } = await openKiosk();
    try {
      await until('preparing message shown', async () => (await alertText(page)).includes(STARTING));
      assert.equal((await bodyText(page)).includes(ADMIN), false, 'never the administrator message for an agent that is not running');
      const loads = tracker.documentLoads;
      note(`agent down: "${(await alertText(page)).split('\n')[0]}"`);
      await pause(1_500);
      await startAgent(enrolledCredential);
      await until('member list recovered without reload', async () => !(await alertText(page)).includes(STARTING) && (await initialButton(page, 'ㅂ').isVisible()));
      await samePage(page, tracker, loads);
      await searchMember(page, note);
      await samePage(page, tracker, loads);
      assert.deepEqual(tracker.pageErrors, []);
    } catch (error) { await dump(page, 'fail'); throw error; } finally { await context.close(); }
  });

  await step('B. agent running from the start → member list works immediately', async (note) => {
    await stopAgent(); await startAgent(enrolledCredential);
    const { context, page, tracker } = await openKiosk();
    try {
      await searchMember(page, note);
      assert.equal((await bodyText(page)).includes(STARTING), false, 'no preparing message');
      assert.equal((await bodyText(page)).includes(ADMIN), false, 'no administrator message');
      assert.deepEqual(tracker.pageErrors, []);
    } catch (error) { await dump(page, 'fail'); throw error; } finally { await context.close(); }
  });

  await step('C. agent answers device_not_enrolled → administrator message, no retry loop', async (note) => {
    await stopAgent(); await startAgent(unenrolledCredential);
    const { context, page, tracker } = await openKiosk();
    try {
      await until('administrator message shown', async () => (await alertText(page)).includes(ADMIN));
      assert.equal((await bodyText(page)).includes(STARTING), false, 'not the preparing message');
      const requestsAtMessage = tokenRequests;
      await pause(12_000); // longer than 1 s + 2 s + 5 s of the retry schedule
      assert.equal(tokenRequests, requestsAtMessage, `no automatic retry (agent token requests ${requestsAtMessage} → ${tokenRequests})`);
      note(`device_not_enrolled: "${(await alertText(page)).split('\n')[0]}", no further agent requests in 12 s`);
      assert.deepEqual(tracker.pageErrors, []);
    } catch (error) { await dump(page, 'fail'); throw error; } finally { await context.close(); }
  });

  await step('D. agent stops and the device session is lost, agent restarts → same page recovers', async (note) => {
    await stopAgent(); await startAgent(enrolledCredential);
    const { context, page, tracker } = await openKiosk({ start: false, clock: true });
    try {
      await until('member list loaded with the agent up', async () => tracker.memberListOk >= 1);
      const loads = tracker.documentLoads;
      // The agent dies and the device's Firebase session is lost with it (as when the ID token expires and its
      // refresh fails): disable the device user and let the in-memory ID token expire, so the next Kiosk call has
      // to sign in again through the agent, which is down.
      await stopAgent();
      const deviceUid = `kiosk:${deviceIds[0]}`;
      await verifier.auth.updateUser(deviceUid, { disabled: true });
      await page.clock.fastForward('02:00:00');
      // A new Kiosk call on the same page (SPA): the history screen loads the member list.
      await page.getByRole('button', { name: '이전 운동 기록 보기' }).click();
      await until('preparing message while the agent is down', async () => (await bodyText(page)).includes(STARTING));
      assert.equal((await bodyText(page)).includes(ADMIN), false, 'never the administrator message for an agent restart');
      note('agent down + device session lost: preparing message shown');
      await verifier.auth.updateUser(deviceUid, { disabled: false });
      const okBefore = tracker.memberListOk;
      await startAgent(enrolledCredential);
      await until('same page recovered (member list loaded again)', async () => tracker.memberListOk > okBefore && !(await bodyText(page)).includes(STARTING), 30_000);
      await samePage(page, tracker, loads);
      await page.getByPlaceholder('회원명 또는 전화번호 검색').fill(MEMBER_NAME);
      await page.getByRole('button', { name: MEMBER_NAME, exact: true }).waitFor({ timeout: 20_000 });
      note('history member search works after the agent restart, no reload');
      await samePage(page, tracker, loads);
      assert.deepEqual(tracker.pageErrors, []);
    } catch (error) { await dump(page, 'fail'); throw error; } finally { await context.close(); }
  });
} catch (error) {
  console.error('[e2e] harness error', error);
} finally {
  clearTimeout(watchdog);
  await cleanup().catch((error) => console.error('cleanup failed', error));
  await persist(true).catch(() => {});
  for (const result of results) console.log(`${result.status} ${result.name}${result.error ? ` — ${result.error.split('\n')[0]}` : ''}`);
  const expected = requested ? 1 : 4; const failed = results.filter((result) => result.status !== 'PASS').length;
  console.log(`Device recovery results: ${resultsFile}\n${results.length - failed}/${results.length} passed (${expected} expected)`);
  process.exit(failed || results.length !== expected ? 1 : 0);
}
