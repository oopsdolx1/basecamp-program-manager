import AddIcon from "@mui/icons-material/Add";
import ArchiveIcon from "@mui/icons-material/Archive";
import CloseFullscreenIcon from "@mui/icons-material/CloseFullscreen";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import PrintIcon from "@mui/icons-material/Print";
import SaveIcon from "@mui/icons-material/Save";
import SearchIcon from "@mui/icons-material/Search";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Alert, Box, IconButton, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { routeBuilder } from "../../../app/routeBuilder";
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  Loading,
  Select,
  StatusChip,
  Topbar,
  WorkspaceLayout,
  colors,
  motion,
  radius,
  shadows,
  spacing,
} from "../../../design-system";
import { toAppId, toProgramId } from "../../../types/brandedIds";
import { normalizeText } from "../../../utils/normalizeText";
import { useExerciseCatalog, type ExerciseCatalogOption } from "../../exercise-catalog";
import { useExerciseResolver } from "../../exercise-resolver";
import { useMembers } from "../../members/hooks/useMembers";
import { filterMembersByInitial, KOREAN_INITIALS, type MemberInitialFilter } from "../../members/utils/koreanInitial";
import type { MemberSelectionItem } from "../../members";
import { WorkoutPrintTemplateV1 } from "../../printing/components/WorkoutPrintTemplateV1/WorkoutPrintTemplateV1";
import { createWorkoutPrintDocument } from "../../printing/mappers/workoutPrintMapper";
import { savePrintSnapshot } from "../../printing/services/printSnapshotSession";
import { createWorkoutSession } from "../../workout-sessions/services/workoutSessionService";
import { programManagerRuntime } from "../../../shared-knowledge/programManagerRuntime";
import { ExerciseSortableRow } from "../components/ExerciseSortableRow/ExerciseSortableRow";
import { programCategories, programDifficulties } from "../config/programOptions";
import { useProgramForm } from "../hooks/useProgramForm";
import { usePrograms } from "../hooks/usePrograms";
import { programToFormValues } from "../mappers/programMapper";
import { programRepository } from "../repositories/programRepository";
import { createCopyTitle, createInitialProgramFormValues } from "../services/programService";
import type { Program, ProgramFormValues } from "../types/program.types";

const appId = toAppId(import.meta.env.VITE_CONDITION_LAB_APP_ID ?? "");
const previewSessionId = "PREVIEW";

const toWorkingProgram = (source: Program, values: ProgramFormValues): Program => ({
  ...source,
  title: values.title,
  category: values.category,
  difficulty: values.difficulty,
  memo: values.memo,
  favorite: values.favorite,
  exercises: values.exercises.map((exercise, index) => ({ ...exercise, order: index + 1 })),
});

interface BuilderProps {
  program: Program;
  member: MemberSelectionItem;
  isNew?: boolean;
  onDuplicateProgram: () => void;
  onEditingChange: (editing: boolean) => void;
  onSaved: (program: Program) => void;
}

