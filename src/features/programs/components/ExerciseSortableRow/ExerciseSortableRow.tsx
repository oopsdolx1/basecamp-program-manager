import DeleteIcon from "@mui/icons-material/Delete";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import SearchIcon from "@mui/icons-material/Search";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Autocomplete, Box, Button, Chip, Grid, IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import type { ExerciseCatalogOption } from "../../../exercise-catalog";
import type { ResolveResult } from "../../../exercise-resolver";
import type { ProgramFormExercise } from "../../types/program.types";
import { NumericStepper } from "../NumericStepper/NumericStepper";

interface ExerciseSortableRowProps {
  exercise: ProgramFormExercise;
  catalogOptions: ExerciseCatalogOption[];
  resolveResult?: ResolveResult | null;
  canDelete: boolean;
  index: number;
  total: number;
  onChange: (patch: Partial<ProgramFormExercise>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onOpenPicker: () => void;
}

const normalizeOptionSearch = (value: string): string => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
const optionSearchText = (option: ExerciseCatalogOption): string => normalizeOptionSearch([option.name, option.displayName, option.englishName ?? "", ...option.aliases].join(" "));

export const ExerciseSortableRow = ({ exercise, catalogOptions, resolveResult, canDelete, index, total, onChange, onDelete, onMoveUp, onMoveDown, onOpenPicker }: ExerciseSortableRowProps): JSX.Element => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: exercise.id });
  const selected = catalogOptions.find((option) => option.id === exercise.catalogExerciseId) ?? null;
  const helperText = !selected && exercise.name
    ? `현재 저장값: ${exercise.name} (Shared Runtime에 없음)`
    : resolveResult?.status === "ambiguous" ? `후보 ${resolveResult.candidateExercises.length}개` : undefined;

  return (
    <Box ref={setNodeRef} sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: { sm: 2, xs: 1.5 }, transform: CSS.Transform.toString(transform), transition }}>
      <Stack spacing={2}>
        <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
          <Stack alignItems="center" direction="row" spacing={1}>
            <Tooltip title="드래그로 순서 변경">
              <IconButton aria-label={`${exercise.order}번 운동 드래그`} {...attributes} {...listeners} sx={{ minHeight: 44, minWidth: 44 }}><DragIndicatorIcon /></IconButton>
            </Tooltip>
            <Box><Typography fontWeight={900}>운동 {exercise.order}</Typography><Typography color="text.secondary" variant="body2">{selected ? `${selected.bodyPart} · ${selected.equipment}` : exercise.name || "운동을 선택하세요"}</Typography></Box>
          </Stack>
          <Stack direction="row" spacing={0.5}>
            <IconButton aria-label={`${exercise.order}번 운동 위로 이동`} disabled={index === 0} onClick={onMoveUp} sx={{ minHeight: 48, minWidth: 48 }}><KeyboardArrowUpIcon /></IconButton>
            <IconButton aria-label={`${exercise.order}번 운동 아래로 이동`} disabled={index === total - 1} onClick={onMoveDown} sx={{ minHeight: 48, minWidth: 48 }}><KeyboardArrowDownIcon /></IconButton>
          </Stack>
        </Stack>

        <Button fullWidth startIcon={<SearchIcon />} variant="outlined" onClick={onOpenPicker} sx={{ justifyContent: "flex-start", minHeight: 56 }}>
          {exercise.name || "Runtime에서 운동 선택"}
        </Button>

        <Autocomplete
          options={catalogOptions}
          value={selected}
          filterOptions={(options, state) => {
            const query = normalizeOptionSearch(state.inputValue);
            return query ? options.filter((option) => optionSearchText(option).includes(query)) : options;
          }}
          getOptionLabel={(option) => option.displayName}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          onChange={(_, value) => value && onChange({ name: value.name, displayName: value.displayName, catalogExerciseId: value.id })}
          renderOption={(props, option) => <Box component="li" {...props} key={option.id} sx={{ minHeight: 56 }}><Box><Typography fontWeight={900}>{option.displayName}</Typography><Stack direction="row" flexWrap="wrap" gap={0.5}><Chip label={option.bodyPart} size="small" /><Chip label={option.equipment} size="small" variant="outlined" /></Stack></Box></Box>}
          renderInput={(params) => <TextField {...params} helperText={helperText} label="보조 검색" />}
        />

        <Grid alignItems="center" container spacing={1.5}>
          <Grid item md={5} xs={12}><NumericStepper label="세트" value={exercise.sets} onChange={(sets) => onChange({ sets })} /></Grid>
          <Grid item md={7} xs={12}><TextField fullWidth label="메모" value={exercise.memo} onChange={(event) => onChange({ memo: event.target.value })} /></Grid>
        </Grid>

        <Stack direction="row" justifyContent="flex-end">
          <Button color="error" disabled={!canDelete} startIcon={<DeleteIcon />} variant="outlined" onClick={onDelete} sx={{ minHeight: 48, minWidth: 112 }}>삭제</Button>
        </Stack>
      </Stack>
    </Box>
  );
};
