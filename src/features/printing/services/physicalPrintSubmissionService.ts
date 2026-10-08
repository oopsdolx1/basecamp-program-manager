import type { PrintSubmissionResult } from "../gateways/browserPrintGateway";

export type PhysicalPrintPersistenceResult<TRecord> =
  | { physical: "failed"; reason?: string }
  | { physical: "submitted"; history: "saved"; record: TRecord }
  | { physical: "submitted"; history: "failed" };

// The physical action always happens first. Persistence failures are reported
// separately and never cause a second submission.
export const submitPhysicalPrintAndPersist = async <TRecord extends { id: string }>({
  submit,
  saveHistory,
  markSessionPrinted,
  onPhysicalSubmitted,
}: {
  submit: () => Promise<PrintSubmissionResult>;
  saveHistory: (printer: string) => Promise<TRecord | null>;
  markSessionPrinted: (printHistoryId: string) => Promise<void>;
  onPhysicalSubmitted?: () => void;
}): Promise<PhysicalPrintPersistenceResult<TRecord>> => {
  const physical = await submit();
  if (physical.status === "failed") return { physical: "failed", reason: physical.reason };
  onPhysicalSubmitted?.();
  try {
    const record = await saveHistory(physical.printer ?? "unknown");
    if (!record) throw new Error("print_history_write_failed");
    await markSessionPrinted(record.id);
    return { physical: "submitted", history: "saved", record };
  } catch {
    return { physical: "submitted", history: "failed" };
  }
};
