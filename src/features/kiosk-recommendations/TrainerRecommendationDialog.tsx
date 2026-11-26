import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { createRecommendationBuilderHistory, type RecommendedProgram } from "../printing/services/recommendationBuilderService";
import { createRecommendationCardExercises, formatRecommendationSets } from "../printing/services/recommendationCardPresentationService";
import { palette } from "../../theme/palette";

interface Props { open: boolean; program: RecommendedProgram | null; onUse: (program: RecommendedProgram) => void; onDecline: () => void; }
const touchButton = { borderRadius: 3, flex: 1, fontSize: { md: 24, xs: 20 }, fontWeight: 800, m: "0 !important", minHeight: { md: 80, xs: 68 } };

export const TrainerRecommendationDialog = ({ open, program, onUse, onDecline }: Props): JSX.Element => {
  const exercises = program ? createRecommendationCardExercises(createRecommendationBuilderHistory(program).present.exercises) : [];
  return <Dialog aria-describedby="trainer-recommendation-message" aria-labelledby="trainer-recommendation-title" disableEscapeKeyDown fullWidth maxWidth="md" open={open && Boolean(program)} scroll="paper" PaperProps={{ sx: { bgcolor: palette.surface, backgroundImage: "none", border: 2, borderColor: "primary.main", borderRadius: 4, m: { md: 4, xs: 1.5 }, maxHeight: { md: "calc(100% - 64px)", xs: "calc(100% - 24px)" }, width: { md: "calc(100% - 64px)", xs: "calc(100% - 24px)" } } }}>
    <DialogTitle id="trainer-recommendation-title" sx={{ fontSize: { md: 34, xs: 26 }, fontWeight: 900, pb: 1, pt: { md: 4, xs: 2.5 }, px: { md: 4, xs: 2.5 } }}>트레이너 추천 프로그램</DialogTitle>
    <Box sx={{ pb: 2, px: { md: 4, xs: 2.5 } }}><Typography color="text.secondary" id="trainer-recommendation-message" sx={{ fontSize: { md: 21, xs: 17 } }}>트레이너가 준비한 프로그램입니다. 이 구성으로 진행하시겠습니까?</Typography>{program ? <Typography color="primary" sx={{ fontSize: { md: 28, xs: 22 }, fontWeight: 900, mt: 2 }}>{program.name}</Typography> : null}</Box>
    <DialogContent dividers sx={{ borderColor: palette.borderAccent, px: { md: 4, xs: 2.5 }, py: 1 }}><Stack aria-label="추천 운동 목록" component="ol" sx={{ listStyle: "none", m: 0, p: 0 }}>{exercises.map((exercise, index) => <Box component="li" key={exercise.id} sx={{ alignItems: "baseline", borderColor: "divider", borderTop: index ? 1 : 0, display: "grid", gap: 1.5, gridTemplateColumns: "auto minmax(0, 1fr) auto", py: 1.5 }}><Typography color="primary.main" fontWeight={900}>{String(exercise.order).padStart(2, "0")}</Typography><Box><Typography fontWeight={800} sx={{ overflowWrap: "anywhere" }}>{exercise.name}</Typography>{program?.exercises.find((item) => item.order === exercise.order)?.memo ? <Typography color="text.secondary">{program.exercises.find((item) => item.order === exercise.order)?.memo}</Typography> : null}</Box><Typography fontWeight={800} sx={{ whiteSpace: "nowrap" }}>{formatRecommendationSets(exercise)}</Typography></Box>)}</Stack></DialogContent>
    <DialogActions sx={{ flexDirection: { sm: "row", xs: "column-reverse" }, gap: { md: 2, xs: 1.5 }, p: { md: 4, xs: 2.5 }, pt: { md: 3, xs: 2 } }}><Button color="inherit" fullWidth onClick={onDecline} sx={touchButton} variant="outlined">다른 운동 선택</Button>{program ? <Button fullWidth onClick={() => onUse(program)} sx={touchButton} variant="contained">추천 프로그램으로 진행</Button> : null}</DialogActions>
  </Dialog>;
};
