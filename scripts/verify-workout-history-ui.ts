import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { routeBuilder } from "../src/app/routeBuilder";

const historyPage = readFileSync("src/features/workout-sessions/pages/WorkoutSessionsPage.tsx", "utf8");
const previewPage = readFileSync("src/features/printing/pages/PrintPreviewPage.tsx", "utf8");
const authorityResolver = readFileSync("src/features/printing/services/printPreviewAuthorityResolver.ts", "utf8");

assert.equal(
  routeBuilder.printPreviewSession("member-1", "manual-session-1", true, true),
  "/program-manager/print/session/manual-session-1?memberId=member-1&autoPrint=1&reprint=1",
  "reprint enters the existing session preview route with auto dispatch",
);
assert.match(historyPage, /이 운동기록 다시 출력/);
assert.match(historyPage, /reprintInFlight/);
assert.match(historyPage, /printPreviewSession\(selected\.memberId, selected\.sessionId, true, true\)/);
assert.match(historyPage, /\{categoryLabel\(record\)\} · \{record\.exercises\.length\}종목/);
assert.match(historyPage, /총 \$\{plannedSetCount\(selected\)\}세트/);
assert.doesNotMatch(historyPage, /기록 ID|StatusChip|출력 완료/);
assert.match(historyPage, /overflowY: "auto"/);
assert.match(previewPage, /const reprint = searchParams\.get\("reprint"\) === "1"/);
assert.match(previewPage, /autoPrintStarted\.current/);
assert.match(previewPage, /physicalPrintInFlight\.current/);
assert.match(previewPage, /출력하지 못했습니다\. 프린터 연결을 확인해 주세요\./);
assert.match(authorityResolver, /session\.prescription \? programFromSessionPrescription\(session\) : resolveLegacyProgram\(\)/);

console.log("Workout history UI and reprint checks: PASS");
