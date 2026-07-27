import { useEffect, useMemo, useState } from "react";
import type { AppId } from "../../../types/brandedIds";
import type { Loadable } from "../../../types/common.types";
import type { ProgramCategory } from "../../programs/types/program.types";
import type { PrintRequestRecord } from "../domain/printRequest.types";
import { firestorePrintRequestRepository } from "../repositories/firestorePrintRequestRepository";
import { filterPrintRequests } from "../services/printRequestService";

export interface PrintHistoryFilters {
  search: string;
  category: ProgramCategory | "ALL";
  memberId?: string;
  programId?: string;
}

export const usePrintRequests = (appId: AppId, filters: PrintHistoryFilters) => {
  const [state, setState] = useState<Loadable<PrintRequestRecord[]>>({
    status: "loading",
    data: [],
  });

  useEffect(() => {
    setState({ status: "loading", data: [] });
    return firestorePrintRequestRepository.subscribeRecentRequests(
      {
        appId,
        memberId: filters.memberId,
        programId: filters.programId,
        category: filters.category,
        limit: 100,
      },
      (records) => setState({ status: "ready", data: records }),
      (message) =>
        setState({
          status: "error",
          data: [],
          message: `인쇄 요청 기록을 불러오지 못했습니다. (${message})`,
        }),
    );
  }, [appId, filters.category, filters.memberId, filters.programId]);

  const filtered = useMemo(() => filterPrintRequests(state.data, filters), [filters, state.data]);

  return { state, records: filtered };
};
