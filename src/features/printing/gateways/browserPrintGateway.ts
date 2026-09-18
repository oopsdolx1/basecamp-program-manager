import type { WorkoutPrintDocument } from "../types/print.types";

export interface PrintRequest {
  jobId: string;
  document: WorkoutPrintDocument;
  copies?: number;
}

export type PrintSubmissionResult =
  | { status: "submitted" }
  | { status: "failed"; reason?: string };

export interface PrintAdapter {
  print: (request: PrintRequest) => Promise<PrintSubmissionResult>;
}

export interface BrowserPrintGateway extends PrintAdapter {}

export const browserPrintGateway: BrowserPrintGateway = {
  print: async (_request) => {
    window.print();
    return { status: "submitted" };
  },
};
