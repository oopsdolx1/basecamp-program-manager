import { AppLayout } from "../components/layout/AppLayout";
import { AppProviders } from "./AppProviders";
import { AppRouter } from "./AppRouter";

export const App = (): JSX.Element => (
  <AppProviders>
    <AppLayout>
      <AppRouter />
    </AppLayout>
  </AppProviders>
);
