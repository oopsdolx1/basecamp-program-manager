import { filterMembers, sortMembersByName } from "../../members/services/memberService";
import type { MemberSelectionItem } from "../../members/types/memberViewModel.types";
import { filterMembersByInitial, type MemberInitialFilter } from "../../members/utils/koreanInitial";

/** UI-only filter contract for Quick Print's first step. */
export const filterQuickPrintMembers = (
  members: MemberSelectionItem[],
  query: string,
  initial: MemberInitialFilter | null,
): MemberSelectionItem[] => {
  if (query.trim()) return sortMembersByName(filterMembers(members, query));
  if (!initial) return [];
  return sortMembersByName(filterMembersByInitial(members, initial));
};
