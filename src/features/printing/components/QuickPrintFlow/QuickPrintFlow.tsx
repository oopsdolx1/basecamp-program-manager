import PrintIcon from "@mui/icons-material/Print";
import { Box, Button, Card, CardActionArea, CardContent, Chip, Grid, Stack, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../../../../components/common/EmptyState";
import { ErrorState } from "../../../../components/common/ErrorState";
import { LoadingState } from "../../../../components/common/LoadingState";
import { SearchField } from "../../../../components/common/SearchField";
import { routeBuilder } from "../../../../app/routeBuilder";
import type { AppId } from "../../../../types/brandedIds";
import { useMembers } from "../../../members";
import type { MemberSelectionItem } from "../../../members";
import { filterMembers } from "../../../members/services/memberService";
import { getCategoryLabel, getDifficultyLabel, programCategories } from "../../../programs/config/programOptions";
import { usePrograms } from "../../../programs/hooks/usePrograms";
import type { Program, ProgramCategory } from "../../../programs/types/program.types";

type CategoryFilter = "ALL" | ProgramCategory;

interface QuickPrintFlowProps {
  appId: AppId;
}

const formatLastUsed = (date?: Date): string => {
  if (!date) return "사용 기록 없음";
  return `최근 사용 ${new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(date)}`;
};

export const QuickPrintFlow = ({ appId }: QuickPrintFlowProps): JSX.Element => {
  const navigate = useNavigate();
  const memberState = useMembers(appId);
  const { programState, programs } = usePrograms(appId);
  const [selectedMember, setSelectedMember] = useState<MemberSelectionItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("ALL");
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [memberQuery, setMemberQuery] = useState("");
  const [programQuery, setProgramQuery] = useState("");

  const members = useMemo(
    () => filterMembers(memberState.data.members, memberQuery),
    [memberQuery, memberState.data.members],
  );

  const visiblePrograms = useMemo(
    () =>
      programs
        .filter((program) => !program.isArchived)
        .filter((program) => (selectedCategory === "ALL" ? true : program.category === selectedCategory))
        .filter((program) => {
          const query = programQuery.trim().toLocaleLowerCase("ko-KR");
          if (!query) return true;
          return [program.title, getCategoryLabel(program.category), ...program.exercises.map((exercise) => exercise.name)]
            .join(" ")
            .toLocaleLowerCase("ko-KR")
            .includes(query);
        })
        .sort((left, right) => {
          if (left.favorite !== right.favorite) return left.favorite ? -1 : 1;
          const lastUsedDiff = (right.lastUsedAt?.getTime() ?? 0) - (left.lastUsedAt?.getTime() ?? 0);
          if (lastUsedDiff !== 0) return lastUsedDiff;
          const updatedDiff = right.updatedAt.getTime() - left.updatedAt.getTime();
          if (updatedDiff !== 0) return updatedDiff;
          return left.title.localeCompare(right.title, "ko-KR", { numeric: true });
        }),
    [programQuery, programs, selectedCategory],
  );

  const canPreview = Boolean(selectedMember && selectedProgram);

  const goPreview = () => {
    if (!selectedMember || !selectedProgram) return;
    navigate(routeBuilder.printPreview(selectedProgram.id, selectedMember.memberId));
  };

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h1">Quick Print</Typography>
        <Typography color="text.secondary">
          회원과 프로그램을 선택한 뒤 A5 운동 기록지를 출력합니다.
        </Typography>
      </Stack>

      <Grid container spacing={2.5}>
        <Grid item lg={3.5} md={4} xs={12}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h2">1. 회원</Typography>
                <SearchField label="회원 검색" value={memberQuery} onChange={setMemberQuery} />
                {memberState.status === "loading" ? <LoadingState /> : null}
                {memberState.status === "error" ? <ErrorState message={memberState.message} /> : null}
                {memberState.status === "ready" ? (
                  <Stack spacing={1} sx={{ maxHeight: 520, overflow: "auto" }}>
                    {members.map((member) => (
                      <CardActionArea
                        key={member.memberId}
                        onClick={() => setSelectedMember(member)}
                        sx={{
                          border: 1,
                          borderColor: selectedMember?.memberId === member.memberId ? "primary.main" : "divider",
                          borderRadius: 1,
                          p: 1.25,
                        }}
                      >
                        <Typography fontWeight={700}>{member.displayName}</Typography>
                        <Typography color="text.secondary" variant="body2">
                          {member.phone ? "전화번호 있음" : "전화번호 없음"}
                        </Typography>
                      </CardActionArea>
                    ))}
                  </Stack>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item lg={5} md={4.5} xs={12}>
          <Stack spacing={2}>
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h2">2. 카테고리</Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    <Chip
                      clickable
                      color={selectedCategory === "ALL" ? "primary" : "default"}
                      label="전체"
                      onClick={() => setSelectedCategory("ALL")}
                    />
                    {programCategories.map((category) => (
                      <Chip
                        clickable
                        color={selectedCategory === category.value ? "primary" : "default"}
                        key={category.value}
                        label={category.label}
                        onClick={() => setSelectedCategory(category.value)}
                      />
                    ))}
                  </Box>
                  <SearchField label="프로그램 또는 운동명 검색" value={programQuery} onChange={setProgramQuery} />
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h2">3. 프로그램</Typography>
                  {programState.status === "loading" ? <LoadingState /> : null}
                  {programState.status === "error" ? <ErrorState message={programState.message} /> : null}
                  {programState.status === "ready" && visiblePrograms.length === 0 ? (
                    <EmptyState title="선택 가능한 프로그램이 없습니다." />
                  ) : null}
                  <Stack spacing={1.25} sx={{ maxHeight: 520, overflow: "auto" }}>
                    {visiblePrograms.map((program) => (
                      <CardActionArea
                        key={program.id}
                        onClick={() => setSelectedProgram(program)}
                        sx={{
                          border: 1,
                          borderColor: selectedProgram?.id === program.id ? "primary.main" : "divider",
                          borderRadius: 1,
                          p: 1.5,
                        }}
                      >
                        <Stack spacing={0.75}>
                          <Typography fontWeight={800}>{program.title}</Typography>
                          <Stack direction="row" flexWrap="wrap" gap={0.75}>
                            <Chip label={getCategoryLabel(program.category)} size="small" />
                            <Chip label={getDifficultyLabel(program.difficulty)} size="small" variant="outlined" />
                            <Chip label={`${program.exercises.length}개 운동`} size="small" variant="outlined" />
                            <Chip label={`사용 ${program.usageCount}회`} size="small" variant="outlined" />
                            <Chip label={formatLastUsed(program.lastUsedAt)} size="small" variant="outlined" />
                            {program.favorite ? <Chip color="primary" label="즐겨찾기" size="small" /> : null}
                          </Stack>
                          <Typography color="text.secondary" variant="body2">
                            {program.exercises.map((exercise) => exercise.name).join(", ")}
                          </Typography>
                        </Stack>
                      </CardActionArea>
                    ))}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid item lg={3.5} md={3.5} xs={12}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h2">4. 확인</Typography>
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    회원
                  </Typography>
                  <Typography fontWeight={800}>{selectedMember?.displayName ?? "미선택"}</Typography>
                </Box>
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    프로그램
                  </Typography>
                  <Typography fontWeight={800}>{selectedProgram?.title ?? "미선택"}</Typography>
                </Box>
                {selectedProgram ? (
                  <Stack spacing={0.75}>
                    <Typography color="text.secondary" variant="body2">
                      {getCategoryLabel(selectedProgram.category)} · {getDifficultyLabel(selectedProgram.difficulty)}
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      사용 {selectedProgram.usageCount}회 · {formatLastUsed(selectedProgram.lastUsedAt)}
                    </Typography>
                    {selectedProgram.exercises.map((exercise) => (
                      <Typography key={exercise.id} variant="body2">
                        {exercise.order}. {exercise.name} · {exercise.sets}세트
                      </Typography>
                    ))}
                    {selectedProgram.memo ? (
                      <Typography color="text.secondary" variant="body2">
                        {selectedProgram.memo}
                      </Typography>
                    ) : null}
                  </Stack>
                ) : null}
                <Button
                  disabled={!canPreview}
                  fullWidth
                  startIcon={<PrintIcon />}
                  variant="contained"
                  onClick={goPreview}
                >
                  출력 미리보기
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
};
