import type { Unsubscribe } from "firebase/firestore";
import type { AppId } from "../../../types/brandedIds";
import type {
  PrintRequestQueryOptions,
  PrintRequestRecord,
} from "../domain/printRequest.types";

// Read-only since Phase 3-B: print records are created by the Condition Lab Kiosk API
// (POST /v1/kiosk/workout-sessions/{id}/prints). Browsers cannot write printHistory.
export interface PrintRequestRepository {
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
}
