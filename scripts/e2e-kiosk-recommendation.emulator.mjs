/**
 * Phase 2-T3 — Program Manager browser E2E (Emulator only), Trainer → Kiosk handoff.
 *
 * Starts the Condition Lab handoff API on localhost, runs the Program Manager Vite dev server against
 * the Firebase Emulator, and drives the real Kiosk UI in Chrome. A Trainer issues handoffs through the
 * API; the Kiosk (device-only identity) shows recommendations only for the handoff's member, and
 * 그대로 사용 / 수정해서 사용 / 직접 구성 reach the existing workout-session + print preview flow.
 * Uses Condition Lab's installed Playwright. Never touches production Firebase or Gemini.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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
const [{ createEmulatorAdminTokenVerifier }, { createEmulatorFirestoreContext }, { createAuthBoundary }, { createTrustedIssuance }, { createKioskSessionActivationHandler }, handoffHttp, { checksumKnowledgeItems, FIRESTORE_SNAPSHOT_SCHEMA_VERSION }] = await Promise.all([
  load('server/auth/firebaseAdminVerifier.js'), load('server/auth/firebaseAdminFirestore.js'), load('server/auth/authBoundary.js'), load('server/auth/trustedIssuance.js'),
  load('server/kiosk/kioskSessionActivationHandler.js'), load('server/http/kioskSessionActivationHttpAdapter.js'), load('packages/exercise-knowledge/runtime/firestoreSnapshotStore.js'),
]);

const prefix = `pm_e2e_${Date.now()}`;
const adminUid = `${prefix}_admin`; const trainerUid = `${prefix}_trainer`; const deviceId = `${prefix}_kiosk`;
const memberA = `${prefix}_a`; const memberB = `${prefix}_b`;
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
const step = async (name, fn) => { const started = Date.now(); try { await fn(); results.push({ name, ok: true }); console.log(`PASS ${name} (${Date.now() - started}ms)`); } catch (error) { results.push({ name, ok: false, error: error?.message ?? String(error) }); console.log(`FAIL ${name} — ${String(error?.message ?? error).split(String.fromCharCode(10))[0]}`); throw error; } };
const EXPECTED_STEPS = 8;

let previousKnowledge = null; let gateway; let vite; let browser;
const cleanup = async () => {
  await browser?.close().catch(() => {});
  // Wait for the whole Vite process tree to exit so no dev server is left on the port.
  if (vite && !vite.killed) { if (process.platform === 'win32') await new Promise((resolve) => spawn('taskkill', ['/pid', String(vite.pid), '/t', '/f'], { stdio: 'ignore' }).on('exit', resolve).on('error', resolve)); else vite.kill(); }
  if (gateway?.listening) await new Promise((resolve) => gateway.close(resolve));
  const [handoffs, workoutSessions, prints] = await Promise.all([
    db.collection('authKioskHandoffs').where('deviceId', '==', deviceId).get(),
    db.collection(`artifacts/${APP_ID}/public/data/workoutSessions`).where('memberId', 'in', [memberA, memberB]).get(),
    db.collection(`artifacts/${APP_ID}/public/data/printHistory`).where('memberId', 'in', [memberA, memberB]).get().catch(() => ({ docs: [] })),
  ]);
  await Promise.all([
    ...handoffs.docs.map((doc) => doc.ref.delete()), ...workoutSessions.docs.map((doc) => doc.ref.delete()), ...prints.docs.map((doc) => doc.ref.delete()),
    ...Object.values(programIds).map((id) => program(id).delete()), profile(memberA).delete(), profile(memberB).delete(),
    issuance.paths.device(deviceId).delete().catch(() => {}), ...[adminUid, trainerUid, `kiosk:${deviceId}`].map((uid) => verifier.auth.deleteUser(uid).catch(() => {})),
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
  // --- Emulator fixtures ---
  const existing = await knowledge.get(); previousKnowledge = existing.exists ? existing.data() : null;
  const items = [knowledgeItem('squat', '스쿼트', 'legs'), knowledgeItem('lunge', '런지', 'legs'), knowledgeItem('row', '바벨 로우', 'back'), knowledgeItem('bench_press', '벤치 프레스', 'chest')];
  await knowledge.set({ revision: Number(previousKnowledge?.revision || 0) + 1, schemaVersion: FIRESTORE_SNAPSHOT_SCHEMA_VERSION, knowledgeVersion: '3.0.0', updatedAt: new Date().toISOString(), updatedBy: `${prefix}:e2e-seed`, exerciseCount: items.length, checksum: await checksumKnowledgeItems(items), items });
  await Promise.all([adminUid, trainerUid].map((uid) => verifier.auth.createUser({ uid })));
  await Promise.all([profile(memberA).set({ id: memberA, name: '추천회원', role: 'member' }), profile(memberB).set({ id: memberB, name: '추가회원', role: 'member' })]);
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

  // --- Local handoff API (Trainer issue + Kiosk read/close) ---
  gateway = handoffHttp.createKioskSessionActivationHttpServer({ handleKioskSessionActivation: createKioskSessionActivationHandler({ authBoundary: boundary, db, issuance }) });
  await new Promise((resolve, reject) => { gateway.once('error', reject); gateway.listen(API_PORT, '127.0.0.1', resolve); });

  // --- Program Manager dev server against the Emulator (process env overrides .env.local) ---
  const origin = `http://127.0.0.1:${PM_PORT}`;
  vite = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--host', '127.0.0.1', '--port', String(PM_PORT), '--strictPort'], { cwd: PM_ROOT, shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'], env: {
    ...process.env,
    VITE_FIREBASE_USE_EMULATOR: 'true', VITE_FIREBASE_EMULATOR_HOST: '127.0.0.1', VITE_FIRESTORE_EMULATOR_PORT: '18080', VITE_FIREBASE_AUTH_EMULATOR_PORT: '19099',
    VITE_FIREBASE_API_KEY: 'emulator-test-key', VITE_FIREBASE_AUTH_DOMAIN: 'localhost', VITE_FIREBASE_PROJECT_ID: PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET: `${PROJECT_ID}.appspot.com`, VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000', VITE_FIREBASE_APP_ID: '1:000000000000:web:e2etest',
    VITE_CONDITION_LAB_APP_ID: APP_ID, VITE_CONDITION_LAB_API_BASE_URL: origin, VITE_KIOSK_API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}`,
    VITE_PRINT_RUNTIME: 'browser', VITE_GEMINI_API_KEY: '',
  } });
  let viteLog = ''; vite.stdout.on('data', (chunk) => { viteLog += chunk; }); vite.stderr.on('data', (chunk) => { viteLog += chunk; });
  console.log('Program Manager dev server starting...');
  for (let attempt = 0; attempt < 60; attempt += 1) { try { if ((await fetch(origin)).ok) break; } catch { /* starting */ } await new Promise((resolve) => setTimeout(resolve, 500)); if (attempt === 59) throw new Error(`Program Manager dev server did not start.\n${viteLog.slice(-2000)}`); }
  await fetch(`${origin}/program-manager/print`).catch(() => {});

  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript((token) => { window.__kiosk_device_token = token; window.print = () => {}; }, deviceEnrollmentToken);
  const page = await context.newPage();
  page.setDefaultTimeout(30_000); page.setDefaultNavigationTimeout(90_000);
  const consoleErrors = []; page.on('pageerror', (error) => consoleErrors.push(error.message));
  const firebaseHosts = new Set(); page.on('request', (request) => { const host = new URL(request.url()).host; if (/googleapis\.com|firebaseio\.com|firebaseapp\.com/.test(host)) firebaseHosts.add(host); });
  const kioskRequests = []; page.on('request', (request) => { if (request.url().includes('/v1/kiosk/')) kioskRequests.push(request.url()); });

  const begin = async () => { await page.goto(`${origin}/program-manager/print`); await page.getByRole('button', { name: '프로그램 시작' }).click(); };
  const openMember = async (name, initial = 'ㅊ') => {
    // The initial filter toggles; only press it when it is not already active.
    const initialButton = page.getByRole('button', { name: initial, exact: true });
    if (await initialButton.getAttribute('aria-pressed') !== 'true') await initialButton.click();
    await page.getByRole('button', { name: `${name} 회원 선택` }).click();
  };
  const card = page.getByRole('region', { name: '트레이너 추천 프로그램' });
  const sessionRecord = async () => { await page.waitForURL(/\/program-manager\/print\/session\/ws_\d{8}_[a-z0-9]+/, { timeout: 20_000 }); const sessionId = new URL(page.url()).pathname.split('/').pop(); return (await db.doc(`artifacts/${APP_ID}/public/data/workoutSessions/${sessionId}`).get()).data(); };

  let h1; let h2;
  await step('A. Case 1/8: handoff for A → selecting A shows only A\'s active recommendations, default first', async () => {
    h1 = await issueHandoff(memberA, programIds.aSecond);
    await begin(); await openMember('추천회원');
    await card.waitFor({ timeout: 20_000 });
    assert.ok(await card.getByText('스쿼트 · 4세트 · 무릎 정렬').isVisible(), 'default program shown first, ordered, with memo');
    assert.ok(await card.getByRole('button', { name: '트레이너 상체 루틴 · 트레이너 전달' }).isVisible(), 'other active program selectable; Trainer-sent marked');
    assert.equal(await card.getByText('보관된 루틴').count(), 0, 'archived hidden');
    assert.equal(await card.getByText('다른 회원 루틴').count(), 0, 'other member hidden');
    assert.ok(kioskRequests.length > 0 && kioskRequests.every((url) => !url.includes('memberId') && !url.includes('programId')), `kiosk requests carry no member/program: ${kioskRequests}`);
  });

  await step('B. Case 2: switching to B hides A\'s card, requests nothing for B, and closes the shown handoff', async () => {
    await openMember('추가회원');
    await page.getByRole('button', { name: '추가회원 회원으로 계속하기' }).waitFor();
    await page.waitForTimeout(1500);
    assert.equal(await card.count(), 0);
    assert.equal(await handoffStatus(h1), 'closed', 'member change closes the displayed handoff');
  });

  await step('C. Case 2: B selected while the handoff is for A → no card and the handoff stays for A', async () => {
    h2 = await issueHandoff(memberA, programIds.aSecond);
    await begin(); await openMember('추가회원');
    await page.getByRole('button', { name: '추가회원 회원으로 계속하기' }).waitFor();
    await page.waitForTimeout(1500);
    assert.equal(await card.count(), 0, 'no recommendation for B');
    assert.equal(await handoffStatus(h2), 'active', 'mismatch does not consume the Trainer handoff');
    await openMember('추천회원');
    await card.waitFor({ timeout: 20_000 });
  });

  await step('D. Case 9: 수정해서 사용 in the existing editor → snapshot source=recommendation edited=true + handoffId; handoff closed', async () => {
    await card.getByRole('button', { name: '트레이너 상체 루틴 · 트레이너 전달' }).click();
    await card.getByRole('button', { name: '수정해서 사용' }).click();
    await page.getByRole('button', { name: '2번 운동 세트 줄이기' }).click();
    await page.getByRole('button', { name: '출력 준비하기' }).click();
    await page.getByRole('button', { name: '이 프로그램으로 진행하기' }).click();
    const record = await sessionRecord();
    assert.equal(record.memberId, memberA);
    assert.deepEqual(record.source, { type: 'recommendation', memberProgramId: programIds.aSecond, edited: true, handoffId: h2 });
    assert.equal(record.programId, undefined);
    assert.deepEqual(record.exercises.map((item) => [item.exerciseId, item.order, item.plannedSets]), [['row', 1, 5], ['bench_press', 2, 2]]);
    await page.locator('svg').filter({ has: page.locator('path') }).first().waitFor({ timeout: 20_000 });
    await page.waitForTimeout(1000);
    assert.equal(await handoffStatus(h2), 'closed', 'handoff closed after the workout session snapshot');
  });

  await step('E. 그대로 사용: default program as-is → edited=false, order/sets/memo preserved', async () => {
    const h3 = await issueHandoff(memberA, programIds.aDefault);
    await begin(); await openMember('추천회원');
    await card.waitFor({ timeout: 20_000 });
    await card.getByRole('button', { name: '그대로 사용' }).click();
    await page.getByRole('button', { name: '이 프로그램으로 진행하기' }).click();
    const record = await sessionRecord();
    assert.deepEqual(record.source, { type: 'recommendation', memberProgramId: programIds.aDefault, edited: false, handoffId: h3 });
    assert.deepEqual(record.exercises.map((item) => [item.exerciseId, item.order, item.plannedSets, item.memo ?? '']), [['squat', 1, 4, '무릎 정렬'], ['lunge', 2, 3, '']]);
  });

  await step('F. 직접 구성 from the card uses the existing manual builder (source=manual)', async () => {
    await issueHandoff(memberA, programIds.aDefault);
    await begin(); await openMember('추천회원');
    await card.waitFor({ timeout: 20_000 });
    await card.getByRole('button', { name: '직접 구성' }).click();
    await page.getByRole('dialog').getByText('벤치 프레스', { exact: true }).first().click();
    await page.getByRole('button', { name: '출력 준비하기' }).click();
    await page.getByRole('button', { name: '이 구성으로 진행하기' }).click();
    const record = await sessionRecord();
    assert.deepEqual(record.source, { type: 'manual' });
    assert.equal(record.exercises[0].exerciseId, 'bench_press');
  });

  await step('G. Case 10/11: no handoff → no card; API down → failure notice only; existing flow continues', async () => {
    await begin(); await openMember('추천회원');
    await page.getByRole('button', { name: '추천회원 회원으로 계속하기' }).waitFor();
    await page.waitForTimeout(1500);
    assert.equal(await card.count(), 0, 'no handoff → no card');
    await new Promise((resolve) => gateway.close(resolve));
    await begin(); await openMember('추천회원');
    await page.getByText('트레이너 추천 프로그램을 불러오지 못했습니다.', { exact: false }).waitFor({ timeout: 20_000 });
    assert.ok(await page.getByRole('button', { name: '추천회원 회원으로 계속하기' }).isVisible());
    assert.equal(await page.getByText(/NETWORK_ERROR|Failed to fetch|ECONNREFUSED/).count(), 0, 'no raw network error shown');
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
  console.log(`\n${results.length - failed}/${results.length} passed (${EXPECTED_STEPS} expected)`);
  process.exit(failed || results.length !== EXPECTED_STEPS ? 1 : 0);
}
