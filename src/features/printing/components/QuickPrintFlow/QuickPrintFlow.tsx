import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
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

interface CategoryPresentation {
  value: CategoryFilter;
  label: string;
  description: string;
  accent: string;
  paths: string[];
}

const formatLastUsed = (date?: Date): string =>
  date ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(date) : "사용 기록 없음";

const stepLabels = ["회원 선택", "프로그램 선택", "확인 및 출력"];

const categoryPresentations: CategoryPresentation[] = [
  {
    value: "ALL",
    label: "전체",
    description: "모든 운동 프로그램",
    accent: "#f7d65a",
    paths: ["M14 52 C22 22 50 12 74 28", "M22 74 C42 52 62 52 82 74", "M48 18 L48 86"],
  },
  {
    value: "FULL_BODY",
    label: "전신",
    description: "복합 움직임 중심",
    accent: "#d9c54b",
    paths: ["M48 16 C58 30 58 68 48 84", "M24 36 C38 44 58 44 72 36", "M30 74 C42 62 54 62 66 74"],
  },
  {
    value: "CHEST",
    label: "가슴",
    description: "상체 푸시 루틴",
    accent: "#f0c15d",
    paths: ["M18 46 C34 24 62 24 78 46", "M24 58 C38 48 58 48 72 58", "M34 36 L26 28 M62 36 L70 28"],
  },
  {
    value: "BACK",
    label: "등",
    description: "풀다운·로우 계열",
    accent: "#86b7ff",
    paths: ["M24 24 C34 46 34 66 22 82", "M72 24 C62 46 62 66 74 82", "M32 44 C44 36 52 36 64 44"],
  },
  {
    value: "LOWER_BODY",
    label: "하체",
    description: "스쿼트·런지 계열",
    accent: "#9be071",
    paths: ["M38 18 C36 42 28 60 22 82", "M58 18 C60 42 68 60 74 82", "M32 50 C42 56 54 56 64 50"],
  },
  {
    value: "SHOULDER",
    label: "어깨",
    description: "프레스·레이즈",
    accent: "#c6a7ff",
    paths: ["M18 42 C28 26 40 26 48 42", "M78 42 C68 26 56 26 48 42", "M28 54 C42 48 54 48 68 54"],
  },
  {
    value: "ARMS",
    label: "팔",
    description: "이두·삼두 루틴",
    accent: "#ff9c7a",
    paths: ["M24 34 C34 44 38 58 32 76", "M72 34 C62 44 58 58 64 76", "M34 58 C44 50 52 50 62 58"],
  },
  {
    value: "RECOVERY",
    label: "회복",
    description: "스트레칭·릴리즈",
    accent: "#75e4c2",
    paths: ["M20 58 C34 34 62 34 76 58", "M28 70 C42 62 54 62 68 70", "M48 28 C44 42 44 54 48 68"],
  },
  {
    value: "ETC",
    label: "기타",
    description: "범용 운동 장비",
    accent: "#d7dde8",
    paths: ["M26 28 L70 28 L70 70 L26 70 Z", "M34 42 L62 42", "M34 56 L62 56"],
  },
  {
    value: "CUSTOM",
    label: "직접작성",
    description: "현장 맞춤 구성",
    accent: "#f4b8ff",
    paths: ["M24 72 L66 30", "M58 22 L74 38", "M30 78 C42 72 54 72 66 78"],
  },
];

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

const CategoryArtwork = ({ item, active }: { item: CategoryPresentation; active: boolean }): JSX.Element => (
  <Box
    component="svg"
    viewBox="0 0 96 96"
    role="img"
    aria-hidden="true"
    sx={{
      aspectRatio: "1 / 1",
      borderRadius: 3,
      display: "block",
      width: "100%",
    }}
  >
    <defs>
      <radialGradient id={`category-glow-${item.value}`} cx="50%" cy="34%" r="70%">
        <stop offset="0%" stopColor={item.accent} stopOpacity={active ? 0.5 : 0.34} />
        <stop offset="70%" stopColor="#111827" stopOpacity="0.25" />
        <stop offset="100%" stopColor="#020617" stopOpacity="0.92" />
      </radialGradient>
    </defs>
    <rect width="96" height="96" rx="22" fill={`url(#category-glow-${item.value})`} />
    <circle cx="48" cy="48" r="28" fill="none" stroke={item.accent} strokeOpacity="0.18" strokeWidth="10" />
    {item.paths.map((path) => (
      <path
        key={path}
        d={path}
        fill="none"
        stroke={item.accent}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="6"
      />
    ))}
  </Box>
);

const selectCategoryCardSx = (active: boolean) => ({
  bgcolor: active ? "rgba(217, 197, 75, 0.14)" : "rgba(2, 6, 23, 0.58)",
  border: 1,
  borderColor: active ? "primary.main" : "divider",
  borderRadius: 4,
  boxShadow: active ? "0 0 0 1px rgba(217, 197, 75, 0.35), 0 18px 45px rgba(0, 0, 0, 0.32)" : "none",
  height: "100%",
  p: 1.25,
  textAlign: "left",
  transition: "border-color 160ms ease, background 160ms ease, transform 160ms ease",
  "&:focus-visible": {
    outline: "3px solid rgba(217, 197, 75, 0.5)",
    outlineOffset: 3,
  },
  "&:hover": {
    borderColor: "primary.main",
    transform: "translateY(-2px)",
  },
});

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

  const changeCategory = (category: CategoryFilter) => {
    setSelectedCategory(category);
    if (selectedProgram && category !== "ALL" && selectedProgram.category !== category) {
      setSelectedProgram(null);
    }
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
                <EmptyState title="검색 결과가 없습니다." description="다른 이름으로 검색해 주세요." />
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
              <Grid container spacing={1.25}>
                {categoryPresentations.map((item) => {
                  const active = selectedCategory === item.value;
                  return (
                    <Grid item key={item.value} lg={2.4} md={3} sm={4} xs={6}>
                      <CardActionArea
                        aria-label={`${item.label} 카테고리 선택`}
                        aria-pressed={active}
                        onClick={() => changeCategory(item.value)}
                        sx={selectCategoryCardSx(active)}
                      >
                        <Stack spacing={1}>
                          <Box sx={{ position: "relative" }}>
                            <CategoryArtwork item={item} active={active} />
                            {active ? (
                              <CheckCircleIcon
                                color="primary"
                                sx={{ position: "absolute", right: 8, top: 8, filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.5))" }}
                              />
                            ) : null}
                          </Box>
                          <Stack spacing={0.25}>
                            <Typography fontWeight={950}>{item.label}</Typography>
                            <Typography color="text.secondary" fontSize={12}>
                              {item.description}
                            </Typography>
                          </Stack>
                        </Stack>
                      </CardActionArea>
                    </Grid>
                  );
                })}
              </Grid>
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
