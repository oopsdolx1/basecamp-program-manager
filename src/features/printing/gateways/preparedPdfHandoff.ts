export interface PreparedPdfHandoff {
  blob: Blob;
  blobUrl: string;
  file: File;
}

export interface PdfHandoffResult {
  status: "submitted" | "failed";
  reason?: string;
}

type NavigatorLike = Pick<Navigator, "canShare" | "share">;
type WindowLike = Pick<Window, "open" | "location">;

export const createPreparedPdfHandoff = (bytes: ArrayBuffer, filename: string): PreparedPdfHandoff => {
  const blob = new Blob([bytes], { type: "application/pdf" });
  return { blob, blobUrl: URL.createObjectURL(blob), file: new File([blob], filename, { type: "application/pdf" }) };
};

export const handoffPreparedPdf = async (prepared: PreparedPdfHandoff, preferShare: boolean, navigatorLike: NavigatorLike = navigator, windowLike: WindowLike = window): Promise<PdfHandoffResult> => {
  const files = [prepared.file];
  if (preferShare && navigatorLike.share && navigatorLike.canShare?.({ files })) {
    try {
      await navigatorLike.share({ files, title: "BaseCamp 운동일지" });
      return { status: "submitted" };
    } catch (error) {
      return { status: "failed", reason: error instanceof Error ? error.message : "pdf_share_failed" };
    }
  }
  const opened = windowLike.open(prepared.blobUrl, "_blank", "noopener,noreferrer");
  if (opened) return { status: "submitted" };
  windowLike.location.assign(prepared.blobUrl);
  return { status: "submitted" };
};
