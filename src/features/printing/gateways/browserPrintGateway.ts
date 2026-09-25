import type { WorkoutPrintDocument } from "../types/print.types";

export interface PrintRequest {
  jobId: string;
  document: WorkoutPrintDocument;
  copies?: number;
  artifactId?: string;
}

export type PrintSubmissionResult =
  | { status: "submitted" }
  | { status: "failed"; reason?: string };

export interface PrintAdapter {
  print: (request: PrintRequest) => Promise<PrintSubmissionResult>;
}

export interface BrowserPrintGateway extends PrintAdapter {}

export const browserPrintGateway: BrowserPrintGateway = {
  print: async (request) => {
    if (request.artifactId) return { status: "failed", reason: "preview_artifact_requires_windows_agent" };
    window.print();
    return { status: "submitted" };
  },
};
