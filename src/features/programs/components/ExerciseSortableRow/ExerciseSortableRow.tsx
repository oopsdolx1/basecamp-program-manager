import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import SearchIcon from "@mui/icons-material/Search";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Autocomplete, Box, Collapse, Stack, Typography } from "@mui/material";
import { Button, Card, Chip, EmptyState, IconButton, Input, colors, motion, shadows, spacing } from "../../../../design-system";
import type { ExerciseCatalogOption } from "../../../exercise-catalog";
import type { ResolveResult } from "../../../exercise-resolver";
import type { ProgramFormExercise } from "../../types/program.types";
import { NumericStepper } from "../NumericStepper/NumericStepper";

interface ExerciseSortableRowProps {
  exercise: ProgramFormExercise;
  catalogOptions: ExerciseCatalogOption[];
  resolveResult?: ResolveResult | null;
  memberWhy?: string;
  canDelete: boolean;
  collapsed?: boolean;
  selected?: boolean;
  index: number;
  total: number;
  onChange: (patch: Partial<ProgramFormExercise>) => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onOpenPicker: () => void;
  onSelect?: () => void;
  onToggleCollapse?: () => void;
}

const normalizeOptionSearch = (value: string): string => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
const optionSearchText = (option: ExerciseCatalogOption): string => normalizeOptionSearch([option.name, option.displayName, option.englishName ?? "", ...option.aliases].join(" "));

