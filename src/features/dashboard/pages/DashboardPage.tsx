import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import GroupsIcon from "@mui/icons-material/Groups";
import PrintIcon from "@mui/icons-material/Print";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import { Box, Grid, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { routeBuilder } from "../../../app/routeBuilder";
import { PageContainer } from "../../../components/layout/PageContainer";
import { Badge, BASECAMP_DESIGN_SYSTEM_VERSION, Button, Card, DashboardLayout, EmptyState, Loading, StatusChip } from "../../../design-system";
import { programManagerRuntime } from "../../../shared-knowledge/programManagerRuntime";
import { toAppId } from "../../../types/brandedIds";
import { useMembers } from "../../members/hooks/useMembers";
import { usePrintRequests } from "../../print-history/hooks/usePrintRequests";
import { usePrograms } from "../../programs/hooks/usePrograms";
import type { WorkoutSessionRecord } from "../../workout-sessions/domain/workoutSession.types";
import { workoutSessionStatusPresentation } from "../../workout-sessions/presentation/workoutSessionPresentation";
import { subscribeWorkoutSessions } from "../../workout-sessions/services/workoutSessionService";

const appId = toAppId(import.meta.env.VITE_CONDITION_LAB_APP_ID ?? "");
const printFilters = { search: "", category: "ALL" as const };
const isToday = (date: Date | null | undefined) => date?.toDateString() === new Date().toDateString();
const dateLabel = (date: Date | null | undefined) => date ? new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date) : "기록 없음";

