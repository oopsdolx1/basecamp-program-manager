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

type PrintStep = 1 | 2 | 3 | 4;
type AiStatus = "idle" | "loading" | "ready" | "error" | "skipped";
type IntelligenceStatus = "idle" | "loading" | "ready" | "error";
type MemberLoadStatus = "loading" | "ready" | "error";

interface QuickPrintFlowProps {
  appId: AppId;
  memberProvider: MemberProvider;
  recommendationProvider: RecommendationProvider;
}

const stepLabels = ["ȸ�� ����", "Today's Condition", "��õ ���α׷�", "Snapshot ����"];
const conditionOptions: Array<{ value: ConditionStatus; label: string }> = [{ value: "GOOD", label: "����" }, { value: "NORMAL", label: "����" }, { value: "BAD", label: "����" }];
const sleepOptions: Array<{ value: SleepQuality; label: string }> = [{ value: "ENOUGH", label: "���" }, { value: "NORMAL", label: "����" }, { value: "LACK", label: "����" }];
const alcoholOptions: Array<{ value: AlcoholStatus; label: string }> = [{ value: "NO", label: "�ƴϿ�" }, { value: "YES", label: "��" }];
const fatigueOptions: Array<{ value: FatigueArea; label: string }> = [{ value: "CHEST", label: "����" }, { value: "BACK", label: "��" }, { value: "SHOULDER", label: "���" }, { value: "ARMS", label: "��" }, { value: "LOWER_BODY", label: "��ü" }];
const defaultCondition: ConditionInput = { condition: null, sleep: null, fatigueAreas: [], stress: 3, alcohol: null };
const centeredCardSx = (maxWidth: number) => ({ maxWidth, mx: "auto", width: "100%" });
const largeChoiceCardSx = (active: boolean) => ({ bgcolor: active ? "rgba(217, 197, 75, 0.14)" : "rgba(2, 6, 23, 0.58)", border: 1, borderColor: active ? "primary.main" : "divider", borderRadius: 4, height: "100%", minHeight: 96, p: 2, textAlign: "left", "&:hover": { borderColor: "primary.main" }, "&:focus-visible": { outline: "3px solid rgba(217, 197, 75, 0.45)", outlineOffset: 3 } });
const infoCardSx = { bgcolor: "rgba(2, 6, 23, 0.45)", border: 1, borderColor: "divider", borderRadius: 4, height: "100%" };
const globalActions = [{ key: "sets_plus", label: "��ü ��Ʈ +1" }, { key: "sets_minus", label: "��ü ��Ʈ -1" }, { key: "rest_plus", label: "�޽� +30��" }, { key: "rest_minus", label: "�޽� -30��" }, { key: "clear_memo", label: "��ü �޸� ����" }, { key: "restore", label: "��õ ���·� ����" }] as const;
const formatDaysAgo = (daysAgo: number | null): string => (daysAgo === null ? "��� ���� �̻�" : daysAgo === 0 ? "����" : daysAgo === 1 ? "1�� ��" : `${daysAgo}�� ��`);
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

