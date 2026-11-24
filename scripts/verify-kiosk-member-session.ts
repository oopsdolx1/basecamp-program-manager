import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { KioskApiError } from "../src/features/kiosk-recommendations/kioskRecommendationClient";
import type { KioskMemberSessionClient, KioskWorkoutSessionPayload } from "../src/features/kiosk-session/kioskMemberSessionClient";
import { createKioskMemberSessionClient } from "../src/features/kiosk-session/kioskMemberSessionClient";
import { createKioskMemberSessionManager } from "../src/features/kiosk-session/kioskMemberSessionManager";
import { isRenewableKioskSessionError, withKioskMemberSession } from "../src/features/kiosk-session/kioskSessionRenewal";
import { kioskMemberListErrorMessage } from "../src/features/kiosk-session/kioskErrorMessages";
import { logKioskError } from "../src/features/kiosk-diagnostics/kioskErrorLog";
import { createWorkoutSession } from "../src/features/workout-sessions/services/workoutSessionService";
import type { CreateWorkoutSessionInput } from "../src/features/workout-sessions/domain/workoutSession.types";
import { KioskDeviceTransientError, createAgentDeviceTokenSource, createKioskDeviceIdentity, resolveKioskDeviceAgentEndpoint } from "../src/features/kiosk-recommendations/kioskDeviceIdentityCore";

