// Kiosk device sign-in recovery (startup race with the local Print Agent).
// Uses the real Print Agent HTTP server (windows-print-agent/server.mjs) on a test port with a fake device
// credential, and a fake Firebase auth port. No Firebase project, no network beyond 127.0.0.1, no production data.
import assert from "node:assert/strict";
import { createPrintAgent } from "../windows-print-agent/server.mjs";
import {
  KioskDeviceTransientError,
  createAgentDeviceTokenSource,
  createKioskDeviceIdentity,
  installKioskDeviceRecoveryTriggers,
} from "../src/features/kiosk-recommendations/kioskDeviceIdentityCore";
import { KioskApiError, createKioskRecommendationClient, kioskDeviceTokenUnavailable, type KioskDeviceAuthState } from "../src/features/kiosk-recommendations/kioskRecommendationClient";
import { KIOSK_MEMBER_LIST_MESSAGES, kioskMemberListErrorMessage } from "../src/features/kiosk-session/kioskErrorMessages";

const PORT = 43139;
const ORIGIN = "https://kiosk.test";
const ENDPOINT = `http://127.0.0.1:${PORT}`;
const FAST_RETRY = [40, 80, 150];
const STARTING = "키오스크 서비스를 준비하고 있습니다. 잠시만 기다려 주세요.";
const ADMIN = "키오스크 기기 인증이 필요합니다. 관리자에게 문의해 주세요.";

const silentLogger = { info: async () => undefined, error: async () => undefined };
type Credential = { getCustomToken(): Promise<string> };
const startAgent = async (credential: () => Promise<Credential | null>) => {
  const agent = createPrintAgent({ port: PORT, allowedOrigins: [ORIGIN], deviceTokenOrigins: [ORIGIN], logger: silentLogger, backend: { getStatus: async () => ({ printerAvailable: false, defaultPrinter: null }), submit: async () => ({ status: "failed" }) }, pdfPipeline: { create: async () => { throw new Error("unused"); } }, deviceCredential: credential });
  await agent.listen();
  return agent;
};
let tokenSerial = 0;
const enrolled = async (): Promise<Credential> => ({ getCustomToken: async () => `custom-${++tokenSerial}` });
const notEnrolled = async (): Promise<Credential> => ({ getCustomToken: async () => { throw Object.assign(new Error("device_not_enrolled"), { reason: "device_not_enrolled" }); } });

// The browser sends Origin itself; Node's fetch needs it set explicitly to reach the real agent's origin check.
let agentCalls = 0;
const browserFetch = (async (url: string, init: RequestInit) => { agentCalls += 1; return fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), origin: ORIGIN } }); }) as unknown as typeof fetch;

