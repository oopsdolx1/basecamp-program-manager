import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { KioskApiError } from "../src/features/kiosk-recommendations/kioskRecommendationClient";
import type { KioskMemberSessionClient, KioskPrintRecordPayload, KioskPrintRecordResponse } from "../src/features/kiosk-session/kioskMemberSessionClient";
import { createKioskMemberSessionManager } from "../src/features/kiosk-session/kioskMemberSessionManager";
import { createPrintRequestId, ensureKioskPrintSession, recordKioskPrint, type PendingPrintRecord } from "../src/features/print-history/services/kioskPrintRecordService";
import { submitPhysicalPrintAndPersist } from "../src/features/printing/services/physicalPrintSubmissionService";

// Phase 3-B: print persistence through the Kiosk API (session check before printing, idempotent record after).
let tokenSeq = 0;
const nextToken = () => `bks1_${String(++tokenSeq).padStart(43, "B")}`;
const record = (payload: KioskPrintRecordPayload, workoutSessionId: string): KioskPrintRecordResponse => ({ id: payload.printRequestId, schemaVersion: 1, requestedAt: 1_700_000_000_000, requestedBy: "kiosk:k1", requestSource: "quick-print", status: "printed", workoutSessionId, printedAt: 1_700_000_000_000, printedBy: "kiosk:k1", printer: payload.printer, copy: 1, memberId: "A", programId: workoutSessionId, memberSnapshot: { memberId: "A", name: "회원" }, programSnapshot: { title: "t" }, template: {}, createdAt: 1_700_000_000_000, createdBy: "kiosk:k1", isArchived: false });
const fake = () => {
  const opened: string[] = []; const prints: Array<{ token: string; workoutSessionId: string; payload: KioskPrintRecordPayload }> = [];
  let current: (token: string) => Promise<{ memberId: string; expiresAt: number }> = async () => ({ memberId: "A", expiresAt: Date.now() + 600_000 });
  let recordImpl: (token: string, workoutSessionId: string, payload: KioskPrintRecordPayload) => Promise<{ record: KioskPrintRecordResponse; replayed: boolean }> = async (_t, id, payload) => ({ record: record(payload, id), replayed: false });
  const client: KioskMemberSessionClient = {
    async openSession(memberId) { opened.push(memberId); return { token: nextToken(), expiresAt: Date.now() + 600_000 }; },
    async closeSession() {},
    async saveWorkoutSession() { throw new Error("unused"); },
    currentSession: (token) => current(token),
    recordPrint: (token, workoutSessionId, payload) => { prints.push({ token, workoutSessionId, payload }); return recordImpl(token, workoutSessionId, payload); },
  };
  const sessions = createKioskMemberSessionManager({ client });
  return { client, sessions, runtime: { client, sessions }, opened, prints, setCurrent: (fn: typeof current) => { current = fn; }, setRecord: (fn: typeof recordImpl) => { recordImpl = fn; } };
};
const pending = (overrides: Partial<PendingPrintRecord> = {}): PendingPrintRecord => ({ printRequestId: createPrintRequestId(), workoutSessionId: "ws_20261117_abcdefabcdef", memberId: "A", printer: "Office Printer A", copy: 1, ...overrides });
const results: string[] = [];
const check = async (name: string, fn: () => Promise<void> | void) => { await fn(); results.push(name); console.log(`PASS ${name}`); };

