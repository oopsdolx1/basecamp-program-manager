import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import HistoryIcon from "@mui/icons-material/History";
import PrintIcon from "@mui/icons-material/Print";
import RedoIcon from "@mui/icons-material/Redo";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import UndoIcon from "@mui/icons-material/Undo";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Alert, Box, Button, Card, CardActionArea, CardContent, Chip, CircularProgress, Collapse, FormControlLabel, Grid, LinearProgress, MenuItem, Slider, Stack, Switch, TextField, Typography } from "@mui/material";
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
import { filterMembers } from "../../../members/services/memberService";
import { getCategoryLabel, getDifficultyLabel, programCategories, programDifficulties } from "../../../programs/config/programOptions";
import { usePrograms } from "../../../programs/hooks/usePrograms";
import { sanitizeProgramForm, validateProgramForm } from "../../../programs/services/programService";
import type { Program, ProgramDifficulty, ProgramFormValues } from "../../../programs/types/program.types";
import type { MemberProvider } from "../../providers/memberProvider";
import type { RecommendationProvider } from "../../providers/recommendationProvider";
import { applyAiRecommendationToSnapshot, requestAiRecommendation } from "../../services/aiRecommendationService";
import { analyzeMemberIntelligence } from "../../services/memberIntelligenceService";
import { analyzePeriodization } from "../../services/periodizationEngine";
import { buildRecommendationReason, recommendProgram } from "../../services/conditionRecommendationService";
import { savePrintSnapshot } from "../../services/printSnapshotSession";
import { createSnapshotBuilderHistory, snapshotBuilderService, type SnapshotBuilderExercise, type SnapshotBuilderHistory } from "../../services/snapshotBuilderService";
import type { AiRecommendationResult, AlcoholStatus, ConditionInput, ConditionStatus, FatigueArea, MemberIntelligenceMetadata, MemberIntelligenceSummary, PeriodizationSummary, RecommendationResult, RecommendationTrace, RecentWorkoutSummary, SleepQuality } from "../../types/condition.types";
import { SnapshotExerciseBuilderRow } from "../SnapshotExerciseBuilderRow/SnapshotExerciseBuilderRow";
import { palette } from "../../../../theme/palette";

type PrintStep = 1 | 2 | 3 | 4;
type AiStatus = "idle" | "loading" | "ready" | "error" | "skipped";
type IntelligenceStatus = "idle" | "loading" | "ready" | "error";
type MemberLoadStatus = "loading" | "ready" | "error";

interface QuickPrintFlowProps {
  appId: AppId;
  memberProvider: MemberProvider;
  recommendationProvider: RecommendationProvider;
}

const stepLabels = ["회원 선택", "Today's Condition", "추천 프로그램", "Snapshot 수정"];
const conditionOptions: Array<{ value: ConditionStatus; label: string }> = [
  { value: "GOOD", label: "좋음" },
  { value: "NORMAL", label: "보통" },
  { value: "BAD", label: "나쁨" },
];
const sleepOptions: Array<{ value: SleepQuality; label: string }> = [
  { value: "ENOUGH", label: "충분함" },
  { value: "NORMAL", label: "보통" },
  { value: "LACK", label: "부족함" },
];
const alcoholOptions: Array<{ value: AlcoholStatus; label: string }> = [
  { value: "NO", label: "없음" },
  { value: "YES", label: "있음" },
];
const fatigueOptions: Array<{ value: FatigueArea; label: string }> = [
  { value: "CHEST", label: "가슴" },
  { value: "BACK", label: "등" },
  { value: "SHOULDER", label: "어깨" },
  { value: "ARMS", label: "팔" },
  { value: "LOWER_BODY", label: "하체" },
];
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
const infoCardSx = {
  bgcolor: palette.surfaceSection,
  border: 1,
  borderColor: "divider",
  borderRadius: `${palette.radiusMd}px`,
  boxShadow: palette.shadowCard,
  height: "100%",
};
const globalActions = [{ key: "sets_plus", label: "占쏙옙체 占쏙옙트 +1" }, { key: "sets_minus", label: "占쏙옙체 占쏙옙트 -1" }, { key: "rest_plus", label: "占쌨쏙옙 +30占쏙옙" }, { key: "rest_minus", label: "占쌨쏙옙 -30占쏙옙" }, { key: "clear_memo", label: "占쏙옙체 占쌨몌옙 占쏙옙占쏙옙" }, { key: "restore", label: "占쏙옙천 占쏙옙占승뤄옙 占쏙옙占쏙옙" }] as const;
const formatDaysAgo = (daysAgo: number | null): string => (daysAgo === null ? "占쏙옙占?占쏙옙占쏙옙 占싱삼옙" : daysAgo === 0 ? "占쏙옙占쏙옙" : daysAgo === 1 ? "1占쏙옙 占쏙옙" : `${daysAgo}占쏙옙 占쏙옙`);
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