/** Fake Firebase auth: a custom token signs in; the ID token is derived from it. */
const fakeAuth = () => {
  let user: string | null = null;
  return {
    port: {
      async currentIdToken() { return user ? `id:${user}` : null; },
      async signInWithCustomToken(token: string) { user = token; },
      async signOut() { user = null; },
    },
    dropSession() { user = null; },
  };
};
const newIdentity = (auth = fakeAuth()) => {
  const identity = createKioskDeviceIdentity({ auth: auth.port, sources: [createAgentDeviceTokenSource({ endpoint: ENDPOINT, fetchImpl: browserFetch, timeoutMs: 500 })], retryDelaysMs: FAST_RETRY, minRecoveryIntervalMs: 50 });
  const states: KioskDeviceAuthState[] = [];
  identity.subscribe!((state) => states.push(state));
  return { identity, auth, states };
};
const waitFor = async (condition: () => boolean, label: string, timeoutMs = 3_000) => {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`timed out: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A Kiosk API client against a fake API server: what the member list does on screen. */
const memberListThroughClient = (identity: ReturnType<typeof newIdentity>["identity"]) => createKioskRecommendationClient({
  baseUrl: "https://api.test",
  device: identity,
  fetchImpl: (async (_url: string, init: RequestInit) => {
    const authorization = (init.headers as Record<string, string>).authorization;
    return new Response(JSON.stringify(authorization?.startsWith("Bearer id:custom-") ? { program: null } : { error: { code: "KIOSK_DEVICE_IDENTITY_REQUIRED" } }), { status: authorization ? 200 : 401 });
  }) as unknown as typeof fetch,
});
const screenMessage = async (client: ReturnType<typeof memberListThroughClient>) => {
  try { await client.fetchDefaultProgram("member-1"); return "OK"; } catch (error) { return kioskMemberListErrorMessage(error); }
};

let failures = 0;
const check = async (name: string, run: () => Promise<void>) => {
  try { await run(); console.log(`PASS ${name}`); } catch (error) { failures += 1; console.error(`FAIL ${name}\n`, error); }
};
const silenceKioskLog = () => { const original = console.error; console.error = (...args: unknown[]) => { if (String(args[0]).includes("[Kiosk")) return; original(...args); }; return () => { console.error = original; }; };

await check("A. agent missing at startup → 'starting' (not 'not enrolled') → agent starts → recovers without reload", async () => {
  const restore = silenceKioskLog();
  try {
    const { identity, states } = newIdentity();
    const client = memberListThroughClient(identity);
    // 1-3. Program Manager starts first: connection refused on 127.0.0.1.
    assert.equal(await identity.getIdToken(), null);
    assert.equal(identity.getState!(), "starting");
    const first = await screenMessage(client);
    assert.equal(first, STARTING, "transient startup failure shows the 'preparing' message");
    assert.notEqual(first, ADMIN, "never the administrator message for a startup race");
    await assert.rejects(client.fetchDefaultProgram("member-1"), (error: unknown) => error instanceof KioskApiError && error.code === "KIOSK_DEVICE_STARTING");
    // 4. The agent starts. 5. The automatic retry signs in; listeners (screen reload) hear `ready`.
    const agent = await startAgent(enrolled);
    try {
      await waitFor(() => identity.getState!() === "ready", "automatic retry reaches ready");
      assert.ok(states.includes("starting") && states.at(-1) === "ready", `state path ${states.join(" → ")}`);
      assert.equal(await screenMessage(client), "OK", "member API works on the same page, no reload");
    } finally { await agent.close(); }
  } finally { restore(); }
});

await check("B. agent ready at startup → ready immediately, one agent request", async () => {
  const agent = await startAgent(enrolled);
  try {
    const before = agentCalls;
    const { identity, states } = newIdentity();
    const [a, b] = await Promise.all([identity.getIdToken(), identity.getIdToken()]);
    assert.match(String(a), /^id:custom-/); assert.equal(a, b);
    assert.equal(agentCalls - before, 1, "concurrent callers share one agent request");
    assert.deepEqual(states, ["ready"]);
    assert.equal(await screenMessage(memberListThroughClient(identity)), "OK");
  } finally { await agent.close(); }
});

await check("C. real device_not_enrolled → administrator message, no retry loop", async () => {
  const restore = silenceKioskLog();
  const agent = await startAgent(notEnrolled);
  try {
    const before = agentCalls;
    const { identity } = newIdentity();
    assert.equal(await identity.getIdToken(), null);
    assert.equal(identity.getState!(), "not_enrolled");
    assert.equal(await screenMessage(memberListThroughClient(identity)), ADMIN);
    await sleep(400); // longer than the whole fast retry schedule
    assert.equal(agentCalls - before, 2, "only the two explicit calls reached the agent: no automatic retry");
    // Agent says the credential is missing (no config) → also permanent.
    const missing = await (async () => { await agent.close(); const second = await startAgent(async () => null); try { const { identity: other } = newIdentity(); await other.getIdToken(); return other.getState!(); } finally { await second.close(); } })();
    assert.equal(missing, "not_enrolled", "device_auth_not_configured is permanent");
  } finally { await agent.close().catch(() => undefined); restore(); }
});

await check("D. agent stops and restarts while the page is open → recovers without reload", async () => {
  const restore = silenceKioskLog();
  try {
    let agent = await startAgent(enrolled);
    const { identity, auth, states } = newIdentity();
    assert.match(String(await identity.getIdToken()), /^id:custom-/);
    await agent.close();
    // The Firebase session is lost while the agent is down (e.g. refresh failed): the next call fails transiently.
    auth.dropSession();
    assert.equal(await identity.getIdToken(), null);
    assert.equal(identity.getState!(), "starting");
    assert.equal(await screenMessage(memberListThroughClient(identity)), STARTING);
    agent = await startAgent(enrolled);
    try {
      await waitFor(() => identity.getState!() === "ready", "recovered after agent restart");
      assert.deepEqual(states, ["ready", "starting", "ready"], `state path ${states.join(" → ")}`);
      assert.equal(await screenMessage(memberListThroughClient(identity)), "OK");
    } finally { await agent.close(); }
  } finally { restore(); }
});

await check("agent token source: transient vs permanent classification", async () => {
  const respond = (status: number, body: unknown) => createAgentDeviceTokenSource({ endpoint: ENDPOINT, fetchImpl: (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch });
  const transient = (reason: string) => (error: unknown) => error instanceof KioskDeviceTransientError && error.reason === reason;
  await assert.rejects(createAgentDeviceTokenSource({ endpoint: ENDPOINT, fetchImpl: (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch })(), transient("agent_unreachable"), "connection refused / fetch failed");
  await assert.rejects(createAgentDeviceTokenSource({ endpoint: ENDPOINT, timeoutMs: 30, fetchImpl: ((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))) as unknown as typeof fetch })(), transient("agent_timeout"), "timeout");
  await assert.rejects(respond(503, { status: "failed", reason: "device_auth_unavailable" })(), transient("device_auth_unavailable"), "agent cannot reach the API");
  await assert.rejects(respond(502, {})(), transient("agent_http_502"));
  await assert.rejects(respond(429, {})(), transient("agent_http_429"));
  await assert.rejects(respond(200, { status: "ok" })(), transient("agent_invalid_response"));
  for (const [status, reason] of [[409, "device_not_enrolled"], [409, "enrollment_already_pending"], [503, "device_auth_not_configured"], [500, "credential_unreadable"], [500, "credential_protection_failed"], [403, "KIOSK_DEVICE_AUTH_FAILED"], [409, "DEVICE_REVOKED"], [403, "origin_not_allowed"]] as const) {
    assert.equal(await respond(status, { status: "failed", reason })(), null, `${status} ${reason} is permanent`);
  }
});

await check("custom-token exchange failure is transient and retried", async () => {
  let fail = true; let user: string | null = null;
  const identity = createKioskDeviceIdentity({ auth: { async currentIdToken() { return user; }, async signInWithCustomToken(token) { if (fail) throw new Error("auth/network-request-failed"); user = `id:${token}`; }, async signOut() { user = null; } }, sources: [async () => "ct"], retryDelaysMs: FAST_RETRY });
  assert.equal(await identity.getIdToken(), null);
  assert.equal(identity.getState!(), "starting");
  fail = false;
  await waitFor(() => identity.getState!() === "ready", "retry after exchange failure");
});

await check("retry schedule: 1 s, 2 s, then every 5 s; stops when ready", async () => {
  const delays: number[] = []; const timers: Array<() => void> = [];
  let up = false;
  const identity = createKioskDeviceIdentity({ auth: fakeAuth().port, sources: [async () => { if (!up) throw new KioskDeviceTransientError("agent_unreachable"); return "ct"; }], setTimer: (callback, ms) => { delays.push(ms); timers.push(callback); return timers.length; }, clearTimer: () => undefined });
  await identity.getIdToken();
  for (let i = 0; i < 4; i += 1) { timers.shift()!(); await sleep(0); await sleep(0); }
  assert.deepEqual(delays, [1_000, 2_000, 5_000, 5_000, 5_000]);
  up = true; timers.shift()!(); await sleep(0); await sleep(0);
  assert.equal(identity.getState!(), "ready");
  assert.equal(timers.length, 0, "no further retry once ready");
});

await check("recovery triggers: focus / visible / online, throttled and single-flight", async () => {
  let calls = 0; let release: (() => void) | null = null;
  let clock = 0;
  const identity = createKioskDeviceIdentity({ auth: fakeAuth().port, sources: [() => { calls += 1; return new Promise<string | null>((_resolve, reject) => { release = () => reject(new KioskDeviceTransientError("agent_unreachable")); }); }], retryDelaysMs: [], minRecoveryIntervalMs: 1_000, now: () => clock });
  const handlers = new Map<string, () => void>();
  const target = { addEventListener: (type: string, listener: () => void) => handlers.set(type, listener), removeEventListener: (type: string) => handlers.delete(type) };
  const doc = { ...target, visibilityState: "visible" };
  const remove = installKioskDeviceRecoveryTriggers(identity, { window: target, document: doc });
  handlers.get("focus")!(); handlers.get("online")!(); handlers.get("visibilitychange")!();
  await sleep(0);
  assert.equal(calls, 1, "three events while one attempt runs → one agent request");
  release!(); await sleep(0); await sleep(0);
  assert.equal(identity.getState!(), "starting");
  handlers.get("focus")!(); await sleep(0);
  assert.equal(calls, 1, "within the throttle window → no new request");
  clock = 1_500; doc.visibilityState = "hidden"; handlers.get("visibilitychange")!(); await sleep(0);
  assert.equal(calls, 1, "hidden → no request");
  handlers.get("focus")!(); await sleep(0);
  assert.equal(calls, 2, "after the window → one new request");
  release!(); await sleep(0);
  remove(); assert.equal(handlers.size, 0);
});

await check("UI wording: starting and enrollment problems never share a message", async () => {
  const restore = silenceKioskLog();
  try {
    assert.equal(KIOSK_MEMBER_LIST_MESSAGES.deviceStarting, STARTING);
    assert.equal(KIOSK_MEMBER_LIST_MESSAGES.deviceAuth, ADMIN);
    assert.equal(kioskMemberListErrorMessage(new KioskApiError("KIOSK_DEVICE_STARTING", 0)), STARTING);
    for (const code of ["KIOSK_DEVICE_NOT_ENROLLED", "KIOSK_DEVICE_IDENTITY_REQUIRED", "KIOSK_DEVICE_AUTH_FAILED"]) assert.equal(kioskMemberListErrorMessage(new KioskApiError(code, 401)), ADMIN, code);
    assert.equal(kioskDeviceTokenUnavailable({ getIdToken: async () => null, getState: () => "starting" }).code, "KIOSK_DEVICE_STARTING");
    assert.equal(kioskDeviceTokenUnavailable({ getIdToken: async () => null, getState: () => "not_enrolled" }).code, "KIOSK_DEVICE_NOT_ENROLLED");
    assert.equal(kioskDeviceTokenUnavailable({ getIdToken: async () => null }).code, "KIOSK_DEVICE_NOT_ENROLLED", "an identity without state keeps the old code");
  } finally { restore(); }
});

if (failures) { console.error(`${failures} check(s) failed`); process.exit(1); }
console.log("kiosk device recovery: all checks passed");