const StepIndicator = ({ currentStep }: { currentStep: PrintStep }): JSX.Element => <Stack spacing={1.5} sx={{ maxWidth: 1040, width: "100%" }}><Typography color="text.secondary" textAlign="center" variant="body2">���� �ܰ� {currentStep} / {stepLabels.length}</Typography><Stack alignItems="stretch" direction={{ md: "row", xs: "column" }} gap={1.25} justifyContent="center">{stepLabels.map((label, index) => { const step = (index + 1) as PrintStep; const active = currentStep === step; const complete = currentStep > step; return <Box key={label} sx={{ alignItems: "center", bgcolor: active ? "primary.main" : complete ? "rgba(217, 197, 75, 0.18)" : "rgba(15, 23, 42, 0.8)", border: 1, borderColor: active || complete ? "primary.main" : "divider", borderRadius: 4, color: active ? "primary.contrastText" : "text.primary", display: "flex", flex: 1, gap: 1.25, minHeight: 64, px: 2, py: 1.25 }}><Box sx={{ alignItems: "center", bgcolor: active ? "rgba(2, 6, 23, 0.22)" : complete ? "rgba(217, 197, 75, 0.24)" : "rgba(148, 163, 184, 0.12)", borderRadius: 999, display: "inline-flex", fontSize: 14, fontWeight: 900, height: 32, justifyContent: "center", minWidth: 32 }}>{complete ? "?" : step}</Box><Stack spacing={0.25}><Typography fontWeight={900}>0{step}</Typography><Typography color={active ? "inherit" : "text.secondary"} variant="body2">{label}</Typography></Stack></Box>; })}</Stack></Stack>;
const MemberIntelligenceCard = ({ intelligence, status }: { intelligence: MemberIntelligenceSummary | null; status: IntelligenceStatus }): JSX.Element => <Card sx={infoCardSx}><CardContent><Stack spacing={2}><Stack direction="row" justifyContent="space-between" spacing={1}><Typography variant="h2">Member Intelligence</Typography>{status === "loading" ? <Chip label="�м� ��" size="small" /> : null}</Stack>{status === "loading" ? <LinearProgress /> : null}{!intelligence ? <Typography color="text.secondary">� �̷��� �м��ϸ� ȸ��, ����, ��, ���� ������ ǥ�õ˴ϴ�.</Typography> : <Grid container spacing={1.5}><Grid item md={3} xs={6}><Chip color={scoreColor(intelligence.recoveryScore, true)} label={`Recovery ${intelligence.recoveryScore}`} /></Grid><Grid item md={3} xs={6}><Chip color={scoreColor(intelligence.riskScore, false)} icon={<WarningAmberIcon />} label={`Risk ${intelligence.riskScore}`} /></Grid><Grid item md={3} xs={6}><Chip label={`�ֱ� 7�� ${intelligence.frequency7}ȸ`} variant="outlined" /></Grid><Grid item md={3} xs={6}><Chip label={`�ֱ� 30�� ${intelligence.frequency30}ȸ`} variant="outlined" /></Grid><Grid item md={3} xs={6}><Typography color="text.secondary">�ֱ� �</Typography><Typography fontWeight={900}>{formatDaysAgo(intelligence.recentWorkoutDaysAgo)}</Typography></Grid><Grid item md={3} xs={6}><Typography color="text.secondary">� ����</Typography><Typography fontWeight={900}>{intelligence.gapDays === null ? "����" : `${intelligence.gapDays}��`}</Typography></Grid><Grid item md={3} xs={6}><Typography color="text.secondary">Program �ݺ�</Typography><Typography fontWeight={900}>{intelligence.repeatedProgramCount}ȸ</Typography></Grid><Grid item md={3} xs={6}><Typography color="text.secondary">�پ缺</Typography><Typography fontWeight={900}>P {intelligence.diversity10.programCount} / C {intelligence.diversity10.categoryCount}</Typography></Grid><Grid item xs={12}><Typography color="text.secondary">� ����</Typography><Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 0.5 }}>{intelligence.bodyPartBias.length > 0 ? intelligence.bodyPartBias.slice(0, 4).map((item) => <Chip key={item.category} label={`${getCategoryLabel(item.category)} ${formatRatio(item.ratio)}`} size="small" />) : <Chip label="���� ������ ����" size="small" variant="outlined" />}</Stack></Grid></Grid>}</Stack></CardContent></Card>;
const TrainingTrendCard = ({ periodization, status }: { periodization: PeriodizationSummary | null; status: IntelligenceStatus }): JSX.Element => <Card sx={infoCardSx}><CardContent><Stack spacing={2}><Stack direction="row" justifyContent="space-between" spacing={1}><Typography variant="h2">Training Trend</Typography>{status === "loading" ? <Chip label="��� ��" size="small" /> : null}</Stack>{status === "loading" ? <LinearProgress /> : null}{!periodization ? <Typography color="text.secondary">�ֱ� � �帧�� �м��ϸ� Cycle, Plateau, Deload, ���� ��õ�� ǥ�õ˴ϴ�.</Typography> : <Grid container spacing={1.5}><Grid item md={3} xs={6}><Typography color="text.secondary">���� Cycle</Typography><Typography fontWeight={900}>{periodization.currentCycle}</Typography></Grid><Grid item md={3} xs={6}><Typography color="text.secondary">Recovery</Typography><Typography fontWeight={900}>{recoveryTrendLabel(periodization.recoveryTrend)}</Typography></Grid><Grid item md={3} xs={6}><Typography color="text.secondary">Plateau</Typography><Typography fontWeight={900}>{periodization.plateau ? "Yes" : "No"}</Typography></Grid><Grid item md={3} xs={6}><Typography color="text.secondary">���� ��õ</Typography><Typography fontWeight={900}>{periodization.nextProgramHint ?? "����"}</Typography></Grid><Grid item md={3} xs={6}><Chip color="primary" label={modeLabel(periodization.recommendedMode)} /></Grid><Grid item md={3} xs={6}><Chip color={periodization.deload ? "warning" : "default"} label={periodization.deload ? "Deload" : "Normal Load"} variant={periodization.deload ? "filled" : "outlined"} /></Grid><Grid item md={3} xs={6}><Chip label={`�ְ� �� ${periodization.weeklyFrequency}ȸ`} variant="outlined" /></Grid><Grid item md={3} xs={6}><Chip label={`�ݺ� ${periodization.repeatedProgramCount}ȸ`} variant="outlined" /></Grid><Grid item xs={12}><Typography color="text.secondary">�ֱ� Program ����</Typography><Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 0.5 }}>{periodization.recentProgramSequence.length > 0 ? periodization.recentProgramSequence.map((title) => <Chip key={title} label={title} size="small" />) : <Chip label="��� ����" size="small" variant="outlined" />}</Stack></Grid></Grid>}</Stack></CardContent></Card>;

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
    return <Card sx={infoCardSx}><CardContent><Typography color="text.secondary">?? ?? ?? ??</Typography></CardContent></Card>;
  }

  if (!trace) {
    return <Card sx={infoCardSx}><CardContent><Stack spacing={1}><Typography variant="h2">?? ??</Typography><Typography color="text.secondary">?? ?? ?? ??</Typography></Stack></CardContent></Card>;
  }

  const positiveFactors = trace.decisionFactors.filter((factor) => factor.score > 0);
  const negativeFactors = trace.decisionFactors.filter((factor) => factor.score < 0);
  const candidates = trace.candidatePrograms.slice(0, 5);

  return <Card sx={infoCardSx}><CardContent><Stack spacing={2.5}><Stack direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={1.5}><Stack spacing={0.5}><Typography variant="h2">?? ??</Typography><Typography color="text.secondary">Rule Recommendation? ??? ?? ?????.</Typography></Stack><Chip color="primary" label={`Final Score ${trace.selectedProgram.score}`} /></Stack><Grid container spacing={1.5}><Grid item md={6} xs={12}><Typography color="text.secondary">?? ?? Program</Typography><Typography fontWeight={900}>{trace.selectedProgram.title}</Typography></Grid><Grid item md={6} xs={12}><Typography color="text.secondary">?? ??</Typography><Typography fontWeight={900}>{trace.selectedProgram.reason}</Typography></Grid></Grid><Grid container spacing={2}><Grid item md={6} xs={12}><Stack spacing={1}><Typography fontWeight={900}>?? ??</Typography>{positiveFactors.length > 0 ? positiveFactors.map((factor) => <Box key={`${factor.key}-${factor.reason}`} sx={{ border: 1, borderColor: "divider", borderRadius: 3, p: 1.25 }}><Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}><Typography fontWeight={700}>{factor.label}</Typography><Typography color="success.main" fontWeight={900}>{formatSignedScore(factor.score)}</Typography></Stack><Typography color="text.secondary" variant="body2">{factor.reason}</Typography></Box>) : <Typography color="text.secondary">?? ?? ??</Typography>}</Stack></Grid><Grid item md={6} xs={12}><Stack spacing={1}><Typography fontWeight={900}>?? ??</Typography>{negativeFactors.length > 0 ? negativeFactors.map((factor) => <Box key={`${factor.key}-${factor.reason}`} sx={{ border: 1, borderColor: "divider", borderRadius: 3, p: 1.25 }}><Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}><Typography fontWeight={700}>{factor.label}</Typography><Typography color="error.main" fontWeight={900}>{formatSignedScore(factor.score)}</Typography></Stack><Typography color="text.secondary" variant="body2">{factor.reason}</Typography></Box>) : <Typography color="text.secondary">?? ?? ??</Typography>}</Stack></Grid></Grid><Stack alignItems="flex-start" spacing={1}><Button size="small" variant="outlined" onClick={onToggleCandidates}>{showCandidates ? "?? ???? ???" : "?? ???? ??"}</Button><Collapse in={showCandidates} sx={{ width: "100%" }}><Stack spacing={1} sx={{ pt: 1 }}>{candidates.map((candidate) => { const selected = candidate.programId === trace.selectedProgram.programId; return <Box key={candidate.programId} sx={{ border: 1, borderColor: selected ? "primary.main" : "divider", borderRadius: 3, p: 1.25 }}><Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1.5}><Typography fontWeight={selected ? 900 : 700}>{candidate.title}</Typography><Stack alignItems="center" direction="row" spacing={1}><Typography fontWeight={900}>{candidate.score}</Typography>{selected ? <Chip color="primary" label="Selected" size="small" /> : null}</Stack></Stack></Box>; })}</Stack></Collapse></Stack><Typography color="text.secondary" variant="caption">Engine v{trace.engineVersion}</Typography></Stack></CardContent></Card>;
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
  const snapshotValidation = useMemo(() => (snapshotValues ? validateProgramForm(snapshotValues) : { valid: false, errors: ["Snapshot�� �����ϴ�."] }), [snapshotValues]);
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
      setMemberError(error instanceof Error ? error.message : "ȸ�� ������ �ҷ����� ���߽��ϴ�.");
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
      setRecommendationReason("��õ ������ ���α׷��� �����ϴ�.");
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
      setAiError(error instanceof Error ? error.message : "AI Recommendation�� �����߽��ϴ�.");
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
    if (aiStatus === "loading") return <Card sx={infoCardSx}><CardContent><Stack alignItems="center" direction="row" spacing={1.5}><CircularProgress size={20} /><Typography>AI Recommendation�� �����ϴ� ���Դϴ�.</Typography></Stack></CardContent></Card>;
    if (aiStatus === "error") return <Alert severity="warning">AI Recommendation ���з� Rule Recommendation�� �����մϴ�. {aiError}</Alert>;
    if (aiStatus === "skipped") return useAiRecommendation ? null : <Alert severity="info">AI ��õ�� ���� �־� Rule Recommendation�� ����մϴ�.</Alert>;
    if (!aiRecommendation) return null;
    return <Grid container spacing={2}>{[{ title: "��õ ����", value: aiRecommendation.reason }, { title: "ȸ�� ��Ī", value: aiRecommendation.coach }, { title: "���ǻ���", value: aiRecommendation.warning }].map((item) => <Grid item key={item.title} md={4} xs={12}><Card sx={infoCardSx}><CardContent><Stack spacing={1}><Stack alignItems="center" direction="row" spacing={1}><Chip color="primary" icon={<SmartToyIcon />} label="AI" size="small" /><Typography variant="h2">{item.title}</Typography></Stack><Typography color="text.secondary">{item.value}</Typography></Stack></CardContent></Card></Grid>)}</Grid>;
  };
  return (
    <Stack alignItems="center" spacing={3}>
      <StepIndicator currentStep={currentStep} />

      {currentStep === 1 ? (
        <Card sx={centeredCardSx(880)}><CardContent sx={{ p: { md: 4, xs: 2.5 } }}><Stack spacing={3}><Stack alignItems="center" spacing={1} textAlign="center"><FitnessCenterIcon color="primary" fontSize="large" /><Typography variant="h1">ȸ�� ����</Typography><Typography color="text.secondary">Mock Member Provider�� ���� ȸ���� �ҷ��ɴϴ�.</Typography></Stack><SearchField label="ȸ�� �̸� �Ǵ� ��ȭ��ȣ �˻�" value={memberQuery} onChange={setMemberQuery} />{memberStatus === "loading" ? <LoadingState message="ȸ�� ����� �ҷ����� ���Դϴ�." /> : null}{memberStatus === "error" ? <ErrorState message={memberError} /> : null}{memberStatus === "ready" && !hasSearchQuery ? <EmptyState title="ȸ�� �̸� �Ǵ� ��ȭ��ȣ�� �˻��ϼ���." description="�˻�� �Է��ϸ� ��ġ�ϴ� ȸ�� ī�常 ǥ�õ˴ϴ�." /> : null}{memberStatus === "ready" && hasSearchQuery && filteredMembers.length === 0 ? <EmptyState title="�˻� ����� �����ϴ�." description="�ٸ� �̸��̳� ��ȭ��ȣ�� �ٽ� �˻��� �ּ���." /> : null}{memberStatus === "ready" && hasSearchQuery ? <Grid container spacing={1.5}>{filteredMembers.map((member) => <Grid item key={member.memberId} md={4} sm={6} xs={12}><CardActionArea aria-label={`${member.displayName} ȸ�� ����`} onClick={() => selectMember(member)} sx={{ bgcolor: "rgba(2, 6, 23, 0.52)", border: 1, borderColor: "divider", borderRadius: 4, minHeight: 88, p: 1.75, "&:hover": { borderColor: "primary.main" } }}><Typography fontWeight={900}>{member.displayName}</Typography><Typography color="text.secondary" variant="body2">{member.phone ?? "��ȭ��ȣ ����"}</Typography></CardActionArea></Grid>)}</Grid> : null}</Stack></CardContent></Card>
      ) : null}

      {currentStep === 2 ? (
        <Card sx={centeredCardSx(1040)}><CardContent sx={{ p: { md: 4, xs: 2.5 } }}><Stack spacing={3}><Stack direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={1.5}><Stack spacing={0.75}><Typography variant="h1">������ �����</Typography><Typography color="text.secondary">{selectedMember?.displayName} ȸ����</Typography>{recentWorkout ? <Stack direction="row" flexWrap="wrap" gap={1}><Chip label={`�ֱ� � ${recentWorkout.title}`} /><Chip label={formatDaysAgo(recentWorkout.daysAgo)} variant="outlined" /></Stack> : <Typography color="text.secondary">�ֱ� � ����� �����ϴ�.</Typography>}</Stack><Button startIcon={<ArrowBackIcon />} variant="outlined" onClick={() => setCurrentStep(1)}>ȸ�� ����</Button></Stack><MemberIntelligenceCard intelligence={intelligence} status={intelligenceStatus} /><TrainingTrendCard periodization={periodization} status={intelligenceStatus} /><Card sx={infoCardSx}><CardContent><FormControlLabel control={<Switch checked={useAiRecommendation} onChange={(event) => setUseAiRecommendation(event.target.checked)} />} label="AI ��õ ���" /><Typography color="text.secondary" variant="body2">AI�� Provider ��� Recommendation Context�� Rule Recommendation ����� �����ϰ� Snapshot�� �����մϴ�.</Typography></CardContent></Card><Stack spacing={1.5}><Typography fontWeight={900}>���� �����</Typography><Grid container spacing={1.5}>{conditionOptions.map((option) => <Grid item key={option.value} md={4} xs={12}><CardActionArea aria-label={`���� ����� ${option.label}`} aria-pressed={condition.condition === option.value} onClick={() => setCondition((current) => ({ ...current, condition: option.value }))} sx={largeChoiceCardSx(condition.condition === option.value)}><Typography fontWeight={900}>{option.label}</Typography></CardActionArea></Grid>)}</Grid></Stack><Stack spacing={1.5}><Typography fontWeight={900}>����</Typography><Grid container spacing={1.5}>{sleepOptions.map((option) => <Grid item key={option.value} md={4} xs={12}><CardActionArea aria-label={`���� ${option.label}`} aria-pressed={condition.sleep === option.value} onClick={() => setCondition((current) => ({ ...current, sleep: option.value }))} sx={largeChoiceCardSx(condition.sleep === option.value)}><Typography fontWeight={900}>{option.label}</Typography></CardActionArea></Grid>)}</Grid></Stack><Stack spacing={1.5}><Typography fontWeight={900}>�Ƿ� ����</Typography><Stack direction="row" flexWrap="wrap" gap={1}>{fatigueOptions.map((option) => <Chip key={option.value} aria-label={`�Ƿ� ���� ${option.label}`} clickable color={condition.fatigueAreas.includes(option.value) ? "primary" : "default"} label={option.label} onClick={() => toggleFatigue(option.value)} sx={{ minHeight: 56, px: 1.5 }} />)}<Chip aria-label="�Ƿ� ���� ����" clickable color={condition.fatigueAreas.length === 0 ? "primary" : "default"} label="����" onClick={() => setCondition((current) => ({ ...current, fatigueAreas: [] }))} sx={{ minHeight: 56, px: 1.5 }} /></Stack></Stack><Stack spacing={1.5}><Typography fontWeight={900}>��Ʈ����</Typography><Box sx={{ px: 1 }}><Slider aria-label="��Ʈ����" marks max={5} min={1} step={1} value={condition.stress} onChange={(_, value) => setCondition((current) => ({ ...current, stress: Number(value) }))} /><Typography color="text.secondary">���� ����: {condition.stress}</Typography></Box></Stack><Stack spacing={1.5}><Typography fontWeight={900}>���� ����</Typography><Grid container spacing={1.5}>{alcoholOptions.map((option) => <Grid item key={option.value} md={6} xs={12}><CardActionArea aria-label={`���� ���� ${option.label}`} aria-pressed={condition.alcohol === option.value} onClick={() => setCondition((current) => ({ ...current, alcohol: option.value }))} sx={largeChoiceCardSx(condition.alcohol === option.value)}><Typography fontWeight={900}>{option.label}</Typography></CardActionArea></Grid>)}</Grid></Stack><Stack direction={{ sm: "row", xs: "column" }} justifyContent="flex-end" spacing={1}><Button disabled={!canRecommend || programState.status !== "ready"} size="large" startIcon={<AutoAwesomeIcon />} variant="contained" onClick={() => void runRecommendation()} sx={{ minHeight: 56, minWidth: 180 }}>��õ�ϱ�</Button></Stack></Stack></CardContent></Card>
      ) : null}

      {currentStep === 3 ? (
        <Card sx={centeredCardSx(1040)}><CardContent sx={{ p: { md: 4, xs: 2.5 } }}><Stack spacing={3}><Stack direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={1.5}><Stack spacing={0.75}><Stack alignItems="center" direction="row" spacing={1}><Typography variant="h1">?? ????</Typography>{aiStatus === "ready" ? <Chip color="primary" icon={<SmartToyIcon />} label="AI Applied" size="small" /> : null}</Stack><Typography color="text.secondary">Provider ?? Recommendation Context? ??? Rule Recommendation ?????.</Typography></Stack><Stack direction={{ sm: "row", xs: "column" }} spacing={1}><Button startIcon={<ArrowBackIcon />} variant="outlined" onClick={() => setCurrentStep(2)}>??? ??</Button><Button disabled={!recommendation || !builderHistory} startIcon={<CheckCircleIcon />} variant="contained" onClick={() => setCurrentStep(4)}>?? ??</Button></Stack></Stack><TrainingTrendCard periodization={periodization} status={intelligenceStatus} /><MemberIntelligenceCard intelligence={intelligence} status={intelligenceStatus} />{programState.status === "loading" ? <LoadingState message="???? ??? ???? ????." /> : null}{programState.status === "error" ? <ErrorState message={programState.message} /> : null}{recommendationReason ? <Alert severity="info">{recommendationReason}</Alert> : null}<RecommendationTraceCard recommendation={recommendation} trace={recommendationTrace} showCandidates={showCandidates} onToggleCandidates={() => setShowCandidates((current) => !current)} />{renderAiCards()}{recommendation ? <Card sx={infoCardSx}><CardContent><Stack spacing={2}><Stack direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={1}><Box><Typography variant="h2">{recommendation.program.title}</Typography><Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}><Chip label={getCategoryLabel(recommendation.program.category)} /><Chip label={getDifficultyLabel(recommendation.program.difficulty)} variant="outlined" /><Chip label={`${recommendation.program.exercises.length}? ??`} variant="outlined" /></Stack></Box><Chip color="primary" label={`?? ?? ${recommendation.score}`} /></Stack><Stack spacing={1}>{recommendation.program.exercises.map((exercise) => <Box key={exercise.id} sx={{ border: 1, borderColor: "divider", borderRadius: 3, p: 1.5 }}><Typography fontWeight={900}>{exercise.order}. {exercise.name}</Typography><Typography color="text.secondary" variant="body2">{exercise.sets}??{exercise.memo ? ` ? ${exercise.memo}` : ""}</Typography></Box>)}</Stack></Stack></CardContent></Card> : null}</Stack></CardContent></Card>
      ) : null}
      {currentStep === 4 ? (
        <Card sx={centeredCardSx(1180)}><CardContent sx={{ p: { md: 4, xs: 2.5 } }}><Stack spacing={3}><Stack direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={1.5}><Stack spacing={0.75}><Stack alignItems="center" direction="row" spacing={1}><Typography variant="h1">Snapshot Program Builder</Typography>{aiStatus === "ready" ? <Chip color="primary" icon={<SmartToyIcon />} label="AI Snapshot" size="small" /> : null}</Stack><Typography color="text.secondary">��õ ������ �ٽ� �������� �ʰ� Snapshot�� �����մϴ�.</Typography></Stack><Stack direction={{ sm: "row", xs: "column" }} spacing={1}><Button startIcon={<ArrowBackIcon />} variant="outlined" onClick={() => setCurrentStep(3)}>��õ���� ���ư���</Button><Button disabled={!snapshotValidation.valid || !selectedMember || !snapshotSourceProgram || !snapshotValues} startIcon={<PrintIcon />} variant="contained" onClick={goPrintPreview}>��� �̸�����</Button></Stack></Stack><MemberIntelligenceCard intelligence={intelligence} status={intelligenceStatus} />{recommendationReason ? <Alert severity="info">{recommendationReason}</Alert> : null}{!snapshotValidation.valid ? <Alert severity="warning">{snapshotValidation.errors[0]}</Alert> : null}{renderAiCards()}<Grid container spacing={2}><Grid item md={4} xs={12}><TextField fullWidth label="���α׷���" value={builderState?.title ?? ""} onChange={(event) => updateBuilderMeta({ title: event.target.value })} /></Grid><Grid item md={4} xs={12}><TextField fullWidth label="ī�װ���" select value={builderState?.category ?? "FULL_BODY"} onChange={(event) => updateBuilderMeta({ category: event.target.value as ProgramFormValues["category"] })}>{programCategories.map((category) => <MenuItem key={category.value} value={category.value}>{category.label}</MenuItem>)}</TextField></Grid><Grid item md={4} xs={12}><TextField fullWidth label="���̵�" select value={builderState?.difficulty ?? "GENERAL"} onChange={(event) => updateBuilderMeta({ difficulty: event.target.value as ProgramDifficulty })}>{programDifficulties.map((difficulty) => <MenuItem key={difficulty.value} value={difficulty.value}>{difficulty.label}</MenuItem>)}</TextField></Grid><Grid item xs={12}><TextField fullWidth label="���α׷� �޸�" multiline minRows={2} value={builderState?.memo ?? ""} onChange={(event) => updateBuilderMeta({ memo: event.target.value })} /></Grid></Grid><Card sx={infoCardSx}><CardContent><Stack direction={{ lg: "row", xs: "column" }} justifyContent="space-between" spacing={2}><Stack direction="row" flexWrap="wrap" gap={1}><Button startIcon={<UndoIcon />} variant="outlined" disabled={!builderHistory || !snapshotBuilderService.canUndo(builderHistory)} onClick={() => setBuilderHistory((current) => (current ? snapshotBuilderService.undo(current) : current))}>Undo</Button><Button startIcon={<RedoIcon />} variant="outlined" disabled={!builderHistory || !snapshotBuilderService.canRedo(builderHistory)} onClick={() => setBuilderHistory((current) => (current ? snapshotBuilderService.redo(current) : current))}>Redo</Button><Chip icon={<HistoryIcon />} label="Ctrl+Z / Ctrl+Y ����" variant="outlined" /></Stack><Stack direction="row" flexWrap="wrap" gap={1}>{globalActions.map((action) => <Button key={action.key} size="small" variant={action.key === "restore" ? "contained" : "outlined"} disabled={!builderHistory || !snapshotSourceProgram} onClick={() => setBuilderHistory((current) => current && snapshotSourceProgram ? snapshotBuilderService.applyGlobal(current, action.key, snapshotSourceProgram) : current)}>{action.label}</Button>)}</Stack></Stack></CardContent></Card>{catalogState.status === "loading" ? <LoadingState message="Exercise Catalog�� �ҷ����� ���Դϴ�." /> : null}{catalogState.status === "error" ? <Alert severity="warning">{catalogState.message}</Alert> : null}<Stack alignItems="center" direction="row" justifyContent="space-between"><Typography variant="h2">� ���</Typography><Button disabled={!builderHistory || builderState?.exercises.length === 8} startIcon={<AddIcon />} onClick={() => setBuilderHistory((current) => (current ? snapshotBuilderService.addBlank(current) : current))}>� �߰�</Button></Stack><Stack spacing={1.5}>{(builderState?.exercises ?? []).map((exercise, index, array) => <SnapshotExerciseBuilderRow key={exercise.id} exercise={exercise} index={index} total={array.length} catalogOptions={catalogOptions} onPatch={(patch) => setBuilderHistory((current) => (current ? snapshotBuilderService.patchExercise(current, exercise.id, patch) : current))} onMoveUp={() => setBuilderHistory((current) => (current ? snapshotBuilderService.move(current, exercise.id, "up") : current))} onMoveDown={() => setBuilderHistory((current) => (current ? snapshotBuilderService.move(current, exercise.id, "down") : current))} onDuplicate={() => setBuilderHistory((current) => (current ? snapshotBuilderService.duplicate(current, exercise.id) : current))} onDelete={() => setBuilderHistory((current) => (current ? snapshotBuilderService.remove(current, exercise.id) : current))} onPreset={(preset) => setBuilderHistory((current) => (current ? snapshotBuilderService.applyPreset(current, exercise.id, preset) : current))} />)}</Stack></Stack></CardContent></Card>
      ) : null}
    </Stack>
  );
};







