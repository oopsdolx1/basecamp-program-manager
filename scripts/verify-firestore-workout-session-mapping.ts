import assert from "node:assert/strict";
import { Timestamp } from "firebase/firestore";
import { filterWorkoutHistory, workoutHistoryDate } from "../src/features/workout-sessions/services/workoutSessionHistoryService";
import { createWorkoutPrintDocument } from "../src/features/printing/mappers/workoutPrintMapper";
import { resolvePrintPreviewSource } from "../src/features/printing/services/printPreviewAuthorityResolver";
import { assertPrintPreviewSessionContext } from "../src/features/printing/services/printPreviewAuthorityResolver";
import { mapWorkoutSessionRecord } from "../src/features/workout-sessions/repositories/firestoreWorkoutSessionRepository";
import { normalizeWorkoutSource } from "../src/features/workout-sessions/services/workoutSessionSourceResolver";

const raw = (overrides: Record<string, unknown> = {}) => ({
  memberId: "member-a",
  trainerId: "trainer-a",
  status: "created",
  exerciseIds: [],
  memberSnapshot: { name: "Member A" },
  programSnapshot: { title: "Workout" },
  exercises: [],
  prescription: { source: { type: "manual" }, sourceProgramName: "Manual Workout", exercises: [] },
  source: { type: "manual" },
  ...overrides,
});

const mapped = (data: Record<string, unknown>) => mapWorkoutSessionRecord("session-a", data as never);

const cleanManual = mapped(raw());
assert.equal(cleanManual.programId, undefined);
assert.equal(cleanManual.prescription?.sourceProgramId, undefined);
assert.deepEqual(cleanManual.source, { type: "manual" });
assert.deepEqual(cleanManual.prescription?.source, { type: "manual" });
assert.deepEqual(normalizeWorkoutSource(cleanManual), { type: "manual" });
assert.doesNotThrow(() => assertPrintPreviewSessionContext(cleanManual, "member-a"));

for (const identity of ["", "undefined", "null"]) {
  const polluted = mapped(raw({ programId: identity, prescription: { source: { type: "manual" }, sourceProgramId: identity, sourceProgramName: "Manual Workout", exercises: [] } }));
  assert.equal(polluted.programId, undefined, `programId ${JSON.stringify(identity)} is removed`);
  assert.equal(polluted.prescription?.sourceProgramId, undefined, `sourceProgramId ${JSON.stringify(identity)} is removed`);
  assert.deepEqual(normalizeWorkoutSource(polluted), { type: "manual" });
}

const program = mapped(raw({
  programId: "program-123",
  source: { type: "program", programId: "program-123" },
  prescription: { source: { type: "program", programId: "program-123" }, sourceProgramId: "program-123", sourceProgramName: "Program", exercises: [] },
}));
assert.equal(program.programId, "program-123");
assert.equal(program.prescription?.sourceProgramId, "program-123");
assert.deepEqual(normalizeWorkoutSource(program), { type: "program", programId: "program-123" });

const verifyLiveManualShape = async (): Promise<void> => {
  const liveManualShape = mapped(raw({
    memberId: "member-a",
    exerciseIds: ["shoulder-press", "deadlift", "leg-extension"],
    programSnapshot: { title: "Direct workout", category: "BACK" },
    exercises: [
      { exerciseId: "shoulder-press", programExerciseId: "entry-1", name: "Shoulder press", order: 1, plannedSets: 4, memo: "" },
      { exerciseId: "deadlift", programExerciseId: "entry-2", name: "Deadlift", order: 2, plannedSets: 4, memo: "" },
      { exerciseId: "leg-extension", programExerciseId: "entry-3", name: "Leg extension", order: 3, plannedSets: 4, memo: "" },
    ],
    prescription: {
      source: { type: "manual" },
      sourceProgramName: "Direct workout",
      category: "BACK",
      exercises: [
        { exerciseId: "shoulder-press", programExerciseId: "entry-1", name: "Shoulder press", order: 1, plannedSets: 4, memo: "" },
        { exerciseId: "deadlift", programExerciseId: "entry-2", name: "Deadlift", order: 2, plannedSets: 4, memo: "" },
        { exerciseId: "leg-extension", programExerciseId: "entry-3", name: "Leg extension", order: 3, plannedSets: 4, memo: "" },
      ],
    },
    source: { type: "manual" },
  }));
  assert.deepEqual(normalizeWorkoutSource(liveManualShape), { type: "manual" });
  assert.equal(liveManualShape.programId, undefined);
  assert.equal(liveManualShape.prescription?.sourceProgramId, undefined);
  const liveManualProgram = await resolvePrintPreviewSource(liveManualShape, async () => { throw new Error("manual prescription must not load a program"); });
  const liveManualDocument = createWorkoutPrintDocument({ member: { memberId: "member-a" as never, displayName: "Member", searchText: "member" }, program: liveManualProgram, workoutSessionId: liveManualShape.sessionId });
  assert.equal(liveManualDocument.workoutSessionId, "session-a");
  assert.equal(liveManualDocument.rows.filter((row) => !row.isBlank).length, 3);
};

