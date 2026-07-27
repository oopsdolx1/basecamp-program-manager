import { PageContainer } from "../../../components/layout/PageContainer";
import { toAppId } from "../../../types/brandedIds";
import { QuickPrintFlow } from "../components/QuickPrintFlow/QuickPrintFlow";

const conditionLabAppId = toAppId(import.meta.env.VITE_CONDITION_LAB_APP_ID ?? "");

export const QuickPrintPage = (): JSX.Element => (
  <PageContainer>
    <QuickPrintFlow appId={conditionLabAppId} />
  </PageContainer>
);
