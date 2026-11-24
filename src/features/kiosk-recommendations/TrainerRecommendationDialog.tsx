import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import type { RecommendedProgram } from "../printing/services/recommendationBuilderService";
import { palette } from "../../theme/palette";

interface TrainerRecommendationDialogProps {
  open: boolean;
  /** Kept after closing so the content does not empty during the close transition. */
  program: RecommendedProgram | null;
  onUse: (program: RecommendedProgram) => void;
  onDecline: () => void;
}

// Kiosk touch targets: large, full-width on narrow screens, generous spacing between choices.
const touchButton = { fontSize: { md: 24, xs: 20 }, fontWeight: 800, minHeight: { md: 80, xs: 68 }, borderRadius: 3, flex: 1, m: "0 !important" };

/**
 * Condition step (step 2) popup for the selected member's default Trainer recommendation. Only the exercise
 * list scrolls; the title and both choices stay on screen at any Kiosk resolution. The backdrop and Escape
 * do not dismiss it, so the member always answers with one of the two buttons.
 */
export const TrainerRecommendationDialog = ({ open, program, onUse, onDecline }: TrainerRecommendationDialogProps): JSX.Element => {
  const exercises = program ? [...program.exercises].sort((left, right) => left.order - right.order) : [];
  return (
    <Dialog
      aria-describedby="trainer-recommendation-message"
      aria-labelledby="trainer-recommendation-title"
      disableEscapeKeyDown
      fullWidth
      maxWidth="md"
      open={open && Boolean(program)}
      scroll="paper"
      PaperProps={{ sx: { bgcolor: palette.surface, backgroundImage: "none", border: 2, borderColor: "primary.main", borderRadius: 4, m: { md: 4, xs: 1.5 }, maxHeight: { md: "calc(100% - 64px)", xs: "calc(100% - 24px)" }, width: { md: "calc(100% - 64px)", xs: "calc(100% - 24px)" } } }}
    >
      <DialogTitle id="trainer-recommendation-title" sx={{ fontSize: { md: 34, xs: 26 }, fontWeight: 900, lineHeight: 1.25, pb: 1, pt: { md: 4, xs: 2.5 }, px: { md: 4, xs: 2.5 } }}>트레이너 추천 프로그램이 있습니다</DialogTitle>
      <Box sx={{ pb: 2, px: { md: 4, xs: 2.5 } }}>
        <Typography color="text.secondary" id="trainer-recommendation-message" sx={{ fontSize: { md: 21, xs: 17 }, lineHeight: 1.5 }}>트레이너가 회원님을 위해 준비한 운동 프로그램입니다. 이 프로그램으로 진행하시겠습니까?</Typography>
        {program ? <Typography color="primary" component="p" sx={{ fontSize: { md: 28, xs: 22 }, fontWeight: 900, lineHeight: 1.3, mt: 2 }}>{program.name}</Typography> : null}
      </Box>
      <DialogContent dividers sx={{ borderColor: palette.borderAccent, px: { md: 4, xs: 2.5 }, py: 1 }}>
        <Stack aria-label="추천 운동 목록" component="ol" sx={{ listStyle: "none", m: 0, p: 0 }}>
          {exercises.map((exercise, index) => (
            <Box component="li" key={`${exercise.order}-${exercise.exerciseId}`} sx={{ alignItems: "baseline", borderColor: "divider", borderTop: index ? 1 : 0, display: "grid", gap: 1.5, gridTemplateColumns: "auto minmax(0, 1fr) auto", py: 1.5 }}>
              <Typography color="primary.main" sx={{ fontSize: { md: 20, xs: 17 }, fontWeight: 900 }}>{String(index + 1).padStart(2, "0")}</Typography>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: { md: 22, xs: 18 }, fontWeight: 800, overflowWrap: "anywhere" }}>{exercise.name}</Typography>
                {exercise.memo ? <Typography color="text.secondary" sx={{ fontSize: { md: 17, xs: 15 }, mt: 0.25, overflowWrap: "anywhere" }}>{exercise.memo}</Typography> : null}
              </Box>
              <Typography sx={{ fontSize: { md: 21, xs: 18 }, fontWeight: 800, whiteSpace: "nowrap" }}>{exercise.plannedSets}세트</Typography>
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexDirection: { sm: "row", xs: "column-reverse" }, gap: { md: 2, xs: 1.5 }, p: { md: 4, xs: 2.5 }, pt: { md: 3, xs: 2 } }}>
        <Button color="inherit" fullWidth onClick={onDecline} sx={touchButton} variant="outlined">다른 운동 선택</Button>
        {program ? <Button fullWidth onClick={() => onUse(program)} sx={touchButton} variant="contained">추천 프로그램 사용</Button> : null}
      </DialogActions>
    </Dialog>
  );
};
