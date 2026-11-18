import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const programs = read("src/features/programs/repositories/programRepository.ts");
const runtime = read("src/shared-knowledge/programManagerRuntime.ts");
const flow = read("src/features/printing/components/QuickPrintFlow/QuickPrintFlow.tsx");
const preview = read("src/features/printing/hooks/usePrintPreview.ts");

for (const source of [programs, runtime]) {
  assert.match(source, /VITE_BASECAMP_API_BASE_URL/);
  assert.match(source, /authorization: `Bearer \$\{token\}`/);
  assert.match(source, /KioskApiError/);
  assert.doesNotMatch(source, /getFirestore|collection\(|getDoc|getDocs|onSnapshot|setDoc|updateDoc/);
}
assert.match(programs, /\/v1\/kiosk\/programs/);
assert.match(runtime, /\/v1\/kiosk\/shared-knowledge-runtime/);
assert.match(programs, /!response\.ok.*KioskApiError/s);
assert.match(runtime, /!response\.ok.*KioskApiError/s);
assert.match(flow, /usePrograms\(appId\)/);
assert.match(preview, /programRepository\.getProgram/);
assert.doesNotMatch(programs, /firebase\/firestore/);
console.log("Kiosk API-only contract: PASS (success/auth/network/5xx fail closed; no Firestore fallback)");
