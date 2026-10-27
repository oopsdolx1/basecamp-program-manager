import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filterWorkoutHistory, isRecordedWorkoutSession, workoutHistoryDate } from "../src/features/workout-sessions/services/workoutSessionHistoryService";
import type { WorkoutSessionRecord } from "../src/features/workout-sessions/domain/workoutSession.types";

const session = (status: WorkoutSessionRecord["status"], date: string, id: string): WorkoutSessionRecord => ({
  sessionId: id,
  schemaVersion: 1,
  memberId: "member-1",
  source: { type: "manual" },
  trainerId: "trainer-1",
  status,
  exerciseIds: ["squat"],
  memberSnapshot: { name: "김회원" },
  programSnapshot: { title: "직접 구성 운동" },
  exercises: [{ exerciseId: "squat", programExerciseId: "squat", name: "스쿼트", order: 1, plannedSets: 3 }],
  prescription: { source: { type: "manual" }, sourceProgramName: "직접 구성 운동", exercises: [] },
  print: { format: "A5-portrait", templateKey: "basecamp-workout-log-v1", templateVersion: 1, printHistoryId: null, historyIds: [], copyCount: 1 },
  createdAt: new Date(date),
  updatedAt: new Date(date),
  printedAt: status === "created" ? null : new Date(date),
  lastPrintedAt: status === "created" ? null : new Date(date),
});

const draft = session("created", "2026-10-27T08:00:00Z", "draft");
const printed = session("printed", "2026-10-20T08:00:00Z", "printed");
const confirmed = session("confirmed", "2026-08-20T08:00:00Z", "confirmed");
const programRecord: WorkoutSessionRecord = {
  ...confirmed,
  sessionId: "program",
  programId: "program-1",
  source: { type: "program", programId: "program-1" },
  programSnapshot: { title: "등 프로그램" },
  prescription: { source: { type: "program", programId: "program-1" }, sourceProgramId: "program-1", sourceProgramName: "등 프로그램", exercises: [] },
};

assert.equal(isRecordedWorkoutSession(draft), false, "preview-created drafts are not workout history");
assert.equal(isRecordedWorkoutSession(printed), true, "physically printed sessions are workout history");
assert.equal(workoutHistoryDate(printed).toISOString(), "2026-10-20T08:00:00.000Z");
assert.deepEqual(
  filterWorkoutHistory([draft, confirmed, printed], { period: "month", search: "김회원", now: new Date("2026-10-27T12:00:00Z") }).map(({ sessionId }) => sessionId),
  ["printed"],
  "the kiosk view excludes drafts and applies its date range to saved workout records",
);
assert.deepEqual(
  filterWorkoutHistory([printed, confirmed, programRecord], { period: "all", search: "", now: new Date("2026-10-27T12:00:00Z") }).map(({ sessionId }) => sessionId),
  ["printed", "confirmed", "program"],
  "manual and program records remain in the same canonical session history",
);
const pageSource = readFileSync("src/features/workout-sessions/pages/WorkoutSessionsPage.tsx", "utf8");
assert.doesNotMatch(pageSource, /print-history|Print History|getPrintRequestsByIds/, "the kiosk history page does not query Print Request history");
console.log("Workout history checks: PASS");