// Dates: Firestore Timestamp (SDK) and epoch milliseconds (Kiosk read API) both map to real dates;
// null/undefined and invalid numbers keep the existing epoch-0 / null contract.
const verifyDates = (): void => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const iso = (value: Date | null) => value?.toISOString() ?? null;

  const fromTimestamp = mapped(raw({ createdAt: Timestamp.fromMillis(now - 3 * DAY), updatedAt: Timestamp.fromMillis(now - 2 * DAY), printedAt: Timestamp.fromMillis(now - DAY), lastPrintedAt: Timestamp.fromMillis(now) }));
  assert.equal(iso(fromTimestamp.createdAt), new Date(now - 3 * DAY).toISOString());
  assert.equal(iso(fromTimestamp.updatedAt), new Date(now - 2 * DAY).toISOString());
  assert.equal(iso(fromTimestamp.printedAt), new Date(now - DAY).toISOString());
  assert.equal(iso(fromTimestamp.lastPrintedAt), new Date(now).toISOString());

  const fromMillis = mapped(raw({ createdAt: now - 3 * DAY, updatedAt: now - 2 * DAY, printedAt: now - DAY, lastPrintedAt: now }));
  assert.equal(iso(fromMillis.createdAt), new Date(now - 3 * DAY).toISOString());
  assert.equal(iso(fromMillis.updatedAt), new Date(now - 2 * DAY).toISOString());
  assert.equal(iso(fromMillis.printedAt), new Date(now - DAY).toISOString());
  assert.equal(iso(fromMillis.lastPrintedAt), new Date(now).toISOString());

  for (const missing of [null, undefined]) {
    const record = mapped(raw({ createdAt: missing, updatedAt: missing, printedAt: missing, lastPrintedAt: missing }));
    assert.equal(record.createdAt.getTime(), 0, `createdAt ${String(missing)} keeps the epoch-0 fallback`);
    assert.equal(record.updatedAt.getTime(), 0);
    assert.equal(record.printedAt, null, `printedAt ${String(missing)} stays null`);
    assert.equal(record.lastPrintedAt, null);
  }
  for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const record = mapped(raw({ createdAt: invalid, updatedAt: invalid }));
    assert.equal(record.createdAt.getTime(), 0, `createdAt ${invalid} keeps the epoch-0 fallback`);
    assert.equal(record.updatedAt.getTime(), 0, `updatedAt ${invalid} keeps the epoch-0 fallback`);
  }
  const unsupported = mapped(raw({ updatedAt: "2026-11-17T00:00:00.000Z" }));
  assert.equal(unsupported.updatedAt.getTime(), 0, "non-number, non-Timestamp values keep the existing fallback");

  // API-shaped records through the real history filter.
  const apiRecord = (id: string, dates: Record<string, number | null>) => mapWorkoutSessionRecord(id, raw({ status: "printed", ...dates }) as never);
  const at = (days: number) => ({ createdAt: now - days * DAY, updatedAt: now - days * DAY, printedAt: now - days * DAY, lastPrintedAt: now - days * DAY });
  const recent = apiRecord("recent", at(5)); const twoMonths = apiRecord("two-months", at(60)); const old = apiRecord("old", at(200));
  const ids = (period: "month" | "quarter" | "all") => filterWorkoutHistory([old, twoMonths, recent], { period, search: "" }).map((item) => item.sessionId);
  assert.deepEqual(ids("month"), ["recent"], "last 1 month shows the recent API record");
  assert.deepEqual(ids("quarter"), ["recent", "two-months"], "last 3 months");
  assert.deepEqual(ids("all"), ["recent", "two-months", "old"], "all records, newest first");

  // History date priority: lastPrintedAt → printedAt → updatedAt.
  const reprinted = apiRecord("reprinted", { updatedAt: now - 100 * DAY, printedAt: now - 90 * DAY, lastPrintedAt: now - 2 * DAY });
  assert.equal(workoutHistoryDate(reprinted).getTime(), now - 2 * DAY);
  const printedOnce = apiRecord("printed-once", { updatedAt: now - 100 * DAY, printedAt: now - 3 * DAY, lastPrintedAt: null });
  assert.equal(workoutHistoryDate(printedOnce).getTime(), now - 3 * DAY);
  const notPrinted = apiRecord("not-printed", { updatedAt: now - 4 * DAY, printedAt: null, lastPrintedAt: null });
  assert.equal(workoutHistoryDate(notPrinted).getTime(), now - 4 * DAY);
  assert.deepEqual(filterWorkoutHistory([reprinted], { period: "month", search: "" }).map((item) => item.sessionId), ["reprinted"], "a recent reprint keeps an older session in the last month");
};

verifyDates();
void verifyLiveManualShape().then(() => console.log("Firestore workout session mapping checks: PASS"));
