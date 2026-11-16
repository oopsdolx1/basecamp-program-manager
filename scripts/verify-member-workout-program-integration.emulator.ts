/**
 * Phase 2-T3 — Emulator-only cross-project verification (Trainer → Kiosk handoff).
 *
 * Condition Lab: Trainer program API stores recommendations; the handoff API issues a handoff that
 * binds one member + one active program to one registered Kiosk device.
 * Program Manager: the real kioskRecommendationClient (device-only identity) reads only that
 * device's handoff, and the real builder / workout-session snapshot code consumes it.
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
import { createKioskRecommendationClient, KioskApiError, resolveKioskApiBaseUrl } from "../src/features/kiosk-recommendations/kioskRecommendationClient";
import type { RawProfileDocument } from "../src/features/members/types/profile.types";
import { toAppId } from "../src/types/brandedIds";

const PROJECT_ID = "basecamp-e2e-local";
const APP_ID = "basecamp_e2e_test";
const AUTH_HOST = "127.0.0.1:19099";
const FIRESTORE_HOST = "127.0.0.1:18080";
const CONDITION_LAB_ROOT = path.resolve(process.env.CONDITION_LAB_ROOT ?? "../condition-lab");

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
  const [{ createEmulatorAdminTokenVerifier }, { createEmulatorFirestoreContext }, { createAuthBoundary }, { createTrustedIssuance }, { createMemberWorkoutProgramHandler }, trainerHttp, { createKioskSessionActivationHandler }, handoffHttp] = await Promise.all([
    load("server/auth/firebaseAdminVerifier.js"), load("server/auth/firebaseAdminFirestore.js"), load("server/auth/authBoundary.js"), load("server/auth/trustedIssuance.js"),
    load("server/programs/memberWorkoutProgramHandler.js"), load("server/http/memberWorkoutProgramHttpAdapter.js"),
    load("server/kiosk/kioskSessionActivationHandler.js"), load("server/http/kioskSessionActivationHttpAdapter.js"),
  ]);

  const prefix = `pm_t3_${Date.now()}`;
  const adminUid = `${prefix}_admin`, trainerUid = `${prefix}_trainer`, deviceK1 = `${prefix}_k1`, deviceK2 = `${prefix}_k2`;
  const memberA = `${prefix}_a`, memberB = `${prefix}_b`;
  const verifier = createEmulatorAdminTokenVerifier({ projectId: PROJECT_ID, authEmulatorHost: AUTH_HOST, appName: `${prefix}_auth` });
  const { db } = createEmulatorFirestoreContext({ projectId: PROJECT_ID, firestoreEmulatorHost: FIRESTORE_HOST, appName: `${prefix}_fs` });
  const boundary = createAuthBoundary({ verifyIdToken: verifier.verifyIdToken, expectedProjectId: PROJECT_ID, requireEmulator: true, emulatorHost: AUTH_HOST });
  const issuance = createTrustedIssuance({ auth: verifier.auth, db, trustedIssuerUids: [adminUid], approvedTrainerUids: [trainerUid] });
  const catalog = [{ id: "squat", name: "스쿼트" }, { id: "row", name: "바벨 로우" }, { id: "bench_press", name: "벤치 프레스" }, { id: "lunge", name: "런지" }];
  const gateway = handoffHttp.createLocalApiGateway({ routes: [
    { match: handoffHttp.isKioskSessionActivationPath, server: handoffHttp.createKioskSessionActivationHttpServer({ handleKioskSessionActivation: createKioskSessionActivationHandler({ authBoundary: boundary, db, issuance }) }) },
    { match: () => true, server: trainerHttp.createMemberWorkoutProgramHttpServer({ handleMemberWorkoutPrograms: createMemberWorkoutProgramHandler({ authBoundary: boundary, db, exerciseCatalog: catalog }) }) },
  ] });
  const baseUrl: string = await handoffHttp.listenKioskSessionActivationLocalhost(gateway);
  const profileRef = (id: string) => db.doc(`artifacts/${APP_ID}/public/data/profiles/${id}`);
  const programsCol = db.collection(`artifacts/${APP_ID}/private/data/memberWorkoutPrograms`);

  const exchange = async (body: object, endpoint = "accounts:signInWithCustomToken") => {
    const response = await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/${endpoint}?key=emulator-test-key`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, returnSecureToken: true }) });
    const json = await response.json() as { idToken?: string; localId?: string };
    assert.ok(response.ok && json.idToken, `Auth Emulator ${endpoint} failed`);
    return json as { idToken: string; localId: string };
  };
  const api = async (method: string, route: string, token: string | null, body?: unknown) => {
    const response = await fetch(`${baseUrl}${route}`, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() as any };
  };

  const anonymousUids: string[] = [];
  try {
    await Promise.all([adminUid, trainerUid].map((uid) => verifier.auth.createUser({ uid })));
    await Promise.all([profileRef(memberA).set({ id: memberA, name: "회원에이", role: "member" }), profileRef(memberB).set({ id: memberB, name: "회원비", role: "member" })]);
    await issuance.issueTrainer({ issuerUid: adminUid, targetUid: trainerUid });
    await issuance.registerKioskDevice({ issuerUid: adminUid, deviceId: deviceK1, label: "Front Kiosk" });
    await issuance.registerKioskDevice({ issuerUid: adminUid, deviceId: deviceK2, label: "PT Room Kiosk" });
    const trainerToken = (await exchange({ token: await verifier.auth.createCustomToken(trainerUid) })).idToken;
    const k1Token = (await exchange({ token: (await issuance.issueKioskDeviceToken({ issuerUid: adminUid, deviceId: deviceK1 })).customToken })).idToken;
    const k2Token = (await exchange({ token: (await issuance.issueKioskDeviceToken({ issuerUid: adminUid, deviceId: deviceK2 })).customToken })).idToken;
    const anonymous = await exchange({}, "accounts:signUp"); anonymousUids.push(anonymous.localId);
    const kioskK1 = createKioskRecommendationClient({ baseUrl, device: { getIdToken: async () => k1Token } });
    const kioskK2 = createKioskRecommendationClient({ baseUrl, device: { getIdToken: async () => k2Token } });

    const ex = (exerciseId: string, order: number, plannedSets: number, memo?: string) => ({ exerciseId, order, plannedSets, ...(memo ? { memo } : {}) });
    const created: Record<string, { id: string; revision: number }> = {};
    await check("1. Trainer stores recommendations (fixture through the Trainer API)", async () => {
      const posts = [
        ["a_default", memberA, { name: "하체 A", isDefault: true, exercises: [ex("lunge", 2, 3), ex("squat", 1, 4, "무릎 정렬"), ex("bench_press", 3, 2)] }],
        ["a_second", memberA, { name: "상체 A", exercises: [ex("row", 1, 5), ex("bench_press", 2, 3)] }],
        ["a_archived", memberA, { name: "보관 예정", exercises: [ex("squat", 1, 1)] }],
        ["b_default", memberB, { name: "회원B 전용", isDefault: true, exercises: [ex("row", 1, 2)] }],
      ] as const;
      for (const [key, member, body] of posts) {
        const result = await api("POST", `/v1/trainer/members/${member}/workout-programs`, trainerToken, body);
        assert.equal(result.status, 201, `${key}: ${JSON.stringify(result.body)}`);
        created[key] = result.body.program;
      }
      assert.equal((await api("PATCH", `/v1/trainer/workout-programs/${created.a_archived.id}`, trainerToken, { action: "archive", revision: created.a_archived.revision })).status, 200);
    });
    const originalsBefore = JSON.stringify((await programsCol.where("memberId", "in", [memberA, memberB]).get()).docs.map((doc: any) => [doc.id, doc.data()]).sort());
    const pmMemberA = toMemberSelectionItem(mapProfileDocument(memberA, (await profileRef(memberA).get()).data() as RawProfileDocument));

    await check("2. Case 10: no handoff → Kiosk gets nothing (existing manual flow only)", async () => {
      assert.equal(await kioskK1.fetchHandoff(), null);
    });
    await check("2b. default-workout-program: selected member's active default only, no handoff needed", async () => {
      const programA = await kioskK1.fetchDefaultProgram(pmMemberA.memberId);
      assert.equal(programA?.id, created.a_default.id); assert.equal(programA?.isDefault, true);
      assert.equal((await kioskK2.fetchDefaultProgram(memberB))?.id, created.b_default.id);
      assert.equal(await kioskK1.fetchHandoff(), null, "reading the default does not create a handoff");
    });

    const issued = await api("POST", "/v1/trainer/kiosk-handoffs", trainerToken, { deviceId: deviceK1, memberId: memberA, programId: created.a_second.id });
    const handoffResult = await kioskK1.fetchHandoff();
    await check("3. Case 1: Trainer hands member A + program to K1; K1 reads A's handoff", () => {
      assert.equal(issued.status, 201);
      assert.ok(handoffResult);
      assert.equal(handoffResult!.handoff.memberId, pmMemberA.memberId, "matches the PM-selected member A");
      assert.equal(handoffResult!.handoff.memberProgramId, created.a_second.id);
      assert.equal(handoffResult!.handoff.handoffId, issued.body.handoff.handoffId);
    });
    await check("4. Case 7/8: default first, other active selectable, archived excluded", () => {
      assert.deepEqual(handoffResult!.programs.map((item) => item.id), [created.a_default.id, created.a_second.id]);
    });
    await check("5. Case 2/3: selecting B shows nothing; Kiosk cannot request B (no member parameter accepted)", async () => {
      assert.notEqual(handoffResult!.handoff.memberId, memberB, "UI compares and hides for member B");
      for (const query of [`?memberId=${memberB}`, `?programId=${created.b_default.id}`]) {
        const tampered = await api("GET", `/v1/kiosk/handoff${query}`, k1Token);
        assert.equal(tampered.status, 400); assert.equal(tampered.body.programs, undefined);
      }
      assert.ok(!handoffResult!.programs.some((item) => item.id === created.b_default.id));
    });
    await check("6. Case 4: K2 sees no handoff issued to K1 and cannot close it", async () => {
      assert.equal(await kioskK2.fetchHandoff(), null);
      await assert.rejects(() => kioskK2.closeHandoff(handoffResult!.handoff.handoffId), (error: unknown) => error instanceof KioskApiError && error.status === 403);
    });
    await check("7. Case 5: anonymous / device / no token cannot issue handoffs", async () => {
      const body = { deviceId: deviceK1, memberId: memberB, programId: created.b_default.id };
      assert.equal((await api("POST", "/v1/trainer/kiosk-handoffs", null, body)).status, 401);
      assert.equal((await api("POST", "/v1/trainer/kiosk-handoffs", anonymous.idToken, body)).status, 403);
      assert.equal((await api("POST", "/v1/trainer/kiosk-handoffs", k1Token, body)).status, 403);
      assert.equal((await kioskK1.fetchHandoff())!.handoff.memberId, memberA, "handoff unchanged");
    });

    const source = handoffResult!.programs[0];
    const toRecord = (exercises: ReturnType<typeof createRecommendationBuilderHistory>["present"]["exercises"], edited: boolean) => buildWorkoutSessionRecord({ appId: toAppId(APP_ID), memberId: pmMemberA.memberId, memberName: pmMemberA.displayName, programTitle: source.name, category: "CUSTOM", categories: [], source: { type: "recommendation", memberProgramId: source.id, edited, handoffId: handoffResult!.handoff.handoffId }, exercises: mapSessionPrescriptionExercises(exercises, new Map(exercises.map((exercise) => [exercise.id, { id: exercise.catalogExerciseId ?? exercise.id, name: exercise.name }]))) }, anonymous.localId, "ws_20261116_t3testsess00");
    await check("8. use as-is: order/exerciseId/sets/memo preserved; source carries handoffId", () => {
      const asIs = createRecommendationBuilderHistory(source);
      const record = toRecord(asIs.present.exercises, isRecommendationEdited(source, asIs.present.exercises));
      assert.deepEqual(record.exercises.map((item) => [item.exerciseId, item.order, item.plannedSets]), [["squat", 1, 4], ["lunge", 2, 3], ["bench_press", 3, 2]]);
      assert.equal(record.exercises[0].memo, "무릎 정렬");
      assert.deepEqual(record.source, { type: "recommendation", memberProgramId: created.a_default.id, edited: false, handoffId: handoffResult!.handoff.handoffId });
      assert.deepEqual(normalizeWorkoutSource(record), record.source);
    });
    await check("9. Case 9: edit (remove, add-reorder, sets) in the existing builder; Condition Lab originals unchanged", async () => {
      let edited = createRecommendationBuilderHistory(source);
      edited = snapshotBuilderService.remove(edited, edited.present.exercises[2].id);
      edited = snapshotBuilderService.move(edited, edited.present.exercises[1].id, "up");
      edited = snapshotBuilderService.patchExercise(edited, edited.present.exercises[0].id, { plannedSets: 2 });
      assert.equal(isRecommendationEdited(source, edited.present.exercises), true);
      const record = toRecord(edited.present.exercises, true);
      assert.deepEqual(record.exercises.map((item) => [item.exerciseId, item.plannedSets]), [["lunge", 2], ["squat", 4]]);
      assert.equal(source.exercises.length, 3, "in-memory recommendation not mutated");
      const after = JSON.stringify((await programsCol.where("memberId", "in", [memberA, memberB]).get()).docs.map((doc: any) => [doc.id, doc.data()]).sort());
      assert.equal(after, originalsBefore);
    });
    await check("10. Case 6: close after save → handoff gone; repeat close is safe", async () => {
      await kioskK1.closeHandoff(handoffResult!.handoff.handoffId);
      await kioskK1.closeHandoff(handoffResult!.handoff.handoffId);
      assert.equal(await kioskK1.fetchHandoff(), null);
    });
    await check("11. Case 6: a newer handoff supersedes; only the newest member is readable", async () => {
      await api("POST", "/v1/trainer/kiosk-handoffs", trainerToken, { deviceId: deviceK1, memberId: memberA, programId: created.a_default.id });
      await api("POST", "/v1/trainer/kiosk-handoffs", trainerToken, { deviceId: deviceK1, memberId: memberB, programId: created.b_default.id });
      const current = await kioskK1.fetchHandoff();
      assert.equal(current!.handoff.memberId, memberB);
      assert.deepEqual(current!.programs.map((item) => item.id), [created.b_default.id]);
      await kioskK1.closeHandoff(current!.handoff.handoffId);
    });
    await check("12. Case 11: API unavailable → client error (UI keeps the existing flow); base URL gate", async () => {
      const offline = createKioskRecommendationClient({ baseUrl: "http://127.0.0.1:9", device: { getIdToken: async () => k1Token } });
      await assert.rejects(() => offline.fetchHandoff(), (error: unknown) => error instanceof KioskApiError && error.code === "NETWORK_ERROR");
      const unenrolled = createKioskRecommendationClient({ baseUrl, device: { getIdToken: async () => null } });
      await assert.rejects(() => unenrolled.fetchHandoff(), (error: unknown) => error instanceof KioskApiError && error.code === "KIOSK_DEVICE_NOT_ENROLLED");
      assert.equal(resolveKioskApiBaseUrl(undefined), null);
      assert.equal(resolveKioskApiBaseUrl("http://example.com"), null, "plain http only for localhost");
    });
  } finally {
    await new Promise((resolve) => gateway.close(resolve));
    const [programs, handoffs] = await Promise.all([programsCol.where("memberId", "in", [memberA, memberB]).get(), db.collection("authKioskHandoffs").where("deviceId", "in", [deviceK1, deviceK2]).get()]);
    await Promise.all([
      ...programs.docs.map((doc: any) => doc.ref.delete()), ...handoffs.docs.map((doc: any) => doc.ref.delete()),
      issuance.paths.device(deviceK1).delete().catch(() => {}), issuance.paths.device(deviceK2).delete().catch(() => {}), profileRef(memberA).delete(), profileRef(memberB).delete(),
      ...[adminUid, trainerUid, `kiosk:${deviceK1}`, `kiosk:${deviceK2}`, ...anonymousUids].map((uid) => verifier.auth.deleteUser(uid).catch(() => {})),
    ]);
  }

  for (const result of results) console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}${result.error ? ` — ${result.error}` : ""}`);
  const failed = results.filter((result) => !result.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  if (failed || results.length !== 13) process.exit(1);
};

main().catch((error) => { console.error(error); process.exit(1); });
