/**
 * Phase 2-T3 — Emulator-only cross-project verification (approved device-trust Kiosk policy).
 *
 * Write side: Condition Lab Trainer API (memberWorkoutProgramHandler) stores recommendations.
 * Kiosk side: the real Program Manager client (kioskRecommendationClient) with a registered Kiosk
 * device-only identity starts a session for the selected member (`POST /v1/kiosk/session/start`),
 * reads that member's recommendations, and closes the session. The result is fed through the real
 * Program Manager builder and workout-session snapshot code.
 *
 * Requires: emulators running (condition-lab `npm run emulators:e2e`). Never touches production.
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { mapProfileDocument, toMemberSelectionItem } from "../src/features/members/mappers/profileMapper";
import { mapSessionPrescriptionExercises } from "../src/features/workout-sessions/services/sessionPrescriptionMapper";
import { buildWorkoutSessionRecord } from "../src/features/workout-sessions/services/workoutSessionRecordBuilder";
import { normalizeWorkoutSource } from "../src/features/workout-sessions/services/workoutSessionSourceResolver";
import { snapshotBuilderService } from "../src/features/printing/services/snapshotBuilderService";
import { createRecommendationBuilderHistory, isRecommendationEdited } from "../src/features/printing/services/recommendationBuilderService";
import { createKioskRecommendationClient, KioskApiError, resolveKioskApiBaseUrl, type KioskSessionIdentity } from "../src/features/kiosk-recommendations/kioskRecommendationClient";
import type { RawProfileDocument } from "../src/features/members/types/profile.types";
import { toAppId } from "../src/types/brandedIds";

const PROJECT_ID = "basecamp-e2e-local";
const APP_ID = "basecamp_e2e_test";
const AUTH_HOST = "127.0.0.1:19099";
const FIRESTORE_HOST = "127.0.0.1:18080";
const CONDITION_LAB_ROOT = path.resolve(process.env.CONDITION_LAB_ROOT ?? "../condition-lab");

// Hard safety gate: never run against a non-emulator target.
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID !== PROJECT_ID) throw new Error("Refusing to run: non-emulator project.");
process.env.FIREBASE_PROJECT_ID = PROJECT_ID;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;

const load = (relative: string) => import(pathToFileURL(path.join(CONDITION_LAB_ROOT, relative)).href);
const results: Array<{ name: string; ok: boolean; error?: string }> = [];
const check = async (name: string, fn: () => Promise<void> | void) => {
  try { await fn(); results.push({ name, ok: true }); } catch (error) { results.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) }); }
};

const main = async () => {
  const [{ createEmulatorAdminTokenVerifier }, { createEmulatorFirestoreContext }, { createAuthBoundary }, { createTrustedIssuance }, { createMemberWorkoutProgramHandler }, trainerHttp, { createKioskScopedReadHandler }, scopedHttp, { createKioskSessionActivationHandler }, activationHttp, { createKioskSessionCloseHandler }, closeHttp] = await Promise.all([
    load("server/auth/firebaseAdminVerifier.js"), load("server/auth/firebaseAdminFirestore.js"), load("server/auth/authBoundary.js"), load("server/auth/trustedIssuance.js"),
    load("server/programs/memberWorkoutProgramHandler.js"), load("server/http/memberWorkoutProgramHttpAdapter.js"),
    load("server/kiosk/kioskScopedReadHandler.js"), load("server/http/kioskScopedReadHttpAdapter.js"),
    load("server/kiosk/kioskSessionActivationHandler.js"), load("server/http/kioskSessionActivationHttpAdapter.js"),
    load("server/kiosk/kioskSessionCloseHandler.js"), load("server/http/kioskSessionCloseHttpAdapter.js"),
  ]);

  const prefix = `pm_t3_${Date.now()}`;
  let clock = Date.now();
  const now = () => clock;
  const adminUid = `${prefix}_admin`, trainerUid = `${prefix}_trainer`, deviceId = `${prefix}_kiosk`;
  const memberA = `${prefix}_a`, memberB = `${prefix}_b`, memberEmpty = `${prefix}_empty`;
  const verifier = createEmulatorAdminTokenVerifier({ projectId: PROJECT_ID, authEmulatorHost: AUTH_HOST, appName: `${prefix}_auth` });
  const { db } = createEmulatorFirestoreContext({ projectId: PROJECT_ID, firestoreEmulatorHost: FIRESTORE_HOST, appName: `${prefix}_fs` });
  const boundary = createAuthBoundary({ verifyIdToken: verifier.verifyIdToken, expectedProjectId: PROJECT_ID, requireEmulator: true, emulatorHost: AUTH_HOST });
  const issuance = createTrustedIssuance({ auth: verifier.auth, db, now, trustedIssuerUids: [adminUid], approvedTrainerUids: [trainerUid] });
  const catalog = [{ id: "squat", name: "스쿼트" }, { id: "row", name: "바벨 로우" }, { id: "bench_press", name: "벤치 프레스" }, { id: "lunge", name: "런지" }];
  const trainerServer = trainerHttp.createMemberWorkoutProgramHttpServer({ handleMemberWorkoutPrograms: createMemberWorkoutProgramHandler({ authBoundary: boundary, db, exerciseCatalog: catalog }) });
  const resolveTrustedKioskMemberId = ({ principal, kioskSessionId }: any) => issuance.resolveKioskMemberScope({ principal, kioskSessionId });
  const kioskGateway = activationHttp.createLocalApiGateway({ routes: [
    { match: activationHttp.isKioskSessionActivationPath, server: activationHttp.createKioskSessionActivationHttpServer({ handleKioskSessionActivation: createKioskSessionActivationHandler({ authBoundary: boundary, issuance }) }) },
    { match: (route: string) => route === "/v1/kiosk/session/close", server: closeHttp.createKioskSessionCloseHttpServer({ handleKioskSessionClose: createKioskSessionCloseHandler({ authBoundary: boundary, closeKioskSession: issuance.closeKioskSession }) }) },
    { match: (route: string) => route.startsWith("/v1/kiosk/session/"), server: scopedHttp.createKioskScopedReadHttpServer({ handleKioskScopedRead: createKioskScopedReadHandler({ authBoundary: boundary, db, resolveTrustedKioskMemberId }) }) },
  ] });
  const trainerUrl: string = await trainerHttp.listenMemberWorkoutProgramLocalhost(trainerServer);
  const kioskUrl: string = await activationHttp.listenKioskSessionActivationLocalhost(kioskGateway);
  const profileRef = (id: string) => db.doc(`artifacts/${APP_ID}/public/data/profiles/${id}`);
  const programsCol = db.collection(`artifacts/${APP_ID}/private/data/memberWorkoutPrograms`);

  const exchange = async (body: object, endpoint = "accounts:signInWithCustomToken") => {
    const response = await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/${endpoint}?key=emulator-test-key`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, returnSecureToken: true }) });
    const json = await response.json() as { idToken?: string; localId?: string };
    assert.ok(response.ok && json.idToken, `Auth Emulator ${endpoint} failed`);
    return json as { idToken: string; localId: string };
  };
  const trainerCall = async (method: string, route: string, token: string, body?: unknown) => {
    const response = await fetch(`${trainerUrl}${route}`, { method, headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() as any };
  };
  // Node stand-in for the browser's in-memory Firebase session app.
  const sessionIdentity = (): KioskSessionIdentity & { token: string | null } => {
    const identity = { token: null as string | null, async signIn(customToken: string) { identity.token = (await exchange({ token: customToken })).idToken; }, async getIdToken() { return identity.token; }, async signOut() { identity.token = null; } };
    return identity;
  };

  const anonymousUids: string[] = [];
  try {
    await Promise.all([adminUid, trainerUid].map((uid) => verifier.auth.createUser({ uid })));
    await Promise.all([profileRef(memberA).set({ id: memberA, name: "회원에이", role: "member" }), profileRef(memberB).set({ id: memberB, name: "회원비", role: "member" }), profileRef(memberEmpty).set({ id: memberEmpty, name: "추천없음", role: "member" })]);
    await issuance.issueTrainer({ issuerUid: adminUid, targetUid: trainerUid });
    await issuance.registerKioskDevice({ issuerUid: adminUid, deviceId, label: "PM 키오스크" });
    const trainerToken = (await exchange({ token: await verifier.auth.createCustomToken(trainerUid) })).idToken;
    const deviceToken = (await exchange({ token: (await issuance.issueKioskDeviceToken({ issuerUid: adminUid, deviceId })).customToken })).idToken;
    const anonymous = await exchange({}, "accounts:signUp"); anonymousUids.push(anonymous.localId);

    const sessionA = sessionIdentity();
    const client = createKioskRecommendationClient({ baseUrl: kioskUrl, device: { getIdToken: async () => deviceToken }, session: sessionA });

    const ex = (exerciseId: string, order: number, plannedSets: number, memo?: string) => ({ exerciseId, order, plannedSets, ...(memo ? { memo } : {}) });
    const created: Record<string, { id: string; revision: number }> = {};
    await check("1. Trainer write API stores recommendations (fixture)", async () => {
      const posts = [
        ["a_default", memberA, { name: "하체 A", description: "기본", isDefault: true, exercises: [ex("lunge", 2, 3), ex("squat", 1, 4, "무릎 정렬"), ex("bench_press", 3, 2)] }],
        ["a_second", memberA, { name: "상체 A", exercises: [ex("row", 1, 5), ex("bench_press", 2, 3)] }],
        ["a_archived", memberA, { name: "보관 예정", exercises: [ex("squat", 1, 1)] }],
        ["b_default", memberB, { name: "회원B 전용", isDefault: true, exercises: [ex("row", 1, 2)] }],
      ] as const;
      for (const [key, member, body] of posts) {
        const result = await trainerCall("POST", `/v1/trainer/members/${member}/workout-programs`, trainerToken, body);
        assert.equal(result.status, 201, `${key}: ${JSON.stringify(result.body)}`);
        created[key] = result.body.program;
      }
      assert.equal((await trainerCall("PATCH", `/v1/trainer/workout-programs/${created.a_archived.id}`, trainerToken, { action: "archive", revision: created.a_archived.revision })).status, 200);
    });

    const pmMemberA = toMemberSelectionItem(mapProfileDocument(memberA, (await profileRef(memberA).get()).data() as RawProfileDocument));
    const originalsBefore = JSON.stringify((await programsCol.where("memberId", "in", [memberA, memberB]).get()).docs.map((doc: any) => [doc.id, doc.data()]).sort());

    let session = await client.startSession(pmMemberA.memberId);
    let listA = await client.listPrograms(session);
    await check("2. PM-selected member starts a Kiosk session and reads automatically", () => {
      assert.equal(session.memberId, memberA); assert.equal(session.memberName, "회원에이");
      assert.ok(listA.length > 0);
    });
    await check("3. default recommendation first", () => assert.equal(listA[0].id, created.a_default.id));
    await check("4. multiple active recommendations", () => assert.deepEqual(listA.map((item) => item.id), [created.a_default.id, created.a_second.id]));
    await check("5. archived excluded", () => assert.ok(!listA.some((item) => item.id === created.a_archived.id)));

    await check("6. member switch: new session for B, A session no longer valid", async () => {
      const previous = session; const previousToken = await sessionA.getIdToken();
      const sessionB = await client.startSession(memberB);
      const listB = await client.listPrograms(sessionB);
      assert.deepEqual(listB.map((item) => item.id), [created.b_default.id]);
      const stale = await fetch(`${kioskUrl}/v1/kiosk/session/workout-programs?kioskSessionId=${previous.kioskSessionId}`, { headers: { authorization: `Bearer ${previousToken}` } });
      assert.equal(stale.status, 403, "A session superseded when B starts on the same kiosk");
      session = await client.startSession(memberA);
      listA = await client.listPrograms(session);
    });

    await check("7. no cross-member access: memberId override 400, foreign session id 403, wrong member response rejected", async () => {
      const token = await sessionA.getIdToken();
      const injected = await fetch(`${kioskUrl}/v1/kiosk/session/workout-programs?kioskSessionId=${session.kioskSessionId}&memberId=${memberB}`, { headers: { authorization: `Bearer ${token}` } });
      assert.equal(injected.status, 400);
      const foreign = await fetch(`${kioskUrl}/v1/kiosk/session/workout-programs?kioskSessionId=kiosk_session_other`, { headers: { authorization: `Bearer ${token}` } });
      assert.equal(foreign.status, 403);
      const lying = createKioskRecommendationClient({ baseUrl: kioskUrl, device: { getIdToken: async () => deviceToken }, session: sessionIdentity(), fetchImpl: (async () => new Response(JSON.stringify({ kioskSessionId: "x", customToken: "y", member: { id: memberB, name: "회원비" } }), { status: 201 })) as typeof fetch });
      await assert.rejects(() => lying.startSession(memberA), (error: unknown) => error instanceof KioskApiError && error.code === "INVALID_API_RESPONSE");
    });

    // "그대로 사용" and "수정해서 사용" both copy into the existing builder; the snapshot records the source.
    const source = listA[0];
    const asIs = createRecommendationBuilderHistory(source);
    const toRecord = (exercises: typeof asIs.present.exercises, edited: boolean) => buildWorkoutSessionRecord({ appId: toAppId(APP_ID), memberId: pmMemberA.memberId, memberName: pmMemberA.displayName, programTitle: source.name, category: "CUSTOM", categories: [], source: { type: "recommendation", memberProgramId: source.id, edited }, exercises: mapSessionPrescriptionExercises(exercises, new Map(exercises.map((exercise) => [exercise.id, { id: exercise.catalogExerciseId ?? exercise.id, name: exercise.name }]))) }, anonymous.localId, "ws_20261116_t3testsess00");
    const asIsRecord = toRecord(asIs.present.exercises, isRecommendationEdited(source, asIs.present.exercises));

    await check("8. as-is use: order, canonical exerciseId, plannedSets, memo preserved", () => {
      assert.deepEqual(asIsRecord.exercises.map((item) => [item.exerciseId, item.order, item.plannedSets]), [["squat", 1, 4], ["lunge", 2, 3], ["bench_press", 3, 2]]);
      assert.equal(asIsRecord.exercises[0].memo, "무릎 정렬");
      assert.equal(new Set(asIsRecord.exercises.map((item) => item.programExerciseId)).size, 3);
    });
    await check("9. source recorded as recommendation (edited=false) and accepted by the resolver", () => {
      assert.deepEqual(asIsRecord.source, { type: "recommendation", memberProgramId: created.a_default.id, edited: false });
      assert.equal(asIsRecord.programId, undefined);
      assert.deepEqual(normalizeWorkoutSource(asIsRecord), asIsRecord.source);
    });
    await check("10. edit in the existing builder: edited=true, original untouched", () => {
      let edited = createRecommendationBuilderHistory(source);
      edited = snapshotBuilderService.patchExercise(edited, edited.present.exercises[0].id, { plannedSets: 2 });
      edited = snapshotBuilderService.move(edited, edited.present.exercises[2].id, "up");
      assert.equal(isRecommendationEdited(source, edited.present.exercises), true);
      const record = toRecord(edited.present.exercises, true);
      assert.deepEqual(record.source, { type: "recommendation", memberProgramId: created.a_default.id, edited: true });
      assert.equal(record.exercises[0].plannedSets, 2);
      assert.equal(source.exercises.find((item) => item.exerciseId === "squat")?.plannedSets, 4, "in-memory recommendation not mutated");
    });

    await check("11. auth: no token 401, anonymous/Trainer 403, member without recommendations gets empty list", async () => {
      const startWith = async (token?: string) => (await fetch(`${kioskUrl}/v1/kiosk/session/start`, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ memberId: memberA }) })).status;
      assert.equal(await startWith(), 401);
      assert.equal(await startWith(anonymous.idToken), 403);
      assert.equal(await startWith(trainerToken), 403);
      const emptyClient = createKioskRecommendationClient({ baseUrl: kioskUrl, device: { getIdToken: async () => deviceToken }, session: sessionIdentity() });
      const emptySession = await emptyClient.startSession(memberEmpty);
      assert.deepEqual(await emptyClient.listPrograms(emptySession), []);
      await emptyClient.closeSession(emptySession);
      session = await client.startSession(memberA);
    });

    await check("12. close after print: session cannot be reused; originals unchanged; API base URL gate", async () => {
      const closedToken = await sessionA.getIdToken();
      await client.closeSession(session);
      const reuse = await fetch(`${kioskUrl}/v1/kiosk/session/workout-programs?kioskSessionId=${session.kioskSessionId}`, { headers: { authorization: `Bearer ${closedToken}` } });
      assert.equal(reuse.status, 403);
      await assert.rejects(() => client.listPrograms(session), (error: unknown) => error instanceof KioskApiError && error.status === 401, "client signed out of the session identity");
      const after = JSON.stringify((await programsCol.where("memberId", "in", [memberA, memberB]).get()).docs.map((doc: any) => [doc.id, doc.data()]).sort());
      assert.equal(after, originalsBefore);
      assert.equal(resolveKioskApiBaseUrl(undefined), null);
      assert.equal(resolveKioskApiBaseUrl("http://example.com"), null, "plain http only for localhost");
      assert.equal(resolveKioskApiBaseUrl("https://api.example.com/"), "https://api.example.com");
    });
  } finally {
    await Promise.all([trainerServer, kioskGateway].map((server: any) => new Promise((resolve) => server.close(resolve))));
    const [programs, sessions] = await Promise.all([programsCol.where("memberId", "in", [memberA, memberB, memberEmpty]).get(), db.collection("authKioskSessions").where("deviceId", "==", deviceId).get()]);
    await Promise.all([
      ...programs.docs.map((doc: any) => doc.ref.delete()), ...sessions.docs.map((doc: any) => doc.ref.delete()),
      issuance.paths.device(deviceId).delete().catch(() => {}), profileRef(memberA).delete(), profileRef(memberB).delete(), profileRef(memberEmpty).delete(),
      ...[adminUid, trainerUid, ...anonymousUids].map((uid) => verifier.auth.deleteUser(uid).catch(() => {})),
    ]);
  }

  for (const result of results) console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}${result.error ? ` — ${result.error}` : ""}`);
  const failed = results.filter((result) => !result.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed || results.length !== 12) process.exit(1);
};

main().catch((error) => { console.error(error); process.exit(1); });