export const ExerciseSortableRow = ({
  exercise,
  catalogOptions,
  resolveResult,
  memberWhy = "",
  canDelete,
  collapsed = false,
  selected: isSelected = false,
  index,
  total,
  onChange,
  onDelete,
  onDuplicate = () => undefined,
  onMoveUp,
  onMoveDown,
  onOpenPicker,
  onSelect = () => undefined,
  onToggleCollapse = () => undefined,
}: ExerciseSortableRowProps): JSX.Element => {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({ id: exercise.id });
  const selectedExercise = catalogOptions.find((option) => option.id === exercise.catalogExerciseId) ?? null;
  const why = memberWhy.trim();
  const helperText = !selectedExercise && exercise.name
    ? `현재 저장값: ${exercise.name} (Shared Runtime에 없음)`
    : resolveResult?.status === "ambiguous" ? `후보 ${resolveResult.candidateExercises.length}개` : undefined;

  return (
    <Card
      ref={setNodeRef}
      data-exercise-id={exercise.id}
      onClick={onSelect}
      sx={{
        borderColor: isSelected ? colors.primary.gold : colors.neutral.gray700,
        boxShadow: isDragging ? shadows.xl : isSelected ? shadows.md : shadows.sm,
        opacity: isDragging ? 0.92 : 1,
        p: `${spacing[4]}px`,
        position: "relative",
        transform: CSS.Transform.toString(transform),
        transition: transition ?? motion.transition,
        zIndex: isDragging ? 10 : 1,
        "&:hover": { borderColor: colors.primary.goldDark, boxShadow: shadows.md },
        "&:focus-within": { borderColor: colors.primary.gold },
      }}
    >
      <Stack spacing={`${spacing[3]}px`}>
        <Stack alignItems="flex-start" direction="row" justifyContent="space-between" spacing={`${spacing[2]}px`}>
          <Stack alignItems="center" direction="row" spacing={`${spacing[2]}px`} sx={{ minWidth: 0 }}>
            <IconButton
              aria-label={`${exercise.order}번 운동 드래그`}
              title="드래그하여 순서 변경"
              {...attributes}
              {...listeners}
              sx={{ cursor: isDragging ? "grabbing" : "grab", flexShrink: 0 }}
            >
              <DragIndicatorIcon />
            </IconButton>
            <Box sx={{ minWidth: 0 }}>
              <Stack alignItems="center" direction="row" flexWrap="wrap" gap={`${spacing[2]}px`}>
                <Typography color={colors.primary.gold} fontWeight={800}>{String(exercise.order).padStart(2, "0")}</Typography>
                <Typography fontWeight={800} noWrap>{selectedExercise?.displayName ?? exercise.displayName ?? (exercise.name || "운동을 선택하세요")}</Typography>
              </Stack>
              {selectedExercise?.englishName ? <Typography color={colors.neutral.gray400} variant="body2">{selectedExercise.englishName}</Typography> : null}
            </Box>
          </Stack>
          <Stack direction="row" spacing={`${spacing[1]}px`}>
            <IconButton aria-label={`${exercise.order}번 운동 위로 이동`} disabled={index === 0} onClick={(event) => { event.stopPropagation(); onMoveUp(); }}><KeyboardArrowUpIcon /></IconButton>
            <IconButton aria-label={`${exercise.order}번 운동 아래로 이동`} disabled={index === total - 1} onClick={(event) => { event.stopPropagation(); onMoveDown(); }}><KeyboardArrowDownIcon /></IconButton>
            <IconButton aria-label={`${exercise.order}번 운동 ${collapsed ? "펼치기" : "접기"}`} onClick={(event) => { event.stopPropagation(); onToggleCollapse(); }}>{collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}</IconButton>
          </Stack>
        </Stack>

        <Stack direction="row" flexWrap="wrap" gap={`${spacing[2]}px`}>
          {selectedExercise?.bodyPart ? <Chip label={selectedExercise.bodyPart} selected /> : null}
          {selectedExercise?.equipment ? <Chip label={selectedExercise.equipment} /> : null}
          {selectedExercise?.categoryLabel ? <Chip label={selectedExercise.categoryLabel} /> : null}
        </Stack>

        <Collapse in={!collapsed} unmountOnExit>
          <Stack spacing={`${spacing[4]}px`}>
            <Box sx={{ bgcolor: colors.neutral.gray800, borderLeft: `3px solid ${colors.primary.goldDeep}`, p: `${spacing[3]}px` }}>
              <Typography color={colors.neutral.gray400} fontWeight={700} variant="caption">WHY</Typography>
              {why ? <Typography sx={{ mt: `${spacing[1]}px` }}>{why}</Typography> : <EmptyState title="등록된 WHY가 없습니다." description="Shared Knowledge에 WHY가 추가되면 자동으로 표시됩니다." />}
            </Box>

            <Button fullWidth startIcon={<SearchIcon />} variant="secondary" onClick={(event) => { event.stopPropagation(); onOpenPicker(); }} sx={{ justifyContent: "flex-start" }}>
              {exercise.name || "Shared Runtime에서 운동 선택"}
            </Button>

            <Autocomplete
              options={catalogOptions}
              value={selectedExercise}
              filterOptions={(options, state) => {
                const query = normalizeOptionSearch(state.inputValue);
                return query ? options.filter((option) => optionSearchText(option).includes(query)) : options;
              }}
              getOptionLabel={(option) => option.displayName}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              onChange={(_, value) => value && onChange({ name: value.name, displayName: value.displayName, catalogExerciseId: value.id })}
              renderOption={(props, option) => <Box component="li" {...props} key={option.id} sx={{ minHeight: 56 }}><Box><Typography fontWeight={800}>{option.displayName}</Typography><Typography color="text.secondary" variant="body2">{[option.englishName, option.bodyPart, option.equipment].filter(Boolean).join(" · ")}</Typography></Box></Box>}
              renderInput={(params) => <Input {...params} helperText={helperText} label="운동 교체" />}
            />

            <Box sx={{ display: "grid", gap: `${spacing[3]}px`, gridTemplateColumns: { md: "220px minmax(0, 1fr)", xs: "1fr" } }}>
              <NumericStepper label="세트" value={exercise.sets} onChange={(sets) => onChange({ sets })} />
              <Input fullWidth label="수행 메모 (횟수 · 휴식 · 코칭)" value={exercise.memo} onChange={(event) => onChange({ memo: event.target.value })} />
            </Box>

            <Stack direction="row" justifyContent="flex-end" spacing={`${spacing[2]}px`}>
              <Button variant="tertiary" startIcon={<ContentCopyIcon />} onClick={(event) => { event.stopPropagation(); onDuplicate(); }}>복사</Button>
              <Button variant="tertiary" disabled={!canDelete} startIcon={<DeleteIcon />} onClick={(event) => { event.stopPropagation(); onDelete(); }} sx={{ color: colors.semantic.error }}>삭제</Button>
            </Stack>
          </Stack>
        </Collapse>
      </Stack>
    </Card>
  );
};