const StepIndicator = ({ currentStep }: { currentStep: PrintStep }): JSX.Element => <Stack spacing={1.5} sx={{ maxWidth: 1040, width: "100%" }}><Typography color="text.secondary" textAlign="center" variant="body2">현재 단계 {currentStep} / {stepLabels.length}</Typography><Stack alignItems="stretch" direction={{ md: "row", xs: "column" }} gap={1.25} justifyContent="center">{stepLabels.map((label, index) => { const step = (index + 1) as PrintStep; const active = currentStep === step; const complete = currentStep > step; return <Box key={label} sx={{ alignItems: "center", bgcolor: active ? "primary.main" : complete ? palette.primaryGoldMuted : palette.surfaceRaised, border: 1, borderColor: active || complete ? "primary.main" : "divider", borderRadius: `${palette.radiusMd}px`, boxShadow: active ? palette.shadowAccent : "none", color: active ? "primary.contrastText" : "text.primary", display: "flex", flex: 1, gap: 1.25, minHeight: 72, px: 2, py: 1.5, transition: "background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease" }}><Box sx={{ alignItems: "center", bgcolor: active ? "rgba(0, 0, 0, 0.18)" : complete ? palette.primaryGoldBorder : "rgba(255, 255, 255, 0.04)", border: 1, borderColor: active || complete ? "rgba(0, 0, 0, 0.12)" : palette.borderStrong, borderRadius: 999, display: "inline-flex", fontSize: 14, fontWeight: 900, height: 36, justifyContent: "center", minWidth: 36 }}>{complete ? "✓" : step}</Box><Stack spacing={0.25}><Typography fontWeight={900}>0{step}</Typography><Typography color={active ? "inherit" : "text.secondary"} variant="body2">{label}</Typography></Stack></Box>; })}</Stack></Stack>;
const MemberIntelligenceCard = ({ intelligence, status }: { intelligence: MemberIntelligenceSummary | null; status: IntelligenceStatus }): JSX.Element => <Card sx={infoCardSx}><CardContent><Stack spacing={2}><Stack direction="row" justifyContent="space-between" spacing={1}><Typography variant="h2">Member Intelligence</Typography>{status === "loading" ? <Chip label="占싻쇽옙 占쏙옙" size="small" /> : null}</Stack>{status === "loading" ? <LinearProgress /> : null}{!intelligence ? <Typography color="text.secondary">占쏘동 占싱뤄옙占쏙옙 占싻쇽옙占싹몌옙 회占쏙옙, 占쏙옙占쏙옙, 占쏙옙, 占쏙옙占쏙옙 占쏙옙占쏙옙占쏙옙 표占시됩니댐옙.</Typography> : <Grid container spacing={1.5}><Grid item md={3} xs={6}><Chip color={scoreColor(intelligence.recoveryScore, true)} label={`Recovery ${intelligence.recoveryScore}`} /></Grid><Grid item md={3} xs={6}><Chip color={scoreColor(intelligence.riskScore, false)} icon={<WarningAmberIcon />} label={`Risk ${intelligence.riskScore}`} /></Grid><Grid item md={3} xs={6}><Chip label={`占쌍깍옙 7占쏙옙 ${intelligence.frequency7}회`} variant="outlined" /></Grid><Grid item md={3} xs={6}><Chip label={`占쌍깍옙 30占쏙옙 ${intelligence.frequency30}회`} variant="outlined" /></Grid><Grid item md={3} xs={6}><Typography color="text.secondary">占쌍깍옙 占쏘동</Typography><Typography fontWeight={900}>{formatDaysAgo(intelligence.recentWorkoutDaysAgo)}</Typography></Grid><Grid item md={3} xs={6}><Typography color="text.secondary">占쏘동 占쏙옙占쏙옙</Typography><Typography fontWeight={900}>{intelligence.gapDays === null ? "占쏙옙占쏙옙" : `${intelligence.gapDays}占쏙옙`}</Typography></Grid><Grid item md={3} xs={6}><Typography color="text.secondary">Program 占쌥븝옙</Typography><Typography fontWeight={900}>{intelligence.repeatedProgramCount}회</Typography></Grid><Grid item md={3} xs={6}><Typography color="text.secondary">占쌕양성</Typography><Typography fontWeight={900}>P {intelligence.diversity10.programCount} / C {intelligence.diversity10.categoryCount}</Typography></Grid><Grid item xs={12}><Typography color="text.secondary">占쏘동 占쏙옙占쏙옙</Typography><Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 0.5 }}>{intelligence.bodyPartBias.length > 0 ? intelligence.bodyPartBias.slice(0, 4).map((item) => <Chip key={item.category} label={`${getCategoryLabel(item.category)} ${formatRatio(item.ratio)}`} size="small" />) : <Chip label="占쏙옙占쏙옙 占쏙옙占쏙옙占쏙옙 占쏙옙占쏙옙" size="small" variant="outlined" />}</Stack></Grid></Grid>}</Stack></CardContent></Card>;
const TrainingTrendCard = ({ periodization, status }: { periodization: PeriodizationSummary | null; status: IntelligenceStatus }): JSX.Element => <Card sx={infoCardSx}><CardContent><Stack spacing={2}><Stack direction="row" justifyContent="space-between" spacing={1}><Typography variant="h2">Training Trend</Typography>{status === "loading" ? <Chip label="占쏙옙占?占쏙옙" size="small" /> : null}</Stack>{status === "loading" ? <LinearProgress /> : null}{!periodization ? <Typography color="text.secondary">占쌍깍옙 占쏘동 占썲름占쏙옙 占싻쇽옙占싹몌옙 Cycle, Plateau, Deload, 占쏙옙占쏙옙 占쏙옙천占쏙옙 표占시됩니댐옙.</Typography> : <Grid container spacing={1.5}><Grid item md={3} xs={6}><Typography color="text.secondary">占쏙옙占쏙옙 Cycle</Typography><Typography fontWeight={900}>{periodization.currentCycle}</Typography></Grid><Grid item md={3} xs={6}><Typography color="text.secondary">Recovery</Typography><Typography fontWeight={900}>{recoveryTrendLabel(periodization.recoveryTrend)}</Typography></Grid><Grid item md={3} xs={6}><Typography color="text.secondary">Plateau</Typography><Typography fontWeight={900}>{periodization.plateau ? "Yes" : "No"}</Typography></Grid><Grid item md={3} xs={6}><Typography color="text.secondary">占쏙옙占쏙옙 占쏙옙천</Typography><Typography fontWeight={900}>{periodization.nextProgramHint ?? "占쏙옙占쏙옙"}</Typography></Grid><Grid item md={3} xs={6}><Chip color="primary" label={modeLabel(periodization.recommendedMode)} /></Grid><Grid item md={3} xs={6}><Chip color={periodization.deload ? "warning" : "default"} label={periodization.deload ? "Deload" : "Normal Load"} variant={periodization.deload ? "filled" : "outlined"} /></Grid><Grid item md={3} xs={6}><Chip label={`占쌍곤옙 占쏙옙 ${periodization.weeklyFrequency}회`} variant="outlined" /></Grid><Grid item md={3} xs={6}><Chip label={`占쌥븝옙 ${periodization.repeatedProgramCount}회`} variant="outlined" /></Grid><Grid item xs={12}><Typography color="text.secondary">占쌍깍옙 Program 占쏙옙占쏙옙</Typography><Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 0.5 }}>{periodization.recentProgramSequence.length > 0 ? periodization.recentProgramSequence.map((title) => <Chip key={title} label={title} size="small" />) : <Chip label="占쏙옙占?占쏙옙占쏙옙" size="small" variant="outlined" />}</Stack></Grid></Grid>}</Stack></CardContent></Card>;

