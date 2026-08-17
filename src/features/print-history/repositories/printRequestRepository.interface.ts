import type { Unsubscribe } from "firebase/firestore";
import type { AppId } from "../../../types/brandedIds";
import type {
  CreatePrintRequestInput,
  PrintRequestQueryOptions,
  PrintRequestRecord,
} from "../domain/printRequest.types";

export interface PrintRequestRepository {
  createPrintRequest: (input: CreatePrintRequestInput) => Promise<PrintRequestRecord>;
  getPrintRequests: (appId: AppId, ids: string[]) => Promise<PrintRequestRecord[]>;
  subscribeRecentRequests: (
    options: PrintRequestQueryOptions,
    callback: (records: PrintRequestRecord[]) => void,
    onError: (message: string) => void,
  ) => Unsubscribe;
  subscribeMemberRequests: (
    memberId: string,
    options: PrintRequestQueryOptions,
    callback: (records: PrintRequestRecord[]) => void,
    onError: (message: string) => void,
  ) => Unsubscribe;
  subscribeProgramRequests: (
    programId: string,
    options: PrintRequestQueryOptions,
    callback: (records: PrintRequestRecord[]) => void,
    onError: (message: string) => void,
  ) => Unsubscribe;
  archivePrintRequest: (appId: AppId, id: string) => Promise<void>;
}
