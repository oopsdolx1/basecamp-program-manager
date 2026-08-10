import DeleteIcon from "@mui/icons-material/Delete";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Autocomplete, Box, Chip, Grid, IconButton, TextField, Tooltip, Typography } from "@mui/material";
import type { ExerciseCatalogOption } from "../../../exercise-catalog";
import type { ResolveResult } from "../../../exercise-resolver";
import type { ProgramFormExercise } from "../../types/program.types";

interface ExerciseSortableRowProps {
  exercise: ProgramFormExercise;
  catalogOptions: ExerciseCatalogOption[];
  resolveResult?: ResolveResult | null;
  canDelete: boolean;
  onChange: (patch: Partial<ProgramFormExercise>) => void;
  onDelete: () => void;
}

const findSelectedOption = (
  exercise: ProgramFormExercise,
  options: ExerciseCatalogOption[],
): ExerciseCatalogOption | null =>
  options.find((option) => option.id === exercise.catalogExerciseId) ?? null;

const normalizeOptionSearch = (value: string): string => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");

const catalogOptionSearchText = (option: ExerciseCatalogOption): string =>
  normalizeOptionSearch([option.name, option.displayName, option.englishName ?? "", ...option.aliases].join(" "));

export const ExerciseSortableRow = ({
  exercise,
  catalogOptions,
  resolveResult,
  canDelete,
  onChange,
  onDelete,
}: ExerciseSortableRowProps): JSX.Element => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: exercise.id,
  });
  const helperText =
    !exercise.catalogExerciseId && resolveResult?.status === "resolved" && resolveResult.exercise
      ? `추천 후보: ${resolveResult.exercise.name} (${resolveResult.confidence}%)`
      : !exercise.catalogExerciseId && resolveResult?.status === "ambiguous"
        ? `후보 ${resolveResult.candidateExercises.length}개: ${resolveResult.candidateExercises
            .map((candidate) => candidate.name)
            .join(", ")}`
        : exercise.name && !catalogOptions.some((option) => option.id === exercise.catalogExerciseId)
          ? `현재 저장값: ${exercise.name} (Shared Runtime에 없음)`
          : undefined;

  return (
    <Box
      ref={setNodeRef}
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        p: 1.5,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <Grid alignItems="center" container spacing={1.5}>
        <Grid item xs="auto">
          <Tooltip title="순서 변경">
            <IconButton {...attributes} {...listeners} size="small">
              <DragIndicatorIcon />
            </IconButton>
          </Tooltip>
        </Grid>
        <Grid item md={5} xs={12}>
          <Autocomplete
            options={catalogOptions}
            value={findSelectedOption(exercise, catalogOptions)}
            filterOptions={(options, state) => {
              const query = normalizeOptionSearch(state.inputValue);
              if (!query) return options;
              return options.filter((option) => catalogOptionSearchText(option).includes(query));
            }}
            getOptionLabel={(option) => option.displayName}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            onChange={(_, value) => {
              if (value) {
                onChange({ name: value.name, displayName: value.displayName, catalogExerciseId: value.id });
              }
            }}
            renderOption={(props, option) => (
              <Box component="li" {...props} key={option.id}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  <Typography fontWeight={900}>{option.displayName}</Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {option.englishName ? <Chip label={option.englishName} size="small" variant="outlined" /> : null}
                    <Chip label={option.categoryLabel} size="small" />
                    <Chip label={option.equipment || option.equipmentLabel} size="small" variant="outlined" />
                    {option.aliases.slice(0, 2).map((alias) => (
                      <Chip key={alias} label={alias} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Box>
              </Box>
            )}
            renderInput={(params) => <TextField {...params} helperText={helperText} label={`운동 ${exercise.order}`} />}
          />
        </Grid>
        <Grid item md={2} xs={6}>
          <TextField
            fullWidth
            inputProps={{ min: 1 }}
            label="세트"
            type="number"
            value={exercise.sets}
            onChange={(event) => onChange({ sets: Number(event.target.value) })}
          />
        </Grid>
        <Grid item md={4} xs={12}>
          <TextField
            fullWidth
            label="메모"
            value={exercise.memo}
            onChange={(event) => onChange({ memo: event.target.value })}
          />
        </Grid>
        <Grid item xs="auto">
          <Tooltip title="삭제">
            <span>
              <IconButton disabled={!canDelete} onClick={onDelete}>
                <DeleteIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Grid>
      </Grid>
    </Box>
  );
};
