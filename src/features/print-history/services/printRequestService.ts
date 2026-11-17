import { normalizeText } from "../../../utils/normalizeText";
import type { AppId } from "../../../types/brandedIds";
import type { PrintRequestQueryOptions, PrintRequestRecord } from "../domain/printRequest.types";
import { firestorePrintRequestRepository } from "../repositories/firestorePrintRequestRepository";

export const filterPrintRequests = (
  records: PrintRequestRecord[],
  options: Pick<PrintRequestQueryOptions, "search" | "category" | "memberId" | "programId">,
): PrintRequestRecord[] => {
  const search = normalizeText(options.search ?? "");

  return records
    .filter((record) => (options.memberId ? record.memberId === options.memberId : true))
    .filter((record) => (options.programId ? record.programId === options.programId : true))
    .filter((record) =>
      options.category && options.category !== "ALL" ? record.programSnapshot.category === options.category : true,
    )
    .filter((record) => {
      if (!search) return true;
      return normalizeText(
        [
          record.memberSnapshot.name,
          record.programSnapshot.title,
          record.programSnapshot.categoryLabel,
          record.programSnapshot.difficultyLabel,
          ...record.programSnapshot.exercises.map((exercise) => exercise.name),
        ].join(" "),
      ).includes(search);
    });
};

export const getPrintRequestsByIds = (appId: AppId, ids: string[]): Promise<PrintRequestRecord[]> =>
  firestorePrintRequestRepository.getPrintRequests(appId, ids);
