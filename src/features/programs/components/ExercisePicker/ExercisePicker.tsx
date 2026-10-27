import CloseIcon from "@mui/icons-material/Close";
import AccessibilityNewIcon from "@mui/icons-material/AccessibilityNew";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import { Box, Button, CardActionArea, Dialog, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography, useMediaQuery, useTheme } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import type { ExerciseCatalogOption } from "../../../exercise-catalog";
import { normalizeText } from "../../../../utils/normalizeText";

interface ExercisePickerProps {
  open: boolean;
  exercises: ExerciseCatalogOption[];
  loading?: boolean;
  errorMessage?: string;
  disabledExerciseIds?: ReadonlySet<string>;
  onClose: () => void;
  onSelect: (exercise: ExerciseCatalogOption) => void;
  selectionMode?: "single" | "multiple";
  selectionLimit?: number;
  onConfirmSelection?: (exercises: ExerciseCatalogOption[]) => void;
}

const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko-KR"));

export const ExercisePicker = ({ open, exercises, loading = false, errorMessage, disabledExerciseIds, onClose, onSelect, selectionMode = "single", selectionLimit = 8, onConfirmSelection }: ExercisePickerProps): JSX.Element => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [bodyPart, setBodyPart] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(() => new Set());
  const bodyParts = useMemo(() => unique(exercises.map((exercise) => exercise.bodyPart)), [exercises]);
  const equipmentOptions = useMemo(() => unique(exercises
    .filter((exercise) => !bodyPart || exercise.bodyPart === bodyPart)
    .map((exercise) => exercise.equipment)), [bodyPart, exercises]);
  const filtered = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    return exercises.filter((exercise) => !bodyPart || exercise.bodyPart === bodyPart)
      .filter((exercise) => !equipment || exercise.equipment === equipment)
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

  useEffect(() => {
    if (!open) setSelectedExerciseIds(new Set());
  }, [open]);

  const toggleSelection = (exercise: ExerciseCatalogOption): void => {
    if (disabledExerciseIds?.has(exercise.id)) return;
    setSelectedExerciseIds((current) => {
      const next = new Set(current);
      if (next.has(exercise.id)) next.delete(exercise.id);
      else if (next.size < selectionLimit) next.add(exercise.id);
      return next;
    });
  };
  const confirmSelection = (): void => {
    const selected = exercises.filter((exercise) => selectedExerciseIds.has(exercise.id));
    if (selected.length) onConfirmSelection?.(selected);
  };

  const filterButton = (value: string, selected: string | null, onClick: () => void, icon: JSX.Element) => (
    <Button key={value} aria-pressed={selected === value} color={selected === value ? "primary" : "inherit"} onClick={onClick} startIcon={icon} variant={selected === value ? "contained" : "outlined"} sx={{ fontSize: { md: 20, xs: 17 }, fontWeight: 800, justifyContent: "flex-start", minHeight: { md: 70, xs: 60 }, minWidth: { md: 150, xs: 132 }, px: 2 }}>
      {value}
    </Button>
  );

  return (
    <Dialog fullScreen={fullScreen} fullWidth maxWidth="md" open={open} onClose={onClose} PaperProps={{ sx: { display: "flex", flexDirection: "column", height: { md: "min(1280px, 74vh)", xs: "100dvh" }, maxHeight: "none", "@media (orientation: portrait)": { height: "min(1280px, 74vh)" } } }}>
      <DialogTitle component="div">
        <Stack alignItems="center" direction="row" justifyContent="space-between">
          <Box><Typography fontSize={{ md: 46, xs: 34 }} fontWeight={900}>운동 추가</Typography><Typography color="text.secondary" fontSize={{ md: 21, xs: 18 }}>{selectionMode === "multiple" ? "원하는 운동을 여러 개 선택한 뒤 한 번에 추가하세요." : "Shared Runtime 운동만 선택할 수 있습니다."}</Typography></Box>
          <IconButton aria-label="운동 선택 닫기" onClick={onClose} sx={{ minHeight: 48, minWidth: 48 }}><CloseIcon /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flex: "1 1 auto", minHeight: 0, overflow: "hidden", p: { md: 3, xs: 2 } }}>
        <Stack spacing={2.25} sx={{ flex: 1, minHeight: 0 }}>
          <Stack spacing={1.25}><Typography fontSize={{ md: 22, xs: 19 }} fontWeight={900}>운동 부위</Typography><Stack direction="row" flexWrap="wrap" gap={1.25}>{bodyParts.map((value) => filterButton(value, bodyPart, () => { setBodyPart((current) => current === value ? null : value); setEquipment(null); }, <AccessibilityNewIcon />))}</Stack></Stack>
          <Stack spacing={1.25}><Typography fontSize={{ md: 22, xs: 19 }} fontWeight={900}>사용 기구</Typography><Stack direction="row" flexWrap="wrap" gap={1.25}>{equipmentOptions.map((value) => filterButton(value, equipment, () => setEquipment((current) => current === value ? null : value), <FitnessCenterIcon />))}</Stack></Stack>
          <TextField fullWidth label="운동명, 영문명, Alias 검색" value={query} onChange={(event) => setQuery(event.target.value)} sx={{ "& .MuiInputBase-root": { minHeight: { md: 68, xs: 60 } } }} />
          <Stack spacing={1} sx={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", pr: 0.5 }}>
            {loading ? <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>운동 목록을 불러오는 중입니다.</Typography> : null}
            {errorMessage ? <Typography color="error.main" sx={{ py: 3, textAlign: "center" }}>{errorMessage}</Typography> : null}
            {!loading && !errorMessage ? filtered.map((exercise) => {
              const selected = selectedExerciseIds.has(exercise.id);
              const included = disabledExerciseIds?.has(exercise.id) ?? false;
              const selectionFull = selectionMode === "multiple" && !selected && selectedExerciseIds.size >= selectionLimit;
              return <CardActionArea key={exercise.id} aria-label={`${exercise.name}${selected ? " 선택됨" : " 운동 추가"}`} aria-pressed={selectionMode === "multiple" ? selected : undefined} disabled={included || selectionFull} onClick={() => selectionMode === "multiple" ? toggleSelection(exercise) : onSelect(exercise)} sx={{ bgcolor: selected ? "rgba(196, 157, 57, 0.12)" : "background.paper", border: 2, borderColor: selected ? "primary.main" : "divider", borderRadius: 2, minHeight: { md: 94, xs: 82 }, px: 2.25, py: 1.5, "&:hover": { borderColor: "primary.main" } }}>
                <Stack alignItems="center" direction="row" spacing={2}><Box aria-hidden="true" sx={{ alignItems: "center", bgcolor: selected ? "primary.main" : "primary.main", borderRadius: "50%", color: "primary.contrastText", display: "flex", height: 44, justifyContent: "center", width: 44 }}>{selected ? <CheckCircleIcon /> : <AccessibilityNewIcon />}</Box><Box sx={{ flex: 1, minWidth: 0 }}><Typography fontSize={{ md: 22, xs: 19 }} fontWeight={900}>{exercise.name}</Typography><Typography color="text.secondary" fontSize={{ md: 16, xs: 14 }}>{[exercise.bodyPart, exercise.equipment, exercise.englishName].filter(Boolean).join(" · ")}</Typography>{included ? <Typography color="text.secondary" variant="caption">추가됨</Typography> : selected ? <Typography color="primary.main" variant="caption">선택됨</Typography> : null}</Box>{selected ? <CheckCircleIcon color="primary" /> : null}</Stack>
              </CardActionArea>
            }) : null}
            {!loading && !errorMessage && filtered.length === 0 ? <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>선택한 조건의 운동이 없습니다.</Typography> : null}
          </Stack>
          {selectionMode === "multiple" ? <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2} sx={{ borderTop: 1, borderColor: "divider", pt: 2 }}><Typography fontSize={{ md: 22, xs: 18 }} fontWeight={800}>선택 {selectedExerciseIds.size}개</Typography><Button disabled={selectedExerciseIds.size === 0} onClick={confirmSelection} variant="contained" sx={{ fontSize: { md: 27, xs: 21 }, minHeight: { md: 92, xs: 76 }, minWidth: { md: 330, xs: 230 } }}>{selectedExerciseIds.size === 0 ? "운동을 선택하세요" : `선택한 운동 ${selectedExerciseIds.size}개 추가`}</Button></Stack> : null}
        </Stack>
      </DialogContent>
    </Dialog>
  );
};
