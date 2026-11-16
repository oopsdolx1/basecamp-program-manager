import { Alert, Box, Button, Card, CardContent, LinearProgress, Stack, Typography } from "@mui/material";
import type { RecommendedProgram } from "../printing/services/recommendationBuilderService";
import type { KioskRecommendationState } from "./useKioskRecommendation";

interface KioskRecommendationCardProps {
  state: KioskRecommendationState;
  memberId: string;
  onUse: (program: RecommendedProgram) => void;
  onEdit: (program: RecommendedProgram) => void;
  onManual: () => void;
}

// Kiosk touch targets: large, full-width on narrow screens, generous spacing between choices.
const touchButton = { fontSize: { md: 22, xs: 20 }, fontWeight: 800, minHeight: { md: 76, xs: 68 }, borderRadius: 3, flex: 1 };

/**
 * The selected member's default Trainer recommendation. Renders nothing when there is none, so members
 * without a recommendation continue straight into the existing flow without an extra notice.
 */
export const KioskRecommendationCard = ({ state, memberId, onUse, onEdit, onManual }: KioskRecommendationCardProps): JSX.Element | null => {
  const program = state.status === "ready" && state.memberId === memberId ? state.program : null;

  // Quiet loading indicator only: most lookups are fast and many members have no recommendation.
  if (state.status === "loading") return <LinearProgress aria-label="트레이너 추천 확인 중" sx={{ borderRadius: 1 }} />;
  if (state.status === "error") return <Alert severity="info">트레이너 추천 프로그램을 불러오지 못했습니다. 아래에서 평소처럼 운동을 구성해 주세요.</Alert>;
  if (!program) return null;

  return (
    <Card aria-label="트레이너 추천 프로그램" component="section" sx={{ border: 2, borderColor: "primary.main", borderRadius: 4 }}>
      <CardContent sx={{ p: { md: 4, xs: 2.5 } }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography color="primary" sx={{ fontSize: { md: 18, xs: 16 }, fontWeight: 800 }}>트레이너 추천</Typography>
            <Typography component="h2" sx={{ fontSize: { md: 30, xs: 24 }, fontWeight: 900, lineHeight: 1.3 }}>{program.name}</Typography>
            <Typography color="text.secondary" sx={{ fontSize: { md: 19, xs: 17 }, mt: 0.5 }}>트레이너가 준비한 프로그램으로 운동할까요?</Typography>
          </Box>
          <Stack component="ol" spacing={1} sx={{ m: 0, pl: 3.5 }}>
            {program.exercises.map((exercise) => <Typography component="li" key={`${exercise.order}-${exercise.exerciseId}`} sx={{ fontSize: { md: 20, xs: 18 } }}>{exercise.name} · {exercise.plannedSets}세트{exercise.memo ? ` · ${exercise.memo}` : ""}</Typography>)}
          </Stack>
          <Stack direction={{ md: "row", xs: "column" }} spacing={{ md: 2, xs: 1.5 }}>
            <Button onClick={() => onUse(program)} sx={touchButton} variant="contained">추천대로 운동하기</Button>
            <Button onClick={() => onEdit(program)} sx={touchButton} variant="outlined">수정해서 사용</Button>
            <Button onClick={onManual} sx={touchButton} variant="outlined" color="inherit">직접 구성하기</Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};