const WorkspaceBuilder = ({ program, member, isNew = false, onDuplicateProgram, onEditingChange, onSaved }: BuilderProps): JSX.Element => {
  const navigate = useNavigate();
  const form = useProgramForm(programToFormValues(program));
  const { catalogState, items, options } = useExerciseCatalog(appId);
  const resolver = useExerciseResolver(items);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(true);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(form.values.exercises[0]?.id ?? null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [savedBaseline, setSavedBaseline] = useState(() => JSON.stringify(form.sanitizedValues));

  const candidates = useMemo(() => {
    const normalized = normalizeText(query);
    return options.filter((exercise) => !normalized || normalizeText([
      exercise.name,
      exercise.displayName,
      exercise.englishName ?? "",
      ...exercise.aliases,
    ].join(" ")).includes(normalized));
  }, [options, query]);

  const workingProgram = useMemo(() => toWorkingProgram(program, form.sanitizedValues), [form.sanitizedValues, program]);
  const isDirty = JSON.stringify(form.sanitizedValues) !== savedBaseline;
  const selectedPreviewIndex = form.values.exercises.findIndex((exercise) => exercise.id === selectedExerciseId);

  useEffect(() => onEditingChange(isDirty), [isDirty, onEditingChange]);
  const previewDocument = useMemo(() => {
    try {
      return createWorkoutPrintDocument({ member, program: workingProgram, workoutSessionId: previewSessionId });
    } catch {
      return null;
    }
  }, [member, workingProgram]);
  const previewChecks = [
    ["회원 선택", Boolean(member.memberId)],
    ["Program 선택", Boolean(program.id)],
    ["운동 8개 이하", form.sanitizedValues.exercises.length > 0 && form.sanitizedValues.exercises.length <= 8],
    ["저장 완료", !isDirty],
    ["Preview 생성", Boolean(previewDocument)],
  ] as const;

  const handleDragEnd = (event: DragEndEvent) => {
    if (event.over && event.active.id !== event.over.id) form.reorder(String(event.active.id), String(event.over.id));
  };

  const addExercise = (exercise: ExerciseCatalogOption) => {
    form.addExercise({ name: exercise.name, displayName: exercise.displayName, catalogExerciseId: exercise.id });
    const blank = form.values.exercises.find((item) => !item.name.trim());
    setSelectedExerciseId(blank?.id ?? null);
  };

  const duplicateExercise = (exerciseId: string) => {
    const source = form.values.exercises.find((exercise) => exercise.id === exerciseId);
    if (!source) return;
    form.addExercise({ ...source, id: crypto.randomUUID(), order: form.values.exercises.length + 1 });
  };

  const save = async (): Promise<Program | null> => {
    if (!form.validation.valid) return null;
    setSaving(true);
    setMessage(null);
    try {
      const savedId = isNew
        ? await programRepository.createProgram(appId, form.sanitizedValues)
        : program.id;
      if (!isNew) await programRepository.updateProgram(appId, program.id, form.sanitizedValues);
      const saved = { ...toWorkingProgram(program, form.sanitizedValues), id: savedId };
      setSavedBaseline(JSON.stringify(form.sanitizedValues));
      onSaved(saved);
      setMessage("저장되었습니다.");
      return saved;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장하지 못했습니다.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const print = async () => {
    if (!form.validation.valid || printing) return;
    setPrinting(true);
    setMessage(null);
    try {
      const savedProgram = await save();
      if (!savedProgram) return;
      const document = createWorkoutPrintDocument({ member, program: savedProgram, workoutSessionId: previewSessionId });
      const sessionId = await createWorkoutSession({
        appId,
        memberId: member.memberId,
        memberName: member.displayName,
        programId: savedProgram.id,
        programTitle: savedProgram.title,
        exercises: document.program.exercises.map((exercise) => ({
          exerciseId: exercise.exerciseId,
          programExerciseId: exercise.id,
          name: exercise.name,
          order: exercise.order,
        })),
      });
      const snapshotProgramId = savePrintSnapshot({
        sourceProgramId: savedProgram.id,
        sourceProgramTitle: savedProgram.title,
        recommendationReasons: [],
        aiRecommendation: null,
        intelligence: null,
        metadata: null,
        periodization: null,
        recommendationTrace: null,
        condition: { condition: null, sleep: null, fatigueAreas: [], stress: 3, alcohol: null },
        recentWorkout: null,
        formValues: form.sanitizedValues,
      });
      navigate(routeBuilder.printPreview(snapshotProgramId, member.memberId, sessionId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "출력 미리보기를 열지 못했습니다.");
    } finally {
      setPrinting(false);
    }
  };

  return (
    <>
      <Box sx={{ display: "grid", gap: `${spacing[4]}px`, gridTemplateColumns: { xl: "minmax(0, 1fr) 360px", xs: "minmax(0, 1fr)" }, "& > *": { minWidth: 0 } }}>
        <Stack spacing={`${spacing[4]}px`}>
          <Card sx={{ position: "sticky", top: `${spacing[3]}px`, zIndex: 12 }}>
            <Stack alignItems={{ md: "center", xs: "stretch" }} direction={{ md: "row", xs: "column" }} justifyContent="space-between" spacing={`${spacing[2]}px`}>
              <Stack direction="row" flexWrap="wrap" gap={`${spacing[2]}px`}>
                <Button startIcon={<AddIcon />} onClick={() => document.getElementById("exercise-search")?.focus()}>운동 추가</Button>
                <Button variant="tertiary" startIcon={<CloseFullscreenIcon />} onClick={() => setCollapsedIds(new Set(form.values.exercises.map(({ id }) => id)))}>전체 접기</Button>
                <Button variant="tertiary" startIcon={<OpenInFullIcon />} onClick={() => setCollapsedIds(new Set())}>전체 펼치기</Button>
              </Stack>
              <Stack direction="row" flexWrap="wrap" gap={`${spacing[2]}px`}>
                <Button variant="tertiary" startIcon={<ContentCopyIcon />} disabled={isNew} onClick={onDuplicateProgram}>Program 복사</Button>
                <Button variant="tertiary" startIcon={<DeleteSweepIcon />} onClick={() => { form.reset(); setCollapsedIds(new Set()); setSelectedExerciseId(form.values.exercises[0]?.id ?? null); }}>Program 초기화</Button>
              </Stack>
            </Stack>
          </Card>

          <Card>
            <Stack spacing={`${spacing[4]}px`}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box><Typography variant="h5">Program Builder</Typography><Typography color={colors.neutral.gray400}>운동 순서와 수행 정보를 구성하세요.</Typography></Box>
                <Chip label={`${form.values.exercises.length}/8 운동`} selected />
              </Stack>
              <Input fullWidth label="프로그램명" value={form.values.title} onChange={(event) => form.update("title", event.target.value)} />
              <Box sx={{ display: "grid", gap: `${spacing[3]}px`, gridTemplateColumns: { sm: "repeat(2, minmax(0, 1fr))", xs: "minmax(0, 1fr)" } }}>
                <Select label="운동 부위" options={programCategories} value={form.values.category} onChange={(event) => form.update("category", event.target.value as ProgramFormValues["category"])} />
                <Select label="난이도" options={programDifficulties} value={form.values.difficulty} onChange={(event) => form.update("difficulty", event.target.value as ProgramFormValues["difficulty"])} />
              </Box>
              <Input fullWidth multiline minRows={2} label="프로그램 메모" value={form.values.memo} onChange={(event) => form.update("memo", event.target.value)} />
            </Stack>
          </Card>

          {!form.validation.valid ? <Alert severity="warning">{form.validation.errors[0]}</Alert> : null}
          {message ? <Alert severity={message === "저장되었습니다." ? "success" : "error"}>{message}</Alert> : null}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={form.values.exercises.map(({ id }) => id)} strategy={verticalListSortingStrategy}>
              <Stack spacing={`${spacing[3]}px`}>
                {form.values.exercises.map((exercise, index) => (
                  <ExerciseSortableRow
                    key={exercise.id}
                    exercise={exercise}
                    catalogOptions={options}
                    resolveResult={exercise.name ? resolver.resolve(exercise.name) : null}
                    memberWhy={exercise.catalogExerciseId ? programManagerRuntime.getById(exercise.catalogExerciseId)?.memberWhy ?? "" : ""}
                    canDelete={form.values.exercises.length > 1}
                    collapsed={collapsedIds.has(exercise.id)}
                    selected={selectedExerciseId === exercise.id}
                    index={index}
                    total={form.values.exercises.length}
                    onChange={(patch) => form.updateExercise(exercise.id, patch)}
                    onDelete={() => form.removeExercise(exercise.id)}
                    onDuplicate={() => duplicateExercise(exercise.id)}
                    onMoveUp={() => form.moveExercise(exercise.id, "up")}
                    onMoveDown={() => form.moveExercise(exercise.id, "down")}
                    onOpenPicker={() => document.getElementById("exercise-search")?.focus()}
                    onSelect={() => setSelectedExerciseId(exercise.id)}
                    onToggleCollapse={() => setCollapsedIds((current) => { const next = new Set(current); if (next.has(exercise.id)) next.delete(exercise.id); else next.add(exercise.id); return next; })}
                  />
                ))}
              </Stack>
            </SortableContext>
          </DndContext>
        </Stack>

        <Stack spacing={`${spacing[4]}px`}>
          <Card sx={{ position: { xl: "sticky" }, top: `${spacing[4]}px` }}>
            <Stack spacing={`${spacing[3]}px`}>
              <Box><Typography variant="h6">운동 검색</Typography><Typography color={colors.neutral.gray400} variant="body2">운동명 · 영문명 · Alias</Typography></Box>
              <Input id="exercise-search" fullWidth label="운동 검색" value={query} onChange={(event) => setQuery(event.target.value)} InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1 }} /> }} />
              {catalogState.status === "loading" ? <Loading label="Shared Runtime을 불러오는 중" /> : null}
              {catalogState.status === "ready" && candidates.length === 0 ? <EmptyState title="검색 결과가 없습니다." description="다른 운동명이나 Alias를 입력해 보세요." /> : null}
              <Stack spacing={`${spacing[2]}px`} sx={{ maxHeight: 360, overflowY: "auto" }}>
                {candidates.map((exercise) => (
                  <Button key={exercise.id} variant="tertiary" onClick={() => addExercise(exercise)} disabled={form.values.exercises.length >= 8 && !form.values.exercises.some((item) => !item.name.trim())} sx={{ alignItems: "flex-start", border: `1px solid ${colors.neutral.gray700}`, flexDirection: "column", minHeight: 88, textAlign: "left" }}>
                    <Stack direction="row" justifyContent="space-between" sx={{ width: "100%" }}><Typography fontWeight={800}>{exercise.displayName}</Typography><AddIcon /></Stack>
                    <Typography color={colors.neutral.gray400} variant="caption">{[exercise.englishName, exercise.bodyPart, exercise.equipment].filter(Boolean).join(" · ")}</Typography>
                    <Typography color={colors.neutral.gray300} noWrap sx={{ maxWidth: "100%" }} variant="caption">{programManagerRuntime.getById(exercise.id)?.memberWhy || "WHY 정보 없음"}</Typography>
                  </Button>
                ))}
              </Stack>
            </Stack>
          </Card>

          <Card>
            <Stack spacing={`${spacing[3]}px`}>
              <Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography variant="h6">A5 Print Preview</Typography><Typography color={colors.neutral.gray400} variant="body2">실제 WorkoutPrintTemplateV1</Typography></Box><StatusChip label={previewDocument ? "Preview 준비" : "Preparing"} status={previewDocument ? "success" : "pending"} /></Stack>
              <Card sx={{ p: `${spacing[3]}px` }}>
                <Stack spacing={`${spacing[2]}px`}><Stack direction="row" flexWrap="wrap" gap={`${spacing[2]}px`}><Badge>{member.displayName}</Badge><Badge>{workingProgram.title || "Program 미입력"}</Badge></Stack><Typography color={colors.neutral.gray400} variant="caption">Workout Session · 출력 시 생성</Typography><Stack direction="row" spacing={`${spacing[2]}px`}><StatusChip label="QR · Session 생성 후 준비" status="pending" /><StatusChip label={isDirty ? "수정됨" : "저장됨"} status={isDirty ? "pending" : "success"} /></Stack></Stack>
              </Card>
              {previewVisible && previewDocument ? (
                <Box
                  aria-label="A5 운동 미리보기"
                  onClick={(event) => {
                    const row = (event.target as HTMLElement).closest(".exercise-row");
                    if (!row) return;
                    const rows = Array.from(row.parentElement?.querySelectorAll(".exercise-row") ?? []);
                    const exercise = form.values.exercises[rows.indexOf(row)];
                    if (exercise) setSelectedExerciseId(exercise.id);
                  }}
                  sx={{
                    alignItems: "flex-start",
                    bgcolor: colors.neutral.gray800,
                    border: `1px dashed ${colors.neutral.gray600}`,
                    borderRadius: `${radius.sm}px`,
                    cursor: "pointer",
                    display: "flex",
                    height: 520,
                    justifyContent: "center",
                    overflow: "hidden",
                    p: `${spacing[3]}px`,
                    position: "relative",
                    ...(selectedPreviewIndex >= 0 ? { [`& .exercise-row:nth-of-type(${selectedPreviewIndex + 1})`]: { outline: `3px solid ${colors.primary.gold}`, outlineOffset: -3 } } : {}),
                  }}
                >
                  <Box sx={{ boxShadow: shadows.xl, left: "50%", position: "absolute", top: `${spacing[3]}px`, transform: "translateX(-50%) scale(.5)", transformOrigin: "top center", transition: motion.transition }}>
                    <WorkoutPrintTemplateV1 document={previewDocument} />
                  </Box>
                </Box>
              ) : <EmptyState title="미리보기가 닫혀 있습니다." description="하단 미리보기 버튼으로 다시 열 수 있습니다." />}
              <Stack direction="row" flexWrap="wrap" gap={`${spacing[2]}px`} justifyContent="center"><Badge>A5</Badge><Badge>100%</Badge><Badge>여백 없음</Badge><StatusChip label="권장" status="success" /></Stack>
            </Stack>
          </Card>

          <Card>
            <Stack spacing={`${spacing[3]}px`}><Box><Typography variant="h6">Print Checklist</Typography><Typography color={colors.neutral.gray400} variant="body2">출력 전에 현재 상태를 자동 확인합니다.</Typography></Box>{previewChecks.map(([label, valid]) => <Stack key={label} alignItems="center" direction="row" justifyContent="space-between"><Typography>{label}</Typography><StatusChip label={valid ? "완료" : "확인"} status={valid ? "success" : "warning"} /></Stack>)}<Stack alignItems="center" direction="row" justifyContent="space-between"><Typography>Workout Session / QR</Typography><StatusChip label="출력 시 생성" status="pending" /></Stack></Stack>
          </Card>

          <Card>
            <Stack spacing={`${spacing[3]}px`}><Typography variant="h6">Print Progress</Typography>{["Program 저장", "Workout Session", "QR 생성", "Preview", "Print Ready"].map((label, index) => { const complete = index === 0 ? !isDirty : index === 3 ? Boolean(previewDocument) : false; return <Stack key={label} alignItems="center" direction="row" justifyContent="space-between"><Typography>{index + 1}. {label}</Typography><StatusChip label={complete ? "완료" : index === 0 || index === 3 ? "확인" : "다음 단계"} status={complete ? "success" : "pending"} /></Stack>; })}</Stack>
          </Card>
        </Stack>
      </Box>

      <Box sx={{ bgcolor: "rgba(13, 13, 13, 0.96)", borderTop: `1px solid ${colors.neutral.gray700}`, bottom: 0, left: 0, position: "sticky", right: 0, zIndex: 20 }}>
        <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={`${spacing[2]}px`} sx={{ p: `${spacing[3]}px` }}>
          <StatusChip label={isDirty ? "수정됨" : "저장됨"} status={isDirty ? "pending" : "success"} />
          <Stack direction="row" spacing={`${spacing[2]}px`}>
          <Button variant="secondary" startIcon={<VisibilityIcon />} onClick={() => setPreviewVisible((value) => !value)}>미리보기</Button>
          <Button variant="secondary" startIcon={<SaveIcon />} loading={saving} disabled={!form.validation.valid} onClick={() => void save()}>저장</Button>
          <Button startIcon={<PrintIcon />} loading={printing} disabled={!form.validation.valid} onClick={() => void print()}>출력</Button>
          </Stack>
        </Stack>
      </Box>
    </>
  );
};

