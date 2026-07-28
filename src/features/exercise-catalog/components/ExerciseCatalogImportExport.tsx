import UploadFileIcon from "@mui/icons-material/UploadFile";
import { Alert, Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from "@mui/material";
import type { ChangeEvent } from "react";
import { useRef, useState } from "react";
import type { ExerciseCatalogFormValues, ExerciseCatalogItem } from "../domain/exerciseCatalog.types";
import { normalizeAlias, sanitizeExerciseCatalogForm } from "../services/exerciseCatalogService";

type ImportMode = "SKIP_EXISTING" | "OVERWRITE";
export type ImportedExerciseCatalogRow = ExerciseCatalogFormValues & { importId?: string };

interface ExerciseCatalogImportExportProps {
  items: ExerciseCatalogItem[];
  onImport: (rows: ImportedExerciseCatalogRow[], mode: ImportMode) => Promise<string>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const text = (value: unknown): string => (typeof value === "string" ? value : "");

const aliases = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((alias) => normalizeAlias(String(alias))).filter(Boolean) : [];

const parseImportRows = (raw: unknown): ImportedExerciseCatalogRow[] => {
  const rows = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray(raw.items) ? raw.items : [];
  return rows.filter(isRecord).map((row) => ({
    ...sanitizeExerciseCatalogForm({
      name: text(row.name),
      englishName: text(row.englishName),
      aliases: aliases(row.aliases),
      category: text(row.category) as ExerciseCatalogFormValues["category"],
      primaryMuscle: text(row.primaryMuscle) as ExerciseCatalogFormValues["primaryMuscle"],
      secondaryMuscles: [],
      equipmentType: text(row.equipmentType) as ExerciseCatalogFormValues["equipmentType"],
      movementPattern: null,
      difficulty: null,
      memo: text(row.memo),
      isFavorite: row.isFavorite === true,
    }),
    importId: text(row.id) || undefined,
  }));
};

export const ExerciseCatalogImportExport = ({ items, onImport }: ExerciseCatalogImportExportProps): JSX.Element => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<ImportMode>("SKIP_EXISTING");
  const [message, setMessage] = useState<string | null>(null);

  const exportJson = () => {
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), items }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `exercise-catalog-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const rows = parseImportRows(parsed);
      const report = await onImport(rows, mode);
      setMessage(report);
    } catch (caught) {
      const error = caught instanceof Error ? caught.message : "Unknown import error";
      setMessage(`Import 실패: ${error}`);
    } finally {
      event.target.value = "";
    }
  };

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h2">Import / Export</Typography>
          {message ? <Alert severity={message.includes("실패") ? "error" : "info"}>{message}</Alert> : null}
          <Stack direction={{ sm: "row", xs: "column" }} spacing={1}>
            <Button variant="outlined" onClick={exportJson}>
              JSON Export
            </Button>
            <TextField
              label="Import 옵션"
              select
              value={mode}
              onChange={(event) => setMode(event.target.value as ImportMode)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="SKIP_EXISTING">Skip Existing</MenuItem>
              <MenuItem value="OVERWRITE">Overwrite</MenuItem>
            </TextField>
            <Button startIcon={<UploadFileIcon />} variant="contained" onClick={() => inputRef.current?.click()}>
              JSON Import
            </Button>
            <input ref={inputRef} hidden accept="application/json" type="file" onChange={importJson} />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

export type { ImportMode };
