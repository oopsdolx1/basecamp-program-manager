import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { routeBuilder } from "../src/app/routeBuilder";
import { routes } from "../src/app/routes";
import { WorkoutPrintTemplateV1 } from "../src/features/printing/components/WorkoutPrintTemplateV1/WorkoutPrintTemplateV1";
import { PRINT_EXERCISE_ROW_COUNT, PRINT_SET_COLUMN_COUNT } from "../src/features/printing/constants/print.constants";
import { createSelfContainedPrintHtml } from "../src/features/printing/gateways/printArtifactFactory";
import { createBlankWorkoutPrintDocument } from "../src/features/printing/mappers/workoutPrintMapper";
import type { WorkoutPrintDocument } from "../src/features/printing/types/print.types";

const read = (path: string): string => readFileSync(path, "utf8");
const render = (document: WorkoutPrintDocument): string => renderToStaticMarkup(React.createElement(WorkoutPrintTemplateV1, { document }));
const count = (markup: string, pattern: RegExp): number => (markup.match(pattern) ?? []).length;

// Case 1: the history page shows the button in both the member-search view and a member's record view.
const historyPage = read("src/features/workout-sessions/pages/WorkoutSessionsPage.tsx");
assert.match(historyPage, />빈 운동일지 출력<\/Button>/);
assert.equal(count(historyPage, /<BlankWorkoutLogPrintButton onClick=\{openBlankWorkoutLog\}\/>/g), 2, "button is shown with and without a selected member");
assert.match(historyPage, /variant="outlined">빈 운동일지 출력/, "button uses the existing outlined gold style");

