import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { Box, Chip, ListItemButton, ListItemText, Typography } from "@mui/material";
import type { MemberSelectionItem } from "../../types/memberViewModel.types";

interface MemberListItemProps {
  member: MemberSelectionItem;
  selected: boolean;
  onSelect: (member: MemberSelectionItem) => void;
}

export const MemberListItem = ({ member, selected, onSelect }: MemberListItemProps): JSX.Element => (
  <ListItemButton
    selected={selected}
    onClick={() => onSelect(member)}
    sx={{ borderBottom: 1, borderColor: "divider", gap: 2, py: 1.5 }}
  >
    {selected ? <CheckCircleIcon color="primary" /> : null}
    <ListItemText
      primary={<Typography fontWeight={700}>{member.displayName}</Typography>}
      secondary={member.phone ?? "전화번호 없음"}
    />
    <Box sx={{ display: "flex", gap: 0.75 }}>
      {member.status ? <Chip label={member.status} size="small" variant="outlined" /> : null}
      {member.centerId ? <Chip label="center" size="small" variant="outlined" /> : null}
    </Box>
  </ListItemButton>
);
