import type { WorkoutPrintDocument } from "../types/print.types";

export interface PrintRequest {
  jobId: string;
  document: WorkoutPrintDocument;
  copies?: number;
  artifactId?: string;
}

export type PrintSubmissionResult =
  | { status: "submitted"; printer?: string }
  | { status: "failed"; reason?: string };

export interface PrintAdapter {
  print: (request: PrintRequest) => Promise<PrintSubmissionResult>;
}

export interface BrowserPrintGateway extends PrintAdapter {}

export const browserPrintGateway: BrowserPrintGateway = {
  // Browser dialogs cannot satisfy unattended physical printing.  The web app
  // must use the local Windows agent for a physical print submission.
  print: async () => ({ status: "failed", reason: "windows_print_agent_required" }),
};
