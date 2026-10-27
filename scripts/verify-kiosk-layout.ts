import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string): string => readFileSync(path, "utf8");
const appLayout = read("src/components/layout/AppLayout/AppLayout.tsx");
const flow = read("src/features/printing/components/QuickPrintFlow/QuickPrintFlow.tsx");
const printPreview = read("src/features/printing/pages/PrintPreviewPage.tsx");
const picker = read("src/features/programs/components/ExercisePicker/ExercisePicker.tsx");
const history = read("src/features/workout-sessions/pages/WorkoutSessionsPage.tsx");
const welcome = flow.slice(flow.indexOf("const KioskWelcomeScreen"), flow.indexOf("const ConditionChoiceLabel"));

assert.match(appLayout, /location\.pathname === "\/program-manager\/print" \|\| location\.pathname\.startsWith\("\/program-manager\/workout-sessions"\)/);
assert.match(appLayout, /height: "100dvh"/);
assert.match(appLayout, /flex: "1 1 auto", minHeight: 0/);
assert.match(appLayout, /overflowY: isFixedHeightKioskRoute \? "hidden" : "auto"/);

assert.match(flow, /alignItems="center" justifyContent="center" spacing=\{\{ md: 4, xs: 3 \}\}/);
assert.match(flow, /height: "100%", minHeight: 0, overflow: "hidden"/);
assert.match(flow, /maxHeight: \{ md: "32vh", xs: "36vh" \}, overflowY: "auto"/);
assert.match(flow, /overflowY: \{ md: "auto", xs: "visible" \}/);
assert.doesNotMatch(flow, /translateY\(7vh\)|pt: 10|height: 960/);
assert.match(welcome, /display: "flex", flexDirection: "column"/);
assert.match(welcome, /justifyContent: "center"/);
assert.match(welcome, /radial-gradient/);
assert.match(welcome, /borderRadius: "50%"/);
assert.match(welcome, /pointerEvents: "none"/);
assert.match(welcome, /프로그램 시작/);
assert.match(welcome, /이전 운동 기록 보기/);
assert.match(welcome, /linear-gradient\(135deg, #F2D56B 0%, #DDB84A 100%\)/);
assert.match(welcome, /minHeight: \{ md: 120, xs: 100 \}/);
assert.match(flow, /welcomeCopyOptions = \[/);
assert.match(welcome, /height: \{ md: 132, xs: 86 \}/);
assert.match(welcome, /WebkitLineClamp: 2/);
assert.doesNotMatch(welcome, /whiteSpace: "nowrap"/);
assert.match(welcome, /whiteSpace: "normal"/);
assert.match(welcome, /wordBreak: "keep-all"/);
assert.match(welcome, /overflowWrap: "normal"/);
assert.doesNotMatch(welcome, /BASECAMP PROGRAM MANAGER/);
assert.doesNotMatch(welcome, /translateY/);

assert.match(flow, /currentStep === 5/);
assert.match(flow, /height: "100%", justifyContent: "center", minHeight: 0/);
assert.match(flow, /maxHeight: \{ md: 290, xs: 260 \}, overflowY: "auto"/);
assert.match(flow, /Grid item md=\{4\} xs=\{12\}/);
assert.match(flow, /Grid item md=\{8\} xs=\{12\}/);
assert.doesNotMatch(flow, /Grid container spacing=\{2\}><Grid item md=\{6\} xs=\{12\}><Stack spacing=\{1\}><Typography fontWeight=\{900\}>확인 사항/);
assert.match(flow, /<Stack spacing=\{2\}><Stack spacing=\{1\}><Typography fontWeight=\{900\}>확인 사항/);
assert.match(flow, /border: 1/);
assert.doesNotMatch(flow, /border: selected \? 2/);
assert.match(flow, /position: "relative"/);
assert.match(flow, /position: "absolute"/);
assert.match(flow, /pointerEvents: "none"/);
const alcoholSection = flow.slice(flow.indexOf('title="음주 여부"'), flow.indexOf("오늘 상태 요약"));
assert.match(alcoholSection, /variant="outlined"/);
assert.match(alcoholSection, /position: "absolute"/);
assert.match(alcoholSection, /opacity: selected \? 1 : 0/);
assert.doesNotMatch(alcoholSection, /selected \? <CheckCircleIcon/);

assert.match(printPreview, /height: "100%"/);
assert.match(printPreview, /minHeight: 0/);
assert.match(printPreview, /overflow: "hidden"/);
assert.doesNotMatch(printPreview, /minHeight: "100vh"/);

assert.match(picker, /height: \{ md: "min\(1280px, 74vh\)", xs: "100dvh" \}/);
assert.match(picker, /overflow: "hidden"/);
assert.match(picker, /overflowY: "auto"/);
assert.match(picker, /borderTop: 1/);

assert.match(history, /display: "flex", height: "100%", minHeight: 0, overflow: "hidden"/);
assert.match(history, /justifyContent="center"/);
assert.match(history, /display: "flex", height: "100%", minHeight: 0, overflow: "hidden"/);
assert.match(history, /overflowY: "auto"/);
assert.doesNotMatch(history, /translateY\((?:[2-9]|\d{2,})|paddingTop|marginTop/);

console.log("Kiosk layout structure checks: PASS");
