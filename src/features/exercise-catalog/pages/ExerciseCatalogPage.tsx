import AddIcon from "@mui/icons-material/Add";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { PageContainer } from "../../../components/layout/PageContainer";
import { toAppId } from "../../../types/brandedIds";
import { normalizeText } from "../../../utils/normalizeText";
import { usePrograms } from "../../programs/hooks/usePrograms";
import { ExerciseCatalogDashboard } from "../components/ExerciseCatalogDashboard";
import { ExerciseCatalogEditorDialog } from "../components/ExerciseCatalogEditorDialog";
import { ExerciseCatalogFilters } from "../components/ExerciseCatalogFilters";
import {
  ExerciseCatalogImportExport,
  type ImportedExerciseCatalogRow,
  type ImportMode,
} from "../components/ExerciseCatalogImportExport";
import { ExerciseCatalogList } from "../components/ExerciseCatalogList";
import { ExerciseCatalogStatistics } from "../components/ExerciseCatalogStatistics";
import { ExerciseResolverTestPanel } from "../components/ExerciseResolverTestPanel";
import { initialExerciseCatalogSeed } from "../constants/initialExerciseCatalogSeed";
import type { ExerciseCatalogFormValues, ExerciseCatalogItem } from "../domain/exerciseCatalog.types";
import { useExerciseCatalog } from "../hooks/useExerciseCatalog";
import { exerciseCatalogRepository } from "../repositories/exerciseCatalogRepository";
import { sanitizeExerciseCatalogForm } from "../services/exerciseCatalogService";

const conditionLabAppId = toAppId(import.meta.env.VITE_CONDITION_LAB_APP_ID ?? "");

const hasAliasCollision = (aliases: string[], items: ExerciseCatalogItem[], currentId?: string): boolean => {
  const normalizedAliases = aliases.map(normalizeText);
  return items.some(
    (item) =>
      item.id !== currentId &&
      item.aliases.some((alias) => normalizedAliases.includes(normalizeText(alias))),
  );
};

