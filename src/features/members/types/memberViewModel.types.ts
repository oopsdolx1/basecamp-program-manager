import type { ProfileId } from "../../../types/brandedIds";

export interface MemberSelectionItem {
  memberId: ProfileId;
  displayName: string;
  phone?: string;
  status?: string;
  centerId?: string;
  trainerId?: string;
  searchText: string;
}

export interface MemberReadDiagnostics {
  totalDocuments: number;
  memberDocuments: number;
  excludedByRole: number;
  missingRole: number;
  missingName: number;
  idMismatches: number;
  legacyContactFallbacks: number;
  legacyNoteFallbacks: number;
}
