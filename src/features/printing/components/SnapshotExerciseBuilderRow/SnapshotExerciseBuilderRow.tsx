import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { Autocomplete, Box, Button, Card, CardContent, Chip, Grid, IconButton, Stack, TextField, Typography } from "@mui/material";
import { memo } from "react";
import { palette } from "../../../../theme/palette";
import type { ExerciseCatalogOption } from "../../../exercise-catalog";
import { normalizeText } from "../../../../utils/normalizeText";
import type { SnapshotBuilderExercise } from "../../services/snapshotBuilderService";

interface SnapshotExerciseBuilderRowProps {
  guided?: boolean;
  prescription?: boolean;
  exercise: SnapshotBuilderExercise;
  index: number;
  total: number;
  catalogOptions: ExerciseCatalogOption[];
  onPatch: (patch: Partial<SnapshotBuilderExercise>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onPreset: (preset: string) => void;
}

const presetButtons = [
  { key: "plus_set", label: "+1 Set" },
  { key: "minus_set", label: "-1 Set" },
  { key: "reps_8_10", label: "8~10회" },
  { key: "reps_10_12", label: "10~12회" },
  { key: "reps_12_15", label: "12~15회" },
  { key: "reps_15_20", label: "15~20회" },
  { key: "failure", label: "Failure" },
  { key: "drop_set", label: "Drop Set" },
  { key: "super_set", label: "Super Set" },
  { key: "tempo", label: "Tempo" },
  { key: "rest_pause", label: "Rest Pause" },
];

const searchText = (option: ExerciseCatalogOption): string =>
  normalizeText([option.name, option.displayName, option.englishName ?? "", ...option.aliases].join(" "));

export const SnapshotExerciseBuilderRow = memo(function SnapshotExerciseBuilderRow({
  guided = false,
  prescription = false,
  exercise,
  index,
  total,
  catalogOptions,
  onPatch,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onPreset,
}: SnapshotExerciseBuilderRowProps): JSX.Element {
  const selectedOption = catalogOptions.find((option) => option.id === exercise.catalogExerciseId) ?? null;
  const unavailableName = !selectedOption && exercise.name ? exercise.name : "";

  return (
    <Card sx={{ bgcolor: palette.surfaceInteractive, border: 1, borderColor: "divider", boxShadow: "none", minHeight: prescription ? { md: 154, xs: 140 } : undefined }}>
      <CardContent sx={prescription ? { p: { md: 3, xs: 2 } } : undefined}>
        <Stack spacing={prescription ? 1 : 2}>
          {prescription ? <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2} sx={{ minWidth: 0 }}><Stack alignItems="center" direction="row" spacing={2} sx={{ minWidth: 0 }}><Typography color="primary.main" sx={{ fontSize: { md: 25, xs: 21 }, fontWeight: 900, minWidth: { md: 40, xs: 34 } }}>{String(index + 1).padStart(2, "0")}</Typography><Box aria-hidden="true" sx={{ alignItems: "center", bgcolor: "primary.main", borderRadius: "50%", color: "primary.contrastText", display: "flex", flex: "0 0 auto", height: { md: 48, xs: 42 }, justifyContent: "center", width: { md: 48, xs: 42 } }}><FitnessCenterIcon /></Box><Box sx={{ flex: 1, minWidth: 0 }}><Typography sx={{ fontSize: { md: 30, xs: 24 }, fontWeight: 800, lineHeight: 1.2 }}>{exercise.displayName || exercise.name}</Typography><Typography color="text.secondary" noWrap sx={{ fontSize: { md: 16, xs: 14 }, mt: 0.35 }}>{[selectedOption?.bodyPart, selectedOption?.equipment, exercise.memo].filter(Boolean).join(" · ") || "운동 정보를 확인해 주세요."}</Typography></Box></Stack><Button color="inherit" disabled={total <= 1} onClick={onDelete} startIcon={<DeleteIcon />} sx={{ borderColor: "divider", color: "text.secondary", flex: "0 0 auto", fontSize: { md: 20, xs: 17 }, minHeight: { md: 60, xs: 52 } }} variant="outlined">삭제</Button></Stack> : <Stack alignItems={{ sm: "center", xs: "flex-start" }} direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={1}>
            <Stack alignItems="center" direction="row" spacing={1}>
              <Typography variant="h2">운동 {exercise.order}</Typography>
              <Chip label={index + 1 === total ? "Last" : `#${index + 1}`} size="small" variant="outlined" />
            </Stack>
            <Stack direction="row" spacing={0.5}>
              <IconButton aria-label={`${exercise.order}번 운동 위로 이동`} disabled={index === 0} onClick={onMoveUp} sx={{ minHeight: 48, minWidth: 48 }}><KeyboardArrowUpIcon /></IconButton>
              <IconButton aria-label={`${exercise.order}번 운동 아래로 이동`} disabled={index === total - 1} onClick={onMoveDown} sx={{ minHeight: 48, minWidth: 48 }}><KeyboardArrowDownIcon /></IconButton>
              {!guided ? <IconButton aria-label={`${exercise.order}번 운동 복사`} onClick={onDuplicate} sx={{ minHeight: 48, minWidth: 48 }}><ContentCopyIcon /></IconButton> : null}
              <IconButton aria-label={`${exercise.order}번 운동 삭제`} disabled={total <= 1} onClick={onDelete} sx={{ minHeight: 48, minWidth: 48 }}><DeleteIcon /></IconButton>
            </Stack>
          </Stack>}

          {!prescription ? <Autocomplete
            options={catalogOptions}
            value={selectedOption}
            filterOptions={(options, state) => {
              const query = normalizeText(state.inputValue);
              if (!query) return options;
              return options.filter((option) => searchText(option).includes(query));
            }}
            getOptionLabel={(option) => option.displayName}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            onChange={(_, value) => {
              if (value) {
                onPatch({ name: value.name, displayName: value.displayName, catalogExerciseId: value.id });
              }
            }}
            renderInput={(params) => <TextField {...params} helperText={unavailableName ? `현재 저장값: ${unavailableName} (Shared Runtime에 없음)` : undefined} label="Exercise Replace" />}
          /> : null}

          {guided ? (
            <Stack spacing={prescription ? 0.5 : 1.5}>
              {prescription ? <Stack alignItems={{ md: "center", xs: "stretch" }} direction={{ md: "row", xs: "column" }} justifyContent="space-between" spacing={2}><Stack direction="row" spacing={1.25}><Button aria-label={`${exercise.order}번 운동 위로 이동`} disabled={index === 0} onClick={onMoveUp} startIcon={<KeyboardArrowUpIcon />} sx={{ fontSize: { md: 20, xs: 18 }, minHeight: { md: 64, xs: 56 } }} variant="outlined">위로</Button><Button aria-label={`${exercise.order}번 운동 아래로 이동`} disabled={index === total - 1} onClick={onMoveDown} startIcon={<KeyboardArrowDownIcon />} sx={{ fontSize: { md: 20, xs: 18 }, minHeight: { md: 64, xs: 56 } }} variant="outlined">아래로</Button></Stack><Stack alignItems="center" direction="row" justifyContent={{ xs: "space-between", md: "flex-end" }} spacing={1.25}><Button aria-label={`${exercise.order}번 운동 세트 줄이기`} disabled={exercise.plannedSets <= 1} variant="outlined" onClick={() => onPatch({ plannedSets: exercise.plannedSets - 1 })} sx={{ fontSize: 32, minHeight: { md: 64, xs: 56 }, minWidth: { md: 64, xs: 56 } }}>−</Button><Typography align="center" color="primary.main" sx={{ fontSize: { md: 27, xs: 23 }, fontWeight: 900, minWidth: 104 }}>{exercise.plannedSets}세트</Typography><Button aria-label={`${exercise.order}번 운동 세트 늘리기`} disabled={exercise.plannedSets >= 5} variant="outlined" onClick={() => onPatch({ plannedSets: exercise.plannedSets + 1 })} sx={{ fontSize: 32, minHeight: { md: 64, xs: 56 }, minWidth: { md: 64, xs: 56 } }}>+</Button></Stack></Stack> : <Stack direction="row" flexWrap="wrap" gap={1}><Chip label={`${exercise.sets}세트`} /><Chip label={exercise.reps ? `${exercise.reps}회` : "횟수 미지정"} variant="outlined" /><Chip label={`휴식 ${exercise.restSeconds}초`} variant="outlined" /></Stack>}
            </Stack>
          ) : (
            <Grid container spacing={1.5}>
              <Grid item md={2.4} sm={4} xs={6}><TextField fullWidth label="세트" type="number" inputProps={{ min: 1 }} value={exercise.sets} onChange={(event) => onPatch({ sets: Number(event.target.value) })} /></Grid>
              <Grid item md={2.4} sm={4} xs={6}><TextField fullWidth label="횟수" value={exercise.reps} onChange={(event) => onPatch({ reps: event.target.value })} /></Grid>
              <Grid item md={2.4} sm={4} xs={6}><TextField fullWidth label="무게" value={exercise.weight} onChange={(event) => onPatch({ weight: event.target.value })} /></Grid>
              <Grid item md={2.4} sm={6} xs={6}><TextField fullWidth label="휴식(초)" type="number" inputProps={{ min: 0 }} value={exercise.restSeconds} onChange={(event) => onPatch({ restSeconds: Number(event.target.value) })} /></Grid>
              <Grid item md={2.4} sm={6} xs={12}><TextField fullWidth label="메모" value={exercise.memo} onChange={(event) => onPatch({ memo: event.target.value })} /></Grid>
            </Grid>
          )}

          {!guided ? <Stack direction="row" flexWrap="wrap" gap={1}>
            {presetButtons.map((preset) => (
              <Button key={preset.key} size="small" variant="outlined" onClick={() => onPreset(preset.key)}>
                {preset.label}
              </Button>
            ))}
          </Stack> : null}
        </Stack>
      </CardContent>
    </Card>
  );
});
