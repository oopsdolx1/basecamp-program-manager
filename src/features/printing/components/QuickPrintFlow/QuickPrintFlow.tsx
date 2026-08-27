import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import PrintIcon from "@mui/icons-material/Print";
import HistoryIcon from "@mui/icons-material/History";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Alert, Box, Button, Card, CardActionArea, CardContent, Chip, CircularProgress, Collapse, FormControlLabel, Grid, LinearProgress, Slider, Stack, Switch, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { routeBuilder } from "../../../../app/routeBuilder";
import { EmptyState } from "../../../../components/common/EmptyState";
import { ErrorState } from "../../../../components/common/ErrorState";
import { LoadingState } from "../../../../components/common/LoadingState";
import { SearchField } from "../../../../components/common/SearchField";
import type { AppId } from "../../../../types/brandedIds";
import { useExerciseCatalog } from "../../../exercise-catalog";
import type { MemberSelectionItem } from "../../../members";
import { filterMembers, sortMembersByName } from "../../../members/services/memberService";
import { filterMembersByInitial, KOREAN_INITIALS, type MemberInitialFilter } from "../../../members/utils/koreanInitial";
import { getCategoryLabel, getDifficultyLabel } from "../../../programs/config/programOptions";
import { usePrograms } from "../../../programs/hooks/usePrograms";
import { hydrateProgramExerciseKnowledge, resolveProgramExerciseKnowledge } from "../../../../shared-knowledge/resolveProgramExercises";
import { sanitizeProgramForm, validateProgramForm } from "../../../programs/services/programService";
import type { Program, ProgramCategory, ProgramFormValues } from "../../../programs/types/program.types";
import type { MemberProvider } from "../../providers/memberProvider";
import type { RecommendationProvider } from "../../providers/recommendationProvider";
import type { WorkoutHistoryRecord } from "../../providers/workoutHistoryProvider";
import { applyAiRecommendationToSnapshot, requestAiRecommendation } from "../../services/aiRecommendationService";
import { analyzeMemberIntelligence } from "../../services/memberIntelligenceService";
import { analyzePeriodization } from "../../services/periodizationEngine";
import { buildRecommendationReason, recommendProgram } from "../../services/conditionRecommendationService";
import { savePrintSnapshot } from "../../services/printSnapshotSession";
import { createSnapshotBuilderHistory, snapshotBuilderService, type SnapshotBuilderExercise, type SnapshotBuilderHistory } from "../../services/snapshotBuilderService";
import type { AiRecommendationResult, AlcoholStatus, ConditionInput, ConditionStatus, FatigueArea, MemberIntelligenceMetadata, MemberIntelligenceSummary, PeriodizationSummary, RecommendationResult, RecommendationTrace, RecentWorkoutSummary, SleepQuality } from "../../types/condition.types";
import { palette } from "../../../../theme/palette";
import { createWorkoutSession } from "../../../workout-sessions/services/workoutSessionService";

type PrintStep = 1 | 2 | 3 | 4;
type AiStatus = "idle" | "loading" | "ready" | "error" | "skipped";
type IntelligenceStatus = "idle" | "loading" | "ready" | "error";
type MemberLoadStatus = "loading" | "ready" | "error";

interface QuickPrintFlowProps {
  appId: AppId;
  memberProvider: MemberProvider;
  recommendationProvider: RecommendationProvider;
}

const stepLabels = ["회원 선택", "컨디션 확인", "프로그램 추천", "출력"];
const conditionOptions: Array<{ value: ConditionStatus; label: string; icon: string; description: string }> = [
  { value: "GOOD", label: "좋음", icon: "😊", description: "최상의 컨디션입니다." },
  { value: "NORMAL", label: "보통", icon: "🙂", description: "평소와 비슷합니다." },
  { value: "BAD", label: "나쁨", icon: "☹️", description: "회복이 필요한 상태입니다." },
];
const sleepOptions: Array<{ value: SleepQuality; label: string; icon: string; description: string }> = [
  { value: "ENOUGH", label: "충분함", icon: "🌙", description: "7시간 이상" },
  { value: "NORMAL", label: "보통", icon: "🛏️", description: "5~7시간" },
  { value: "LACK", label: "부족함", icon: "😴", description: "5시간 미만" },
];
const alcoholOptions: Array<{ value: AlcoholStatus; label: string; icon: string }> = [
  { value: "NO", label: "없음", icon: "🚫" },
  { value: "YES", label: "있음", icon: "🍷" },
];
const fatigueOptions: Array<{ value: FatigueArea; label: string }> = [
  { value: "CHEST", label: "가슴" },
  { value: "BACK", label: "등" },
  { value: "SHOULDER", label: "어깨" },
  { value: "ARMS", label: "팔" },
  { value: "LOWER_BODY", label: "하체" },
];
const fatigueScale = [
  { value: 1, label: "매우 피곤", description: "회복이 가장 필요한 상태" },
  { value: 2, label: "조금 피곤", description: "피로가 남아 있습니다." },
  { value: 3, label: "보통", description: "평균적인 컨디션입니다." },
  { value: 4, label: "상쾌", description: "몸 상태가 좋은 편입니다." },
  { value: 5, label: "매우 상쾌", description: "최상의 컨디션입니다." },
] as const;
const defaultCondition: ConditionInput = { condition: null, sleep: null, fatigueAreas: [], stress: 3, alcohol: null };
const centeredCardSx = (maxWidth: number) => ({ maxWidth, mx: "auto", width: "100%" });
const largeChoiceCardSx = (active: boolean) => ({
  bgcolor: active ? palette.primaryGoldMuted : palette.surfaceInteractive,
  border: 1,
  borderColor: active ? "primary.main" : "divider",
  borderRadius: `${palette.radiusMd}px`,
  boxShadow: active ? palette.shadowAccent : "none",
  height: "100%",
  minHeight: 96,
  p: 2,
  textAlign: "left",
  transition: "border-color 150ms ease, background-color 150ms ease, box-shadow 150ms ease, transform 150ms ease",
  "&:hover": { borderColor: "primary.main", transform: "translateY(-1px)" },
  "&:focus-visible": { outline: `3px solid ${palette.primaryGoldGlowStrong}`, outlineOffset: 3 },
});
const MuscleSilhouette = ({ area, active }: { area: FatigueArea | "NONE"; active: boolean }): JSX.Element => {
  const base = active ? palette.primaryGoldBorder : palette.borderStrong;
  const highlight = active ? palette.primaryGold : palette.primaryGoldHover;
  const muted = palette.surfaceRaised;
  return <Box aria-hidden="true" component="svg" viewBox="0 0 80 96" sx={{ height: 72, width: 60 }}>
    <circle cx="40" cy="11" fill={muted} stroke={base} strokeWidth="2" r="8" />
    <path d="M29 22 Q40 17 51 22 L56 54 Q49 61 40 61 Q31 61 24 54 Z" fill={area === "CHEST" || area === "BACK" ? highlight : muted} opacity={area === "BACK" ? 0.72 : 1} stroke={base} strokeWidth="2" />
    <path d="M28 25 L17 32 L11 57 L19 60 L28 40" fill={area === "ARMS" ? highlight : muted} stroke={base} strokeWidth="2" />
    <path d="M52 25 L63 32 L69 57 L61 60 L52 40" fill={area === "ARMS" ? highlight : muted} stroke={base} strokeWidth="2" />
    <path d="M31 59 L25 89 L36 89 L41 63" fill={area === "LOWER_BODY" ? highlight : muted} stroke={base} strokeWidth="2" />
    <path d="M49 59 L55 89 L44 89 L39 63" fill={area === "LOWER_BODY" ? highlight : muted} stroke={base} strokeWidth="2" />
    {area === "CHEST" ? <path d="M30 29 Q40 24 50 29 L49 40 Q40 44 31 40 Z" fill={palette.primaryGoldDark} opacity="0.72" /> : null}
    {area === "BACK" ? <path d="M30 26 L40 32 L50 26 L49 48 L40 54 L31 48 Z" fill={palette.primaryGoldDark} opacity="0.7" /> : null}
    {area === "SHOULDER" ? <><circle cx="25" cy="29" fill={highlight} r="6" /><circle cx="55" cy="29" fill={highlight} r="6" /></> : null}
  </Box>;
};
const ConditionBodyMap = ({ areas }: { areas: FatigueArea[] }): JSX.Element => {
  const selected = (area: FatigueArea) => areas.includes(area);
  const fill = (area: FatigueArea) => selected(area) ? palette.primaryGold : palette.surfaceRaised;
  return <Box aria-label={areas.length > 0 ? `선택된 피로 부위: ${areas.map((area) => fatigueOptions.find((item) => item.value === area)?.label).join(", ")}` : "선택된 피로 부위 없음"} component="svg" role="img" viewBox="0 0 180 260" sx={{ filter: areas.length > 0 ? `drop-shadow(0 0 12px ${palette.primaryGoldGlowStrong})` : "none", height: { md: 240, xs: 200 }, width: "auto" }}>
    <circle cx="90" cy="25" fill={palette.surfaceRaised} stroke={palette.borderStrong} strokeWidth="3" r="18" />
    <path d="M58 55 Q90 42 122 55 L129 137 Q111 154 90 154 Q69 154 51 137 Z" fill={selected("CHEST") || selected("BACK") ? palette.primaryGoldMuted : palette.surfaceRaised} stroke={palette.borderStrong} strokeWidth="3" />
    <path d="M58 59 L36 72 L19 142 L37 148 L58 92" fill={fill("ARMS")} stroke={palette.borderStrong} strokeWidth="3" />
    <path d="M122 59 L144 72 L161 142 L143 148 L122 92" fill={fill("ARMS")} stroke={palette.borderStrong} strokeWidth="3" />
    <circle cx="53" cy="66" fill={fill("SHOULDER")} r="14" /><circle cx="127" cy="66" fill={fill("SHOULDER")} r="14" />
    <path d="M65 151 L52 239 L79 239 L91 160" fill={fill("LOWER_BODY")} stroke={palette.borderStrong} strokeWidth="3" />
    <path d="M115 151 L128 239 L101 239 L89 160" fill={fill("LOWER_BODY")} stroke={palette.borderStrong} strokeWidth="3" />
    {selected("CHEST") ? <path d="M62 72 Q90 57 118 72 L114 103 Q90 114 66 103 Z" fill={palette.primaryGold} opacity="0.9" /> : null}
    {selected("BACK") ? <path d="M62 62 L90 78 L118 62 L114 126 L90 143 L66 126 Z" fill={palette.primaryGold} opacity="0.76" /> : null}
  </Box>;
};
const categoryMap = { CHEST: "CHEST", BACK: "BACK", SHOULDER: "SHOULDER", ARMS: "ARMS", LOWER_BODY: "LOWER_BODY" } as const;
const categoryToBodyArea = (category: ProgramCategory): FatigueArea | "NONE" => categoryMap[category as keyof typeof categoryMap] ?? "NONE";
const buildDisplayRecommendationSummary = (program: Program | null, input: ConditionInput, recent: RecentWorkoutSummary | null): string => {
  if (!program) return "선택한 회원 상태에 맞는 프로그램입니다.";
  const target = getCategoryLabel(program.category);
  const conditionLabel = conditionOptions.find((item) => item.value === input.condition)?.label ?? "현재";
  if (!recent?.category) return `오늘 컨디션(${conditionLabel})과 선택한 피로 부위를 고려해 ${target} 중심 프로그램을 추천했습니다.`;
  const recentTarget = getCategoryLabel(recent.category);
  return recent.category === program.category
    ? `최근 ${recentTarget} 운동의 연속성과 오늘 컨디션(${conditionLabel})을 고려한 프로그램입니다.`
    : `최근 ${recentTarget} 운동과 주요 부위 중복을 낮추고 오늘 컨디션(${conditionLabel})에 맞춘 ${target} 중심 프로그램입니다.`;
};
const infoCardSx = {
  bgcolor: palette.surfaceSection,
  border: 1,
  borderColor: "divider",
  borderRadius: `${palette.radiusMd}px`,
  boxShadow: palette.shadowCard,
  height: "100%",
};
const formatDaysAgo = (daysAgo: number | null): string => (daysAgo === null ? "운동 기록 없음" : daysAgo === 0 ? "오늘" : daysAgo === 1 ? "1일 전" : `${daysAgo}일 전`);
const formatRatio = (value: number): string => `${Math.round(value * 100)}%`;
const scoreColor = (value: number, goodHigh: boolean): "success" | "warning" | "error" => goodHigh ? (value >= 70 ? "success" : value >= 40 ? "warning" : "error") : (value >= 70 ? "error" : value >= 40 ? "warning" : "success");
const recoveryTrendLabel = (trend: PeriodizationSummary["recoveryTrend"]): string => trend === "UP" ? "Improving" : trend === "DOWN" ? "Down" : "Stable";
const modeLabel = (mode: PeriodizationSummary["recommendedMode"]): string => ({ NORMAL: "Normal", VARIATION: "Variation", RECOVERY: "Recovery", DELOAD: "Deload", RESTART: "Restart" })[mode];