// Case 2: clicking the button enters the A5 print preview built on the existing artifact pipeline.
assert.equal(routeBuilder.blankWorkoutLogPrint(), "/program-manager/print/blank-workout-log");
assert.equal(routes.blankWorkoutLogPrint, routeBuilder.blankWorkoutLogPrint());
assert.match(historyPage, /openBlankWorkoutLog=\(\)=>navigate\(routeBuilder\.blankWorkoutLogPrint\(\)\)/);
assert.match(read("src/app/AppRouter.tsx"), /<Route path=\{routes\.blankWorkoutLogPrint\} element=\{<BlankWorkoutLogPrintPage \/>\} \/>/);
const blankPage = read("src/features/printing/pages/BlankWorkoutLogPrintPage.tsx");
for (const reused of ["WorkoutPrintTemplateV1", "createRenderedPrintArtifactFactory", "createPrintArtifactPreview", "fetchVisualPdfPreview", "PdfCanvasPreview", "createArtifactPrintAdapter", "configuredPrintAgentEndpoint", "isPrintDispatchReady", "\"../styles/print.css\""]) {
  assert.ok(blankPage.includes(reused), `blank print reuses the existing pipeline: ${reused}`);
}
assert.doesNotMatch(blankPage, /fetch\(|child_process|Sumatra|window\.print/, "no separate printing path");

const blank = createBlankWorkoutPrintDocument(new Date("2026-11-17T09:00:00.000Z"));
assert.equal(blank.kind, "blank-workout-log");
assert.equal(blank.format, "A5-landscape");
assert.equal(blank.templateKey, "basecamp-workout-log-v1");
const blankMarkup = render(blank);

// Case 3: exactly eight exercise rows.
assert.equal(PRINT_EXERCISE_ROW_COUNT, 8);
assert.equal(blank.rows.length, 8);
assert.ok(blank.rows.every((row, index) => row.isBlank && row.order === index + 1 && row.exerciseName === ""));
assert.equal(count(blankMarkup, /class="exercise-row /g), 8);
for (let order = 1; order <= 8; order += 1) assert.ok(blankMarkup.includes(`<div class="exercise-title">${order}.</div>`), `row ${order} is numbered for handwriting`);

// Case 4: every row has SET 1-5, exactly five columns.
assert.equal(PRINT_SET_COLUMN_COUNT, 5);
assert.equal(blank.layout.setLayout, "five-set");
assert.equal(count(blankMarkup, /class="set-header-cell"/g), 5);
for (let set = 1; set <= 5; set += 1) assert.ok(blankMarkup.includes(`SET ${set}`));
assert.equal(count(blankMarkup, /class="set-cell"/g), 8 * 5);
assert.equal(count(blankMarkup, /class="exercise-row five-set-row"/g), 8);
assert.doesNotMatch(blankMarkup, /exercise-point-cell|운동 포인트/);
// Existing A5 template structure is kept.
for (const kept of ["a5-workout-document", "BASECAMP", "회원명 :", "운동일 :", "프로그램 :", "[운동부위]", "시작시간_", "종료시간_", "유산소_", "운동종목", "Kg", "횟수", "수축", "BASECAMP CONDITION LAB", "--a5-binding-safe-area:14mm", "--a5-exercise-row-count:8"]) assert.ok(blankMarkup.includes(kept), `keeps ${kept}`);
assert.match(blankMarkup, /data-layout-density="standard"/);

// Case 5: no member / program / exercise / session data in the document or markup.
assert.equal(blank.member.name, "");
assert.equal(blank.member.memberId, "");
assert.equal(blank.program.title, "");
assert.equal(blank.program.categoryLabel, "");
assert.deepEqual(blank.program.exercises, []);
assert.deepEqual(blank.bodyParts, []);
assert.equal(blank.workoutSessionId, "");
assert.ok(blank.rows.every((row) => row.configuredSets === null && !row.exerciseMemo && !row.memberWhy));
assert.ok(blankMarkup.includes("<strong>회원명 :</strong><span></span>"));
assert.ok(blankMarkup.includes("<strong>운동일 :</strong><span></span>"));
assert.ok(blankMarkup.includes("<strong>프로그램 :</strong><span></span>"));
assert.ok(blankMarkup.includes("<strong>[운동부위]</strong><span></span>"));
assert.doesNotMatch(blankMarkup, /2026|Workout Session|title="/);

// Case 6: no workout session / recommendation / print history is created.
for (const source of [blankPage, read("src/features/printing/mappers/workoutPrintMapper.ts")]) {
  assert.doesNotMatch(source, /workout-sessions|print-history|kiosk-session|kioskPrintRecord|recordKioskPrint|createWorkoutSession|recommendation|firestore|firebase/i);
}
assert.doesNotMatch(historyPage.match(/const BlankWorkoutLogPrintButton[^\n]*/)?.[0] ?? "", /createWorkoutSession|handoffKioskSession/);
assert.doesNotMatch(historyPage.match(/const openBlankWorkoutLog=[^;]*;/)?.[0] ?? "", /createWorkoutSession|handoffKioskSession|setRecords/);

// Case 7: the blank QR area needs no workoutSessionId and keeps only an empty placeholder.
assert.doesNotMatch(blankMarkup, /<svg/);
assert.ok(blankMarkup.includes('<div class="print-session-code print-session-code-empty" aria-hidden="true"></div>'));
assert.ok(createSelfContainedPrintHtml(blankMarkup, ".a5-workout-document{} @page{size:A5 landscape}").includes("a5-workout-document"), "blank markup is a valid print artifact source");

// Cases 8-9: a session document still renders the member, program, exercises and the session QR.
const exercises = [1, 2, 3].map((order) => ({ id: `row-${order}`, exerciseId: `exercise-${order}`, name: `운동 ${order}`, memo: "", order, configuredSets: 4, memberWhy: "" }));
const sessionDocument: WorkoutPrintDocument = {
  templateKey: "basecamp-workout-log-v1", templateVersion: 1, format: "A5-landscape",
  member: { memberId: "member-1" as WorkoutPrintDocument["member"]["memberId"], name: "회귀 테스트 회원" },
  workoutSessionId: "session-regression-1", bodyParts: ["등"],
  program: { programId: "program-1" as WorkoutPrintDocument["program"]["programId"], title: "회귀 프로그램", category: "CUSTOM", categoryLabel: "직접 구성", difficulty: "GENERAL", difficultyLabel: "일반", memo: "", exercises },
  printDate: new Date("2026-11-17T09:00:00.000Z"),
  layout: { density: "standard", exerciseCount: 3, minimumRowCount: 5, topBindingSafeAreaMm: 14, showExerciseMemo: true, setLayout: "four-set-with-note" },
  rows: [...exercises.map((exercise) => ({ order: exercise.order, exerciseName: exercise.name, exerciseMemo: exercise.memo, memberWhy: "", configuredSets: 4, isBlank: false })), ...[4, 5].map((order) => ({ order, exerciseName: "", exerciseMemo: "", memberWhy: "", configuredSets: null, isBlank: true }))],
};
const sessionMarkup = render(sessionDocument);
for (const expected of ["회귀 테스트 회원", "회귀 프로그램", "session-regression-1", "1. 운동 1", "3. 운동 3", "운동 포인트", "data-document-kind=\"workout-session\""]) assert.ok(sessionMarkup.includes(expected), `session print keeps ${expected}`);
assert.match(sessionMarkup, /<div class="print-session-code" aria-label="Workout Session session-regression-1"><svg/);
assert.equal(count(sessionMarkup, /class="set-header-cell"/g), 4);
assert.equal(count(sessionMarkup, /class="exercise-row /g), 5);
assert.equal(count(sessionMarkup, /<div class="exercise-title"><\/div>/g), 2, "trailing handwritten rows of a session print stay unnumbered");
assert.doesNotMatch(sessionMarkup, /print-session-code-empty/);
assert.match(read("src/features/printing/pages/PrintPreviewPage.tsx"), /submitPhysicalPrintAndPersist\(\{/, "session print still goes through the physical print + record path");

console.log("Blank workout log print: 8 rows x SET 1-5, no session data or QR, existing A5 pipeline, session print unchanged: PASS");