export const ExerciseCatalogPage = (): JSX.Element => {
  const { catalogState, filteredItems, items, filters, setFilters } = useExerciseCatalog(conditionLabAppId);
  const { programs } = usePrograms(conditionLabAppId);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ExerciseCatalogItem | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<ExerciseCatalogItem | null>(null);

  const usageCounts = useMemo(
    () =>
      programs.reduce<Record<string, number>>((acc, program) => {
        const usedIds = new Set(program.exercises.map((exercise) => exercise.catalogExerciseId).filter(Boolean));
        usedIds.forEach((id) => {
          if (id) acc[id] = (acc[id] ?? 0) + 1;
        });
        return acc;
      }, {}),
    [programs],
  );

  const seedCatalog = async () => {
    setSeeding(true);
    setMessage(null);
    try {
      const existing = new Set(items.map((item) => normalizeText(item.name)));
      let created = 0;
      for (const seed of initialExerciseCatalogSeed) {
        if (existing.has(normalizeText(seed.name))) continue;
        await exerciseCatalogRepository.createExercise(conditionLabAppId, seed);
        created += 1;
      }
      setMessage(`Seed 완료: ${created}개 생성, 기존 중복 ${initialExerciseCatalogSeed.length - created}개 건너뜀`);
    } catch (caught) {
      const error = caught instanceof Error ? caught.message : "Unknown error";
      setMessage(`Seed 실패: ${error}`);
    } finally {
      setSeeding(false);
    }
  };

  const openCreate = () => {
    setEditingItem(null);
    setEditorOpen(true);
  };

  const openEdit = (item: ExerciseCatalogItem) => {
    setEditingItem(item);
    setEditorOpen(true);
  };

  const saveExercise = async (values: ExerciseCatalogFormValues) => {
    setSaving(true);
    setMessage(null);
    try {
      if (editingItem) {
        await exerciseCatalogRepository.updateExercise(conditionLabAppId, editingItem.id, values);
        setMessage("운동 정보를 수정했습니다.");
      } else {
        await exerciseCatalogRepository.createExercise(conditionLabAppId, values);
        setMessage("새 운동을 등록했습니다.");
      }
      setEditorOpen(false);
    } catch (caught) {
      const error = caught instanceof Error ? caught.message : "Unknown save error";
      setMessage(`저장 실패: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const restoreExercise = async (item: ExerciseCatalogItem) => {
    await exerciseCatalogRepository.restoreExercise(conditionLabAppId, item.id);
    setMessage(`${item.name} Restore 완료`);
  };

  const archiveExercise = async () => {
    if (!archiveTarget) return;
    await exerciseCatalogRepository.archiveExercise(conditionLabAppId, archiveTarget.id);
    setMessage(`${archiveTarget.name} Archive 완료`);
    setArchiveTarget(null);
  };

  const importRows = async (rows: ImportedExerciseCatalogRow[], mode: ImportMode): Promise<string> => {
    let created = 0;
    let overwritten = 0;
    let skipped = 0;
    let idConflicts = 0;
    let nameConflicts = 0;
    let aliasConflicts = 0;
    const byName = new Map(items.map((item) => [normalizeText(item.name), item]));
    const existingIds = new Set(items.map((item) => item.id));

    for (const rawRow of rows) {
      const row = sanitizeExerciseCatalogForm(rawRow);
      const existing = byName.get(normalizeText(row.name));
      if (rawRow.importId && existingIds.has(rawRow.importId)) {
        idConflicts += 1;
      }
      if (hasAliasCollision(row.aliases, items, existing?.id)) {
        aliasConflicts += 1;
        skipped += 1;
        continue;
      }
      if (existing && mode === "SKIP_EXISTING") {
        nameConflicts += 1;
        skipped += 1;
        continue;
      }
      if (existing && mode === "OVERWRITE") {
        await exerciseCatalogRepository.updateExercise(conditionLabAppId, existing.id, row);
        overwritten += 1;
        continue;
      }
      await exerciseCatalogRepository.createExercise(conditionLabAppId, row);
      created += 1;
    }

    return `Import 완료: 생성 ${created}개, 덮어쓰기 ${overwritten}개, 건너뜀 ${skipped}개, ID 충돌 ${idConflicts}개, name 충돌 ${nameConflicts}개, alias 충돌 ${aliasConflicts}개`;
  };

  return (
    <PageContainer>
      <Stack spacing={3}>
        <Stack direction={{ md: "row", xs: "column" }} justifyContent="space-between" spacing={2}>
          <Stack spacing={0.5}>
            <Typography variant="h1">Exercise Catalog</Typography>
            <Typography color="text.secondary">Program Editor와 Resolver가 함께 사용하는 표준 운동 사전을 관리합니다.</Typography>
          </Stack>
          <Stack direction={{ sm: "row", xs: "column" }} spacing={1}>
            <Button disabled={seeding || catalogState.status !== "ready"} variant="outlined" onClick={seedCatalog}>
              {seeding ? "Seed 실행 중..." : `초기 Seed ${initialExerciseCatalogSeed.length}개`}
            </Button>
            <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate}>
              새 운동
            </Button>
          </Stack>
        </Stack>
        {message ? <Alert severity={message.includes("실패") ? "error" : "info"}>{message}</Alert> : null}
        <ExerciseCatalogDashboard items={items} />
        <ExerciseCatalogFilters filters={filters} onChange={setFilters} />
        {catalogState.status === "loading" ? <LoadingState /> : null}
        {catalogState.status === "error" ? <ErrorState message={catalogState.message} /> : null}
        {catalogState.status === "ready" ? (
          <ExerciseCatalogList
            items={filteredItems}
            usageCounts={usageCounts}
            onEdit={openEdit}
            onArchive={setArchiveTarget}
            onRestore={restoreExercise}
          />
        ) : null}
        <ExerciseResolverTestPanel items={items} />
        <ExerciseCatalogStatistics items={items} />
        <ExerciseCatalogImportExport items={items} onImport={importRows} />
      </Stack>

      <ExerciseCatalogEditorDialog
        open={editorOpen}
        item={editingItem}
        existingItems={items}
        saving={saving}
        onClose={() => setEditorOpen(false)}
        onSave={saveExercise}
      />

      <Dialog open={Boolean(archiveTarget)} onClose={() => setArchiveTarget(null)}>
        <DialogTitle>Archive 확인</DialogTitle>
        <DialogContent>
          <Typography>
            이 운동은 Program {archiveTarget ? usageCounts[archiveTarget.id] ?? 0 : 0}개에서 사용 중입니다.
          </Typography>
          <Typography color="text.secondary" mt={1}>
            Archive 후에도 기존 Program Snapshot은 변경하지 않습니다. Restore는 언제든 가능합니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArchiveTarget(null)}>취소</Button>
          <Button color="warning" variant="contained" onClick={archiveExercise}>
            Archive
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
