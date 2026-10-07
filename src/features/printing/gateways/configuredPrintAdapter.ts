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
// Preview artifacts only exist on the Windows agent. A browser runtime can still
// produce one while previewing, so route that artifact back to its owning agent
// instead of asking the browser gateway to reject it.
export const createArtifactPrintAdapter = (runtime: PrintRuntime, hasArtifact: boolean): PrintAdapter =>
  runtime === "browser" && hasArtifact ? createWindowsPrintAdapter() : createConfiguredPrintAdapter(runtime);
export const configuredPrintRuntime = resolvePrintRuntime({ environmentRuntime: import.meta.env?.VITE_PRINT_RUNTIME });
export const configuredPrintAdapter = createConfiguredPrintAdapter(configuredPrintRuntime);
