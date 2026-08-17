import CloseIcon from "@mui/icons-material/Close";
import { Box, Button, CardActionArea, Dialog, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography, useMediaQuery, useTheme } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import type { ExerciseCatalogOption } from "../../../exercise-catalog";
import { normalizeText } from "../../../../utils/normalizeText";

interface ExercisePickerProps {
  open: boolean;
  exercises: ExerciseCatalogOption[];
  onClose: () => void;
  onSelect: (exercise: ExerciseCatalogOption) => void;
}

const ALL = "전체";
const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko-KR"));

export const ExercisePicker = ({ open, exercises, onClose, onSelect }: ExercisePickerProps): JSX.Element => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [bodyPart, setBodyPart] = useState(ALL);
  const [equipment, setEquipment] = useState(ALL);
  const [query, setQuery] = useState("");
  const bodyParts = useMemo(() => unique(exercises.map((exercise) => exercise.bodyPart)), [exercises]);
  const equipmentOptions = useMemo(() => unique(exercises
    .filter((exercise) => bodyPart === ALL || exercise.bodyPart === bodyPart)
    .map((exercise) => exercise.equipment)), [bodyPart, exercises]);
  const filtered = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    return exercises.filter((exercise) => bodyPart === ALL || exercise.bodyPart === bodyPart)
      .filter((exercise) => equipment === ALL || exercise.equipment === equipment)
      .filter((exercise) => !normalizedQuery || normalizeText([exercise.name, exercise.englishName ?? "", ...exercise.aliases].join(" ")).includes(normalizedQuery))
      .sort((left, right) => left.name.localeCompare(right.name, "ko-KR"));
  }, [bodyPart, equipment, exercises, query]);

  useEffect(() => {
    if (!open) return;
    console.info(`[ProgramManager Hydration] Exercise Picker source=${exercises.length} rendered=${filtered.length}`, {
      sourceCount: exercises.length,
      renderedCount: filtered.length,
      exerciseIds: filtered.map(({ id }) => id),
    });
  }, [exercises, filtered, open]);

  const filterButton = (value: string, selected: string, onClick: () => void) => (
    <Button key={value} aria-pressed={selected === value} variant={selected === value ? "contained" : "outlined"} onClick={onClick} sx={{ minHeight: 48, minWidth: 48 }}>
      {value}
    </Button>
  );

  return (
    <Dialog fullScreen={fullScreen} fullWidth maxWidth="md" open={open} onClose={onClose}>
      <DialogTitle component="div">
        <Stack alignItems="center" direction="row" justifyContent="space-between">
          <Box><Typography variant="h2">운동 추가</Typography><Typography color="text.secondary">Shared Runtime 운동만 선택할 수 있습니다.</Typography></Box>
          <IconButton aria-label="운동 선택 닫기" onClick={onClose} sx={{ minHeight: 48, minWidth: 48 }}><CloseIcon /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Stack spacing={1}><Typography fontWeight={900}>부위 선택</Typography><Stack direction="row" flexWrap="wrap" gap={1}>{[ALL, ...bodyParts].map((value) => filterButton(value, bodyPart, () => { setBodyPart(value); setEquipment(ALL); }))}</Stack></Stack>
          <Stack spacing={1}><Typography fontWeight={900}>기구 선택</Typography><Stack direction="row" flexWrap="wrap" gap={1}>{[ALL, ...equipmentOptions].map((value) => filterButton(value, equipment, () => setEquipment(value)))}</Stack></Stack>
          <TextField fullWidth label="운동명, 영문명, Alias 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
          <Stack spacing={1}>
            {filtered.map((exercise) => (
              <CardActionArea key={exercise.id} aria-label={`${exercise.name} 운동 추가`} onClick={() => onSelect(exercise)} sx={{ border: 1, borderColor: "divider", borderRadius: 2, minHeight: 64, px: 2, py: 1.25 }}>
                <Typography fontWeight={900}>{exercise.name}</Typography>
                <Typography color="text.secondary" variant="body2">{[exercise.bodyPart, exercise.equipment, exercise.englishName].filter(Boolean).join(" · ")}</Typography>
              </CardActionArea>
            ))}
            {filtered.length === 0 ? <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>선택한 조건의 운동이 없습니다.</Typography> : null}
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};
