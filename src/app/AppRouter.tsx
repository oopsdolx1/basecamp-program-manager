import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { PageContainer } from "../components/layout/PageContainer";
import { MasterPage } from "../features/master";
import { PrintPreviewPage, QuickPrintPage } from "../features/printing";
import { WorkoutSessionDetailPage, WorkoutSessionsPage } from "../features/workout-sessions";
import { routeBuilder } from "./routeBuilder";
import { routes } from "./routes";

const PlaceholderPage = ({ title }: { title: string }): JSX.Element => (
  <PageContainer>
    <h1>{title}</h1>
    <p>이 기능은 준비 중입니다.</p>
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
    <Route path={routeBuilder.home()} element={<Navigate replace to={routeBuilder.print()} />} />
    <Route path="/program-manager" element={<Navigate replace to={routeBuilder.print()} />} />
    <Route path={routeBuilder.dashboard()} element={<Navigate replace to={routeBuilder.print()} />} />
    <Route path={routeBuilder.print()} element={<QuickPrintPage />} />
    <Route path={routeBuilder.quickPrint()} element={<Navigate replace to={routeBuilder.print()} />} />
    <Route path={routeBuilder.master()} element={<MasterPage />} />
    <Route path={routeBuilder.programs()} element={<Navigate replace to={routeBuilder.print()} />} />
    <Route path={routeBuilder.newProgram()} element={<Navigate replace to={routeBuilder.print()} />} />
    <Route path={routes.programDetail} element={<Navigate replace to={routeBuilder.print()} />} />
    <Route path={routes.editProgram} element={<Navigate replace to={routeBuilder.print()} />} />
    <Route path={routes.printPreview} element={<PrintPreviewPage />} />
    <Route path={routes.printHistory} element={<LegacyPrintHistoryRedirect />} />
    <Route path={routes.workoutSessions} element={<WorkoutSessionsPage />} />
    <Route path={routes.workoutSessionDetail} element={<WorkoutSessionDetailPage />} />
    <Route path={routeBuilder.settings()} element={<PlaceholderPage title="설정 준비 중" />} />
  </Routes>
);
