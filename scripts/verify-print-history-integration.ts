import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { submitPhysicalPrintAndPersist } from "../src/features/printing/services/physicalPrintSubmissionService";

const index = JSON.parse(readFileSync("firestore.indexes.json", "utf8"));
const firebase = JSON.parse(readFileSync("firebase.json", "utf8"));
assert.equal(firebase.firestore.indexes, "firestore.indexes.json");
assert.deepEqual(index.indexes, [{ collectionGroup: "printHistory", queryScope: "COLLECTION", fields: [{ fieldPath: "isArchived", order: "ASCENDING" }, { fieldPath: "requestedAt", order: "DESCENDING" }] }]);

const page = readFileSync("src/features/workout-sessions/pages/WorkoutSessionsPage.tsx", "utf8");
assert.ok(page.includes('useState<"loading" | "ready" | "error">'));
assert.ok(page.includes("출력 이력을 불러오지 못했습니다."));
assert.ok(page.includes('historyState === "ready" && history.length === 0'));

const main = async (): Promise<void> => {
const events: string[] = [];
const saved = await submitPhysicalPrintAndPersist({
  submit: async () => { events.push("physical"); return { status: "submitted", printer: "Office Printer" }; },
  saveHistory: async (printer) => { events.push(`history:${printer}`); return { id: "history-1" }; },
  markSessionPrinted: async (id) => { events.push(`session:${id}`); },
});
assert.deepEqual(saved, { physical: "submitted", history: "saved", record: { id: "history-1" } });
assert.deepEqual(events, ["physical", "history:Office Printer", "session:history-1"]);

const historyFailureEvents: string[] = [];
const historyFailure = await submitPhysicalPrintAndPersist({
  submit: async () => { historyFailureEvents.push("physical"); return { status: "submitted", printer: "Office Printer" }; },
  saveHistory: async () => { historyFailureEvents.push("history"); throw new Error("firestore_unavailable"); },
  markSessionPrinted: async () => { historyFailureEvents.push("session"); },
});
assert.deepEqual(historyFailure, { physical: "submitted", history: "failed" });
assert.deepEqual(historyFailureEvents, ["physical", "history"]);

const failedEvents: string[] = [];
const failed = await submitPhysicalPrintAndPersist({
  submit: async () => { failedEvents.push("physical"); return { status: "failed", reason: "physical_printer_unavailable" }; },
  saveHistory: async () => { failedEvents.push("history"); return { id: "never" }; },
  markSessionPrinted: async () => { failedEvents.push("session"); },
});
assert.deepEqual(failed, { physical: "failed", reason: "physical_printer_unavailable" });
assert.deepEqual(failedEvents, ["physical"]);

console.log("Print history integration checks: PASS");
};

void main().catch((error) => { console.error(error); process.exitCode = 1; });