const formatSignedScore = (value: number): string => `${value >= 0 ? "+" : ""}${value}`;

const RecommendationTraceCard = ({
  recommendation,
  trace,
  showCandidates,
  onToggleCandidates,
}: {
  recommendation: RecommendationResult | null;
  trace: RecommendationTrace | null;
  showCandidates: boolean;
  onToggleCandidates: () => void;
}): JSX.Element => {
  if (!recommendation) {
    return <Card sx={infoCardSx}><CardContent><Typography color="text.secondary">추천 결과가 없습니다.</Typography></CardContent></Card>;
  }

  if (!trace) {
    return <Card sx={infoCardSx}><CardContent><Stack spacing={1}><Typography variant="h2">추천 근거</Typography><Typography color="text.secondary">추천 근거 정보가 없습니다.</Typography></Stack></CardContent></Card>;
  }

  const positiveFactors = trace.decisionFactors.filter((factor) => factor.score > 0);
  const negativeFactors = trace.decisionFactors.filter((factor) => factor.score < 0);
  const candidates = trace.candidatePrograms.slice(0, 5);
  const factorCardSx = {
    border: 1,
    borderColor: "divider",
    borderRadius: `${palette.radiusSm}px`,
    bgcolor: palette.surfaceInteractive,
    p: 1.5,
  };

  return <Card sx={infoCardSx}><CardContent><Stack spacing={2.5}><Stack direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={1.5}><Stack spacing={0.5}><Typography variant="h2">추천 근거</Typography><Typography color="text.secondary">Rule Recommendation의 선택 근거와 후보 점수를 표시합니다.</Typography></Stack><Chip color="primary" label={`Final Score ${trace.selectedProgram.score}`} /></Stack><Grid container spacing={1.5}><Grid item md={6} xs={12}><Typography color="text.secondary">최종 추천 Program</Typography><Typography fontWeight={900}>{trace.selectedProgram.title}</Typography></Grid><Grid item md={6} xs={12}><Typography color="text.secondary">선택 이유</Typography><Typography fontWeight={900}>{trace.selectedProgram.reason}</Typography></Grid></Grid><Grid container spacing={2}><Grid item md={6} xs={12}><Stack spacing={1}><Typography fontWeight={900}>긍정 요인</Typography>{positiveFactors.length > 0 ? positiveFactors.map((factor) => <Box key={`${factor.key}-${factor.reason}`} sx={factorCardSx}><Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}><Typography fontWeight={700}>{factor.label}</Typography><Typography color="success.main" fontWeight={900}>{formatSignedScore(factor.score)}</Typography></Stack><Typography color="text.secondary" variant="body2">{factor.reason}</Typography></Box>) : <Typography color="text.secondary">긍정 요인이 없습니다.</Typography>}</Stack></Grid><Grid item md={6} xs={12}><Stack spacing={1}><Typography fontWeight={900}>감점 요인</Typography>{negativeFactors.length > 0 ? negativeFactors.map((factor) => <Box key={`${factor.key}-${factor.reason}`} sx={factorCardSx}><Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}><Typography fontWeight={700}>{factor.label}</Typography><Typography color="error.main" fontWeight={900}>{formatSignedScore(factor.score)}</Typography></Stack><Typography color="text.secondary" variant="body2">{factor.reason}</Typography></Box>) : <Typography color="text.secondary">감점 요인이 없습니다.</Typography>}</Stack></Grid></Grid><Stack alignItems="flex-start" spacing={1}><Button size="small" variant="outlined" onClick={onToggleCandidates}>{showCandidates ? "후보 프로그램 숨기기" : "후보 프로그램 보기"}</Button><Collapse in={showCandidates} sx={{ width: "100%" }}><Stack spacing={1} sx={{ pt: 1 }}>{candidates.map((candidate) => { const selected = candidate.programId === trace.selectedProgram.programId; return <Box key={candidate.programId} sx={{ border: 1, borderColor: selected ? "primary.main" : "divider", borderRadius: `${palette.radiusSm}px`, bgcolor: selected ? palette.primaryGoldMuted : palette.surfaceInteractive, boxShadow: selected ? palette.shadowAccent : "none", p: 1.5 }}><Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1.5}><Typography fontWeight={selected ? 900 : 700}>{candidate.title}</Typography><Stack alignItems="center" direction="row" spacing={1}><Typography fontWeight={900}>{candidate.score}</Typography>{selected ? <Chip color="primary" label="Selected" size="small" /> : null}</Stack></Stack></Box>; })}</Stack></Collapse></Stack><Typography color="text.secondary" variant="caption">Engine v{trace.engineVersion}</Typography></Stack></CardContent></Card>;
};

