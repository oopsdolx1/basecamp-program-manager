import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string): string => readFileSync(path, "utf8");
const appLayout = read("src/components/layout/AppLayout/AppLayout.tsx");
const flow = read("src/features/printing/components/QuickPrintFlow/QuickPrintFlow.tsx");
const picker = read("src/features/programs/components/ExercisePicker/ExercisePicker.tsx");
const history = read("src/features/workout-sessions/pages/WorkoutSessionsPage.tsx");

assert.match(appLayout, /location\.pathname === "\/program-manager\/print" \|\| location\.pathname\.startsWith\("\/program-manager\/workout-sessions"\)/);
assert.match(appLayout, /height: "100dvh"/);
assert.match(appLayout, /flex: "1 1 auto", minHeight: 0/);
assert.match(appLayout, /overflowY: isFixedHeightKioskRoute \? "hidden" : "auto"/);

assert.match(flow, /alignItems="center" justifyContent="center" spacing=\{\{ md: 4, xs: 3 \}\}/);
assert.match(flow, /height: "100%", minHeight: 0, overflow: "hidden"/);
assert.match(flow, /maxHeight: \{ md: "32vh", xs: "36vh" \}, overflowY: "auto"/);
assert.match(flow, /overflowY: \{ md: "auto", xs: "visible" \}/);
assert.doesNotMatch(flow, /translateY\(7vh\)|pt: 10|height: 960/);

assert.match(picker, /height: \{ md: "min\(1280px, 74vh\)", xs: "100dvh" \}/);
assert.match(picker, /overflow: "hidden"/);
assert.match(picker, /overflowY: "auto"/);
assert.match(picker, /borderTop: 1/);

assert.match(history, /display: "flex", height: "100%", minHeight: 0, overflow: "hidden"/);
assert.match(history, /justifyContent="center"/);
assert.match(history, /maxHeight: \{ lg: "calc\(100dvh - 300px\)" \}, overflowY: \{ lg: "auto" \}/);
assert.doesNotMatch(history, /translateY\((?:[2-9]|\d{2,})|paddingTop|marginTop/);

console.log("Kiosk layout structure checks: PASS");
