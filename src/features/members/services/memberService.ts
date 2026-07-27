import { normalizeDigits, normalizeText } from "../../../utils/normalizeText";
import type { MemberSelectionItem } from "../types/memberViewModel.types";

export const filterMembers = (
  members: MemberSelectionItem[],
  query: string,
): MemberSelectionItem[] => {
  const normalizedQuery = normalizeText(query);
  const digitQuery = normalizeDigits(query);

  if (!normalizedQuery && !digitQuery) {
    return members;
  }

  return members.filter((member) => {
    const textMatch = normalizedQuery ? member.searchText.includes(normalizedQuery) : false;
    const phoneMatch = digitQuery ? normalizeDigits(member.phone ?? "").includes(digitQuery) : false;
    return textMatch || phoneMatch;
  });
};

export const sortMembersByName = (members: MemberSelectionItem[]): MemberSelectionItem[] =>
  [...members].sort((left, right) =>
    left.displayName.localeCompare(right.displayName, "ko-KR", { numeric: true }),
  );
