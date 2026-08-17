import { useParams } from "react-router-dom";
import { WorkoutSessionsPage } from "./WorkoutSessionsPage";

export const WorkoutSessionDetailPage = (): JSX.Element => {
  const { sessionId } = useParams();
  return <WorkoutSessionsPage initialSessionId={sessionId ?? null} />;
};
