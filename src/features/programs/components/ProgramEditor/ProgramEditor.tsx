import AddIcon from "@mui/icons-material/Add";
import ArchiveIcon from "@mui/icons-material/Archive";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import SaveIcon from "@mui/icons-material/Save";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  Alert,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import type { AppId } from "../../../../types/brandedIds";
import { useExerciseCatalog } from "../../../exercise-catalog";
import { useExerciseResolver } from "../../../exercise-resolver";
import { programCategories, programDifficulties } from "../../config/programOptions";
import { useProgramForm } from "../../hooks/useProgramForm";
import type { Program, ProgramFormValues } from "../../types/program.types";
import { PROGRAM_EXERCISE_LIMIT } from "../../types/program.types";
import { ExerciseSortableRow } from "../ExerciseSortableRow/ExerciseSortableRow";

interface ProgramEditorProps {
  initialValues?: ProgramFormValues;
  appId: AppId;
  program?: Program;
  saving: boolean;
  onSave: (values: ProgramFormValues) => void;
  onCancel: () => void;
  onDuplicate?: () => void;
  onArchive?: () => void;
}

export const ProgramEditor = ({
  initialValues,
  appId,
  program,
  saving,
  onSave,
  onCancel,
  onDuplicate,
  onArchive,
}: ProgramEditorProps): JSX.Element => {
  const form = useProgramForm(initialValues);
  const { catalogState, items: catalogItems, options: catalogOptions } = useExerciseCatalog(appId);
  const resolver = useExerciseResolver(catalogItems);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const canAddExercise = form.values.exercises.length < PROGRAM_EXERCISE_LIMIT;

  const handleDragEnd = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) {
      return;
    }

    form.reorder(String(event.active.id), String(event.over.id));
  };

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h1">{program ? "프로그램 수정" : "새 프로그램"}</Typography>
        <Typography color="text.secondary">kg, 횟수, 수축, 휴식시간은 저장하지 않습니다.</Typography>
      </Stack>
      {catalogState.status === "loading" ? (
        <Alert severity="info" variant="outlined">
          운동 카탈로그를 불러오는 중입니다. 직접 입력은 바로 사용할 수 있습니다.
          <LinearProgress sx={{ mt: 1.5 }} />
        </Alert>
      ) : null}
      {catalogState.status === "error" ? (
        <Alert severity="warning">
          운동 카탈로그를 불러오지 못해 직접 입력 모드로 동작합니다. {catalogState.message}
        </Alert>
      ) : null}
      {catalogState.status === "ready" && catalogOptions.length === 0 ? (
        <Alert severity="info" variant="outlined">
          등록된 운동 카탈로그가 없습니다. 직접 입력으로 프로그램을 작성할 수 있습니다.
        </Alert>
      ) : null}
      {!form.validation.valid ? <Alert severity="info">{form.validation.errors[0]}</Alert> : null}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h2">Program Meta</Typography>
            <TextField
              fullWidth
              label="제목"
              value={form.values.title}
              onChange={(event) => form.update("title", event.target.value)}
            />
            <Stack direction={{ md: "row", xs: "column" }} spacing={2}>
              <TextField
                fullWidth
                label="카테고리"
                select
                value={form.values.category}
                onChange={(event) => form.update("category", event.target.value as ProgramFormValues["category"])}
              >
                {programCategories.map((category) => (
                  <MenuItem key={category.value} value={category.value}>
                    {category.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                fullWidth
                label="난이도"
                select
                value={form.values.difficulty}
                onChange={(event) => form.update("difficulty", event.target.value as ProgramFormValues["difficulty"])}
              >
                {programDifficulties.map((difficulty) => (
                  <MenuItem key={difficulty.value} value={difficulty.value}>
                    {difficulty.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <TextField
              fullWidth
              label="메모"
              multiline
              minRows={3}
              value={form.values.memo}
              onChange={(event) => form.update("memo", event.target.value)}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.values.favorite}
                  onChange={(event) => form.update("favorite", event.target.checked)}
                />
              }
              label="즐겨찾기"
            />
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack alignItems="center" direction="row" justifyContent="space-between">
              <Stack spacing={0.25}>
                <Typography variant="h2">Exercise List</Typography>
                <Typography color="text.secondary" variant="body2">
                  카탈로그 운동을 선택하거나 직접 입력할 수 있습니다.
                </Typography>
              </Stack>
              <Button disabled={!canAddExercise} startIcon={<AddIcon />} onClick={form.addExercise}>
                운동 추가
              </Button>
            </Stack>
            <DndContext collisionDetection={closestCenter} sensors={sensors} onDragEnd={handleDragEnd}>
              <SortableContext
                items={form.values.exercises.map((exercise) => exercise.id)}
                strategy={verticalListSortingStrategy}
              >
                <Stack spacing={1.5}>
                  {form.values.exercises.map((exercise) => (
                    <ExerciseSortableRow
                      key={exercise.id}
                      exercise={exercise}
                      catalogOptions={catalogOptions}
                      resolveResult={exercise.name ? resolver.resolve(exercise.name) : null}
                      canDelete={form.values.exercises.length > 1}
                      onChange={(patch) => form.updateExercise(exercise.id, patch)}
                      onDelete={() => form.removeExercise(exercise.id)}
                    />
                  ))}
                </Stack>
              </SortableContext>
            </DndContext>
          </Stack>
        </CardContent>
      </Card>
      <Stack direction="row" justifyContent="flex-end" spacing={1}>
        <Button onClick={onCancel}>취소</Button>
        {onDuplicate ? (
          <Button startIcon={<ContentCopyIcon />} onClick={onDuplicate}>
            복사
          </Button>
        ) : null}
        {onArchive ? (
          <Button startIcon={<ArchiveIcon />} onClick={onArchive}>
            Archive
          </Button>
        ) : null}
        <Button
          disabled={!form.validation.valid || saving}
          startIcon={<SaveIcon />}
          variant="contained"
          onClick={() => onSave(form.sanitizedValues)}
        >
          저장
        </Button>
      </Stack>
    </Stack>
  );
};