export const QuickPrintFlow = ({ appId, memberProvider, recommendationProvider }: QuickPrintFlowProps): JSX.Element => {
  const navigate = useNavigate();
  const { programState, programs } = usePrograms(appId);
  const { catalogState, options: catalogOptions } = useExerciseCatalog(appId);
  const [memberStatus, setMemberStatus] = useState<MemberLoadStatus>("loading");
  const [memberError, setMemberError] = useState("");
  const [members, setMembers] = useState<MemberSelectionItem[]>([]);
  const [currentStep, setCurrentStep] = useState<PrintStep>(1);
  const [memberQuery, setMemberQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<MemberSelectionItem | null>(null);
  const [condition, setCondition] = useState<ConditionInput>(defaultCondition);
  const [recentWorkout, setRecentWorkout] = useState<RecentWorkoutSummary | null>(null);
  const [intelligenceStatus, setIntelligenceStatus] = useState<IntelligenceStatus>("idle");
  const [intelligence, setIntelligence] = useState<MemberIntelligenceSummary | null>(null);
  const [intelligenceMetadata, setIntelligenceMetadata] = useState<MemberIntelligenceMetadata | null>(null);
  const [periodization, setPeriodization] = useState<PeriodizationSummary | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationResult | null>(null);
  const [recommendationTrace, setRecommendationTrace] = useState<RecommendationTrace | null>(null);
  const [showCandidates, setShowCandidates] = useState(false);
  const [recommendationReason, setRecommendationReason] = useState("");
  const [snapshotSourceProgram, setSnapshotSourceProgram] = useState<Program | null>(null);
  const [builderHistory, setBuilderHistory] = useState<SnapshotBuilderHistory | null>(null);
  const [useAiRecommendation, setUseAiRecommendation] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [aiRecommendation, setAiRecommendation] = useState<AiRecommendationResult | null>(null);
  const [aiError, setAiError] = useState("");
  const hasSearchQuery = memberQuery.trim().length > 0;
  const filteredMembers = useMemo(() => (hasSearchQuery ? filterMembers(members, memberQuery).slice(0, 40) : []), [hasSearchQuery, memberQuery, members]);
  const builderState = builderHistory?.present ?? null;
  const snapshotValues = useMemo(() => (builderState ? snapshotBuilderService.toProgramFormValues(builderState) : null), [builderState]);
  const snapshotValidation = useMemo(() => (snapshotValues ? validateProgramForm(snapshotValues) : { valid: false, errors: ["Snapshot占쏙옙 占쏙옙占쏙옙占싹댐옙."] }), [snapshotValues]);
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
      setMemberError(error instanceof Error ? error.message : "회占쏙옙 占쏙옙占쏙옙占쏙옙 占쌀뤄옙占쏙옙占쏙옙 占쏙옙占쌩쏙옙占싹댐옙.");
    });
    return () => {
      active = false;
    };
  }, [memberProvider]);

  useEffect(() => {
    if (!selectedMember || !condition.condition || !condition.sleep || !condition.alcohol) {
      setRecentWorkout(null);
      setIntelligence(null);
      setIntelligenceMetadata(null);
      setPeriodization(null);
      setIntelligenceStatus("idle");
      return;
    }
    let active = true;
    setIntelligenceStatus("loading");
    void recommendationProvider.getRecommendationContext(selectedMember.memberId, condition).then((context) => {
      if (!active) return;
      setRecentWorkout(context.recentWorkout);
      setIntelligence(context.intelligence);
      setIntelligenceMetadata(context.metadata);
      const analysisSource = analyzeMemberIntelligence(context.workoutHistory, condition);
      setPeriodization(context.periodization ?? analyzePeriodization({ intelligence: context.intelligence, history: analysisSource.history, condition }));
      setIntelligenceStatus("ready");
    }).catch(() => {
      if (!active) return;
      setRecentWorkout(null);
      setIntelligence(null);
      setIntelligenceMetadata(null);
      setPeriodization(null);
      setIntelligenceStatus("error");
    });
    return () => {
      active = false;
    };
  }, [condition, recommendationProvider, selectedMember]);

  useEffect(() => {
    if (currentStep !== 4) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const isUndo = event.ctrlKey && event.key.toLowerCase() === "z" && !event.shiftKey;
      const isRedo = event.ctrlKey && (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z"));
      if (isUndo) {
        event.preventDefault();
        setBuilderHistory((current) => (current ? snapshotBuilderService.undo(current) : current));
      }
      if (isRedo) {
        event.preventDefault();
        setBuilderHistory((current) => (current ? snapshotBuilderService.redo(current) : current));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentStep]);

  const resetRecommendationState = () => {
    setRecommendation(null);
    setRecommendationTrace(null);
    setShowCandidates(false);
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
    setIntelligence(null);
    setIntelligenceMetadata(null);
    setPeriodization(null);
    resetRecommendationState();
    setCurrentStep(2);
  };

  const toggleFatigue = (area: FatigueArea) => {
    setCondition((current) => ({
      ...current,
      fatigueAreas: current.fatigueAreas.includes(area) ? current.fatigueAreas.filter((item) => item !== area) : [...current.fatigueAreas, area],
    }));
  };

  const updateBuilderMeta = (patch: Partial<SnapshotBuilderHistory["present"]>) => {
    setBuilderHistory((current) => (current ? snapshotBuilderService.updateMeta(current, patch) : current));
  };

  const runRecommendation = async () => {
    const next = recommendProgram(programs, condition, recentWorkout, intelligence, periodization);
    if (!next) {
      setRecommendation(null);
      setRecommendationReason("占쏙옙천 占쏙옙占쏙옙占쏙옙 占쏙옙占싸그뤄옙占쏙옙 占쏙옙占쏙옙占싹댐옙.");
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
    setShowCandidates(false);
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
      setAiError(error instanceof Error ? error.message : "AI Recommendation占쏙옙 占쏙옙占쏙옙占쌩쏙옙占싹댐옙.");
      setBuilderHistory(baseHistory);
    }
    setCurrentStep(3);
  };

  const goPrintPreview = () => {
    if (!selectedMember || !snapshotSourceProgram || !snapshotValues) return;
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
      formValues: sanitizeProgramForm(snapshotValues),
    });
    navigate(routeBuilder.printPreview(snapshotProgramId, selectedMember.memberId));
  };

  const renderAiCards = (): JSX.Element | null => {
    if (aiStatus === "loading") return <Card sx={infoCardSx}><CardContent><Stack alignItems="center" direction="row" spacing={1.5}><CircularProgress size={20} /><Typography>AI Recommendation占쏙옙 占쏙옙占쏙옙占싹댐옙 占쏙옙占쌉니댐옙.</Typography></Stack></CardContent></Card>;
    if (aiStatus === "error") return <Alert severity="warning">AI Recommendation 占쏙옙占싻뤄옙 Rule Recommendation占쏙옙 占쏙옙占쏙옙占쌌니댐옙. {aiError}</Alert>;
    if (aiStatus === "skipped") return useAiRecommendation ? null : <Alert severity="info">AI 占쏙옙천占쏙옙 占쏙옙占쏙옙 占쌍억옙 Rule Recommendation占쏙옙 占쏙옙占쏙옙爛求占?</Alert>;
    if (!aiRecommendation) return null;
    return <Grid container spacing={2}>{[{ title: "占쏙옙천 占쏙옙占쏙옙", value: aiRecommendation.reason }, { title: "회占쏙옙 占쏙옙칭", value: aiRecommendation.coach }, { title: "占쏙옙占실삼옙占쏙옙", value: aiRecommendation.warning }].map((item) => <Grid item key={item.title} md={4} xs={12}><Card sx={infoCardSx}><CardContent><Stack spacing={1}><Stack alignItems="center" direction="row" spacing={1}><Chip color="primary" icon={<SmartToyIcon />} label="AI" size="small" /><Typography variant="h2">{item.title}</Typography></Stack><Typography color="text.secondary">{item.value}</Typography></Stack></CardContent></Card></Grid>)}</Grid>;
  };
  return (
    <Stack alignItems="center" spacing={3}>
      <StepIndicator currentStep={currentStep} />

      {currentStep === 1 ? (
        <Card sx={centeredCardSx(880)}><CardContent sx={{ p: { md: 4, xs: 2.5 } }}><Stack spacing={3}><Stack alignItems="center" spacing={1} textAlign="center"><FitnessCenterIcon color="primary" fontSize="large" /><Typography variant="h1">회占쏙옙 占쏙옙占쏙옙</Typography><Typography color="text.secondary">Mock Member Provider占쏙옙 占쏙옙占쏙옙 회占쏙옙占쏙옙 占쌀뤄옙占심니댐옙.</Typography></Stack><SearchField label="회占쏙옙 占싱몌옙 占실댐옙 占쏙옙화占쏙옙호 占싯삼옙" value={memberQuery} onChange={setMemberQuery} />{memberStatus === "loading" ? <LoadingState message="회占쏙옙 占쏙옙占쏙옙占?占쌀뤄옙占쏙옙占쏙옙 占쏙옙占쌉니댐옙." /> : null}{memberStatus === "error" ? <ErrorState message={memberError} /> : null}{memberStatus === "ready" && !hasSearchQuery ? <EmptyState title="회占쏙옙 占싱몌옙 占실댐옙 占쏙옙화占쏙옙호占쏙옙 占싯삼옙占싹쇽옙占쏙옙." description="占싯삼옙占쏘를 占쌉뤄옙占싹몌옙 占쏙옙치占싹댐옙 회占쏙옙 카占썲만 표占시됩니댐옙." /> : null}{memberStatus === "ready" && hasSearchQuery && filteredMembers.length === 0 ? <EmptyState title="占싯삼옙 占쏙옙占쏙옙占?占쏙옙占쏙옙占싹댐옙." description="占쌕몌옙 占싱몌옙占싱놂옙 占쏙옙화占쏙옙호占쏙옙 占쌕쏙옙 占싯삼옙占쏙옙 占쌍쇽옙占쏙옙." /> : null}{memberStatus === "ready" && hasSearchQuery ? <Grid container spacing={1.5}>{filteredMembers.map((member) => <Grid item key={member.memberId} md={4} sm={6} xs={12}><CardActionArea aria-label={`${member.displayName} 회占쏙옙 占쏙옙占쏙옙`} onClick={() => selectMember(member)} sx={{ bgcolor: palette.surfaceInteractive, border: 1, borderColor: "divider", borderRadius: `${palette.radiusMd}px`, boxShadow: "none", minHeight: 88, p: 1.75, transition: "border-color 150ms ease, background-color 150ms ease, transform 150ms ease", "&:hover": { borderColor: "primary.main", bgcolor: palette.surfaceRaised, transform: "translateY(-1px)" } }}><Typography fontWeight={900}>{member.displayName}</Typography><Typography color="text.secondary" variant="body2">{member.phone ?? "占쏙옙화占쏙옙호 占쏙옙占쏙옙"}</Typography></CardActionArea></Grid>)}</Grid> : null}</Stack></CardContent></Card>
      ) : null}

      {currentStep === 2 ? (
        <Card sx={centeredCardSx(1040)}><CardContent sx={{ p: { md: 4, xs: 2.5 } }}><Stack spacing={3}><Stack direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={1.5}><Stack spacing={0.75}><Typography variant="h1">Today's Condition</Typography><Typography color="text.secondary">{selectedMember?.displayName} 회占쏙옙占쏙옙</Typography>{recentWorkout ? <Stack direction="row" flexWrap="wrap" gap={1}><Chip label={`占쌍깍옙 占쏘동 ${recentWorkout.title}`} /><Chip label={formatDaysAgo(recentWorkout.daysAgo)} variant="outlined" /></Stack> : <Typography color="text.secondary">占쌍깍옙 占쏘동 占쏙옙占쏙옙占?占쏙옙占쏙옙占싹댐옙.</Typography>}</Stack><Button startIcon={<ArrowBackIcon />} variant="outlined" onClick={() => setCurrentStep(1)}>회占쏙옙 占쏙옙占쏙옙</Button></Stack><MemberIntelligenceCard intelligence={intelligence} status={intelligenceStatus} /><TrainingTrendCard periodization={periodization} status={intelligenceStatus} /><Card sx={infoCardSx}><CardContent><FormControlLabel control={<Switch checked={useAiRecommendation} onChange={(event) => setUseAiRecommendation(event.target.checked)} />} label="AI 추천 사용" /><Typography color="text.secondary" variant="body2">AI占쏙옙 Provider 占쏙옙占?Recommendation Context占쏙옙 Rule Recommendation 占쏙옙占쏙옙占?占쏙옙占쏙옙占싹곤옙 Snapshot占쏙옙 占쏙옙占쏙옙占쌌니댐옙.</Typography></CardContent></Card><Stack spacing={1.5}><Typography fontWeight={900}>컨디션 상태</Typography><Grid container spacing={1.5}>{conditionOptions.map((option) => <Grid item key={option.value} md={4} xs={12}><CardActionArea aria-label={`占쏙옙占쏙옙 占쏙옙占쏙옙占?${option.label}`} aria-pressed={condition.condition === option.value} onClick={() => setCondition((current) => ({ ...current, condition: option.value }))} sx={largeChoiceCardSx(condition.condition === option.value)}><Typography fontWeight={900}>{option.label}</Typography></CardActionArea></Grid>)}</Grid></Stack><Stack spacing={1.5}><Typography fontWeight={900}>占쏙옙占쏙옙</Typography><Grid container spacing={1.5}>{sleepOptions.map((option) => <Grid item key={option.value} md={4} xs={12}><CardActionArea aria-label={`占쏙옙占쏙옙 ${option.label}`} aria-pressed={condition.sleep === option.value} onClick={() => setCondition((current) => ({ ...current, sleep: option.value }))} sx={largeChoiceCardSx(condition.sleep === option.value)}><Typography fontWeight={900}>{option.label}</Typography></CardActionArea></Grid>)}</Grid></Stack><Stack spacing={1.5}><Typography fontWeight={900}>占실뤄옙 占쏙옙占쏙옙</Typography><Stack direction="row" flexWrap="wrap" gap={1}>{fatigueOptions.map((option) => <Chip key={option.value} aria-label={`占실뤄옙 占쏙옙占쏙옙 ${option.label}`} clickable color={condition.fatigueAreas.includes(option.value) ? "primary" : "default"} label={option.label} onClick={() => toggleFatigue(option.value)} sx={{ minHeight: 56, px: 1.5 }} />)}<Chip aria-label="占실뤄옙 占쏙옙占쏙옙 占쏙옙占쏙옙" clickable color={condition.fatigueAreas.length === 0 ? "primary" : "default"} label="占쏙옙占쏙옙" onClick={() => setCondition((current) => ({ ...current, fatigueAreas: [] }))} sx={{ minHeight: 56, px: 1.5 }} /></Stack></Stack><Stack spacing={1.5}><Typography fontWeight={900}>占쏙옙트占쏙옙占쏙옙</Typography><Box sx={{ px: 1 }}><Slider aria-label="占쏙옙트占쏙옙占쏙옙" marks max={5} min={1} step={1} value={condition.stress} onChange={(_, value) => setCondition((current) => ({ ...current, stress: Number(value) }))} /><Typography color="text.secondary">占쏙옙占쏙옙 占쏙옙占쏙옙: {condition.stress}</Typography></Box></Stack><Stack spacing={1.5}><Typography fontWeight={900}>占쏙옙占쏙옙 占쏙옙占쏙옙</Typography><Grid container spacing={1.5}>{alcoholOptions.map((option) => <Grid item key={option.value} md={6} xs={12}><CardActionArea aria-label={`占쏙옙占쏙옙 占쏙옙占쏙옙 ${option.label}`} aria-pressed={condition.alcohol === option.value} onClick={() => setCondition((current) => ({ ...current, alcohol: option.value }))} sx={largeChoiceCardSx(condition.alcohol === option.value)}><Typography fontWeight={900}>{option.label}</Typography></CardActionArea></Grid>)}</Grid></Stack><Stack direction={{ sm: "row", xs: "column" }} justifyContent="flex-end" spacing={1}><Button disabled={!canRecommend || programState.status !== "ready"} size="large" startIcon={<AutoAwesomeIcon />} variant="contained" onClick={() => void runRecommendation()} sx={{ minHeight: 56, minWidth: 180 }}>占쏙옙천占싹깍옙</Button></Stack></Stack></CardContent></Card>
      ) : null}

      {currentStep === 3 ? (
        <Card sx={centeredCardSx(1040)}><CardContent sx={{ p: { md: 4, xs: 2.5 } }}><Stack spacing={3}><Stack direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={1.5}><Stack spacing={0.75}><Stack alignItems="center" direction="row" spacing={1}><Typography variant="h1">?? ????</Typography>{aiStatus === "ready" ? <Chip color="primary" icon={<SmartToyIcon />} label="AI Applied" size="small" /> : null}</Stack><Typography color="text.secondary">Provider ?? Recommendation Context? ??? Rule Recommendation ?????.</Typography></Stack><Stack direction={{ sm: "row", xs: "column" }} spacing={1}><Button startIcon={<ArrowBackIcon />} variant="outlined" onClick={() => setCurrentStep(2)}>??? ??</Button><Button disabled={!recommendation || !builderHistory} startIcon={<CheckCircleIcon />} variant="contained" onClick={() => setCurrentStep(4)}>?? ??</Button></Stack></Stack><TrainingTrendCard periodization={periodization} status={intelligenceStatus} /><MemberIntelligenceCard intelligence={intelligence} status={intelligenceStatus} />{programState.status === "loading" ? <LoadingState message="???? ??? ???? ????." /> : null}{programState.status === "error" ? <ErrorState message={programState.message} /> : null}{recommendationReason ? <Alert severity="info">{recommendationReason}</Alert> : null}<RecommendationTraceCard recommendation={recommendation} trace={recommendationTrace} showCandidates={showCandidates} onToggleCandidates={() => setShowCandidates((current) => !current)} />{renderAiCards()}{recommendation ? <Card sx={infoCardSx}><CardContent><Stack spacing={2}><Stack direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={1}><Box><Typography variant="h2">{recommendation.program.title}</Typography><Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}><Chip label={getCategoryLabel(recommendation.program.category)} /><Chip label={getDifficultyLabel(recommendation.program.difficulty)} variant="outlined" /><Chip label={`${recommendation.program.exercises.length}? ??`} variant="outlined" /></Stack></Box><Chip color="primary" label={`?? ?? ${recommendation.score}`} /></Stack><Stack spacing={1}>{recommendation.program.exercises.map((exercise) => <Box key={exercise.id} sx={{ border: 1, borderColor: "divider", borderRadius: `${palette.radiusSm}px`, bgcolor: palette.surfaceInteractive, p: 1.5 }}><Typography fontWeight={900}>{exercise.order}. {exercise.name}</Typography><Typography color="text.secondary" variant="body2">{exercise.sets}??{exercise.memo ? ` ? ${exercise.memo}` : ""}</Typography></Box>)}</Stack></Stack></CardContent></Card> : null}</Stack></CardContent></Card>
      ) : null}
      {currentStep === 4 ? (
        <Card sx={centeredCardSx(1180)}><CardContent sx={{ p: { md: 4, xs: 2.5 } }}><Stack spacing={3}><Stack direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={1.5}><Stack spacing={0.75}><Stack alignItems="center" direction="row" spacing={1}><Typography variant="h1">Snapshot Program Builder</Typography>{aiStatus === "ready" ? <Chip color="primary" icon={<SmartToyIcon />} label="AI Snapshot" size="small" /> : null}</Stack><Typography color="text.secondary">占쏙옙천 占쏙옙占쏙옙占쏙옙 占쌕쏙옙 占쏙옙占쏙옙占쏙옙占쏙옙 占십곤옙 Snapshot占쏙옙 占쏙옙占쏙옙占쌌니댐옙.</Typography></Stack><Stack direction={{ sm: "row", xs: "column" }} spacing={1}><Button startIcon={<ArrowBackIcon />} variant="outlined" onClick={() => setCurrentStep(3)}>占쏙옙천占쏙옙占쏙옙 占쏙옙占싣곤옙占쏙옙</Button><Button disabled={!snapshotValidation.valid || !selectedMember || !snapshotSourceProgram || !snapshotValues} startIcon={<PrintIcon />} variant="contained" onClick={goPrintPreview}>占쏙옙占?占싱몌옙占쏙옙占쏙옙</Button></Stack></Stack><MemberIntelligenceCard intelligence={intelligence} status={intelligenceStatus} />{recommendationReason ? <Alert severity="info">{recommendationReason}</Alert> : null}{!snapshotValidation.valid ? <Alert severity="warning">{snapshotValidation.errors[0]}</Alert> : null}{renderAiCards()}<Grid container spacing={2}><Grid item md={4} xs={12}><TextField fullWidth label="占쏙옙占싸그뤄옙占쏙옙" value={builderState?.title ?? ""} onChange={(event) => updateBuilderMeta({ title: event.target.value })} /></Grid><Grid item md={4} xs={12}><TextField fullWidth label="카占쌓곤옙占쏙옙" select value={builderState?.category ?? "FULL_BODY"} onChange={(event) => updateBuilderMeta({ category: event.target.value as ProgramFormValues["category"] })}>{programCategories.map((category) => <MenuItem key={category.value} value={category.value}>{category.label}</MenuItem>)}</TextField></Grid><Grid item md={4} xs={12}><TextField fullWidth label="占쏙옙占싱듸옙" select value={builderState?.difficulty ?? "GENERAL"} onChange={(event) => updateBuilderMeta({ difficulty: event.target.value as ProgramDifficulty })}>{programDifficulties.map((difficulty) => <MenuItem key={difficulty.value} value={difficulty.value}>{difficulty.label}</MenuItem>)}</TextField></Grid><Grid item xs={12}><TextField fullWidth label="占쏙옙占싸그뤄옙 占쌨몌옙" multiline minRows={2} value={builderState?.memo ?? ""} onChange={(event) => updateBuilderMeta({ memo: event.target.value })} /></Grid></Grid><Card sx={infoCardSx}><CardContent><Stack direction={{ lg: "row", xs: "column" }} justifyContent="space-between" spacing={2}><Stack direction="row" flexWrap="wrap" gap={1}><Button startIcon={<UndoIcon />} variant="outlined" disabled={!builderHistory || !snapshotBuilderService.canUndo(builderHistory)} onClick={() => setBuilderHistory((current) => (current ? snapshotBuilderService.undo(current) : current))}>Undo</Button><Button startIcon={<RedoIcon />} variant="outlined" disabled={!builderHistory || !snapshotBuilderService.canRedo(builderHistory)} onClick={() => setBuilderHistory((current) => (current ? snapshotBuilderService.redo(current) : current))}>Redo</Button><Chip icon={<HistoryIcon />} label="Ctrl+Z / Ctrl+Y 占쏙옙占쏙옙" variant="outlined" /></Stack><Stack direction="row" flexWrap="wrap" gap={1}>{globalActions.map((action) => <Button key={action.key} size="small" variant={action.key === "restore" ? "contained" : "outlined"} disabled={!builderHistory || !snapshotSourceProgram} onClick={() => setBuilderHistory((current) => current && snapshotSourceProgram ? snapshotBuilderService.applyGlobal(current, action.key, snapshotSourceProgram) : current)}>{action.label}</Button>)}</Stack></Stack></CardContent></Card>{catalogState.status === "loading" ? <LoadingState message="Exercise Catalog占쏙옙 占쌀뤄옙占쏙옙占쏙옙 占쏙옙占쌉니댐옙." /> : null}{catalogState.status === "error" ? <Alert severity="warning">{catalogState.message}</Alert> : null}<Stack alignItems="center" direction="row" justifyContent="space-between"><Typography variant="h2">운동 목록</Typography><Button disabled={!builderHistory || builderState?.exercises.length === 8} startIcon={<AddIcon />} onClick={() => setBuilderHistory((current) => (current ? snapshotBuilderService.addBlank(current) : current))}>占쏘동 占쌩곤옙</Button></Stack><Stack spacing={1.5}>{(builderState?.exercises ?? []).map((exercise, index, array) => <SnapshotExerciseBuilderRow key={exercise.id} exercise={exercise} index={index} total={array.length} catalogOptions={catalogOptions} onPatch={(patch) => setBuilderHistory((current) => (current ? snapshotBuilderService.patchExercise(current, exercise.id, patch) : current))} onMoveUp={() => setBuilderHistory((current) => (current ? snapshotBuilderService.move(current, exercise.id, "up") : current))} onMoveDown={() => setBuilderHistory((current) => (current ? snapshotBuilderService.move(current, exercise.id, "down") : current))} onDuplicate={() => setBuilderHistory((current) => (current ? snapshotBuilderService.duplicate(current, exercise.id) : current))} onDelete={() => setBuilderHistory((current) => (current ? snapshotBuilderService.remove(current, exercise.id) : current))} onPreset={(preset) => setBuilderHistory((current) => (current ? snapshotBuilderService.applyPreset(current, exercise.id, preset) : current))} />)}</Stack></Stack></CardContent></Card>
      ) : null}
    </Stack>
  );
};











