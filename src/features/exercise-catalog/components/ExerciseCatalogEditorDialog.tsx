import CloseIcon from "@mui/icons-material/Close";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { equipmentTypes, exerciseCategories, primaryMuscles } from "../constants/exerciseCatalogOptions";
import type { ExerciseCatalogFormValues, ExerciseCatalogItem } from "../domain/exerciseCatalog.types";
import {
  normalizeAlias,
  sanitizeExerciseCatalogForm,
  validateExerciseCatalogForm,
} from "../services/exerciseCatalogService";

interface ExerciseCatalogEditorDialogProps {
  open: boolean;
  item: ExerciseCatalogItem | null;
  existingItems: ExerciseCatalogItem[];
  saving: boolean;
  onClose: () => void;
  onSave: (values: ExerciseCatalogFormValues) => Promise<void>;
}

const blankValues: ExerciseCatalogFormValues = {
  name: "",
  englishName: "",
  aliases: [],
  category: "other",
  primaryMuscle: "other",
  secondaryMuscles: [],
  equipmentType: "other",
  movementPattern: null,
  difficulty: null,
  memo: "",
  isFavorite: false,
};

const toFormValues = (item: ExerciseCatalogItem | null): ExerciseCatalogFormValues =>
  item
    ? {
        name: item.name,
        englishName: item.englishName ?? "",
        aliases: item.aliases,
        category: item.category,
        primaryMuscle: item.primaryMuscle,
        secondaryMuscles: item.secondaryMuscles,
        equipmentType: item.equipmentType,
        movementPattern: item.movementPattern,
        difficulty: item.difficulty,
        memo: item.memo,
        isFavorite: item.isFavorite,
      }
    : blankValues;

export const ExerciseCatalogEditorDialog = ({
  open,
  item,
  existingItems,
  saving,
  onClose,
  onSave,
}: ExerciseCatalogEditorDialogProps): JSX.Element => {
  const [values, setValues] = useState<ExerciseCatalogFormValues>(toFormValues(item));
  const [aliasInput, setAliasInput] = useState("");

  useEffect(() => {
    if (open) {
      setValues(toFormValues(item));
      setAliasInput("");
    }
  }, [item, open]);

  const validation = useMemo(
    () => validateExerciseCatalogForm(values, existingItems, item?.id),
    [existingItems, item?.id, values],
  );

  const update = <TKey extends keyof ExerciseCatalogFormValues>(key: TKey, value: ExerciseCatalogFormValues[TKey]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const addAlias = () => {
    const alias = normalizeAlias(aliasInput);
    if (!alias) return;
    setValues((current) => {
      const exists = current.aliases.some((itemAlias) => itemAlias.toLocaleLowerCase("ko-KR") === alias.toLocaleLowerCase("ko-KR"));
      return exists ? current : { ...current, aliases: [...current.aliases, alias] };
    });
    setAliasInput("");
  };

  const removeAlias = (alias: string) =>
    setValues((current) => ({ ...current, aliases: current.aliases.filter((itemAlias) => itemAlias !== alias) }));

  const submit = async () => {
    if (!validation.valid) return;
    await onSave(sanitizeExerciseCatalogForm(values));
  };

  return (
    <Dialog fullWidth maxWidth="md" open={open} onClose={onClose}>
      <DialogTitle>
        <Stack alignItems="center" direction="row" justifyContent="space-between">
          <Typography fontWeight={950}>{item ? "운동 수정" : "새 운동 등록"}</Typography>
          <IconButton aria-label="편집 창 닫기" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {validation.errors.length ? (
            <Alert severity="error">
              {validation.errors.map((error) => (
                <Typography key={error} variant="body2">
                  {error}
                </Typography>
              ))}
            </Alert>
          ) : null}
          {validation.warnings.length ? (
            <Alert severity="warning">
              {validation.warnings.map((warning) => (
                <Typography key={warning} variant="body2">
                  {warning}
                </Typography>
              ))}
            </Alert>
          ) : null}
          <Grid container spacing={2}>
            <Grid item md={6} xs={12}>
              <TextField fullWidth label="한글명" value={values.name} onChange={(event) => update("name", event.target.value)} />
            </Grid>
            <Grid item md={6} xs={12}>
              <TextField fullWidth disabled label="Display Name" value={values.name || "한글명 입력 시 자동 표시"} />
            </Grid>
            <Grid item md={6} xs={12}>
              <TextField
                fullWidth
                label="영문명"
                value={values.englishName}
                onChange={(event) => update("englishName", event.target.value)}
              />
            </Grid>
            <Grid item md={6} xs={12}>
              <FormControlLabel
                control={<Switch checked={!item?.isArchived} disabled />}
                label={item?.isArchived ? "Archived" : "Active"}
              />
            </Grid>
            <Grid item md={4} xs={12}>
              <TextField
                fullWidth
                label="Category"
                select
                value={values.category}
                onChange={(event) => update("category", event.target.value as ExerciseCatalogFormValues["category"])}
              >
                {exerciseCategories.map((category) => (
                  <MenuItem key={category.value} value={category.value}>
                    {category.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item md={4} xs={12}>
              <TextField
                fullWidth
                label="Primary Muscle"
                select
                value={values.primaryMuscle}
                onChange={(event) => update("primaryMuscle", event.target.value as ExerciseCatalogFormValues["primaryMuscle"])}
              >
                {primaryMuscles.map((muscle) => (
                  <MenuItem key={muscle.value} value={muscle.value}>
                    {muscle.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item md={4} xs={12}>
              <TextField
                fullWidth
                label="Equipment"
                select
                value={values.equipmentType}
                onChange={(event) => update("equipmentType", event.target.value as ExerciseCatalogFormValues["equipmentType"])}
              >
                {equipmentTypes.map((equipment) => (
                  <MenuItem key={equipment.value} value={equipment.value}>
                    {equipment.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Memo" minRows={3} multiline value={values.memo} onChange={(event) => update("memo", event.target.value)} />
            </Grid>
          </Grid>
          <Stack spacing={1}>
            <Typography fontWeight={950}>Alias</Typography>
            <Stack direction={{ sm: "row", xs: "column" }} spacing={1}>
              <TextField
                fullWidth
                label="Alias 입력 후 Enter"
                value={aliasInput}
                onChange={(event) => setAliasInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addAlias();
                  }
                }}
              />
              <Button variant="outlined" onClick={addAlias}>
                추가
              </Button>
            </Stack>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {values.aliases.map((alias) => (
                <Chip key={alias} label={alias} onDelete={() => removeAlias(alias)} />
              ))}
            </Box>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button disabled={!validation.valid || saving} variant="contained" onClick={submit}>
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
};
