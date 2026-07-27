import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DescriptionIcon from "@mui/icons-material/Description";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import PersonIcon from "@mui/icons-material/Person";
import PrintIcon from "@mui/icons-material/Print";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import { Box, Button, Card, CardActionArea, CardContent, Chip, Grid, Stack, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { routeBuilder } from "../../../../app/routeBuilder";
import { EmptyState } from "../../../../components/common/EmptyState";
import { ErrorState } from "../../../../components/common/ErrorState";
import { LoadingState } from "../../../../components/common/LoadingState";
import { SearchField } from "../../../../components/common/SearchField";
import type { AppId } from "../../../../types/brandedIds";
import { useMembers, type MemberSelectionItem } from "../../../members";
import { filterMembers } from "../../../members/services/memberService";
import { getCategoryLabel, getDifficultyLabel, programCategories } from "../../../programs/config/programOptions";
import { usePrograms } from "../../../programs/hooks/usePrograms";
import type { Program, ProgramCategory } from "../../../programs/types/program.types";

type CategoryFilter = "ALL" | ProgramCategory;
type PrintStep = 1 | 2 | 3;

interface QuickPrintFlowProps {
  appId: AppId;
}

const formatLastUsed = (date?: Date): string =>
  date ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(date) : "사용 기록 없음";

const stepLabels = ["회원 선택", "프로그램 선택", "확인 및 출력"];

const StepIndicator = ({ currentStep }: { currentStep: PrintStep }): JSX.Element => (
  <Stack alignItems="center" direction="row" flexWrap="wrap" gap={1} justifyContent="center">
    {stepLabels.map((label, index) => {
      const step = (index + 1) as PrintStep;
      const active = currentStep === step;
      const complete = currentStep > step;
      return (
        <Box
          key={label}
          sx={{
            alignItems: "center",
            bgcolor: active || complete ? "primary.main" : "rgba(15, 23, 42, 0.8)",
            border: 1,
            borderColor: active || complete ? "primary.main" : "divider",
            borderRadius: 999,
            color: active || complete ? "primary.contrastText" : "text.secondary",
            display: "inline-flex",
            fontSize: 13,
            fontWeight: 950,
            gap: 1,
            px: 1.5,
            py: 0.75,
          }}
        >
          {step}
          {label}
        </Box>
      );
    })}
  </Stack>
);

const centeredCardSx = (maxWidth: number) => ({ maxWidth, mx: "auto", width: "100%" });

export const QuickPrintFlow = ({ appId }: QuickPrintFlowProps): JSX.Element => {
  const navigate = useNavigate();
  const memberState = useMembers(appId);
  const { programState, programs } = usePrograms(appId);
  const [currentStep, setCurrentStep] = useState<PrintStep>(1);
  const [selectedMember, setSelectedMember] = useState<MemberSelectionItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("ALL");
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [memberQuery, setMemberQuery] = useState("");
  const [programQuery, setProgramQuery] = useState("");

  const members = useMemo(
    () => filterMembers(memberState.data.members, memberQuery).slice(0, 40),
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

  const selectMember = (member: MemberSelectionItem) => {
    setSelectedMember(member);
    setSelectedProgram(null);
    setCurrentStep(2);
  };

  const changeMember = () => {
    setSelectedMember(null);
    setSelectedProgram(null);
    setCurrentStep(1);
  };

  const selectProgram = (program: Program) => {
    setSelectedProgram(program);
    setCurrentStep(3);
  };

  const goPreview = () => {
    if (!selectedMember || !selectedProgram) return;
    navigate(routeBuilder.printPreview(selectedProgram.id, selectedMember.memberId));
  };

  return (
    <Stack alignItems="center" spacing={3}>
      <StepIndicator currentStep={currentStep} />

      {currentStep === 1 ? (
        <Card sx={centeredCardSx(880)}>
          <CardContent sx={{ p: { md: 4, xs: 2.5 } }}>
            <Stack spacing={3}>
              <Stack alignItems="center" spacing={1} textAlign="center">
                <PersonIcon color="primary" fontSize="large" />
                <Typography variant="h1">회원 선택</Typography>
                <Typography color="text.secondary">운동일지를 출력할 회원을 선택하세요.</Typography>
              </Stack>
              <SearchField label="회원 이름 또는 전화번호 검색" value={memberQuery} onChange={setMemberQuery} />
              {memberState.status === "loading" ? <LoadingState message="회원 목록을 불러오는 중입니다." /> : null}
              {memberState.status === "error" ? <ErrorState message={memberState.message} /> : null}
              {memberState.status === "ready" && members.length === 0 ? (
                <EmptyState title="검색 결과가 없습니다." description="회원 이름이나 전화번호를 다시 확인해 주세요." />
              ) : null}
              <Grid container spacing={1.5}>
                {members.map((member) => (
                  <Grid item key={member.memberId} md={4} sm={6} xs={12}>
                    <CardActionArea
                      aria-label={`${member.displayName} 회원 선택`}
                      onClick={() => selectMember(member)}
                      sx={{
                        bgcolor: "rgba(2, 6, 23, 0.52)",
                        border: 1,
                        borderColor: "divider",
                        borderRadius: 4,
                        minHeight: 78,
                        p: 1.5,
                        "&:hover": { borderColor: "primary.main" },
                      }}
                    >
                      <Typography fontWeight={950}>{member.displayName}</Typography>
                      <Typography color="text.secondary" variant="body2">
                        {member.phone ? "연락처 등록" : "연락처 없음"}
                      </Typography>
                    </CardActionArea>
                  </Grid>
                ))}
              </Grid>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {currentStep === 2 ? (
        <Card sx={centeredCardSx(1120)}>
          <CardContent sx={{ p: { md: 4, xs: 2.5 } }}>
            <Stack spacing={3}>
              <Stack alignItems="center" spacing={1} textAlign="center">
                <FitnessCenterIcon color="primary" fontSize="large" />
                <Typography variant="h1">운동 프로그램 선택</Typography>
                <Typography color="text.secondary">
                  {selectedMember?.displayName ?? "선택한 회원"}에게 출력할 프로그램을 선택하세요.
                </Typography>
              </Stack>
              <Stack direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={1}>
                <Button startIcon={<ArrowBackIcon />} variant="outlined" onClick={changeMember}>
                  회원 변경
                </Button>
                <Button disabled={!selectedProgram} variant="contained" onClick={() => setCurrentStep(3)}>
                  다음
                </Button>
              </Stack>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, justifyContent: "center" }}>
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
              {programState.status === "loading" ? <LoadingState message="프로그램 목록을 불러오는 중입니다." /> : null}
              {programState.status === "error" ? <ErrorState message={programState.message} /> : null}
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
                        onClick={() => selectProgram(program)}
                        sx={{
                          bgcolor: active ? "rgba(217, 197, 75, 0.12)" : "rgba(2, 6, 23, 0.52)",
                          border: 1,
                          borderColor: active ? "primary.main" : "divider",
                          borderRadius: 4,
                          height: "100%",
                          p: 2,
                          "&:hover": { borderColor: "primary.main" },
                        }}
                      >
                        <Stack spacing={1}>
                          <Typography fontWeight={950}>{program.title}</Typography>
                          <Stack direction="row" flexWrap="wrap" gap={0.75}>
                            <Chip label={getCategoryLabel(program.category)} size="small" />
                            <Chip label={getDifficultyLabel(program.difficulty)} size="small" variant="outlined" />
                            <Chip label={`${program.exercises.length} Exercises`} size="small" variant="outlined" />
                            <Chip label={`${program.usageCount}회 사용`} size="small" variant="outlined" />
                          </Stack>
                          <Typography color="text.secondary" variant="body2">
                            최근 사용 {formatLastUsed(program.lastUsedAt)}
                          </Typography>
                          <Typography
                            color="text.secondary"
                            sx={{
                              display: "-webkit-box",
                              overflow: "hidden",
                              WebkitBoxOrient: "vertical",
                              WebkitLineClamp: 2,
                            }}
                            variant="body2"
                          >
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
      ) : null}

      {currentStep === 3 ? (
        <Card sx={centeredCardSx(1000)}>
          <CardContent sx={{ p: { md: 4, xs: 2.5 } }}>
            <Stack spacing={3}>
              <Stack alignItems="center" spacing={1} textAlign="center">
                <PrintIcon color="primary" fontSize="large" />
                <Typography variant="h1">확인 및 출력</Typography>
                <Typography color="text.secondary">선택한 내용을 확인하고 운동일지를 출력합니다.</Typography>
              </Stack>
              <Grid container spacing={2}>
                <Grid item md={4} xs={12}>
                  <Box sx={{ border: 1, borderColor: "divider", borderRadius: 4, p: 2 }}>
                    <Typography color="text.secondary" fontSize={12} fontWeight={950} letterSpacing="0.12em">
                      MEMBER
                    </Typography>
                    <Typography fontWeight={950}>{selectedMember?.displayName}</Typography>
                  </Box>
                </Grid>
                <Grid item md={4} xs={12}>
                  <Box sx={{ border: 1, borderColor: "divider", borderRadius: 4, p: 2 }}>
                    <Typography color="text.secondary" fontSize={12} fontWeight={950} letterSpacing="0.12em">
                      BODY PART
                    </Typography>
                    <Typography fontWeight={950}>{selectedCategory === "ALL" ? "전체" : getCategoryLabel(selectedCategory)}</Typography>
                  </Box>
                </Grid>
                <Grid item md={4} xs={12}>
                  <Box sx={{ border: 1, borderColor: "divider", borderRadius: 4, p: 2 }}>
                    <Typography color="text.secondary" fontSize={12} fontWeight={950} letterSpacing="0.12em">
                      PROGRAM
                    </Typography>
                    <Typography fontWeight={950}>{selectedProgram?.title}</Typography>
                  </Box>
                </Grid>
              </Grid>
              {selectedProgram ? (
                <Stack spacing={2}>
                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    <Chip label={getDifficultyLabel(selectedProgram.difficulty)} />
                    <Chip label={`${selectedProgram.exercises.length}개 운동`} variant="outlined" />
                    <Chip label={`최근 사용 ${formatLastUsed(selectedProgram.lastUsedAt)}`} variant="outlined" />
                  </Stack>
                  {selectedProgram.memo ? (
                    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 4, p: 2 }}>
                      <Typography color="text.secondary" fontSize={12} fontWeight={950} letterSpacing="0.12em">
                        MEMO
                      </Typography>
                      <Typography>{selectedProgram.memo}</Typography>
                    </Box>
                  ) : null}
                  <Stack spacing={1}>
                    {selectedProgram.exercises.map((exercise) => (
                      <Box key={exercise.id} sx={{ border: 1, borderColor: "divider", borderRadius: 3, p: 1.5 }}>
                        <Typography fontWeight={950}>
                          {exercise.order}. {exercise.name}
                        </Typography>
                        <Typography color="text.secondary" variant="body2">
                          {exercise.sets}세트{exercise.memo ? ` · ${exercise.memo}` : ""}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Stack>
              ) : null}
              <Stack direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={1}>
                <Stack direction={{ sm: "row", xs: "column" }} spacing={1}>
                  <Button startIcon={<ArrowBackIcon />} variant="outlined" onClick={changeMember}>
                    회원 변경
                  </Button>
                  <Button startIcon={<DescriptionIcon />} variant="outlined" onClick={() => setCurrentStep(2)}>
                    프로그램 수정
                  </Button>
                </Stack>
                <Button
                  disabled={!selectedMember || !selectedProgram}
                  size="large"
                  startIcon={<PrintIcon />}
                  variant="contained"
                  aria-label="출력 미리보기로 이동"
                  onClick={goPreview}
                  sx={{ minHeight: 48, minWidth: 180 }}
                >
                  출력 미리보기
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
};
