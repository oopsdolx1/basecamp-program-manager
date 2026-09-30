import type { PrintAdapter } from "./browserPrintGateway";
import { handoffPreparedPdf, type PdfHandoffResult, type PreparedPdfHandoff } from "./preparedPdfHandoff";

export interface UserGesturePdfPrintAdapter extends PrintAdapter {
  readonly requiresUserGesturePdfHandoff: true;
  handoffPdf: (prepared: PreparedPdfHandoff, preferShare?: boolean) => Promise<PdfHandoffResult>;
}

export const userGesturePdfPrintAdapter: UserGesturePdfPrintAdapter = {
  requiresUserGesturePdfHandoff: true,
  print: async () => ({ status: "failed", reason: "user_gesture_pdf_handoff_required" }),
  handoffPdf: (prepared, preferShare = true) => handoffPreparedPdf(prepared, preferShare),
};

export const isUserGesturePdfPrintAdapter = (adapter: PrintAdapter): adapter is UserGesturePdfPrintAdapter => "requiresUserGesturePdfHandoff" in adapter && adapter.requiresUserGesturePdfHandoff === true;
