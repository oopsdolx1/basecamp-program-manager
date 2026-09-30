export const printRuntimes = ["browser", "browser-user-gesture", "windows-agent"] as const;
export type PrintRuntime = typeof printRuntimes[number];

const storageKey = "basecamp.printRuntime";
const isPrintRuntime = (value: string | null | undefined): value is PrintRuntime => printRuntimes.includes(value as PrintRuntime);

export interface PrintRuntimeResolutionOptions {
  search?: string;
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  environmentRuntime?: string;
}

const browserStorage = (): Pick<Storage, "getItem" | "setItem"> | null => {
  if (typeof window === "undefined") return null;
  try { return window.localStorage; } catch { return null; }
};

export const resolvePrintRuntime = ({ search = typeof window === "undefined" ? "" : window.location.search, storage = browserStorage(), environmentRuntime }: PrintRuntimeResolutionOptions = {}): PrintRuntime => {
  const queryRuntime = new URLSearchParams(search).get("printRuntime");
  if (isPrintRuntime(queryRuntime)) {
    try { storage?.setItem(storageKey, queryRuntime); } catch { /* Storage is optional; query selection remains valid. */ }
    return queryRuntime;
  }
  let storedRuntime: string | null = null;
  try { storedRuntime = storage?.getItem(storageKey) ?? null; } catch { /* Fall through to the configured default. */ }
  if (isPrintRuntime(storedRuntime)) return storedRuntime;
  if (isPrintRuntime(environmentRuntime)) return environmentRuntime;
  return "browser";
};

export const printRuntimeStorageKey = storageKey;