export const DashboardPage = (): JSX.Element => {
  const navigate = useNavigate();
  const members = useMembers(appId);
  const { programState, listItems } = usePrograms(appId);
  const { state: printState, records: printRecords } = usePrintRequests(appId, printFilters);
  const [sessions, setSessions] = useState<WorkoutSessionRecord[]>([]);
  const [sessionStatus, setSessionStatus] = useState<"loading" | "ready" | "error">("loading");
  const runtimeRevision = useSyncExternalStore(programManagerRuntime.subscribe, programManagerRuntime.getRevision, programManagerRuntime.getRevision);

  useEffect(() => subscribeWorkoutSessions(appId, (records) => { setSessions(records); setSessionStatus("ready"); }, () => setSessionStatus("error")), []);

  const todaySessions = useMemo(() => sessions.filter((session) => isToday(session.createdAt)), [sessions]);
  const summaries = [
    ["오늘 회원", new Set(todaySessions.map(({ memberId }) => memberId)).size],
    ["오늘 출력", printRecords.filter(({ printedAt }) => isToday(printedAt)).length],
    ["Workout Session", todaySessions.length],
    ["OCR 완료", todaySessions.filter(({ status }) => ["ocr_completed", "ai_completed", "confirmed"].includes(status)).length],
    ["AI 완료", todaySessions.filter(({ status }) => status === "ai_completed" || status === "confirmed").length],
    ["최근 Program", listItems.length],
  ] as const;
  const loading = members.status === "loading" || programState.status === "loading" || printState.status === "loading" || sessionStatus === "loading";
  const quickActions = [
    ["회원 선택", "오늘 지도할 회원을 선택합니다.", <GroupsIcon />, routeBuilder.print()],
    ["프로그램 출력", "회원용 운동지를 출력합니다.", <PrintIcon />, routeBuilder.print()],
    ["운동 종목 관리", "Shared Knowledge를 확인합니다.", <FitnessCenterIcon />, routeBuilder.master()],
    ["Workout Sessions", "최근 세션 상태를 확인합니다.", <QrCode2Icon />, routeBuilder.workoutSessions()],
  ] as const;

  return <PageContainer><DashboardLayout sx={{ display: "block", minHeight: "auto", p: 0 }}><Stack spacing={4}>
    <Stack spacing={1}><Badge sx={{ alignSelf: "flex-start" }}>COMMAND CENTER</Badge><Typography variant="h1">오늘의 운영 현황</Typography><Typography color="text.secondary">필요한 작업과 최근 변화를 한눈에 확인하세요.</Typography></Stack>

    <Box component="section" aria-labelledby="quick-actions-title"><Typography id="quick-actions-title" mb={2} variant="h2">빠른 실행</Typography><Grid container spacing={2}>{quickActions.map(([title, description, icon, to]) => <Grid item key={title} lg md={4} sm={6} xs={12}><Card sx={{ height: "100%" }}><Stack alignItems="flex-start" spacing={2}>{icon}<Box><Typography fontWeight={700}>{title}</Typography><Typography color="text.secondary" variant="body2">{description}</Typography></Box><Button fullWidth onClick={() => navigate(to)} variant="secondary">열기</Button></Stack></Card></Grid>)}</Grid></Box>

    {loading ? <Card><Loading label="운영 데이터를 불러오는 중입니다." /></Card> : null}
    {!loading ? <Box component="section" aria-labelledby="today-summary-title"><Typography id="today-summary-title" mb={2} variant="h2">오늘 요약</Typography><Grid container spacing={2}>{summaries.map(([label, value]) => <Grid item key={label} lg={2} md={4} sm={6} xs={6}><Card variant="stat"><Typography color="text.secondary" variant="body2">{label}</Typography><Typography mt={1} variant="h2">{value}</Typography></Card></Grid>)}</Grid></Box> : null}

    <Grid container spacing={3}>
      <Grid item md={6} xs={12}><Card><Stack spacing={2}><Typography variant="h2">최근 회원</Typography>{members.status === "ready" && members.data.members.length === 0 ? <EmptyState title="최근 회원이 없습니다" description="회원 선택에서 첫 작업을 시작해보세요." action={<Button onClick={() => navigate(routeBuilder.print())}>회원 선택</Button>} /> : members.data.members.slice(0, 5).map((member) => <Button key={member.memberId} onClick={() => navigate(routeBuilder.print())} sx={{ justifyContent: "space-between" }} variant="tertiary"><span>{member.displayName}</span><span>선택</span></Button>)}</Stack></Card></Grid>
      <Grid item md={6} xs={12}><Card><Stack spacing={2}><Typography variant="h2">사용 가능한 프로그램</Typography>{programState.status === "ready" && listItems.length === 0 ? <EmptyState title="프로그램이 없습니다" description="Condition Lab Master에서 Program을 등록해 주세요." /> : listItems.slice(0, 5).map((program) => <Button key={program.id} onClick={() => navigate(routeBuilder.print())} sx={{ justifyContent: "space-between" }} variant="tertiary"><span>{program.favorite ? "★ " : ""}{program.title}</span><Badge>{program.exerciseCount}개 운동</Badge></Button>)}</Stack></Card></Grid>
      <Grid item md={6} xs={12}><Card><Stack spacing={2}><Typography variant="h2">최근 Workout Sessions</Typography>{sessionStatus === "ready" && sessions.length === 0 ? <EmptyState title="Workout Session이 없습니다" description="프로그램을 출력하면 세션이 생성됩니다." /> : sessions.slice(0, 5).map((session) => { const view = workoutSessionStatusPresentation[session.status]; return <Button key={session.sessionId} onClick={() => navigate(routeBuilder.workoutSessionDetail(session.sessionId))} sx={{ justifyContent: "space-between" }} variant="tertiary"><span>{session.memberSnapshot.name} · {session.programSnapshot.title}</span><StatusChip label={view.label} status={session.status === "confirmed" || session.status === "ai_completed" ? "success" : session.status === "ocr_completed" ? "info" : "pending"} /></Button>; })}</Stack></Card></Grid>
      <Grid item md={6} xs={12}><Card><Stack spacing={2}><Typography variant="h2">최근 출력 기록</Typography>{printState.status === "ready" && printRecords.length === 0 ? <EmptyState title="출력 기록이 없습니다" description="Quick Print에서 첫 출력을 진행해보세요." /> : printRecords.slice(0, 5).map((record) => <Button key={record.id} onClick={() => navigate(routeBuilder.printHistory({ memberId: record.memberId }))} sx={{ justifyContent: "space-between" }} variant="tertiary"><span>{record.memberSnapshot.name} · {record.programSnapshot.title}</span><span>{dateLabel(record.printedAt)} · {record.copy}부</span></Button>)}</Stack></Card></Grid>
    </Grid>

    <Box component="section" aria-labelledby="system-status-title"><Typography id="system-status-title" mb={2} variant="h2">시스템 상태</Typography><Card><Grid container spacing={2}>{[["Shared Knowledge", `${programManagerRuntime.getAll().length}개`], ["Runtime", programManagerRuntime.getStatus() === "ready" ? "정상" : "확인 필요"], ["Firestore", members.status === "ready" ? "연결됨" : "확인 중"], ["Design System", `v${BASECAMP_DESIGN_SYSTEM_VERSION}`], ["Revision", String(runtimeRevision)]].map(([label, value]) => <Grid item key={label} md xs={6}><Stack spacing={1}><Typography color="text.secondary" variant="caption">{label}</Typography><StatusChip label={value} status={value === "확인 필요" ? "warning" : "success"} /></Stack></Grid>)}</Grid></Card></Box>
  </Stack></DashboardLayout></PageContainer>;
};
