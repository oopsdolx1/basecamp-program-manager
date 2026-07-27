import { useMemo, useState } from "react";
import { filterMembers } from "../services/memberService";
import type { MemberSelectionItem } from "../types/memberViewModel.types";

export const useMemberSelection = (members: MemberSelectionItem[]) => {
  const [query, setQuery] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const filteredMembers = useMemo(() => filterMembers(members, query), [members, query]);
  const selectedMember = useMemo(
    () => members.find((member) => member.memberId === selectedMemberId) ?? null,
    [members, selectedMemberId],
  );

  return {
    query,
    setQuery,
    filteredMembers,
    selectedMember,
    selectMember: (member: MemberSelectionItem) => setSelectedMemberId(member.memberId),
  };
};