const parseExerciseMemo = (memo: string): Pick<SnapshotBuilderExercise, "memo" | "reps" | "weight" | "restSeconds"> => {
  const segments = memo.split("|").map((segment) => segment.trim()).filter(Boolean);
  let reps = "";
  let weight = "0";
  let restSeconds = 60;
  const notes: string[] = [];
  segments.forEach((segment) => {
    if (segment.startsWith("Reps ")) { reps = segment.replace("Reps ", "").trim(); return; }
    if (segment.startsWith("Weight ")) { weight = segment.replace("Weight ", "").trim() || "0"; return; }
    if (segment.startsWith("Rest ")) { const match = segment.match(/Rest\s+(\d+)/i); if (match) restSeconds = Number(match[1]); return; }
    notes.push(segment);
  });
  return { memo: notes.join(" | "), reps, weight, restSeconds };
};

const historyToProgram = (source: Program, values: ProgramFormValues): Program => ({
  ...source,
  title: values.title,
  category: values.category,
  difficulty: values.difficulty,
  memo: values.memo,
  favorite: values.favorite,
  exercises: values.exercises.map((exercise, index) => {
    const parsed = parseExerciseMemo(exercise.memo);
    return { id: exercise.id, name: exercise.name, displayName: exercise.displayName ?? exercise.name, catalogExerciseId: exercise.catalogExerciseId, sets: Math.max(1, exercise.sets), memo: [parsed.memo, parsed.reps ? `Reps ${parsed.reps}` : "", parsed.weight !== "0" ? `Weight ${parsed.weight}` : "", parsed.restSeconds > 0 ? `Rest ${parsed.restSeconds}s` : ""].filter(Boolean).join(" | "), order: index + 1 };
  }),
});

