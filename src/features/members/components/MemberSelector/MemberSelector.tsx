import { Card, CardContent, Grid, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { ErrorState } from "../../../../components/common/ErrorState";
import { LoadingState } from "../../../../components/common/LoadingState";
import { routeBuilder } from "../../../../app/routeBuilder";
import type { AppId } from "../../../../types/brandedIds";
import { useMemberSelection } from "../../hooks/useMemberSelection";
import { useMembers } from "../../hooks/useMembers";
import { MemberList } from "../MemberList";
import { MemberSearchField } from "../MemberSearchField";
import { SelectedMemberCard } from "../SelectedMemberCard";

interface MemberSelectorProps {
  appId: AppId;
}

export const MemberSelector = ({ appId }: MemberSelectorProps): JSX.Element => {
  const navigate = useNavigate();
  const memberState = useMembers(appId);
  const selection = useMemberSelection(memberState.data.members);
  const diagnostics = memberState.data.diagnostics;

  return (
    <Grid container spacing={3}>
      <Grid item md={8} xs={12}>
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Stack spacing={0.5}>
                <Typography variant="h2">회원 선택</Typography>
                <Typography color="text.secondary">
                  기존 Condition Lab profiles를 실시간으로 읽어 확인합니다.
                </Typography>
              </Stack>
              <MemberSearchField value={selection.query} onChange={selection.setQuery} />
              {memberState.status === "loading" ? <LoadingState /> : null}
              {memberState.status === "error" ? <ErrorState message={memberState.message} /> : null}
              {memberState.status === "ready" ? (
                <MemberList
                  members={selection.filteredMembers}
                  selectedMemberId={selection.selectedMember?.memberId ?? null}
                  onSelect={selection.selectMember}
                />
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      </Grid>
      <Grid item md={4} xs={12}>
        <Stack spacing={2}>
          <SelectedMemberCard
            member={selection.selectedMember}
            onSelectPrograms={() => navigate(routeBuilder.programs())}
          />
          <Card>
            <CardContent>
              <Stack spacing={0.75}>
                <Typography variant="h3">읽기 진단</Typography>
                <Typography color="text.secondary">전체 문서: {diagnostics.totalDocuments}</Typography>
                <Typography color="text.secondary">member 문서: {diagnostics.memberDocuments}</Typography>
                <Typography color="text.secondary">role 제외: {diagnostics.excludedByRole}</Typography>
                <Typography color="text.secondary">role 누락: {diagnostics.missingRole}</Typography>
                <Typography color="text.secondary">이름 누락: {diagnostics.missingName}</Typography>
                <Typography color="text.secondary">ID 불일치: {diagnostics.idMismatches}</Typography>
                <Typography color="text.secondary">contact fallback: {diagnostics.legacyContactFallbacks}</Typography>
                <Typography color="text.secondary">note fallback: {diagnostics.legacyNoteFallbacks}</Typography>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Grid>
    </Grid>
  );
};
