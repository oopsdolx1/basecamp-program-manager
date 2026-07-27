import { Navigate, Route, Routes } from "react-router-dom";
import { PageContainer } from "../components/layout/PageContainer";
import { ExerciseCatalogPage } from "../features/exercise-catalog";
import { PrintHistoryPage } from "../features/print-history";
import { ProgramEditorPage, ProgramListPage } from "../features/programs";
import { PrintPreviewPage, QuickPrintPage } from "../features/printing";
import { routeBuilder } from "./routeBuilder";
import { routes } from "./routes";

const PlaceholderPage = ({ title }: { title: string }): JSX.Element => (
  <PageContainer>
    <h1>{title}</h1>
    <p>다음 단계에서 연결할 예정입니다.</p>
  </PageContainer>
);

export const AppRouter = (): JSX.Element => (
  <Routes>
    <Route path={routeBuilder.home()} element={<Navigate replace to={routeBuilder.quickPrint()} />} />
    <Route path={routeBuilder.quickPrint()} element={<QuickPrintPage />} />
    <Route path={routeBuilder.programs()} element={<ProgramListPage />} />
    <Route path={routeBuilder.exerciseCatalog()} element={<ExerciseCatalogPage />} />
    <Route path={routeBuilder.newProgram()} element={<ProgramEditorPage />} />
    <Route path={routes.programDetail} element={<ProgramEditorPage />} />
    <Route path={routes.editProgram} element={<ProgramEditorPage />} />
    <Route path={routes.printPreview} element={<PrintPreviewPage />} />
    <Route path={routeBuilder.printHistory()} element={<PrintHistoryPage />} />
    <Route path={routeBuilder.settings()} element={<PlaceholderPage title="설정 준비 중" />} />
  </Routes>
);
