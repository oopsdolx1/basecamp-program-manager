import { PageContainer } from "../../../components/layout/PageContainer";
import { toAppId } from "../../../types/brandedIds";
import { QuickPrintFlow } from "../components/QuickPrintFlow/QuickPrintFlow";
import {
  createConditionLabMemberProvider,
  createConditionLabRecommendationProvider,
  createConditionLabWorkoutHistoryProvider,
} from "../providers/conditionLabProviders";

const conditionLabAppId = toAppId(import.meta.env.VITE_CONDITION_LAB_APP_ID ?? "");
const memberProvider = createConditionLabMemberProvider(conditionLabAppId);
const workoutHistoryProvider = createConditionLabWorkoutHistoryProvider(conditionLabAppId);
const recommendationProvider = createConditionLabRecommendationProvider(memberProvider, workoutHistoryProvider);

export const QuickPrintPage = (): JSX.Element => (
  <PageContainer>
    <QuickPrintFlow appId={conditionLabAppId} memberProvider={memberProvider} recommendationProvider={recommendationProvider} />
  </PageContainer>
);