export const ProgramWorkspacePage = (): JSX.Element => {
  const memberState = useMembers(appId);
  const { programState, programs } = usePrograms(appId);
  const [memberQuery, setMemberQuery] = useState("");
  const [initial, setInitial] = useState<MemberInitialFilter>("ALL");
  const [selectedMember, setSelectedMember] = useState<MemberSelectionItem | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "editing">("saved");

  const members = useMemo(() => {
    const query = normalizeText(memberQuery);
    const initialFiltered = filterMembersByInitial(memberState.data.members, initial);
    return initialFiltered.filter((member) => !query || normalizeText(`${member.displayName} ${member.phone ?? ""}`).includes(query));
  }, [initial, memberQuery, memberState.data.members]);
  const availablePrograms = useMemo(() => programs.filter((program) => !program.isArchived), [programs]);
  const isNewProgram = selectedProgram?.id === toProgramId("__new__");

  const startNewProgram = () => {
    const values = createInitialProgramFormValues();
    const now = new Date();
    setSelectedProgram({
      id: toProgramId("__new__"),
      schemaVersion: 1,
      title: values.title,
      category: values.category,
      difficulty: values.difficulty,
      memo: values.memo,
      favorite: values.favorite,
      exercises: values.exercises,
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
      isArchived: false,
    });
    setSaveState("editing");
  };

  const duplicate = async (program: Program) => {
    await programRepository.duplicateProgram(appId, program, createCopyTitle(program.title, programs));
  };
  const archive = async (program: Program) => {
    await programRepository.archiveProgram(appId, program.id);
    if (selectedProgram?.id === program.id) setSelectedProgram(null);
  };
  const toggleFavorite = async (program: Program) => {
    await programRepository.updateProgram(appId, program.id, { ...programToFormValues(program), favorite: !program.favorite });
  };

  return (
    <Box sx={{ bgcolor: colors.neutral.black, minHeight: "100vh" }}>
      <Topbar sx={{ gap: `${spacing[4]}px`, justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30 }}>
        <Stack direction="row" alignItems="center" spacing={`${spacing[3]}px`}><FitnessCenterIcon sx={{ color: colors.primary.gold }} /><Typography color={colors.primary.gold} fontWeight={800}>BASECAMP</Typography><Typography color={colors.neutral.gray400}>Program Workspace</Typography></Stack>
        <Stack direction="row" alignItems="center" spacing={`${spacing[3]}px`}><Typography>{selectedMember?.displayName ?? "회원 미선택"}</Typography><Typography color={colors.neutral.gray600}>/</Typography><Typography>{selectedProgram?.title ?? "프로그램 미선택"}</Typography><StatusChip label={saveState === "saved" ? "저장됨" : "편집 중"} status={saveState === "saved" ? "success" : "pending"} /></Stack>
      </Topbar>
      <WorkspaceLayout sx={{ gridTemplateColumns: { lg: "320px minmax(0, 1fr)", md: "280px minmax(0, 1fr)", xs: "minmax(0, 1fr)" }, maxWidth: 1920, minHeight: "calc(100vh - 64px)", "& > *": { minWidth: 0 } }}>
        <Stack spacing={`${spacing[4]}px`}>
          <Card variant="member">
            <Stack spacing={`${spacing[3]}px`}>
              <Typography variant="h6">회원 선택</Typography>
              <Input fullWidth label="회원 검색" value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} />
              <Stack direction="row" flexWrap="wrap" gap={`${spacing[1]}px`}>
                {(["ALL", ...KOREAN_INITIALS] as MemberInitialFilter[]).map((value) => <Chip key={value} label={value === "ALL" ? "전체" : value} selected={initial === value} onClick={() => setInitial(value)} />)}
              </Stack>
              {memberState.status === "loading" ? <Loading label="회원을 불러오는 중" /> : null}
              {memberState.status === "ready" && members.length === 0 ? <EmptyState title="회원이 없습니다." description="검색 조건을 확인해 주세요." /> : null}
              <Stack spacing={`${spacing[2]}px`} sx={{ maxHeight: 280, overflowY: "auto" }}>
                {members.slice(0, 20).map((member) => <Button key={member.memberId} variant={selectedMember?.memberId === member.memberId ? "primary" : "tertiary"} onClick={() => setSelectedMember(member)} sx={{ justifyContent: "space-between" }}><span>{member.displayName}</span><Typography variant="caption">{member.phone}</Typography></Button>)}
              </Stack>
            </Stack>
          </Card>

          <Card variant="program">
            <Stack spacing={`${spacing[3]}px`}>
              <Stack direction="row" alignItems="center" justifyContent="space-between"><Typography variant="h6">프로그램</Typography><Button variant="tertiary" startIcon={<AddIcon />} disabled={!selectedMember} onClick={startNewProgram}>새 프로그램</Button></Stack>
              {!selectedMember ? <EmptyState title="회원을 먼저 선택하세요." description="선택 후 프로그램을 고를 수 있습니다." /> : null}
              {selectedMember && programState.status === "loading" ? <Loading label="프로그램을 불러오는 중" /> : null}
              {selectedMember && programState.status === "ready" && availablePrograms.length === 0 ? <EmptyState title="프로그램이 없습니다." description="기존 Program 관리에서 프로그램을 생성해 주세요." /> : null}
              {selectedMember ? <Stack spacing={`${spacing[2]}px`} sx={{ maxHeight: 480, overflowY: "auto" }}>{availablePrograms.map((program) => (
                <Card key={program.id} variant="program" onClick={() => { setSelectedProgram(program); setSaveState("editing"); }} sx={{ borderColor: selectedProgram?.id === program.id ? colors.primary.gold : colors.neutral.gray700, cursor: "pointer", p: `${spacing[3]}px` }}>
                  <Stack spacing={`${spacing[2]}px`}><Stack direction="row" justifyContent="space-between"><Typography fontWeight={700}>{program.title}</Typography>{program.favorite ? <StarIcon sx={{ color: colors.primary.gold }} /> : null}</Stack><Typography color={colors.neutral.gray400} variant="caption">최근 수정 {program.updatedAt.toLocaleDateString("ko-KR")} · 운동 {program.exercises.length}개</Typography><Stack direction="row" justifyContent="flex-end"><IconButton aria-label="즐겨찾기" onClick={(event) => { event.stopPropagation(); void toggleFavorite(program); }} sx={{ minHeight: 48, minWidth: 48 }}>{program.favorite ? <StarIcon /> : <StarBorderIcon />}</IconButton><IconButton aria-label="복사" onClick={(event) => { event.stopPropagation(); void duplicate(program); }} sx={{ minHeight: 48, minWidth: 48 }}><ContentCopyIcon /></IconButton><IconButton aria-label="아카이브" onClick={(event) => { event.stopPropagation(); void archive(program); }} sx={{ minHeight: 48, minWidth: 48 }}><ArchiveIcon /></IconButton></Stack></Stack>
                </Card>
              ))}</Stack> : null}
            </Stack>
          </Card>
        </Stack>

        <Box>
          {selectedMember && selectedProgram ? <WorkspaceBuilder key={`${selectedMember.memberId}-${selectedProgram.id}`} member={selectedMember} program={selectedProgram} isNew={isNewProgram} onDuplicateProgram={() => void duplicate(selectedProgram)} onEditingChange={(editing) => setSaveState(editing ? "editing" : "saved")} onSaved={(saved) => { setSelectedProgram(saved); setSaveState("saved"); }} /> : (
            <Card sx={{ minHeight: 520 }}><EmptyState icon={<AddIcon sx={{ fontSize: 48 }} />} title="Workspace를 시작하세요." description="왼쪽에서 회원과 프로그램을 선택하면 작성, 저장, 출력이 한 화면에서 이어집니다." /></Card>
          )}
        </Box>
      </WorkspaceLayout>
    </Box>
  );
};
