import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const template = readFileSync("src/features/printing/components/WorkoutPrintTemplateV1/WorkoutPrintTemplateV1.tsx", "utf8");
const css = readFileSync("src/features/printing/styles/print.css", "utf8");
const mapper = readFileSync("src/features/printing/mappers/workoutPrintMapper.ts", "utf8");

assert(template.includes("data-layout-density={document.layout.density}"));
assert(template.includes("--a5-binding-safe-area"));
assert(css.includes('.a5-workout-document[data-layout-density="standard"]'));
assert(css.includes("padding: var(--a5-binding-safe-area)"));
assert(css.includes("size: A5 landscape"));
assert(!mapper.includes("최대 8개까지만 출력"));
assert(!mapper.includes("slice(0, 7)") && !mapper.includes("slice(0, 8)") && !mapper.includes("slice(0, 9)"));
assert(template.includes("configuredSets"));
assert(template.includes("useFiveSetLayout"));
assert(template.includes("exercise-point-cell"));
assert(template.includes("kg / 횟수 / 수축"));
assert(template.includes("SET {setNumber}"));
assert(!template.includes("handwrite-grid"));
assert(!template.includes("print-memo-section"));
assert(mapper.includes("resolveA5WorkoutLayout(program.exercises.length)"));
assert(!/display:\s*none[^;]*exercise/u.test(css));
assert(css.includes("-webkit-line-clamp: 2"));
assert(css.includes("word-break: keep-all"));
assert(css.includes("grid-template-columns: 50mm minmax(34mm, 1.35fr) repeat(4"));
assert(!css.includes(".handwrite-grid span::after"));
console.log("A5 adaptive CSS checks: PASS");
