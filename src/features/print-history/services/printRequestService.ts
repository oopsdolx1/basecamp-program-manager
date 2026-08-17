import { ensureFirebaseAuth, getFirebaseAuth } from "../../../firebase/firebaseAuth";
import { normalizeText } from "../../../utils/normalizeText";
import type { AppId } from "../../../types/brandedIds";
import type { WorkoutPrintDocument } from "../../printing/types/print.types";
import { PrintRequestError } from "../domain/printRequest.errors";
import type { PrintRequestQueryOptions, PrintRequestRecord } from "../domain/printRequest.types";
import { printDocumentToRequestSnapshots } from "../mappers/printRequestMapper";
import { firestorePrintRequestRepository } from "../repositories/firestorePrintRequestRepository";

export const createPrintRequestFromDocument = async (
  appId: AppId,
  document: WorkoutPrintDocument,
  copy: number,
): Promise<PrintRequestRecord> => {
  await ensureFirebaseAuth();
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) {
    throw new PrintRequestError("인증된 사용자가 없어 인쇄 요청을 기록할 수 없습니다.");
  }

  const snapshots = printDocumentToRequestSnapshots(document);
  if (!snapshots.memberSnapshot.memberId || !snapshots.memberSnapshot.name.trim()) {
    throw new PrintRequestError("회원 snapshot이 올바르지 않습니다.");
  }
  if (!snapshots.programSnapshot.programId || !snapshots.programSnapshot.title.trim()) {
    throw new PrintRequestError("프로그램 snapshot이 올바르지 않습니다.");
  }

  return firestorePrintRequestRepository.createPrintRequest({
    appId,
    requestedBy: uid,
    workoutSessionId: document.workoutSessionId,
    printer: "browser-default",
    copy,
    ...snapshots,
  });
};

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
