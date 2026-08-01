import { List } from "@mui/material";
import { palette } from "../../../../theme/palette";
import { EmptyState } from "../../../../components/common/EmptyState";
import type { MemberSelectionItem } from "../../types/memberViewModel.types";
import { MemberListItem } from "../MemberListItem";

interface MemberListProps {
  members: MemberSelectionItem[];
  selectedMemberId: string | null;
  onSelect: (member: MemberSelectionItem) => void;
}

export const MemberList = ({ members, selectedMemberId, onSelect }: MemberListProps): JSX.Element => {
  if (members.length === 0) {
    return <EmptyState title="검색 결과가 없습니다." description="이름 또는 전화번호를 다시 확인해 주세요." />;
  }

  return (
    <List
      disablePadding
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: `${palette.radiusMd}px`,
        overflow: "hidden",
        bgcolor: palette.surfaceSection,
        boxShadow: palette.shadowCard,
      }}
    >
      {members.map((member) => (
        <MemberListItem
          key={member.memberId}
          member={member}
          selected={member.memberId === selectedMemberId}
          onSelect={onSelect}
        />
      ))}
    </List>
  );
};
