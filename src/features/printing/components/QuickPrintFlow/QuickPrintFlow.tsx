import DescriptionIcon from "@mui/icons-material/Description";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import PersonIcon from "@mui/icons-material/Person";
import PrintIcon from "@mui/icons-material/Print";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import { Alert, Box, Button, Card, CardActionArea, CardContent, Chip, Grid, Stack, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(date);
};

const stepSx = (active: boolean) => ({
  alignItems: "center",
  border: 1,
  borderColor: active ? "primary.main" : "divider",
  borderRadius: 999,
  bgcolor: active ? "rgba(217, 197, 75, 0.14)" : "rgba(15, 23, 42, 0.7)",
  color: active ? "primary.main" : "text.secondary",
  display: "inline-flex",
  fontSize: 13,
  fontWeight: 950,
  gap: 1,
  px: 1.5,
  py: 0.75,
});

const sectionHeader = (icon: JSX.Element, eyebrow: string, title: string) => (
  <Stack spacing={0.5}>
    <Typography color="primary.main" fontSize={12} fontWeight={950} letterSpacing="0.16em">
      {eyebrow}
    </Typography>
    <Typography alignItems="center" display="flex" gap={1} variant="h2">
      {icon}
      {title}
    </Typography>
  </Stack>
);

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
    () => filterMembers(memberState.data.members, memberQuery).slice(0, 30),
    [memberQuery, memberState.data.members],
  );

  const recentMembers = useMemo(() => memberState.data.members.slice(0, 6), [memberState.data.members]);

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
      <Box
        sx={{
          border: 1,
          borderColor: "rgba(217, 197, 75, 0.24)",
          borderRadius: 6,
          bgcolor: "linear-gradient(90deg, #020617, #0F172A)",
          background: "linear-gradient(90deg, rgba(2,6,23,1), rgba(15,23,42,0.96), rgba(0,0,0,1))",
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
          overflow: "hidden",
          p: { md: 4, xs: 3 },
          position: "relative",
        }}
      >
        <PrintIcon sx={{ color: "primary.main", fontSize: 112, opacity: 0.08, position: "absolute", right: 32, top: 24 }} />
        <Stack spacing={2} sx={{ position: "relative", zIndex: 1 }}>
          <Typography variant="h1">Quick Print</Typography>
          <Typography color="text.secondary" maxWidth={720}>
            회원을 고르고, 운동 부위와 프로그램을 선택한 뒤 A5 운동 기록지를 바로 출력합니다.
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            <Box sx={stepSx(Boolean(selectedMember))}>01 회원</Box>
            <Box sx={stepSx(selectedCategory !== "ALL")}>02 운동 부위</Box>
            <Box sx={stepSx(Boolean(selectedProgram))}>03 프로그램</Box>
            <Box sx={stepSx(canPreview)}>04 출력</Box>
          </Stack>
        </Stack>
      </Box>

      {(memberState.status === "error" || programState.status === "error") ? (
        <Alert severity="error" variant="outlined">
          필요한 정보를 불러오지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.
        </Alert>
      ) : null}

      <Grid container spacing={3}>
        <Grid item lg={8} xs={12}>
          <Stack spacing={2.5}>
            <Card>
              <CardContent sx={{ p: { md: 3, xs: 2.5 } }}>
                <Stack spacing={2}>
                  {sectionHeader(<PersonIcon color="primary" />, "STEP 01", "회원 선택")}
                  <SearchField label="회원 이름 또는 전화번호 검색" value={memberQuery} onChange={setMemberQuery} />
                  {memberState.status === "loading" ? <LoadingState /> : null}
                  {memberState.status === "ready" ? (
                    <Stack spacing={1.5}>
                      {!memberQuery && recentMembers.length > 0 ? (
                        <Stack direction="row" flexWrap="wrap" gap={1}>
                          {recentMembers.map((member) => (
                            <Chip
                              clickable
                              color={selectedMember?.memberId === member.memberId ? "primary" : "default"}
                              key={member.memberId}
                              label={member.displayName}
                              onClick={() => setSelectedMember(member)}
                              variant={selectedMember?.memberId === member.memberId ? "filled" : "outlined"}
                            />
                          ))}
                        </Stack>
                      ) : null}
                      <Grid container spacing={1.25}>
                        {members.map((member) => {
                          const active = selectedMember?.memberId === member.memberId;
                          return (
                            <Grid item key={member.memberId} md={4} sm={6} xs={12}>
                              <CardActionArea
                                aria-label={`${member.displayName} 회원 선택`}
                                onClick={() => setSelectedMember(member)}
                                sx={{
                                  bgcolor: active ? "rgba(217, 197, 75, 0.12)" : "rgba(2, 6, 23, 0.52)",
                                  border: 1,
                                  borderColor: active ? "primary.main" : "divider",
                                  borderRadius: 4,
                                  minHeight: 74,
                                  p: 1.5,
                                  transition: "transform 150ms ease, border-color 150ms ease, background-color 150ms ease",
                                  "&:hover": { borderColor: "primary.main", transform: "translateY(-1px)" },
                                  "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main" },
                                }}
                              >
                                <Typography fontWeight={950}>{member.displayName}</Typography>
                                <Typography color="text.secondary" variant="body2">
                                  {member.phone ? "연락처 등록" : "연락처 없음"}
                                </Typography>
                              </CardActionArea>
                            </Grid>
                          );
                        })}
                      </Grid>
                    </Stack>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent sx={{ p: { md: 3, xs: 2.5 } }}>
                <Stack spacing={2}>
                  {sectionHeader(<FitnessCenterIcon color="primary" />, "STEP 02", "운동 부위")}
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    <Chip
                      clickable
                      color={selectedCategory === "ALL" ? "primary" : "default"}
                      label="전체"
                      onClick={() => setSelectedCategory("ALL")}
                      variant={selectedCategory === "ALL" ? "filled" : "outlined"}
                    />
                    {programCategories.map((category) => (
                      <Chip
                        clickable
                        color={selectedCategory === category.value ? "primary" : "default"}
                        key={category.value}
                        label={category.label}
                        onClick={() => setSelectedCategory(category.value)}
                        variant={selectedCategory === category.value ? "filled" : "outlined"}
                      />
                    ))}
                  </Box>
                  <SearchField label="프로그램명 또는 운동명 검색" value={programQuery} onChange={setProgramQuery} />
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent sx={{ p: { md: 3, xs: 2.5 } }}>
                <Stack spacing={2}>
                  {sectionHeader(<DescriptionIcon color="primary" />, "STEP 03", "프로그램 선택")}
                  {programState.status === "loading" ? <LoadingState /> : null}
                  {programState.status === "ready" && visiblePrograms.length === 0 ? (
                    <Stack alignItems="center" spacing={1.5} sx={{ border: 1, borderColor: "divider", borderRadius: 4, py: 5 }}>
                      <SearchOffIcon color="disabled" fontSize="large" />
                      <Typography fontWeight={950}>선택 가능한 프로그램이 없습니다.</Typography>
                      <Typography color="text.secondary" variant="body2">
                        카테고리나 검색어를 바꿔 주세요.
                      </Typography>
                    </Stack>
                  ) : null}
                  <Grid container spacing={1.5}>
                    {visiblePrograms.map((program) => {
                      const active = selectedProgram?.id === program.id;
                      return (
                        <Grid item key={program.id} md={6} xs={12}>
                          <CardActionArea
                            aria-label={`${program.title} 프로그램 선택`}
                            onClick={() => setSelectedProgram(program)}
                            sx={{
                              bgcolor: active ? "rgba(217, 197, 75, 0.12)" : "rgba(2, 6, 23, 0.52)",
                              border: 1,
                              borderColor: active ? "primary.main" : "divider",
                              borderRadius: 4,
                              height: "100%",
                              p: 2,
                              transition: "transform 150ms ease, border-color 150ms ease, background-color 150ms ease",
                              "&:hover": { borderColor: "primary.main", transform: "translateY(-1px)" },
                              "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main" },
                            }}
                          >
                            <Stack spacing={1}>
                              <Stack direction="row" justifyContent="space-between" spacing={1}>
                                <Typography fontWeight={950}>{program.title}</Typography>
                                {program.favorite ? <Chip color="primary" label="즐겨찾기" size="small" /> : null}
                              </Stack>
                              <Stack direction="row" flexWrap="wrap" gap={0.75}>
                                <Chip label={getCategoryLabel(program.category)} size="small" />
                                <Chip label={getDifficultyLabel(program.difficulty)} size="small" variant="outlined" />
                                <Chip label={`${program.exercises.length} Exercises`} size="small" variant="outlined" />
                                <Chip label={`${program.usageCount}회 사용`} size="small" variant="outlined" />
                              </Stack>
                              <Typography color="text.secondary" variant="body2">
                                최근 사용 {formatLastUsed(program.lastUsedAt)}
                              </Typography>
                              <Typography color="text.secondary" sx={{ display: "-webkit-box", overflow: "hidden", WebkitBoxOrient: "vertical", WebkitLineClamp: 2 }} variant="body2">
                                {program.exercises.map((exercise) => exercise.name).join(", ")}
                              </Typography>
                            </Stack>
                          </CardActionArea>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid item lg={4} xs={12}>
          <Card sx={{ position: { lg: "sticky", xs: "static" }, top: 88 }}>
            <CardContent sx={{ p: { md: 3, xs: 2.5 } }}>
              <Stack spacing={2.25}>
                {sectionHeader(<PrintIcon color="primary" />, "STEP 04", "출력 요약")}
                <Stack spacing={1.5}>
                  <Box>
                    <Typography color="text.secondary" fontSize={12} fontWeight={950} letterSpacing="0.12em">
                      MEMBER
                    </Typography>
                    <Typography fontWeight={950}>{selectedMember?.displayName ?? "회원을 선택하세요"}</Typography>
                  </Box>
                  <Box>
                    <Typography color="text.secondary" fontSize={12} fontWeight={950} letterSpacing="0.12em">
                      BODY PART
                    </Typography>
                    <Typography fontWeight={950}>{selectedCategory === "ALL" ? "전체" : getCategoryLabel(selectedCategory)}</Typography>
                  </Box>
                  <Box>
                    <Typography color="text.secondary" fontSize={12} fontWeight={950} letterSpacing="0.12em">
                      PROGRAM
                    </Typography>
                    <Typography fontWeight={950}>{selectedProgram?.title ?? "프로그램을 선택하세요"}</Typography>
                  </Box>
                </Stack>
                {selectedProgram ? (
                  <Stack spacing={1}>
                    <Chip label={`${selectedProgram.exercises.length} Exercises`} />
                    <Chip label={`최근 사용 ${formatLastUsed(selectedProgram.lastUsedAt)}`} variant="outlined" />
                    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 4, p: 1.5 }}>
                      {selectedProgram.exercises.slice(0, 8).map((exercise) => (
                        <Typography key={exercise.id} variant="body2">
                          {exercise.order}. {exercise.name} · {exercise.sets}세트
                        </Typography>
                      ))}
                    </Box>
                  </Stack>
                ) : null}
                <Button
                  disabled={!canPreview}
                  fullWidth
                  size="large"
                  startIcon={<PrintIcon />}
                  variant="contained"
                  aria-label="출력 미리보기로 이동"
                  onClick={goPreview}
                  sx={{ minHeight: 48 }}
                >
                  출력 미리보기
                </Button>
                {!canPreview ? (
                  <Typography color="text.secondary" textAlign="center" variant="body2">
                    회원과 프로그램을 선택하면 출력 버튼이 활성화됩니다.
                  </Typography>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
};
