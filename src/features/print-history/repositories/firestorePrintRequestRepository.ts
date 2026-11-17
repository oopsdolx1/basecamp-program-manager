import type { Unsubscribe } from "firebase/firestore";
import { getDefaultKioskMemberSessionRuntime } from "../../kiosk-session/defaultKioskMemberSession";
import { withKioskMemberSession } from "../../kiosk-session/kioskSessionRenewal";
import type { PrintRequestQueryOptions } from "../domain/printRequest.types";
import { mapPrintRequestDocument } from "../mappers/printRequestMapper";
import type { PrintRequestRepository } from "./printRequestRepository.interface";

// Kiosks read only the active member's projected server result. There is no
// Firestore Client SDK fallback and therefore no cross-member cache.
const readFor = async (memberId: string, limit = 100) => {
  const runtime = getDefaultKioskMemberSessionRuntime();
  if (!runtime) throw new Error("키오스크 API가 설정되지 않았습니다.");
  const { prints } = await withKioskMemberSession(runtime.sessions, memberId, (token) => runtime.client.readPrintHistory(token, limit));
  return prints.map((item) => mapPrintRequestDocument(String(item.id ?? ""), item));
};

export const firestorePrintRequestRepository: PrintRequestRepository = {
  async getPrintRequests(appId, ids) {
    const memberId = getDefaultKioskMemberSessionRuntime()?.sessions.inspect().selectedMemberId;
    if (!memberId || !ids.length) return [];
    return (await readFor(memberId, 100)).filter((record) => ids.includes(record.id));
  },

  subscribeRecentRequests(options, callback, onError) {
    // The endpoint is member-scoped; a direct URL without a selected member fails closed.
    const memberId = options.memberId ?? getDefaultKioskMemberSessionRuntime()?.sessions.inspect().selectedMemberId;
    let cancelled = false;
    if (!memberId) { queueMicrotask(() => onError("KIOSK_SESSION_REQUIRED")); return () => { cancelled = true; }; }
    void readFor(memberId, options.limit ?? 100).then((records) => { if (!cancelled) callback(records); }, (error: unknown) => { if (!cancelled) onError(error instanceof Error ? error.message : "read_failed"); });
    return () => { cancelled = true; };
  },

  subscribeMemberRequests(memberId, options, callback, onError) {
    return firestorePrintRequestRepository.subscribeRecentRequests({ ...options, memberId }, callback, onError);
  },

  subscribeProgramRequests(programId, options, callback, onError) {
    return firestorePrintRequestRepository.subscribeRecentRequests({ ...options, programId }, callback, onError);
  },
};
