import { Alert, Box, Button, Card, CardContent, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import type { RecommendedProgram } from "../printing/services/recommendationBuilderService";
import type { KioskRecommendationState } from "./useKioskRecommendation";

interface KioskRecommendationCardProps {
  state: KioskRecommendationState;
  memberId: string;
  onUse: (program: RecommendedProgram) => void;
  onEdit: (program: RecommendedProgram) => void;
  onManual: () => void;
}

/** Trainer recommendations for the selected member. Renders nothing when there is nothing to show. */
export const KioskRecommendationCard = ({ state, memberId, onUse, onEdit, onManual }: KioskRecommendationCardProps): JSX.Element | null => {
  // Shown only for the member bound to this Kiosk's Trainer handoff.
  const programs = state.status === "ready" && state.memberId === memberId && state.handoff.memberId === memberId ? state.programs : [];
  const sentProgramId = state.status === "ready" ? state.handoff.memberProgramId : null;
  const chipLabel = (program: RecommendedProgram) => [program.name, program.isDefault ? "기본" : null, program.id === sentProgramId ? "트레이너 전달" : null].filter(Boolean).join(" · ");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => { setSelectedId(programs[0]?.id ?? null); }, [programs]);

  if (state.status === "loading") return <Stack spacing={1}><Typography color="text.secondary">트레이너 추천 프로그램을 확인하고 있습니다.</Typography><LinearProgress /></Stack>;
  if (state.status === "error") return <Alert severity="info">트레이너 추천 프로그램을 불러오지 못했습니다. 아래에서 기존 방식으로 운동을 구성할 수 있습니다.</Alert>;
  const selected = programs.find((program) => program.id === selectedId) ?? programs[0];
  if (!selected) return null;

  return (
    <Card aria-label="트레이너 추천 프로그램" component="section" sx={{ border: 2, borderColor: "primary.main" }}>
      <CardContent>
        <Stack spacing={2}>
          <Typography sx={{ fontSize: { md: 26, xs: 21 }, fontWeight: 900 }}>트레이너 추천 프로그램</Typography>
          {programs.length > 1 ? (
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {programs.map((program) => <Chip aria-pressed={program.id === selected.id} clickable color={program.id === selected.id ? "primary" : "default"} key={program.id} label={chipLabel(program)} onClick={() => setSelectedId(program.id)} />)}
            </Stack>
          ) : null}
          <Box>
            <Typography sx={{ fontSize: { md: 22, xs: 18 }, fontWeight: 800 }}>{selected.name}</Typography>
            <Stack component="ol" spacing={0.5} sx={{ m: 0, mt: 1, pl: 3 }}>
              {selected.exercises.map((exercise) => <Typography component="li" key={`${exercise.order}-${exercise.exerciseId}`}>{exercise.name} · {exercise.plannedSets}세트{exercise.memo ? ` · ${exercise.memo}` : ""}</Typography>)}
            </Stack>
          </Box>
          <Stack direction={{ sm: "row", xs: "column" }} spacing={1.5}>
            <Button onClick={() => onUse(selected)} sx={{ fontSize: 20, minHeight: 64 }} variant="contained">그대로 사용</Button>
            <Button onClick={() => onEdit(selected)} sx={{ fontSize: 20, minHeight: 64 }} variant="outlined">수정해서 사용</Button>
            <Button onClick={onManual} sx={{ fontSize: 20, minHeight: 64 }} variant="text">직접 구성</Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};
