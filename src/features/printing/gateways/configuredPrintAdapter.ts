import type { PrintAdapter } from "./browserPrintGateway";
import { browserPrintGateway } from "./browserPrintGateway";
import { resolvePrintRuntime, type PrintRuntime } from "./printRuntimeResolver";
import { userGesturePdfPrintAdapter } from "./userGesturePdfPrintAdapter";
import { createWindowsPrintAdapter } from "./windowsPrintAdapter";
export type { PrintRuntime } from "./printRuntimeResolver";
export const createConfiguredPrintAdapter = (runtime?: string): PrintAdapter => {
  const selected = runtime || "browser";
  if (selected === "browser") return browserPrintGateway;
  if (selected === "browser-user-gesture") return userGesturePdfPrintAdapter;
  if (selected === "windows-agent") return createWindowsPrintAdapter();
  throw new Error(`Unsupported VITE_PRINT_RUNTIME: ${selected}`);
};
export const configuredPrintAdapter = createConfiguredPrintAdapter(resolvePrintRuntime({ environmentRuntime: import.meta.env?.VITE_PRINT_RUNTIME }));