const StepIndicator = ({ currentStep }: { currentStep: PrintStep }): JSX.Element => <Box sx={{ maxWidth: 680, px: { sm: 2, xs: 0 }, width: "100%" }}><Stack alignItems="flex-start" direction="row">{stepLabels.map((label, index) => { const step = (index + 1) as PrintStep; const active = currentStep === step; const complete = currentStep > step; return <Stack key={label} alignItems="center" direction="row" sx={{ flex: 1, minWidth: 0 }}><Stack alignItems="center" spacing={0.5} sx={{ minWidth: { sm: 88, xs: 58 } }}><Box sx={{ alignItems: "center", bgcolor: active ? "primary.main" : complete ? palette.primaryGoldMuted : palette.surfaceRaised, border: 1, borderColor: active || complete ? "primary.main" : "divider", borderRadius: 999, color: active ? "primary.contrastText" : complete ? "primary.main" : "text.secondary", display: "flex", fontSize: 13, fontWeight: 900, height: 32, justifyContent: "center", transition: "all 150ms ease", width: 32 }}>{complete ? "✓" : step}</Box><Typography color={active ? "primary.main" : "text.secondary"} fontWeight={active ? 900 : 700} sx={{ fontSize: { sm: 12, xs: 10 }, lineHeight: 1.2, textAlign: "center" }}>{label}</Typography></Stack>{index < stepLabels.length - 1 ? <Box sx={{ bgcolor: complete ? "primary.main" : "divider", flex: 1, height: 1, mt: "16px", mx: { sm: 0.5, xs: -0.5 } }} /> : null}</Stack>; })}</Stack></Box>;
const MemberIntelligenceCard = ({ intelligence, status }: { intelligence: MemberIntelligenceSummary | null; status: IntelligenceStatus }): JSX.Element => <Card sx={infoCardSx}><CardContent><Stack spacing={2}><Stack direction="row" justifyContent="space-between" spacing={1}><Typography variant="h2">Member Intelligence</Typography>{status === "loading" ? <Chip label="분석 중" size="small" /> : null}</Stack>{status === "loading" ? <LinearProgress /> : null}{!intelligence ? <Typography color="text.secondary">운동 이력을 분석하면 회복, 위험, 빈도, 운동 부위 정보를 표시합니다.</Typography> : <Grid container spacing={1.5}><Grid item md={3} xs={6}><Chip color={scoreColor(intelligence.recoveryScore, true)} label={`Recovery ${intelligence.recoveryScore}`} /></Grid><Grid item md={3} xs={6}><Chip color={scoreColor(intelligence.riskScore, false)} icon={<WarningAmberIcon />} label={`Risk ${intelligence.riskScore}`} /></Grid><Grid item md={3} xs={6}><Chip label={`최근 7일 ${intelligence.frequency7}회`} variant="outlined" /></Grid><Grid item md={3} xs={6}><Chip label={`최근 30일 ${intelligence.frequency30}회`} variant="outlined" /></Grid><Grid item md={3} xs={6}><Typography color="text.secondary">최근 운동</Typography><Typography fontWeight={900}>{formatDaysAgo(intelligence.recentWorkoutDaysAgo)}</Typography></Grid><Grid item md={3} xs={6}><Typography color="text.secondary">운동 간격</Typography><Typography fontWeight={900}>{intelligence.gapDays === null ? "없음" : `${intelligence.gapDays}일`}</Typography></Grid><Grid item md={3} xs={6}><Typography color="text.secondary">Program 반복</Typography><Typography fontWeight={900}>{intelligence.repeatedProgramCount}회</Typography></Grid><Grid item md={3} xs={6}><Typography color="text.secondary">다양성</Typography><Typography fontWeight={900}>P {intelligence.diversity10.programCount} / C {intelligence.diversity10.categoryCount}</Typography></Grid><Grid item xs={12}><Typography color="text.secondary">운동 부위</Typography><Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 0.5 }}>{intelligence.bodyPartBias.length > 0 ? intelligence.bodyPartBias.slice(0, 4).map((item) => <Chip key={item.category} label={`${getCategoryLabel(item.category)} ${formatRatio(item.ratio)}`} size="small" />) : <Chip label="운동 기록이 없습니다" size="small" variant="outlined" />}</Stack></Grid></Grid>}</Stack></CardContent></Card>;
const TrainingTrendCard = ({ periodization, status }: { periodization: PeriodizationSummary | null; status: IntelligenceStatus }): JSX.Element => <Card sx={infoCardSx}><CardContent><Stack spacing={2}><Stack direction="row" justifyContent="space-between" spacing={1}><Typography variant="h2">Training Trend</Typography>{status === "loading" ? <Chip label="분석 중" size="small" /> : null}</Stack>{status === "loading" ? <LinearProgress /> : null}{!periodization ? <Typography color="text.secondary">최근 운동 흐름을 분석하면 Cycle, Plateau, Deload, 다음 추천을 표시합니다.</Typography> : <Grid container spacing={1.5}><Grid item md={3} xs={6}><Typography color="text.secondary">현재 Cycle</Typography><Typography fontWeight={900}>{periodization.currentCycle}</Typography></Grid><Grid item md={3} xs={6}><Typography color="text.secondary">Recovery</Typography><Typography fontWeight={900}>{recoveryTrendLabel(periodization.recoveryTrend)}</Typography></Grid><Grid item md={3} xs={6}><Typography color="text.secondary">Plateau</Typography><Typography fontWeight={900}>{periodization.plateau ? "Yes" : "No"}</Typography></Grid><Grid item md={3} xs={6}><Typography color="text.secondary">다음 추천</Typography><Typography fontWeight={900}>{periodization.nextProgramHint ?? "없음"}</Typography></Grid><Grid item md={3} xs={6}><Chip color="primary" label={modeLabel(periodization.recommendedMode)} /></Grid><Grid item md={3} xs={6}><Chip color={periodization.deload ? "warning" : "default"} label={periodization.deload ? "Deload" : "Normal Load"} variant={periodization.deload ? "filled" : "outlined"} /></Grid><Grid item md={3} xs={6}><Chip label={`주간 운동 ${periodization.weeklyFrequency}회`} variant="outlined" /></Grid><Grid item md={3} xs={6}><Chip label={`반복 ${periodization.repeatedProgramCount}회`} variant="outlined" /></Grid><Grid item xs={12}><Typography color="text.secondary">최근 Program</Typography><Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 0.5 }}>{periodization.recentProgramSequence.length > 0 ? periodization.recentProgramSequence.map((title) => <Chip key={title} label={title} size="small" />) : <Chip label="기록 없음" size="small" variant="outlined" />}</Stack></Grid></Grid>}</Stack></CardContent></Card>;

const factorDisplayLabel = (factor: RecommendationTrace["decisionFactors"][number]): string => ({
  condition: "컨디션 적합",
  recentWorkout: "최근 운동",
  exerciseOverlap: "최근 운동 중복",
  recovery: "회복 상태",
  risk: "운동 위험도",
  programRepeat: "프로그램 반복",
  bias: "운동 부위 균형",
  history: "운동 이력",
  periodization: "운동 주기",
  plateau: "정체 상태",
  weeklyFrequency: "주간 빈도",
  favorite: "즐겨찾기",
  usageCount: "최근 사용 이력",
})[factor.key] ?? factor.label;
const factorDisplayReason = (factor: RecommendationTrace["decisionFactors"][number]): string => ({
  condition: "오늘 컨디션에 맞는 강도를 고려했습니다.",
  recentWorkout: "최근 운동 부위와의 균형을 고려했습니다.",
  exerciseOverlap: "최근 운동과 운동 종목 중복을 확인했습니다.",
  recovery: "현재 회복 상태를 고려했습니다.",
  risk: "무리하지 않도록 주의가 필요한 요소를 반영했습니다.",
  programRepeat: "같은 프로그램의 반복 여부를 확인했습니다.",
  bias: "최근 운동 부위의 균형을 확인했습니다.",
  history: "최근 운동 이력을 함께 확인했습니다.",
  periodization: "최근 운동 흐름에 맞춰 강도를 조정했습니다.",
  plateau: "최근 운동 변화와 회복 흐름을 확인했습니다.",
  weeklyFrequency: "이번 주 운동 빈도를 고려했습니다.",
  favorite: "자주 선택한 프로그램을 참고했습니다.",
  usageCount: "최근 프로그램 사용 이력을 참고했습니다.",
})[factor.key] ?? factor.reason;

const RecommendationTraceCard = ({
  recommendation,
  trace,
}: {
  recommendation: RecommendationResult | null;
  trace: RecommendationTrace | null;
}): JSX.Element => {
  if (!recommendation) {
    return <Card sx={infoCardSx}><CardContent><Typography color="text.secondary">추천 결과가 없습니다.</Typography></CardContent></Card>;
  }

  if (!trace) {
    return <Card sx={infoCardSx}><CardContent><Stack spacing={1}><Typography variant="h2">추천 근거</Typography><Typography color="text.secondary">추천 근거 정보가 없습니다.</Typography></Stack></CardContent></Card>;
  }

  const positiveFactors = trace.decisionFactors.filter((factor) => factor.score > 0);
  const negativeFactors = trace.decisionFactors.filter((factor) => factor.score < 0);
  const factorCardSx = {
    border: 1,
    borderColor: "divider",
    borderRadius: `${palette.radiusSm}px`,
    bgcolor: palette.surfaceInteractive,
    p: 1.5,
  };

  return <Card sx={infoCardSx}><CardContent><Stack spacing={2}>
    <Box><Typography variant="h2">추천 근거</Typography><Typography color="text.secondary">오늘의 상태와 최근 운동을 바탕으로 확인한 내용입니다.</Typography></Box>
    <Grid container spacing={2}><Grid item md={6} xs={12}><Stack spacing={1}><Typography fontWeight={900}>확인 사항</Typography>{positiveFactors.length > 0 ? positiveFactors.map((factor) => <Box key={`${factor.key}-${factor.reason}`} sx={factorCardSx}><Stack direction="row" spacing={1}><CheckCircleIcon color="success" fontSize="small" /><Box><Typography fontWeight={700}>{factorDisplayLabel(factor)}</Typography><Typography color="text.secondary" variant="body2">{factorDisplayReason(factor)}</Typography></Box></Stack></Box>) : <Typography color="text.secondary">추가 확인 사항이 없습니다.</Typography>}</Stack></Grid><Grid item md={6} xs={12}><Stack spacing={1}><Typography fontWeight={900}>주의 사항</Typography>{negativeFactors.length > 0 ? negativeFactors.map((factor) => <Box key={`${factor.key}-${factor.reason}`} sx={factorCardSx}><Stack direction="row" spacing={1}><WarningAmberIcon color="warning" fontSize="small" /><Box><Typography fontWeight={700}>{factorDisplayLabel(factor)}</Typography><Typography color="text.secondary" variant="body2">{factorDisplayReason(factor)}</Typography></Box></Stack></Box>) : <Box sx={factorCardSx}><Typography color="text.secondary">특별한 주의 사항이 없습니다.</Typography></Box>}</Stack></Grid></Grid>
  </Stack></CardContent></Card>;
};

