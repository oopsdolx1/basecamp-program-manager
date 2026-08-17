import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { PageContainer } from "../components/layout/PageContainer";
import { MasterPage } from "../features/master";
import { DashboardPage } from "../features/dashboard";
import { ProgramEditorPage } from "../features/programs";
import { PrintPreviewPage, QuickPrintPage } from "../features/printing";
import { WorkoutSessionDetailPage, WorkoutSessionsPage } from "../features/workout-sessions";
import { routeBuilder } from "./routeBuilder";
import { routes } from "./routes";

const PlaceholderPage = ({ title }: { title: string }): JSX.Element => (
  <PageContainer>
    <h1>{title}</h1>
    <p>다음 단계에서 연결될 예정입니다.</p>
  </PageContainer>
);

const LegacyPrintHistoryRedirect = (): JSX.Element => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set("tab", "history");
  return <Navigate replace to={`${routes.master}?${params.toString()}`} />;
};

export const AppRouter = (): JSX.Element => (
  <Routes>
    <Route path={routeBuilder.home()} element={<Navigate replace to={routeBuilder.dashboard()} />} />
    <Route path="/program-manager" element={<Navigate replace to={routeBuilder.dashboard()} />} />
    <Route path={routeBuilder.dashboard()} element={<DashboardPage />} />
    <Route path={routeBuilder.print()} element={<QuickPrintPage />} />
    <Route path={routeBuilder.quickPrint()} element={<Navigate replace to={routeBuilder.print()} />} />
    <Route path={routeBuilder.master()} element={<MasterPage />} />
    <Route path={routeBuilder.programs()} element={<Navigate replace to={routeBuilder.master("programs")} />} />
    <Route path={routeBuilder.newProgram()} element={<ProgramEditorPage />} />
    <Route path={routes.programDetail} element={<ProgramEditorPage />} />
    <Route path={routes.editProgram} element={<ProgramEditorPage />} />
    <Route path={routes.printPreview} element={<PrintPreviewPage />} />
    <Route path={routes.printHistory} element={<LegacyPrintHistoryRedirect />} />
    <Route path={routes.workoutSessions} element={<WorkoutSessionsPage />} />
    <Route path={routes.workoutSessionDetail} element={<WorkoutSessionDetailPage />} />
    <Route path={routeBuilder.settings()} element={<PlaceholderPage title="설정 준비 중" />} />
  </Routes>
);
