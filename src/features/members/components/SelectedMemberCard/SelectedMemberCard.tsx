import PersonIcon from "@mui/icons-material/Person";
import { Button, Card, CardContent, Stack, Typography } from "@mui/material";
import type { MemberSelectionItem } from "../../types/memberViewModel.types";

interface SelectedMemberCardProps {
  member: MemberSelectionItem | null;
  onSelectPrograms?: () => void;
}

export const SelectedMemberCard = ({ member, onSelectPrograms }: SelectedMemberCardProps): JSX.Element => (
  <Card>
    <CardContent>
      <Stack spacing={2}>
        <Stack alignItems="center" direction="row" spacing={1}>
          <PersonIcon color="primary" />
          <Typography variant="h3">선택 회원</Typography>
        </Stack>
        {member ? (
          <Stack spacing={0.75}>
            <Typography fontWeight={700}>{member.displayName}</Typography>
            <Typography color="text.secondary">{member.phone ?? "전화번호 없음"}</Typography>
            <Typography color="text.secondary">문서 ID: {member.memberId}</Typography>
          </Stack>
        ) : (
          <Typography color="text.secondary">왼쪽 목록에서 회원을 선택해 주세요.</Typography>
        )}
        <Button disabled={!member} fullWidth variant="contained" onClick={onSelectPrograms}>
          운동 프로그램 선택
        </Button>
      </Stack>
    </CardContent>
  </Card>
);
