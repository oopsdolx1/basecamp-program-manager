import assert from "node:assert/strict";
import { printRuntimeStorageKey, resolvePrintRuntime } from "../src/features/printing/gateways/printRuntimeResolver";

const createStorage = (initial?: string): Pick<Storage, "getItem" | "setItem"> & { value: string | null } => {
  let value = initial ?? null;
  return {
    get value() { return value; },
    set value(next: string | null) { value = next; },
    getItem: () => value,
    setItem: (_key, next) => { value = next; },
  };
};

const storage = createStorage();

assert.equal(resolvePrintRuntime({ search: "?printRuntime=browser-user-gesture", storage }), "browser-user-gesture");
assert.equal(storage.value, "browser-user-gesture");
assert.equal(resolvePrintRuntime({ search: "?printRuntime=windows-agent", storage }), "windows-agent");
assert.equal(storage.value, "windows-agent");
assert.equal(resolvePrintRuntime({ search: "?printRuntime=browser", storage }), "browser");
assert.equal(resolvePrintRuntime({ storage: createStorage("browser-user-gesture") }), "browser-user-gesture");
assert.equal(resolvePrintRuntime({ storage: createStorage("windows-agent") }), "windows-agent");
const overridden = createStorage("windows-agent");
assert.equal(resolvePrintRuntime({ search: "?printRuntime=browser-user-gesture", storage: overridden }), "browser-user-gesture");
assert.equal(overridden.value, "browser-user-gesture");
assert.equal(resolvePrintRuntime({ search: "?printRuntime=unknown", storage: createStorage("browser") }), "browser");
assert.equal(resolvePrintRuntime({ storage: createStorage("unknown") }), "browser");
assert.equal(resolvePrintRuntime({ storage: createStorage(), environmentRuntime: "windows-agent" }), "windows-agent");
assert.equal(resolvePrintRuntime({ storage: createStorage(), environmentRuntime: "unknown" }), "browser");
assert.equal(printRuntimeStorageKey, "basecamp.printRuntime");
console.log("Per-client print runtime selection checks: PASS");
