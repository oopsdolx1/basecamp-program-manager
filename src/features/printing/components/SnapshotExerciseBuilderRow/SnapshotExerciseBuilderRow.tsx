import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { Autocomplete, Button, Card, CardContent, Chip, Grid, IconButton, Stack, TextField, Typography } from "@mui/material";
import { memo } from "react";
import { palette } from "../../../../theme/palette";
import type { ExerciseCatalogOption } from "../../../exercise-catalog";
import { normalizeText } from "../../../../utils/normalizeText";
import type { SnapshotBuilderExercise } from "../../services/snapshotBuilderService";

interface SnapshotExerciseBuilderRowProps {
  guided?: boolean;
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
    <Card sx={{ bgcolor: palette.surfaceInteractive, border: 1, borderColor: "divider", boxShadow: "none" }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack alignItems={{ sm: "center", xs: "flex-start" }} direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={1}>
            <Stack alignItems="center" direction="row" spacing={1}>
              <Typography variant="h2">운동 {exercise.order}</Typography>
              <Chip label={index + 1 === total ? "Last" : `#${index + 1}`} size="small" variant="outlined" />
            </Stack>
            <Stack direction="row" spacing={0.5}>
              <IconButton aria-label={`${exercise.order}번 운동 위로 이동`} disabled={index === 0} onClick={onMoveUp} sx={{ minHeight: 48, minWidth: 48 }}><KeyboardArrowUpIcon /></IconButton>
              <IconButton aria-label={`${exercise.order}번 운동 아래로 이동`} disabled={index === total - 1} onClick={onMoveDown} sx={{ minHeight: 48, minWidth: 48 }}><KeyboardArrowDownIcon /></IconButton>
              {!guided ? <IconButton aria-label={`${exercise.order}번 운동 복사`} onClick={onDuplicate} sx={{ minHeight: 48, minWidth: 48 }}><ContentCopyIcon /></IconButton> : null}
              {!guided ? <IconButton aria-label={`${exercise.order}번 운동 삭제`} disabled={total <= 1} onClick={onDelete} sx={{ minHeight: 48, minWidth: 48 }}><DeleteIcon /></IconButton> : null}
            </Stack>
          </Stack>

          <Autocomplete
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
          />

          {guided ? (
            <Stack spacing={1.5}>
              <Stack direction="row" flexWrap="wrap" gap={1}><Chip label={`${exercise.sets}세트`} /><Chip label={exercise.reps ? `${exercise.reps}회` : "횟수 미지정"} variant="outlined" /><Chip label={`휴식 ${exercise.restSeconds}초`} variant="outlined" /></Stack>
              <TextField fullWidth label="출력 메모" value={exercise.memo} onChange={(event) => onPatch({ memo: event.target.value })} />
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