export const QuickPrintFlow = ({ appId, memberProvider, recommendationProvider }: QuickPrintFlowProps): JSX.Element => {
  const navigate = useNavigate();
  const { programState, programs } = usePrograms(appId);
  const { catalogState } = useExerciseCatalog(appId);
  const runtimePrograms = useMemo(() => hydrateProgramExerciseKnowledge(programs), [programs, catalogState.data]);
  const [started, setStarted] = useState(false);
  const [memberStatus, setMemberStatus] = useState<MemberLoadStatus>("loading");
  const [memberError, setMemberError] = useState("");
  const [members, setMembers] = useState<MemberSelectionItem[]>([]);
  const [currentStep, setCurrentStep] = useState<PrintStep>(1);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberInitial, setMemberInitial] = useState<MemberInitialFilter | null>(null);
  const [selectedMember, setSelectedMember] = useState<MemberSelectionItem | null>(null);
  const [condition, setCondition] = useState<ConditionInput>(defaultCondition);
  const [recentWorkout, setRecentWorkout] = useState<RecentWorkoutSummary | null>(null);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutHistoryRecord[]>([]);
  const [intelligenceStatus, setIntelligenceStatus] = useState<IntelligenceStatus>("idle");
  const [intelligence, setIntelligence] = useState<MemberIntelligenceSummary | null>(null);
  const [intelligenceMetadata, setIntelligenceMetadata] = useState<MemberIntelligenceMetadata | null>(null);
  const [periodization, setPeriodization] = useState<PeriodizationSummary | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationResult | null>(null);
  const [recommendationTrace, setRecommendationTrace] = useState<RecommendationTrace | null>(null);
  const [recommendationReason, setRecommendationReason] = useState("");
  const [snapshotSourceProgram, setSnapshotSourceProgram] = useState<Program | null>(null);
  const [builderHistory, setBuilderHistory] = useState<SnapshotBuilderHistory | null>(null);
  const [useAiRecommendation, setUseAiRecommendation] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [aiRecommendation, setAiRecommendation] = useState<AiRecommendationResult | null>(null);
  const [aiError, setAiError] = useState("");
  const [showRecommendationBasis, setShowRecommendationBasis] = useState(false);
  const [sessionSaving, setSessionSaving] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const hasSearchQuery = memberQuery.trim().length > 0;
  const filteredMembers = useMemo(() => {
    if (hasSearchQuery) return sortMembersByName(filterMembers(members, memberQuery));
    if (!memberInitial) return [];
    return sortMembersByName(filterMembersByInitial(members, memberInitial));
  }, [hasSearchQuery, memberInitial, memberQuery, members]);
  const rankedPrograms = useMemo(() => (recommendationTrace?.candidatePrograms ?? [])
    .map((candidate) => ({ candidate, program: runtimePrograms.find((program) => program.id === candidate.programId) }))
    .filter((item): item is { candidate: RecommendationTrace["candidatePrograms"][number]; program: Program } => Boolean(item.program))
    .slice(0, 3), [recommendationTrace, runtimePrograms]);
  const builderState = builderHistory?.present ?? null;
  const displayRecommendationReason = useMemo(() => buildDisplayRecommendationSummary(snapshotSourceProgram ?? recommendation?.program ?? null, condition, recentWorkout), [condition, recentWorkout, recommendation?.program, snapshotSourceProgram]);
  const snapshotValues = useMemo(() => (builderState ? snapshotBuilderService.toProgramFormValues(builderState) : null), [builderState]);
  const snapshotValidation = useMemo(() => (snapshotValues ? validateProgramForm(snapshotValues) : { valid: false, errors: ["Snapshot이 준비되지 않았습니다."] }), [snapshotValues]);
  const canRecommend = Boolean(selectedMember && condition.condition && condition.sleep && condition.alcohol);
  useEffect(() => {
    let active = true;
    setMemberStatus("loading");
    setMemberError("");
    void memberProvider.listMembers().then((items) => {
      if (!active) return;
      setMembers(items);
      setMemberStatus("ready");
    }).catch((error) => {
      if (!active) return;
      setMembers([]);
      setMemberStatus("error");
      setMemberError(error instanceof Error ? error.message : "회원 목록을 불러오지 못했습니다.");
    });
    return () => {
      active = false;
    };
  }, [memberProvider]);

  useEffect(() => {
    if (!selectedMember) {
      setRecentWorkout(null);
      setWorkoutHistory([]);
      setIntelligence(null);
      setIntelligenceMetadata(null);
      setPeriodization(null);
      setIntelligenceStatus("idle");
      return;
    }
    let active = true;
    setIntelligenceStatus("loading");
    const contextCondition: ConditionInput = condition.condition && condition.sleep && condition.alcohol
      ? condition
      : { ...condition, condition: "NORMAL", sleep: "NORMAL", alcohol: "NO" };
    void recommendationProvider.getRecommendationContext(selectedMember.memberId, contextCondition).then((context) => {
      if (!active) return;
      setRecentWorkout(context.recentWorkout);
      setWorkoutHistory(context.workoutHistory);
      setIntelligence(context.intelligence);
      setIntelligenceMetadata(context.metadata);
      const analysisSource = analyzeMemberIntelligence(context.workoutHistory, contextCondition);
      setPeriodization(context.periodization ?? analyzePeriodization({ intelligence: context.intelligence, history: analysisSource.history, condition: contextCondition }));
      setIntelligenceStatus("ready");
    }).catch(() => {
      if (!active) return;
      setRecentWorkout(null);
      setWorkoutHistory([]);
      setIntelligence(null);
      setIntelligenceMetadata(null);
      setPeriodization(null);
      setIntelligenceStatus("error");
    });
    return () => {
      active = false;
    };
  }, [condition, recommendationProvider, selectedMember]);

  const resetRecommendationState = () => {
    setRecommendation(null);
    setRecommendationTrace(null);
    setRecommendationReason("");
    setSnapshotSourceProgram(null);
    setBuilderHistory(null);
    setAiStatus("idle");
    setAiRecommendation(null);
    setAiError("");
  };

  const selectMember = (member: MemberSelectionItem) => {
    setSelectedMember(member);
    setCondition(defaultCondition);
    setRecentWorkout(null);
    setWorkoutHistory([]);
    setIntelligence(null);
    setIntelligenceMetadata(null);
    setPeriodization(null);
    resetRecommendationState();
  };

  const toggleFatigue = (area: FatigueArea) => {
    setCondition((current) => ({
      ...current,
      fatigueAreas: current.fatigueAreas.includes(area) ? current.fatigueAreas.filter((item) => item !== area) : [...current.fatigueAreas, area],
    }));
  };

  const selectProgramForBuilder = (program: Program) => {
    setSnapshotSourceProgram(program);
    if (program.id !== recommendation?.program.id || !builderHistory) {
      setBuilderHistory(createSnapshotBuilderHistory(program));
    }
    setRecommendationReason(program.id === recommendation?.program.id
      ? recommendationReason
      : "차순위 추천에서 트레이너가 선택한 프로그램입니다.");
    setCurrentStep(4);
  };

  const runRecommendation = async () => {
    const next = recommendProgram(runtimePrograms, condition, recentWorkout, intelligence, periodization, workoutHistory, catalogState.data);
    if (!next) {
      setRecommendation(null);
      setRecommendationReason("추천 가능한 프로그램을 찾을 수 없습니다.");
      setSnapshotSourceProgram(null);
      setBuilderHistory(null);
      setAiStatus("skipped");
      setAiRecommendation(null);
      return;
    }
    const ruleReason = buildRecommendationReason(next, condition, recentWorkout, intelligence, periodization);
    const baseHistory = createSnapshotBuilderHistory(next.program);
    setRecommendation(next);
    setRecommendationTrace(next.trace);
    setRecommendationReason(ruleReason);
    setSnapshotSourceProgram(next.program);
    setBuilderHistory(baseHistory);
    setAiRecommendation(null);
    setAiError("");
    if (!useAiRecommendation || !selectedMember) {
      setAiStatus("skipped");
      setCurrentStep(3);
      return;
    }
    setAiStatus("loading");
    try {
      const aiResult = await requestAiRecommendation({ member: selectedMember, condition, recentWorkout, intelligence, periodization, recommendedProgram: next.program, snapshot: snapshotBuilderService.toProgramFormValues(baseHistory.present), ruleReason, recommendationTrace: next.trace });
      if (!aiResult) {
        setAiStatus("skipped");
        setCurrentStep(3);
        return;
      }
      const patchedValues = applyAiRecommendationToSnapshot(snapshotBuilderService.toProgramFormValues(baseHistory.present), aiResult);
      setAiRecommendation(aiResult);
      setAiStatus("ready");
      setBuilderHistory(createSnapshotBuilderHistory(historyToProgram(next.program, patchedValues)));
    } catch (error) {
      setAiStatus("error");
      setAiError(error instanceof Error ? error.message : "AI Recommendation을 불러오지 못했습니다.");
      setBuilderHistory(baseHistory);
    }
    setCurrentStep(3);
  };

  const goPrintPreview = async () => {
    if (!selectedMember || !snapshotSourceProgram || !snapshotValues || sessionSaving) return;
    const sanitized = sanitizeProgramForm(snapshotValues);
    if (sanitized.exercises.length > 8) {
      setSessionError("운동이 8개를 초과하여 이번 Sprint에서는 출력할 수 없습니다.");
      return;
    }
    setSessionSaving(true);
    setSessionError("");
    try {
      const sessionProgram = historyToProgram(snapshotSourceProgram, sanitized);
      const resolved = resolveProgramExerciseKnowledge(sessionProgram);
      const sessionId = await createWorkoutSession({
        appId,
        memberId: selectedMember.memberId,
        memberName: selectedMember.displayName,
        programId: snapshotSourceProgram.id,
        programTitle: sanitized.title,
        exercises: sessionProgram.exercises.map((exercise) => ({
          exerciseId: resolved.get(exercise.id)?.id ?? exercise.catalogExerciseId ?? exercise.id,
          programExerciseId: exercise.id,
          name: resolved.get(exercise.id)?.name ?? exercise.name,
          order: exercise.order,
        })),
      });
      const snapshotProgramId = savePrintSnapshot({
      sourceProgramId: snapshotSourceProgram.id,
      sourceProgramTitle: snapshotSourceProgram.title,
      recommendationReasons: recommendationReason ? [recommendationReason] : [],
      aiRecommendation,
      intelligence,
      metadata: intelligenceMetadata,
      periodization,
      recommendationTrace,
      condition,
      recentWorkout,
        formValues: sanitized,
      });
      navigate(routeBuilder.printPreview(snapshotProgramId, selectedMember.memberId, sessionId));
    } catch (caught) {
      setSessionError(caught instanceof Error ? caught.message : "운동 세션을 생성하지 못했습니다.");
    } finally {
      setSessionSaving(false);
    }
  };

  if (!started) {
    return <Box sx={{ alignItems: "center", display: "flex", justifyContent: "center", minHeight: "calc(100vh - 48px)", py: 3, width: "100%" }}><Stack alignItems="center" spacing={{ md: 5, xs: 3.5 }} sx={{ maxWidth: 860, width: "100%" }} textAlign="center"><Stack alignItems="center" spacing={1.5}><Box sx={{ alignItems: "center", bgcolor: palette.primaryGoldMuted, border: 1, borderColor: "primary.main", borderRadius: 999, boxShadow: palette.shadowAccent, display: "flex", height: 72, justifyContent: "center", width: 72 }}><FitnessCenterIcon color="primary" sx={{ fontSize: 38 }} /></Box><Box><Typography color="primary.main" fontWeight={900} letterSpacing={2} variant="overline">BASECAMP</Typography><Typography color="text.secondary" fontWeight={800} letterSpacing={4} variant="caption">PROGRAM STATION</Typography></Box></Stack><Box><Typography sx={{ fontSize: { md: 44, sm: 38, xs: 32 }, fontWeight: 900, letterSpacing: -1.2, lineHeight: 1.2 }}>안녕하세요!</Typography><Typography color="text.secondary" sx={{ fontSize: { md: 19, xs: 16 }, mt: 1.5 }}>오늘의 운동 프로그램을 확인하고 출력하세요.</Typography></Box><Grid container spacing={2} sx={{ width: "100%" }}><Grid item sm={6} xs={12}><CardActionArea onClick={() => setStarted(true)} sx={{ bgcolor: palette.primaryGoldMuted, border: 1, borderColor: "primary.main", borderRadius: `${palette.radiusMd}px`, boxShadow: palette.shadowAccent, minHeight: 176, p: 3, transition: "transform 150ms ease, box-shadow 150ms ease", "&:hover": { boxShadow: palette.shadowAccentStrong, transform: "translateY(-3px)" } }}><Stack alignItems="center" spacing={1.5}><FitnessCenterIcon color="primary" sx={{ fontSize: 42 }} /><Typography variant="h2">프로그램 시작</Typography><Typography color="text.secondary" variant="body2">회원 컨디션에 맞는 프로그램을 추천받습니다.</Typography></Stack></CardActionArea></Grid><Grid item sm={6} xs={12}><CardActionArea onClick={() => navigate(routeBuilder.master("history"))} sx={{ bgcolor: palette.surfaceRaised, border: 1, borderColor: "divider", borderRadius: `${palette.radiusMd}px`, minHeight: 176, p: 3, transition: "transform 150ms ease, border-color 150ms ease", "&:hover": { borderColor: "primary.main", transform: "translateY(-3px)" } }}><Stack alignItems="center" spacing={1.5}><HistoryIcon color="primary" sx={{ fontSize: 42 }} /><Typography variant="h2">출력 내역</Typography><Typography color="text.secondary" variant="body2">이전 Workout Session과 출력 기록을 확인합니다.</Typography></Stack></CardActionArea></Grid></Grid></Stack></Box>;
  }
  return (
    <Stack alignItems="center" spacing={{ md: 4, xs: 3 }} sx={{ maxWidth: 1240, mx: "auto", pb: 6, width: "100%" }}>
      <StepIndicator currentStep={currentStep} />
      {sessionError ? <Alert severity="error" sx={{ maxWidth: 1180, width: "100%" }}>{sessionError}</Alert> : null}
      {sessionSaving ? <Alert icon={<CircularProgress size={20} />} severity="info" sx={{ maxWidth: 1180, width: "100%" }}>운동 세션을 저장하고 있습니다.</Alert> : null}

      {currentStep === 1 ? (
        <Box sx={{ maxWidth: 820, mx: "auto", width: "100%" }}>
            <Stack spacing={{ md: 4, xs: 3 }}>
              <Stack alignItems="center" spacing={1} textAlign="center">
                <FitnessCenterIcon color="primary" sx={{ fontSize: 32 }} />
                <Typography sx={{ fontSize: { md: 36, xs: 30 }, fontWeight: 900 }}>회원 선택</Typography>
                 <Typography color="text.secondary">본인 이름을 선택해 주세요.</Typography>
              </Stack>
              <Stack spacing={1.25}>
                <Typography fontWeight={900}>초성 선택</Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, justifyContent: "center" }}>
                  {([...KOREAN_INITIALS.map((initial) => ({ value: initial, label: initial })), { value: "OTHER", label: "기타" }] as Array<{ value: MemberInitialFilter; label: string }>).map((option) => (
                    <Button
                      key={option.value}
                      aria-pressed={!hasSearchQuery && memberInitial === option.value}
                      color={!hasSearchQuery && memberInitial === option.value ? "primary" : "inherit"}
                      variant={!hasSearchQuery && memberInitial === option.value ? "contained" : "outlined"}
                      onClick={() => { setMemberInitial(option.value); setMemberQuery(""); }}
                      sx={{ height: 48, minWidth: option.value === "OTHER" ? 64 : 48, p: 0, width: option.value === "OTHER" ? 64 : 48 }}
                    >
                      {option.label}
                    </Button>
                  ))}
                </Box>
              </Stack>
              {memberStatus === "loading" ? <LoadingState message="회원 목록을 불러오는 중입니다." /> : null}
              {memberStatus === "error" ? <ErrorState message={memberError} /> : null}
              {memberStatus === "ready" && filteredMembers.length === 0 && (hasSearchQuery || memberInitial) ? (
                <EmptyState
                  title={hasSearchQuery ? "검색 결과가 없습니다." : `${memberInitial === "OTHER" ? "기타" : memberInitial}로 시작하는 회원이 없습니다.`}
                  description={hasSearchQuery ? "다른 이름이나 전화번호로 다시 검색해 주세요." : "다른 초성을 선택해 주세요."}
                />
              ) : null}
              {memberStatus === "ready" && filteredMembers.length > 0 ? (
                <Grid container spacing={1.5}>
                  {filteredMembers.map((member) => (
                    <Grid item key={member.memberId} md={4} sm={6} xs={12}>
                      <CardActionArea
                        aria-label={`${member.displayName} 회원 선택`}
                        onClick={() => selectMember(member)}
                        sx={{
                          bgcolor: palette.surfaceInteractive,
                          border: 1,
                          borderColor: selectedMember?.memberId === member.memberId ? "primary.main" : "divider",
                          borderRadius: `${palette.radiusMd}px`,
                          boxShadow: selectedMember?.memberId === member.memberId ? palette.shadowAccent : "none",
                          minHeight: 80,
                          p: 1.75,
                          transition: "border-color 150ms ease, background-color 150ms ease, transform 150ms ease",
                          "&:hover": { borderColor: "primary.main", bgcolor: palette.surfaceRaised, transform: "translateY(-1px)" },
                          "&:active": { bgcolor: palette.primaryGoldMuted, transform: "none" },
                        }}
                      >
                        <Stack alignItems="center" direction="row" spacing={1.25}><Box sx={{ alignItems: "center", bgcolor: selectedMember?.memberId === member.memberId ? "primary.main" : palette.surfaceRaised, border: 1, borderColor: selectedMember?.memberId === member.memberId ? "primary.main" : "divider", borderRadius: 999, color: selectedMember?.memberId === member.memberId ? "primary.contrastText" : "text.secondary", display: "flex", fontSize: 17, fontWeight: 900, height: 42, justifyContent: "center", width: 42 }}>{member.displayName.trim().charAt(0)}</Box><Box sx={{ flex: 1 }}><Typography fontWeight={900}>{member.displayName}</Typography><Typography color="text.secondary" variant="caption">회원</Typography></Box>{selectedMember?.memberId === member.memberId ? <CheckCircleIcon color="primary" fontSize="small" /> : null}</Stack>
                      </CardActionArea>
                    </Grid>
                  ))}
                </Grid>
              ) : null}
              <Stack spacing={1}>
                <Typography color="text.secondary" fontWeight={700} variant="body2">직접 이름 또는 전화번호 검색</Typography>
                <SearchField label="회원 이름 또는 전화번호 검색" showLabel={false} value={memberQuery} onChange={setMemberQuery} />
              </Stack>
              {memberStatus === "ready" && !hasSearchQuery && !memberInitial ? <Typography color="text.secondary" textAlign="center" variant="body2">초성을 선택하거나 이름을 검색해 주세요.</Typography> : null}
              <Button disabled={!selectedMember} endIcon={<ArrowForwardIcon />} variant="contained" onClick={() => setCurrentStep(2)} sx={{ alignSelf: "center", minHeight: 54, minWidth: { sm: 280, xs: "100%" } }}>{selectedMember ? `${selectedMember.displayName} 회원으로 계속하기` : "회원을 선택해 주세요"}</Button>
            </Stack>
        </Box>
      ) : null}

      {currentStep === 2 ? (
        <Card sx={centeredCardSx(1080)}>
          <CardContent sx={{ p: { md: 3, xs: 2 } }}>
            <Stack spacing={2.25}>
              <Stack direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={1.5}>
                <Stack spacing={0.5}>
                  <Typography color="primary.main" fontWeight={800} variant="overline">TODAY'S CONDITION</Typography>
                  <Typography variant="h1">컨디션 확인</Typography>
                  <Typography color="text.secondary"><Box component="span" color="text.primary" fontWeight={900}>{selectedMember?.displayName}</Box> 회원의 오늘 상태를 알려주세요.</Typography>
                  {intelligenceStatus === "loading" ? <Stack alignItems="center" direction="row" spacing={1}><CircularProgress size={16} /><Typography color="text.secondary" variant="body2">최근 운동 기록을 확인하고 있습니다.</Typography></Stack> : null}
                  {intelligenceStatus === "ready" && recentWorkout ? <Stack direction="row" flexWrap="wrap" gap={1}><Chip label={`최근 운동 ${recentWorkout.title}`} /><Chip label={formatDaysAgo(recentWorkout.daysAgo)} variant="outlined" /></Stack> : null}
                  {intelligenceStatus === "ready" && !recentWorkout ? <Typography color="text.secondary" variant="body2">최근 운동 기록이 없습니다.</Typography> : null}
                  {intelligenceStatus === "error" ? <Typography color="error.main" variant="body2">최근 운동 기록을 불러오지 못했습니다.</Typography> : null}
                  {intelligenceStatus === "idle" ? <Typography color="text.secondary" variant="body2">컨디션을 선택하면 최근 운동 기록을 확인합니다.</Typography> : null}
                </Stack>
                <Button startIcon={<ArrowBackIcon />} variant="outlined" onClick={() => setCurrentStep(1)}>회원 선택</Button>
              </Stack>

              <Stack spacing={1}><Typography fontWeight={900}>컨디션 상태</Typography><Grid container spacing={1.5}>{conditionOptions.map((option) => <Grid item key={option.value} md={4} xs={12}><CardActionArea aria-label={`컨디션 상태 ${option.label}`} aria-pressed={condition.condition === option.value} onClick={() => setCondition((current) => ({ ...current, condition: option.value }))} sx={largeChoiceCardSx(condition.condition === option.value)}><Stack alignItems="center" direction="row" spacing={1.5}><Typography aria-hidden="true" fontSize={30}>{option.icon}</Typography><Box><Typography fontWeight={900}>{option.label}</Typography><Typography color="text.secondary" variant="body2">{option.description}</Typography></Box></Stack></CardActionArea></Grid>)}</Grid></Stack>

              <Stack spacing={1}><Typography fontWeight={900}>수면 상태</Typography><Grid container spacing={1.5}>{sleepOptions.map((option) => <Grid item key={option.value} md={4} xs={12}><CardActionArea aria-label={`수면 상태 ${option.label}`} aria-pressed={condition.sleep === option.value} onClick={() => setCondition((current) => ({ ...current, sleep: option.value }))} sx={largeChoiceCardSx(condition.sleep === option.value)}><Stack alignItems="center" direction="row" spacing={1.5}><Typography aria-hidden="true" fontSize={28}>{option.icon}</Typography><Box><Typography fontWeight={900}>{option.label}</Typography><Typography color="text.secondary" variant="body2">{option.description}</Typography></Box></Stack></CardActionArea></Grid>)}</Grid></Stack>

              <Stack spacing={1.5}><Box><Typography fontWeight={900}>피로 · 근육통 부위</Typography><Typography color="text.secondary" variant="body2">불편한 부위를 모두 선택하세요.</Typography></Box><Box sx={{ alignItems: "center", bgcolor: palette.surfaceInteractive, border: 1, borderColor: "divider", borderRadius: `${palette.radiusMd}px`, display: "grid", gap: 2, gridTemplateColumns: { md: "minmax(180px, .8fr) minmax(0, 1.2fr)", xs: "1fr" }, p: { md: 2.5, xs: 2 } }}><Stack alignItems="center"><ConditionBodyMap areas={condition.fatigueAreas} /></Stack><Box sx={{ display: "grid", gap: 1, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>{fatigueOptions.map((option) => { const active = condition.fatigueAreas.includes(option.value); return <Button key={option.value} aria-pressed={active} color={active ? "primary" : "inherit"} variant={active ? "contained" : "outlined"} onClick={() => toggleFatigue(option.value)} sx={{ minHeight: 48 }}>{option.label}</Button>; })}<Button aria-pressed={condition.fatigueAreas.length === 0} color={condition.fatigueAreas.length === 0 ? "primary" : "inherit"} variant={condition.fatigueAreas.length === 0 ? "contained" : "outlined"} onClick={() => setCondition((current) => ({ ...current, fatigueAreas: [] }))} sx={{ minHeight: 48 }}>없음</Button></Box></Box></Stack>

              <Stack spacing={1}><Stack alignItems="center" direction="row" justifyContent="space-between"><Typography fontWeight={900}>피로도</Typography><Chip color="primary" label={`${fatigueScale[condition.stress - 1].value}. ${fatigueScale[condition.stress - 1].label}`} /></Stack><Box sx={{ px: 1 }}><Slider aria-label="피로도" marks={fatigueScale.map(({ value }) => ({ value }))} max={5} min={1} step={1} value={condition.stress} valueLabelDisplay="off" onChange={(_, value) => setCondition((current) => ({ ...current, stress: Number(value) }))} /><Box sx={{ display: "grid", gap: 0.5, gridTemplateColumns: "repeat(5, 1fr)" }}>{fatigueScale.map((level) => { const active = condition.stress === level.value; return <Box key={level.value} sx={{ color: active ? "primary.main" : "text.secondary", textAlign: "center" }}><Typography fontWeight={active ? 900 : 700} variant="caption">{level.label}</Typography><Typography sx={{ display: { md: "block", xs: "none" } }} variant="caption">{level.description}</Typography></Box>; })}</Box></Box></Stack>

              <Stack spacing={1}><Typography fontWeight={900}>음주 여부</Typography><Grid container spacing={1.5}>{alcoholOptions.map((option) => <Grid item key={option.value} md={6} xs={12}><CardActionArea aria-label={`음주 여부 ${option.label}`} aria-pressed={condition.alcohol === option.value} onClick={() => setCondition((current) => ({ ...current, alcohol: option.value }))} sx={{ ...largeChoiceCardSx(condition.alcohol === option.value), minHeight: 78 }}><Stack alignItems="center" direction="row" spacing={1.5}><Typography aria-hidden="true" fontSize={26}>{option.icon}</Typography><Typography fontWeight={900}>{option.label}</Typography></Stack></CardActionArea></Grid>)}</Grid></Stack>

              <Card sx={{ ...infoCardSx, height: "auto" }}><CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}><Typography color="text.secondary" variant="caption">오늘 상태 요약</Typography><Typography fontWeight={800}>{condition.sleep ? `수면 ${sleepOptions.find((item) => item.value === condition.sleep)?.label}` : "수면 미선택"} · {condition.fatigueAreas.length > 0 ? `${condition.fatigueAreas.map((area) => fatigueOptions.find((item) => item.value === area)?.label ?? area).join(", ")} 피로` : "근육 피로 없음"} · {condition.alcohol === "NO" ? "음주 없음" : condition.alcohol === "YES" ? "음주 있음" : "음주 미선택"} · {condition.condition ? `컨디션 ${conditionOptions.find((item) => item.value === condition.condition)?.label}` : "컨디션 미선택"}</Typography></CardContent></Card>

              <Card sx={{ ...infoCardSx, height: "auto" }}><CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}><Stack alignItems={{ sm: "center", xs: "stretch" }} direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={1.5}><Box><FormControlLabel control={<Switch checked={useAiRecommendation} onChange={(event) => setUseAiRecommendation(event.target.checked)} />} label="AI 추천 사용" /><Typography color="text.secondary" variant="body2">회원 상태와 최근 운동 기록을 함께 반영합니다.</Typography></Box><Button disabled={!canRecommend || programState.status !== "ready"} endIcon={<ArrowForwardIcon />} startIcon={<AutoAwesomeIcon />} variant="contained" onClick={() => void runRecommendation()} sx={{ minHeight: 52, minWidth: 220, transition: "transform 120ms ease", "&:hover": { transform: "translateY(-2px)" } }}>프로그램 추천 받기</Button></Stack></CardContent></Card>
              {programState.status === "error" ? <Alert severity="error">{programState.message}</Alert> : null}
              {programState.status === "ready" && runtimePrograms.length === 0 ? <EmptyState title="현재 조건에 맞는 추천 프로그램이 없습니다." description="컨디션을 조정하거나 Condition Lab에서 프로그램을 추가해 주세요." /> : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {currentStep === 3 ? (
        <Card sx={centeredCardSx(1180)}>
          <CardContent sx={{ p: { md: 4, xs: 2.5 } }}>
            <Stack spacing={3}>
              <Stack direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={1.5}>
                <Stack spacing={0.75}>
                  <Stack alignItems="center" direction="row" spacing={1}>
                    <Typography variant="h1">오늘의 추천 프로그램</Typography>
                  </Stack>
                  <Typography color="text.secondary">{selectedMember?.displayName} 회원에게 가장 적합한 프로그램을 추천했습니다.</Typography>
                </Stack>
                <Button startIcon={<ArrowBackIcon />} variant="outlined" onClick={() => setCurrentStep(2)}>컨디션 수정</Button>
              </Stack>
              {programState.status === "loading" ? <LoadingState message="운동 프로그램을 불러오는 중입니다." /> : null}
              {programState.status === "error" ? <ErrorState message={programState.message} /> : null}
              {aiStatus === "error" ? <Alert severity="warning">AI 추천을 불러오지 못해 기본 추천 결과를 사용합니다. {aiError}</Alert> : null}
              <Card sx={{ ...infoCardSx, height: "auto" }}><CardContent sx={{ py: 1.5 }}><Stack alignItems="center" direction={{ sm: "row", xs: "column" }} flexWrap="wrap" gap={1.25}><Typography color="text.secondary" fontWeight={800} variant="caption">TODAY CONTEXT</Typography><Chip label={selectedMember?.displayName ?? "회원"} size="small" /><Chip label={`수면 ${sleepOptions.find((item) => item.value === condition.sleep)?.label ?? "미선택"}`} size="small" variant="outlined" /><Chip label={condition.fatigueAreas.length > 0 ? `${condition.fatigueAreas.map((area) => fatigueOptions.find((item) => item.value === area)?.label).join(", ")} 피로` : "근육 피로 없음"} size="small" variant="outlined" /><Chip label={`컨디션 ${conditionOptions.find((item) => item.value === condition.condition)?.label ?? "미선택"}`} size="small" variant="outlined" /></Stack></CardContent></Card>
              {recommendation ? (
                <Card sx={{ ...infoCardSx, borderColor: "primary.main", borderWidth: 2, boxShadow: palette.shadowAccent }}>
                  <CardContent sx={{ p: { md: 3.5, xs: 2.5 } }}><Stack spacing={2.5}>
                    <Stack direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={1.5}>
                      <Stack direction="row" spacing={2}><Box sx={{ alignItems: "center", bgcolor: "primary.main", borderRadius: 999, color: "primary.contrastText", display: "flex", fontSize: 24, fontWeight: 900, height: 56, justifyContent: "center", minWidth: 56 }}>1</Box><Box><Chip color="primary" label="BEST" size="small" /><Typography sx={{ fontSize: { md: 30, xs: 23 }, mt: 1 }} variant="h2">{recommendation.program.title}</Typography><Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}><Chip label={getCategoryLabel(recommendation.program.category)} /><Chip label={getDifficultyLabel(recommendation.program.difficulty)} variant="outlined" /><Chip label={`${recommendation.program.exercises.length}개 운동`} variant="outlined" /></Stack></Box></Stack>
                      <Stack alignItems="center" spacing={1}><MuscleSilhouette active area={categoryToBodyArea(recommendation.program.category)} /><Button endIcon={<ArrowForwardIcon />} variant="contained" onClick={() => selectProgramForBuilder(recommendation.program)} sx={{ minHeight: 48 }}>이 프로그램으로 진행하기</Button></Stack>
                    </Stack>
                    <Box sx={{ bgcolor: palette.primaryGoldMuted, border: 1, borderColor: palette.primaryGoldBorder, borderRadius: `${palette.radiusMd}px`, p: 2 }}><Typography color="primary.main" fontWeight={900} variant="caption">💡 추천 이유</Typography><Typography sx={{ mt: 0.75 }}>{displayRecommendationReason}</Typography></Box>
                    <Stack direction="row" flexWrap="wrap" gap={1}>{recommendation.program.exercises.map((exercise) => <Chip key={exercise.id} label={`${exercise.order}. ${exercise.name} · ${exercise.sets}세트`} sx={{ minHeight: 38 }} variant="outlined" />)}</Stack>
                  </Stack></CardContent>
                </Card>
              ) : null}
              {rankedPrograms.filter(({ program }) => program.id !== recommendation?.program.id).length > 0 ? <Stack spacing={1.5}><Box><Typography variant="h2">다른 추천</Typography><Typography color="text.secondary">오늘 선택할 수 있는 차순위 프로그램입니다.</Typography></Box><Grid container spacing={1.5}>{rankedPrograms.filter(({ program }) => program.id !== recommendation?.program.id).slice(0, 2).map(({ candidate: _candidate, program }) => { const rank = (recommendationTrace?.candidatePrograms.findIndex((item) => item.programId === program.id) ?? 0) + 1; return <Grid item key={program.id} md={6} xs={12}><Card sx={{ ...infoCardSx, boxShadow: "none" }}><CardContent><Stack spacing={1.5}><Stack alignItems="center" direction="row" justifyContent="space-between"><Chip label={`${rank}순위`} size="small" variant="outlined" /><MuscleSilhouette active area={categoryToBodyArea(program.category)} /></Stack><Typography variant="h2">{program.title}</Typography><Stack direction="row" flexWrap="wrap" gap={1}><Chip label={getCategoryLabel(program.category)} size="small" /><Chip label={getDifficultyLabel(program.difficulty)} size="small" variant="outlined" /><Chip label={`${program.exercises.length}개 운동`} size="small" variant="outlined" /></Stack><Button variant="outlined" onClick={() => selectProgramForBuilder(program)}>이 프로그램 선택</Button></Stack></CardContent></Card></Grid>; })}</Grid></Stack> : null}
              <Button endIcon={<ExpandMoreIcon sx={{ transform: showRecommendationBasis ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }} />} variant="text" onClick={() => setShowRecommendationBasis((current) => !current)}>{showRecommendationBasis ? "추천 근거 닫기" : "추천 근거 보기"}</Button>
              <Collapse in={showRecommendationBasis}><RecommendationTraceCard recommendation={recommendation} trace={recommendationTrace} /></Collapse>
            </Stack>
          </CardContent>
        </Card>
      ) : null}
      {currentStep === 4 ? (
        <Card sx={centeredCardSx(1240)}>
          <CardContent sx={{ p: { md: 4, xs: 2.5 } }}>
            <Stack spacing={3}>
              <Stack direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={1.5}>
                <Stack spacing={0.75}>
                  <Typography variant="h1">추천 분석</Typography>
                  <Typography color="text.secondary">현재 상태와 실제 프로그램 구성을 함께 확인하세요.</Typography>
                </Stack>
                <Button startIcon={<ArrowBackIcon />} variant="outlined" onClick={() => setCurrentStep(3)}>다른 추천 프로그램 보기</Button>
              </Stack>
              <Card sx={{ ...infoCardSx, height: "auto" }}><CardContent sx={{ py: 1.5 }}><Stack direction="row" flexWrap="wrap" gap={1}><Chip label={selectedMember?.displayName ?? "회원"} /><Chip label={recentWorkout ? `${formatDaysAgo(recentWorkout.daysAgo)} · ${recentWorkout.title}` : "최근 운동 없음"} variant="outlined" /><Chip label={condition.fatigueAreas.length > 0 ? `피로 ${condition.fatigueAreas.map((area) => fatigueOptions.find((item) => item.value === area)?.label).join(", ")}` : "피로 부위 없음"} variant="outlined" /><Chip label={`수면 ${sleepOptions.find((item) => item.value === condition.sleep)?.label ?? "미선택"}`} variant="outlined" /><Chip label={`컨디션 ${conditionOptions.find((item) => item.value === condition.condition)?.label ?? "미선택"}`} variant="outlined" /><Chip label={condition.alcohol === "YES" ? "음주 있음" : "음주 없음"} variant="outlined" /></Stack></CardContent></Card>
              {!snapshotValidation.valid ? <Alert severity="warning">{snapshotValidation.errors[0]}</Alert> : null}
              {catalogState.status === "loading" ? <LoadingState message="Exercise Catalog를 불러오는 중입니다." /> : null}
              {catalogState.status === "error" ? <Alert severity="warning">{catalogState.message}</Alert> : null}
              <Grid container spacing={2.5}><Grid item lg={4} xs={12}><Stack spacing={2}><Card sx={infoCardSx}><CardContent><Stack spacing={1.5}><Typography variant="h2">확인 사항</Typography>{(recommendationTrace?.decisionFactors ?? []).filter((factor) => factor.score > 0).slice(0, 4).map((factor) => <Stack key={`${factor.key}-${factor.reason}`} direction="row" spacing={1.25}><CheckCircleIcon color="success" fontSize="small" /><Box><Typography fontWeight={800}>{factorDisplayLabel(factor)}</Typography><Typography color="text.secondary" variant="body2">{factorDisplayReason(factor)}</Typography></Box></Stack>)}</Stack></CardContent></Card><Card sx={infoCardSx}><CardContent><Stack spacing={1.5}><Typography variant="h2">주의 사항</Typography>{(recommendationTrace?.decisionFactors ?? []).filter((factor) => factor.score < 0).slice(0, 3).map((factor) => <Stack key={`${factor.key}-${factor.reason}`} direction="row" spacing={1.25}><WarningAmberIcon color="warning" fontSize="small" /><Box><Typography fontWeight={800}>{factorDisplayLabel(factor)}</Typography><Typography color="text.secondary" variant="body2">{factorDisplayReason(factor)}</Typography></Box></Stack>)}{(recommendationTrace?.decisionFactors ?? []).every((factor) => factor.score >= 0) ? <Typography color="text.secondary">특별한 주의 사항이 없습니다.</Typography> : null}{builderState?.memo ? <Typography color="text.secondary" variant="body2">{builderState.memo}</Typography> : null}</Stack></CardContent></Card></Stack></Grid><Grid item lg={8} xs={12}><Card sx={{ ...infoCardSx, borderColor: "primary.main", borderWidth: 2, boxShadow: palette.shadowAccent }}><CardContent sx={{ p: { md: 3, xs: 2 } }}><Stack spacing={2.5}><Stack direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={2}><Stack direction="row" spacing={1.5}><MuscleSilhouette active area={builderState ? categoryToBodyArea(builderState.category) : "NONE"} /><Box><Chip color="primary" label="BEST" size="small" /><Typography sx={{ fontSize: { md: 28, xs: 22 }, mt: 1 }} variant="h2">{builderState?.title}</Typography><Typography color="text.secondary">{builderState ? getCategoryLabel(builderState.category) : ""} · {builderState ? getDifficultyLabel(builderState.difficulty) : ""}</Typography></Box></Stack><Stack direction="row" flexWrap="wrap" gap={1}><Chip label={`${builderState?.exercises.length ?? 0}개 운동`} /><Chip label={`${builderState?.exercises.reduce((sum, item) => sum + item.sets, 0) ?? 0}세트`} variant="outlined" /></Stack></Stack><Box sx={{ bgcolor: palette.primaryGoldMuted, borderRadius: `${palette.radiusMd}px`, p: 2 }}><Typography color="primary.main" fontWeight={900} variant="caption">추천 포인트</Typography><Typography sx={{ mt: 0.75 }}>{displayRecommendationReason}</Typography></Box><Box sx={{ border: 1, borderColor: "divider", borderRadius: `${palette.radiusMd}px`, overflow: "hidden" }}>{(builderState?.exercises ?? []).map((exercise) => <Box key={exercise.id} sx={{ alignItems: "center", bgcolor: palette.surfaceInteractive, borderTop: exercise.order > 1 ? 1 : 0, borderColor: "divider", display: "grid", gap: 1.5, gridTemplateColumns: { sm: "42px minmax(0, 1fr) auto", xs: "36px minmax(0, 1fr)" }, px: 2, py: 1.5 }}><Typography color="primary.main" fontWeight={900}>{String(exercise.order).padStart(2, "0")}</Typography><Box><Typography fontWeight={900}>{exercise.name}</Typography><Typography color="text.secondary" variant="body2">{exercise.memo || "운동 목표에 맞춰 정확한 자세로 진행하세요."}</Typography></Box><Chip label={`${exercise.sets} SET`} size="small" sx={{ gridColumn: { sm: "auto", xs: "2" } }} variant="outlined" /></Box>)}</Box></Stack></CardContent></Card></Grid></Grid>
              <Stack direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={1.5}><Button startIcon={<ArrowBackIcon />} variant="text" onClick={() => setCurrentStep(3)}>이전 단계로</Button><Button disabled={!snapshotValidation.valid || !selectedMember || !snapshotSourceProgram || !snapshotValues} endIcon={<ArrowForwardIcon />} startIcon={<PrintIcon />} variant="contained" onClick={goPrintPreview} sx={{ minHeight: 52, minWidth: 240 }}>이 프로그램으로 진행하기</Button></Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
};