const main = async (): Promise<void> => {
  await check("1. idempotency keys are random pr_ + 32 hex", () => {
    const ids = new Set(Array.from({ length: 50 }, createPrintRequestId));
    assert.equal(ids.size, 50); for (const id of ids) assert.match(id, /^pr_[0-9a-f]{32}$/);
  });

  await check("2. before printing: no API, no selected member or another member → refused (nothing printed)", async () => {
    await assert.rejects(ensureKioskPrintSession("A", null), /키오스크 API가 설정되지 않아/);
    const f = fake();
    await assert.rejects(ensureKioskPrintSession("A", f.runtime), /회원을 다시 선택해/, "no selection (e.g. page reload or URL opened directly)");
    f.sessions.select("B");
    await assert.rejects(ensureKioskPrintSession("A", f.runtime), /회원을 다시 선택해/, "another member is selected");
    f.sessions.select("A"); f.setCurrent(async () => ({ memberId: "B", expiresAt: Date.now() + 1 }));
    await assert.rejects(ensureKioskPrintSession("A", f.runtime), /회원을 다시 선택해/, "server reports another member");
  });

  await check("3. before printing: an expired session is renewed once for the still-selected member; an ended session is not renewed; a revoked device is refused", async () => {
    const f = fake(); f.sessions.select("A");
    let calls = 0; f.setCurrent(async () => { calls += 1; if (calls === 1) throw new KioskApiError("KIOSK_SESSION_EXPIRED", 403); return { memberId: "A", expiresAt: Date.now() + 600_000 }; });
    await ensureKioskPrintSession("A", f.runtime);
    assert.deepEqual(f.opened, ["A", "A"], "renewed once");
    f.setCurrent(async () => { throw new KioskApiError("KIOSK_DEVICE_NOT_REGISTERED", 403); });
    await assert.rejects(ensureKioskPrintSession("A", f.runtime), /사용이 중지된 키오스크/);
    assert.deepEqual(f.opened, ["A", "A"], "a revoked device is never renewed");
    // Phase 3-E: an explicitly ended (closed / superseded) session is not recovered automatically.
    const g = fake(); g.sessions.select("A");
    g.setCurrent(async () => { throw new KioskApiError("KIOSK_SESSION_ENDED", 403); });
    await assert.rejects(ensureKioskPrintSession("A", g.runtime), /회원 선택이 종료되었습니다/);
    assert.deepEqual(g.opened, ["A"], "no renewal for KIOSK_SESSION_ENDED");
    // An expired session whose renewal is expired again is refused after one renewal (no loop).
    const h = fake(); h.sessions.select("A");
    h.setCurrent(async () => { throw new KioskApiError("KIOSK_SESSION_EXPIRED", 403); });
    await assert.rejects(ensureKioskPrintSession("A", h.runtime), /만료되었습니다/);
    assert.deepEqual(h.opened, ["A", "A"], "exactly one renewal");
  });

  await check("4. record: success maps the server record; network/5xx retries reuse the SAME idempotency key", async () => {
    const f = fake(); f.sessions.select("A");
    const p = pending();
    let calls = 0;
    f.setRecord(async (_t, id, payload) => { calls += 1; if (calls === 1) throw new KioskApiError("NETWORK_ERROR", 0); if (calls === 2) throw new KioskApiError("INTERNAL_ERROR", 503); return { record: record(payload, id), replayed: true }; });
    const saved = await recordKioskPrint(p, f.runtime);
    assert.equal(saved.id, p.printRequestId); assert.ok(saved.printedAt instanceof Date); assert.equal(saved.copy, 1);
    assert.equal(f.prints.length, 3); assert.deepEqual(new Set(f.prints.map((item) => item.payload.printRequestId)), new Set([p.printRequestId]));
    assert.deepEqual(f.prints[0].payload, { printRequestId: p.printRequestId, printer: "Office Printer A", copy: 1 }, "only id, printer and advisory copy are sent");
  });

  await check("5. record: gives up after 3 attempts; 4xx errors are not retried; nothing else is attempted", async () => {
    const f = fake(); f.sessions.select("A");
    f.setRecord(async () => { throw new KioskApiError("NETWORK_ERROR", 0); });
    await assert.rejects(recordKioskPrint(pending(), f.runtime), /서버에 연결하지 못했습니다/); assert.equal(f.prints.length, 3);
    f.prints.length = 0; f.setRecord(async () => { throw new KioskApiError("PRINT_SCOPE_DENIED", 403); });
    await assert.rejects(recordKioskPrint(pending(), f.runtime), /선택한 회원의 운동 기록이 아닙니다/); assert.equal(f.prints.length, 1);
    f.prints.length = 0; f.setRecord(async () => { throw new KioskApiError("PRINT_REQUEST_CONFLICT", 409); });
    await assert.rejects(recordKioskPrint(pending(), f.runtime), (error: Error) => /이미 처리된 출력 요청과 내용이 달라/.test(error.message) && !/PRINT_REQUEST_CONFLICT/.test(error.message)); assert.equal(f.prints.length, 1);
    // Phase 3-E: no internal code on screen; the code stays available on the error object and in the diagnostic log.
    for (const [code, status, expected] of [["PRINT_SOURCE_UNAVAILABLE", 409, /운동 프로그램 정보가 없어/], ["INVALID_PRINT_RECORD", 400, /출력 기록 요청이 올바르지 않아/], ["KIOSK_SESSION_INVALID", 401, /회원 선택 정보를 확인할 수 없습니다/], ["SOMETHING_NEW", 409, /^출력 기록을 처리하지 못했습니다\. 잠시 후 다시 시도해 주세요\.$/], ["UNMAPPED_SERVER", 503, /일시적인 서버 오류/]] as Array<[string, number, RegExp]>) {
      const g = fake(); g.sessions.select("A"); g.setRecord(async () => { throw new KioskApiError(code, status); });
      await assert.rejects(recordKioskPrint(pending(), g.runtime), (error: Error & { code?: string }) => expected.test(error.message) && !/[A-Z]{3,}_[A-Z_]+/.test(error.message) && error.code === code);
    }
  });

  await check("6. record: an expired session is renewed once (new token, same key); an ended session is not; a member switch before saving is refused", async () => {
    const f = fake(); f.sessions.select("A");
    const p = pending(); let first = "";
    f.setRecord(async (token, id, payload) => { if (!first) { first = token; throw new KioskApiError("KIOSK_SESSION_EXPIRED", 403); } return { record: record(payload, id), replayed: false }; });
    await recordKioskPrint(p, f.runtime);
    assert.equal(f.prints.length, 2); assert.notEqual(f.prints[1].token, first, "never the old token"); assert.equal(f.prints[1].payload.printRequestId, p.printRequestId);
    const e = fake(); e.sessions.select("A");
    e.setRecord(async () => { throw new KioskApiError("KIOSK_SESSION_ENDED", 403); });
    await assert.rejects(recordKioskPrint(pending(), e.runtime), /회원 선택이 종료되었습니다/);
    assert.equal(e.prints.length, 1, "an ended session is not retried"); assert.deepEqual(e.opened, ["A"], "and not renewed");
    f.sessions.select("B");
    await assert.rejects(recordKioskPrint(pending(), f.runtime), /회원을 다시 선택해/, "late save for A after switching to B");
  });

  await check("7. physical print first; a failed physical print records nothing; a failed record never re-prints", async () => {
    let submits = 0; let saves = 0;
    const failed = await submitPhysicalPrintAndPersist({ submit: async () => { submits += 1; return { status: "failed", reason: "physical_printer_unavailable" }; }, saveHistory: async () => { saves += 1; return { id: "x" }; } });
    assert.deepEqual(failed, { physical: "failed", reason: "physical_printer_unavailable" }); assert.equal(saves, 0);
    submits = 0;
    const historyFailed = await submitPhysicalPrintAndPersist({ submit: async () => { submits += 1; return { status: "submitted", printer: "P" }; }, saveHistory: async () => { saves += 1; throw new Error("api down"); } });
    assert.deepEqual(historyFailed, { physical: "submitted", history: "failed" }); assert.equal(submits, 1, "no second physical submission");
    const saved = await submitPhysicalPrintAndPersist({ submit: async () => ({ status: "submitted", printer: "P" }), saveHistory: async (printer) => ({ id: `r-${printer}` }) });
    assert.deepEqual(saved, { physical: "submitted", history: "saved", record: { id: "r-P" } });
  });

  await check("8. static: no browser write to printHistory or workoutSessions remains; the preview uses the session-scoped API", () => {
    const root = path.resolve("src");
    const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
    const code = (file: string) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const offenders = files(root).filter((file) => /\.(ts|tsx)$/.test(file)).filter((file) => {
      const source = code(file);
      return /(printHistoryCollectionPath|workoutSessionsCollectionPath)/.test(source) && /\b(setDoc|addDoc|updateDoc|deleteDoc|writeBatch|runTransaction)\b/.test(source);
    });
    assert.deepEqual(offenders, [], "no Client SDK writer of printHistory/workoutSessions");
    const all = files(root).filter((file) => /\.(ts|tsx)$/.test(file)).map(code).join("\n");
    for (const removed of ["markWorkoutSessionPrinted", "createPrintRequestFromDocument", "useCreatePrintRequest", "archivePrintRequest", "createPrintRequest("]) assert.equal(all.includes(removed), false, `${removed} removed`);
    const preview = code(path.join(root, "features/printing/pages/PrintPreviewPage.tsx"));
    assert.ok(preview.includes("ensureKioskPrintSession(") && preview.includes("recordKioskPrint(") && preview.includes("receivesHandoff: true"));
    assert.ok(preview.indexOf("ensureKioskPrintSession(") < preview.indexOf("submitPhysicalPrintAndPersist({"), "session is confirmed before the physical print");
    for (const page of ["features/printing/components/QuickPrintFlow/QuickPrintFlow.tsx", "features/workout-sessions/pages/WorkoutSessionsPage.tsx"]) {
      const source = code(path.join(root, page));
      assert.ok(/handoffKioskSession\(\);\s*navigate\(routeBuilder\.printPreviewSession/.test(source), `${page} hands its member session to the preview`);
    }
  });

  console.log(`\n${results.length}/8 passed`);
  if (results.length !== 8) process.exit(1);
};
main().catch((error) => { console.error(error); process.exit(1); });