// Kiosk member-session lifecycle (memory only, generation-guarded) and the API-only workout-session save.
type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void };
const deferred = <T>(): Deferred<T> => { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
let tokenSeq = 0;
const token = () => `bks1_${String(++tokenSeq).padStart(43, "A")}`;

const fakeClient = () => {
  const opens: Array<{ memberId: string; result: Deferred<{ token: string; expiresAt: number }> }> = [];
  const closed: string[] = []; const saves: Array<{ token: string; payload: KioskWorkoutSessionPayload }> = [];
  let saveImpl: (token: string, payload: KioskWorkoutSessionPayload) => Promise<{ workoutSessionId: string; replayed: boolean }> = async (_token, payload) => ({ workoutSessionId: payload.workoutSessionId, replayed: false });
  const client: KioskMemberSessionClient = {
    openSession(memberId) { const result = deferred<{ token: string; expiresAt: number }>(); opens.push({ memberId, result }); return result.promise; },
    async closeSession(value) { closed.push(value); },
    saveWorkoutSession(value, payload) { saves.push({ token: value, payload }); return saveImpl(value, payload); },
  };
  return { client, opens, closed, saves, setSave: (impl: typeof saveImpl) => { saveImpl = impl; } };
};
const results: string[] = [];
const check = async (name: string, fn: () => Promise<void> | void) => { await fn(); results.push(name); console.log(`PASS ${name}`); };
const input = (memberId: string): CreateWorkoutSessionInput => ({ appId: "app" as never, memberId, memberName: "클라이언트가 보낸 이름", programTitle: "하체", source: { type: "recommendation", memberProgramId: "prog-a", edited: false }, category: "LOWER_BODY", categories: ["LOWER_BODY"], exercises: [{ exerciseId: "lunge", programExerciseId: "pe-2", name: "런지", order: 2, plannedSets: 3, memo: "" }, { exerciseId: "squat", programExerciseId: "pe-1", name: "스쿼트", order: 1, plannedSets: 4, memo: "무릎" }] });

const main = async (): Promise<void> => {
await check("1. selecting a member issues one session; re-selecting the same member does not issue again", async () => {
  const fake = fakeClient(); const manager = createKioskMemberSessionManager({ client: fake.client });
  manager.select("A"); manager.select("A"); manager.select("A");
  assert.equal(fake.opens.length, 1, "duplicate taps share one issue");
  const value = token(); fake.opens[0].result.resolve({ token: value, expiresAt: Date.now() + 600_000 });
  assert.equal((await manager.sessionFor("A")).token, value);
  manager.select("A"); assert.equal(fake.opens.length, 1, "active session reused for the same member");
});

await check("2. A → B before A's issue returns: A's late token is closed and never used for B", async () => {
  const fake = fakeClient(); const manager = createKioskMemberSessionManager({ client: fake.client });
  manager.select("A"); manager.select("B");
  const aToken = token(); const bToken = token();
  fake.opens[1].result.resolve({ token: bToken, expiresAt: Date.now() + 600_000 });
  assert.equal((await manager.sessionFor("B")).token, bToken);
  fake.opens[0].result.resolve({ token: aToken, expiresAt: Date.now() + 600_000 }); await tick();
  assert.deepEqual(fake.closed, [aToken], "late A token closed");
  assert.equal((await manager.sessionFor("B")).token, bToken, "B keeps its own token");
  await assert.rejects(manager.sessionFor("A"), (error: unknown) => error instanceof KioskApiError && error.code === "KIOSK_SESSION_MEMBER_CHANGED");
});

await check("3. switching members closes the previous active session", async () => {
  const fake = fakeClient(); const manager = createKioskMemberSessionManager({ client: fake.client });
  manager.select("A"); const aToken = token(); fake.opens[0].result.resolve({ token: aToken, expiresAt: Date.now() + 600_000 }); await manager.sessionFor("A");
  manager.select("B"); await tick();
  assert.deepEqual(fake.closed, [aToken]); assert.equal(fake.opens.length, 2); assert.equal(fake.opens[1].memberId, "B");
});

await check("4. clear (reset / cancel) closes the session; a pending issue is closed when it lands; nothing is usable afterwards", async () => {
  const fake = fakeClient(); const manager = createKioskMemberSessionManager({ client: fake.client });
  manager.select("A"); const aToken = token(); fake.opens[0].result.resolve({ token: aToken, expiresAt: Date.now() + 600_000 }); await manager.sessionFor("A");
  manager.clear(); await tick();
  assert.deepEqual(fake.closed, [aToken]); assert.deepEqual(manager.inspect(), { selectedMemberId: null, hasSession: false, pending: false });
  await assert.rejects(manager.sessionFor("A"), (error: unknown) => error instanceof KioskApiError && error.code === "KIOSK_SESSION_MEMBER_CHANGED");
  manager.select("B"); const pendingSave = manager.sessionFor("B"); manager.clear();
  const bToken = token(); fake.opens[1].result.resolve({ token: bToken, expiresAt: Date.now() + 600_000 });
  await assert.rejects(pendingSave); await tick();
  assert.ok(fake.closed.includes(bToken), "token issued after the reset is closed");
});

await check("5. an expired session is never reused: a new one is issued", async () => {
  let clock = 1_000_000; const fake = fakeClient(); const manager = createKioskMemberSessionManager({ client: fake.client, now: () => clock });
  manager.select("A"); const first = token(); fake.opens[0].result.resolve({ token: first, expiresAt: clock + 60_000 }); await manager.sessionFor("A");
  clock += 50_000; // inside the 15 s safety margin
  const next = manager.sessionFor("A"); await tick();
  assert.equal(fake.opens.length, 2, "re-issued"); const second = token(); fake.opens[1].result.resolve({ token: second, expiresAt: clock + 60_000 });
  assert.equal((await next).token, second);
});

await check("6. issue failure → sessionFor rejects and no save is attempted", async () => {
  const fake = fakeClient(); const manager = createKioskMemberSessionManager({ client: fake.client });
  manager.select("A"); fake.opens[0].result.reject(new KioskApiError("KIOSK_DEVICE_NOT_REGISTERED", 403));
  await assert.rejects(createWorkoutSession(input("A"), { client: fake.client, sessions: manager }), /사용이 중지된 키오스크/);
  assert.equal(fake.saves.length, 0);
});

await check("7. save sends only the session-scoped payload (no memberName/trainerId/status) and returns the id", async () => {
  const fake = fakeClient(); const manager = createKioskMemberSessionManager({ client: fake.client });
  manager.select("A"); const aToken = token(); fake.opens[0].result.resolve({ token: aToken, expiresAt: Date.now() + 600_000 });
  const id = await createWorkoutSession(input("A"), { client: fake.client, sessions: manager });
  assert.match(id, /^ws_\d{8}_[a-z0-9]{12}$/);
  assert.equal(fake.saves.length, 1); assert.equal(fake.saves[0].token, aToken);
  const payload = fake.saves[0].payload;
  assert.deepEqual(Object.keys(payload).sort(), ["categories", "category", "exercises", "memberId", "programTitle", "source", "workoutSessionId"]);
  assert.equal(payload.workoutSessionId, id); assert.equal(payload.memberId, "A");
  assert.deepEqual(payload.exercises.map((item) => item.exerciseId), ["squat", "lunge"], "client builder ordering kept");
});

await check("8. network errors and 5xx retry with the SAME workoutSessionId (server idempotency); 4xx do not retry", async () => {
  const fake = fakeClient(); const manager = createKioskMemberSessionManager({ client: fake.client });
  manager.select("A"); fake.opens[0].result.resolve({ token: token(), expiresAt: Date.now() + 600_000 });
  let calls = 0; fake.setSave(async (_t, payload) => { calls += 1; if (calls === 1) throw new KioskApiError("NETWORK_ERROR", 0); if (calls === 2) throw new KioskApiError("INTERNAL_ERROR", 500); return { workoutSessionId: payload.workoutSessionId, replayed: true }; });
  const id = await createWorkoutSession(input("A"), { client: fake.client, sessions: manager });
  assert.equal(fake.saves.length, 3); assert.deepEqual(new Set(fake.saves.map((item) => item.payload.workoutSessionId)), new Set([id]));
  fake.saves.length = 0; fake.setSave(async () => { throw new KioskApiError("INVALID_WORKOUT_SESSION", 400); });
  await assert.rejects(createWorkoutSession(input("A"), { client: fake.client, sessions: manager }), (error: Error) => /운동 구성이 올바르지 않아 저장하지 못했습니다/.test(error.message) && !/INVALID_WORKOUT_SESSION|KIOSK_/.test(error.message));
  assert.equal(fake.saves.length, 1, "validation errors are not retried");
  // Phase 3-E: every save-path code has Korean guidance; unknown codes get a safe general message (code only in the log).
  for (const [code, status, expected] of [["WORKOUT_SESSION_CONFLICT", 409, /이미 저장된 운동 세션/], ["RECOMMENDATION_SCOPE_DENIED", 403, /추천 프로그램이 아니어서/], ["KIOSK_SESSION_INVALID", 401, /회원 선택 정보를 확인할 수 없어/], ["KIOSK_SESSION_MEMBER_MISMATCH", 403, /선택한 회원이 바뀌어/], ["SOMETHING_NEW", 409, /^운동 세션을 저장하지 못했습니다\. 잠시 후 다시 시도해 주세요\.$/]] as Array<[string, number, RegExp]>) {
    fake.saves.length = 0; fake.setSave(async () => { throw new KioskApiError(code, status); });
    await assert.rejects(createWorkoutSession(input("A"), { client: fake.client, sessions: manager }), (error: Error) => expected.test(error.message) && !/[A-Z]{3,}_[A-Z_]+/.test(error.message));
  }
  fake.saves.length = 0; fake.setSave(async () => { throw new KioskApiError("NETWORK_ERROR", 0); });
  await assert.rejects(createWorkoutSession(input("A"), { client: fake.client, sessions: manager }), /서버에 연결하지 못해/);
  assert.equal(fake.saves.length, 3, "gives up after 3 attempts and reports failure");
});

await check("9. expired session on the server → one renewal with a new token, never the old one; an ended session is not renewed", async () => {
  const fake = fakeClient(); const manager = createKioskMemberSessionManager({ client: fake.client });
  manager.select("A"); const old = token(); fake.opens[0].result.resolve({ token: old, expiresAt: Date.now() + 600_000 });
  fake.setSave(async (value, payload) => { if (value === old) throw new KioskApiError("KIOSK_SESSION_EXPIRED", 403); return { workoutSessionId: payload.workoutSessionId, replayed: false }; });
  const pending = createWorkoutSession(input("A"), { client: fake.client, sessions: manager });
  for (let i = 0; i < 5 && fake.opens.length < 2; i += 1) await tick();
  assert.equal(fake.opens.length, 2, "renewed"); const fresh = token(); fake.opens[1].result.resolve({ token: fresh, expiresAt: Date.now() + 600_000 });
  await pending;
  assert.deepEqual(fake.saves.map((item) => item.token), [old, fresh]);
  fake.setSave(async () => { throw new KioskApiError("KIOSK_SESSION_EXPIRED", 403); });
  const failing = createWorkoutSession(input("A"), { client: fake.client, sessions: manager });
  for (let i = 0; i < 5 && fake.opens.length < 3; i += 1) await tick();
  fake.opens[2]?.result.resolve({ token: token(), expiresAt: Date.now() + 600_000 });
  await assert.rejects(failing, /만료되어 저장하지 못했습니다/, "only one renewal per save");
  assert.equal(fake.opens.length, 3, "exactly one renewal");
  // Phase 3-E: an explicitly ended (closed / superseded) session is not recovered automatically.
  fake.setSave(async () => { throw new KioskApiError("KIOSK_SESSION_ENDED", 403); });
  const savesBefore = fake.saves.length;
  await assert.rejects(createWorkoutSession(input("A"), { client: fake.client, sessions: manager }), /회원 선택이 종료되어 저장하지 못했습니다/);
  assert.equal(fake.opens.length, 3, "no renewal for KIOSK_SESSION_ENDED"); assert.equal(fake.saves.length, savesBefore + 1, "and no retry");
});

await check("10. saving for a member other than the selected one, or without a configured API, is refused", async () => {
  const fake = fakeClient(); const manager = createKioskMemberSessionManager({ client: fake.client });
  manager.select("B"); fake.opens[0].result.resolve({ token: token(), expiresAt: Date.now() + 600_000 });
  await assert.rejects(createWorkoutSession(input("A"), { client: fake.client, sessions: manager }), /선택한 회원이 바뀌어/);
  await assert.rejects(createWorkoutSession(input("A"), null), /키오스크 API가 설정되지 않아/);
  assert.equal(fake.saves.length, 0);
});

await check("11. HTTP client: token only in the session header, never in URL; errors expose only the code", async () => {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const secret = `bks1_${"Z".repeat(43)}`;
  const fetchImpl = (async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    if (url.endsWith("/v1/kiosk/sessions")) return new Response(JSON.stringify({ kioskSession: { token: secret, expiresAt: Date.now() + 600_000, ttlSeconds: 600 } }), { status: 201 });
    return new Response(JSON.stringify({ error: { code: "KIOSK_SESSION_MEMBER_MISMATCH", message: `echo ${secret}` } }), { status: 403 });
  }) as unknown as typeof fetch;
  const client = createKioskMemberSessionClient({ baseUrl: "http://127.0.0.1:1", device: { getIdToken: async () => "device-id-token" }, fetchImpl });
  const issued = await client.openSession("A");
  assert.equal(issued.token, secret);
  const error = await client.saveWorkoutSession(secret, { workoutSessionId: "ws_20261117_abcdefabcdef", memberId: "A", programTitle: "t", source: { type: "manual" }, exercises: [] }).catch((caught) => caught);
  assert.ok(error instanceof KioskApiError); assert.equal(error.code, "KIOSK_SESSION_MEMBER_MISMATCH"); assert.equal(String(error.message).includes(secret), false);
  for (const request of requests) assert.equal(request.url.includes("bks1_"), false, "no token in URLs");
  const headers = requests[1].init.headers as Record<string, string>;
  assert.equal(headers["x-basecamp-kiosk-session"], secret); assert.equal(headers.authorization, "Bearer device-id-token");
  assert.equal(String(requests[1].init.body).includes(secret), false, "no token in the body");
  assert.equal(await client.openSession("A").then(() => "ok"), "ok");
  const noDevice = createKioskMemberSessionClient({ baseUrl: "http://127.0.0.1:1", device: { getIdToken: async () => null }, fetchImpl });
  await assert.rejects(noDevice.openSession("A"), (caught: unknown) => caught instanceof KioskApiError && caught.code === "KIOSK_DEVICE_NOT_ENROLLED");
});

await check("12. static: session code never touches browser storage or logs, and the Client SDK create path is gone", () => {
  const root = path.resolve("src");
  // Code only: comments may describe what is forbidden.
  const code = (file: string) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
  for (const file of files(path.join(root, "features/kiosk-session"))) {
    const source = code(file);
    for (const forbidden of [/\b(localStorage|sessionStorage|indexedDB)\s*[.[]/, /\bconsole\./, /searchParams/, /[?&]token=/]) assert.equal(forbidden.test(source), false, `${path.basename(file)} matches ${forbidden}`);
  }
  const repository = code(path.join(root, "features/workout-sessions/repositories/firestoreWorkoutSessionRepository.ts"));
  assert.equal(/\bsetDoc\b|\baddDoc\b|async create\(/.test(repository), false, "no Client SDK create in the repository");
  const offenders = files(root).filter((file) => /\.(ts|tsx)$/.test(file)).filter((file) => {
    const source = code(file);
    return /workoutSessionsCollectionPath/.test(source) && /\b(setDoc|addDoc|deleteDoc|writeBatch)\b/.test(source);
  });
  assert.deepEqual(offenders, [], "no other Client SDK writer of workoutSessions");
  const service = code(path.join(root, "features/workout-sessions/services/workoutSessionService.ts"));
  assert.equal(service.includes("firestoreWorkoutSessionRepository.create"), false);
});

await check("13. device identity: agent token → sign-in; expired/revoked refresh → re-authenticate; failures fail closed", async () => {
  let signedIn: string | null = null; let refreshFails = false; let agentCalls = 0;
  const auth = {
    async currentIdToken() { if (!signedIn) return null; if (refreshFails) throw new Error("auth/user-token-expired"); return `id:${signedIn}`; },
    async signInWithCustomToken(token: string) { if (token === "bad") throw new Error("auth/invalid-custom-token"); signedIn = token; refreshFails = false; },
    async signOut() { signedIn = null; },
  };
  let agentToken: string | null = "custom-1";
  const identity = createKioskDeviceIdentity({ auth, sources: [async () => { agentCalls += 1; return agentToken; }] });
  const [first, second] = await Promise.all([identity.getIdToken(), identity.getIdToken()]);
  assert.equal(first, "id:custom-1"); assert.equal(second, "id:custom-1"); assert.equal(agentCalls, 1, "concurrent callers share one agent exchange");
  assert.equal(await identity.getIdToken(), "id:custom-1"); assert.equal(agentCalls, 1, "an active session is reused (Firebase refreshes the ID token)");
  refreshFails = true; agentToken = "custom-2";
  assert.equal(await identity.getIdToken(), "id:custom-2", "refresh failure → signed out → agent re-authenticates");
  refreshFails = true; agentToken = null;
  assert.equal(await identity.getIdToken(), null, "revoked device: refresh fails and the agent has no token → no identity");
  assert.equal(signedIn, null);
  agentToken = "bad"; assert.equal(await identity.getIdToken(), null, "an invalid custom token is not treated as success");
  const allFailing = createKioskDeviceIdentity({ auth, sources: [async () => null, async () => { throw new Error("agent down"); }] });
  signedIn = null; refreshFails = false; assert.equal(await allFailing.getIdToken(), null, "all sources failing → null, never an exception or bypass");
});

await check("14. agent endpoint is loopback-only; agent token source posts without credentials; agent down is transient", async () => {
  assert.equal(resolveKioskDeviceAgentEndpoint(undefined), "http://127.0.0.1:43127");
  assert.equal(resolveKioskDeviceAgentEndpoint("http://localhost:43191"), "http://localhost:43191");
  for (const bad of ["https://agent.example.com", "http://10.0.0.5:43127", "http://127.0.0.1:43127/path", "javascript:alert(1)"]) assert.equal(resolveKioskDeviceAgentEndpoint(bad), null, bad);
  const seen: RequestInit[] = [];
  const source = createAgentDeviceTokenSource({ endpoint: "http://127.0.0.1:1", fetchImpl: (async (url: string, init: RequestInit) => { seen.push(init); assert.equal(url, "http://127.0.0.1:1/kiosk/device-token"); return new Response(JSON.stringify({ status: "ok", customToken: "ct" }), { status: 200 }); }) as unknown as typeof fetch });
  assert.equal(await source(), "ct"); assert.equal(seen[0].credentials, "omit"); assert.equal(seen[0].method, "POST");
  const failing = createAgentDeviceTokenSource({ endpoint: "http://127.0.0.1:1", fetchImpl: (async () => new Response(JSON.stringify({ status: "failed", reason: "device_not_enrolled" }), { status: 409 })) as unknown as typeof fetch });
  assert.equal(await failing(), null);
  // Agent not listening (Windows startup race) is transient: it throws so the identity retries instead of
  // treating the device as not enrolled (scripts/verify-kiosk-device-recovery.ts covers the recovery).
  const down = createAgentDeviceTokenSource({ endpoint: "http://127.0.0.1:1", fetchImpl: (async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch });
  await assert.rejects(down(), (error: unknown) => error instanceof KioskDeviceTransientError && error.reason === "agent_unreachable");
});

// --- Phase 3-E: one renewal policy for reads (history, preview), save and print record ---
const readSetup = () => { const fake = fakeClient(); const manager = createKioskMemberSessionManager({ client: fake.client }); manager.select("A"); const first = token(); fake.opens[0].result.resolve({ token: first, expiresAt: Date.now() + 600_000 }); return { fake, manager, first }; };

await check("15. read: a server-EXPIRED session is renewed once and the request retried once with the new token; a second expiry is refused (no loop)", async () => {
  const { fake, manager, first } = readSetup(); const seen: string[] = [];
  const result = withKioskMemberSession(manager, "A", async (value) => { seen.push(value); if (value === first) throw new KioskApiError("KIOSK_SESSION_EXPIRED", 403); return "rows"; });
  for (let i = 0; i < 5 && fake.opens.length < 2; i += 1) await tick();
  assert.equal(fake.opens.length, 2, "renewed"); const fresh = token(); fake.opens[1].result.resolve({ token: fresh, expiresAt: Date.now() + 600_000 });
  assert.equal(await result, "rows"); assert.deepEqual(seen, [first, fresh], "old token once, then the renewed token");
  const again: string[] = [];
  const failing = withKioskMemberSession(manager, "A", async (value) => { again.push(value); throw new KioskApiError("KIOSK_SESSION_EXPIRED", 403); });
  for (let i = 0; i < 5 && fake.opens.length < 3; i += 1) await tick();
  fake.opens[2]?.result.resolve({ token: token(), expiresAt: Date.now() + 600_000 });
  await assert.rejects(failing, /KIOSK_SESSION_EXPIRED/); assert.equal(again.length, 2, "one retry only"); assert.equal(fake.opens.length, 3, "one renewal only");
});

await check("16. read: ENDED, mismatch, invalid/missing session and device errors are never renewed or retried", async () => {
  for (const code of ["KIOSK_SESSION_ENDED", "KIOSK_SESSION_MEMBER_MISMATCH", "KIOSK_SESSION_INVALID", "KIOSK_SESSION_NOT_FOUND", "KIOSK_SESSION_REQUIRED", "KIOSK_DEVICE_NOT_REGISTERED", "KIOSK_DEVICE_NOT_ENROLLED", "KIOSK_DEVICE_IDENTITY_REQUIRED"]) {
    const { fake, manager } = readSetup(); let calls = 0;
    await assert.rejects(withKioskMemberSession(manager, "A", async () => { calls += 1; throw new KioskApiError(code, 403); }), new RegExp(code));
    await tick();
    assert.equal(calls, 1, `${code}: no retry`); assert.equal(fake.opens.length, 1, `${code}: no renewal`);
    assert.equal(isRenewableKioskSessionError(new KioskApiError(code, 403)), false);
  }
  assert.equal(isRenewableKioskSessionError(new KioskApiError("KIOSK_SESSION_EXPIRED", 403)), true);
  assert.equal(isRenewableKioskSessionError(new Error("KIOSK_SESSION_EXPIRED")), false, "only API errors");
});

await check("17. read: a member change before the renewal refuses it; the late request never runs with another member's session", async () => {
  const { fake, manager } = readSetup(); const seen: string[] = [];
  const result = withKioskMemberSession(manager, "A", async (value) => { seen.push(value); manager.select("B"); throw new KioskApiError("KIOSK_SESSION_EXPIRED", 403); });
  await assert.rejects(result, /KIOSK_SESSION_MEMBER_CHANGED/);
  assert.equal(seen.length, 1, "not retried for B"); assert.ok(fake.opens.every((item, index) => index === 0 ? item.memberId === "A" : item.memberId === "B"), "no new session for A");
});

await check("18. member-list errors map to Korean guidance; no internal code is ever returned", () => {
  const cases: Array<[unknown, RegExp]> = [
    [new KioskApiError("KIOSK_DEVICE_NOT_ENROLLED", 0), /기기 인증이 필요합니다/], [new KioskApiError("KIOSK_DEVICE_IDENTITY_REQUIRED", 401), /기기 인증이 필요합니다/], [new KioskApiError("KIOSK_DEVICE_AUTH_FAILED", 401), /기기 인증이 필요합니다/],
    [new KioskApiError("KIOSK_DEVICE_NOT_REGISTERED", 403), /사용이 중지된 키오스크/], [new KioskApiError("NETWORK_ERROR", 0), /서버에 연결하지 못했습니다/],
    [new KioskApiError("INTERNAL_ERROR", 500), /일시적인 서버 오류/], [new KioskApiError("INVALID_API_RESPONSE", 200), /일시적인 서버 오류/], [new KioskApiError("SOMETHING", 503), /일시적인 서버 오류/],
    [new KioskApiError("SOMETHING_NEW", 409), /회원 목록을 불러오지 못했습니다/], [new Error("KIOSK_RAW"), /회원 목록을 불러오지 못했습니다/], ["x", /회원 목록을 불러오지 못했습니다/],
  ];
  for (const [error, expected] of cases) { const message = kioskMemberListErrorMessage(error); assert.match(message, expected); assert.doesNotMatch(message, /KIOSK_|NETWORK_ERROR|INTERNAL_ERROR|INVALID_API_RESPONSE|SOMETHING/); }
  // Static: both member-list screens use the mapping and never render error.message.
  for (const file of ["src/features/printing/components/QuickPrintFlow/QuickPrintFlow.tsx", "src/features/workout-sessions/pages/WorkoutSessionsPage.tsx"]) {
    const source = readFileSync(path.join(process.cwd(), file), "utf8");
    assert.ok(source.includes("kioskMemberListErrorMessage("), `${file} maps member-list errors`);
  }
  const history = readFileSync(path.join(process.cwd(), "src/features/workout-sessions/pages/WorkoutSessionsPage.tsx"), "utf8");
  assert.doesNotMatch(history, /void membersApi\.listMembers\(\)\.then\(setMembers\)/, "the member list rejection is handled");
  // Every member-session read uses the shared renewal rule (no bare sessionFor → request).
  for (const file of ["src/features/printing/providers/conditionLabProviders.ts", "src/features/members/repositories/profileRepository.ts", "src/features/print-history/repositories/firestorePrintRequestRepository.ts", "src/features/workout-sessions/repositories/firestoreWorkoutSessionRepository.ts"]) {
    const source = readFileSync(path.join(process.cwd(), file), "utf8");
    assert.ok(source.includes("withKioskMemberSession("), `${file} uses withKioskMemberSession`);
    assert.doesNotMatch(source, /sessions\.sessionFor\(/, `${file} has no bare sessionFor`);
  }
  // Provider diagnostics (Phase 3-E Sprint 4): fixed labels, timing and counts only — no member id, token, raw error or body.
  const provider = readFileSync(path.join(process.cwd(), "src/features/printing/providers/conditionLabProviders.ts"), "utf8");
  for (const call of provider.match(/(debugLog|console\.\w+)\([^;]*;/g) ?? []) assert.doesNotMatch(call, /(?<!Boolean\()\b(memberId|appId|error|token|name|raw|logs|records|profile)\b(?!\.length)/,`provider log carries no identifier or payload: ${call}`);
  // Diagnostic log: code and status only — never a token, member id or message body.
  const logged: unknown[][] = []; const original = console.warn; console.warn = (...args: unknown[]) => { logged.push(args); };
  try {
    const secret = "bks1_SECRETSECRETSECRETSECRETSECRETSECRETSECRET1"; const memberId = "member-private-id";
    logKioskError("unit", new KioskApiError("PRINT_REQUEST_CONFLICT", 409, `${secret} ${memberId}`));
    logKioskError("unit", new Error(`${secret} ${memberId}`));
    const text = JSON.stringify(logged);
    assert.match(text, /PRINT_REQUEST_CONFLICT/); assert.match(text, /409/);
    assert.doesNotMatch(text, /SECRET|member-private-id/, "no token or member id in the diagnostic log");
  } finally { console.warn = original; }
});

console.log(`\n${results.length}/18 passed`);
if (results.length !== 18) process.exit(1);
};
main().catch((error) => { console.error(error); process.exit(1); });
