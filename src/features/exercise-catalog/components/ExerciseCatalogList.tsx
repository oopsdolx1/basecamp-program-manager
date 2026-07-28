import { Badge, Button, Card, CardContent, Chip, Grid, Stack, Typography } from "@mui/material";
import { EmptyState } from "../../../components/common/EmptyState";
import { getEquipmentTypeLabel, getExerciseCategoryLabel, getPrimaryMuscleLabel } from "../constants/exerciseCatalogOptions";
import type { ExerciseCatalogItem } from "../domain/exerciseCatalog.types";

interface ExerciseCatalogListProps {
  items: ExerciseCatalogItem[];
  usageCounts: Record<string, number>;
  onEdit: (item: ExerciseCatalogItem) => void;
  onArchive: (item: ExerciseCatalogItem) => void;
  onRestore: (item: ExerciseCatalogItem) => void;
}

export const ExerciseCatalogList = ({
  items,
  usageCounts,
  onEdit,
  onArchive,
  onRestore,
}: ExerciseCatalogListProps): JSX.Element => {
  if (items.length === 0) {
    return <EmptyState title="운동 카탈로그가 없습니다." description="검색 조건을 바꾸거나 새 운동을 등록해 주세요." />;
  }

  return (
    <Stack spacing={1.25}>
      {items.map((item) => (
        <Card key={item.id}>
          <CardContent>
            <Grid alignItems="center" container spacing={2}>
              <Grid item md={4} xs={12}>
                <Stack spacing={0.5}>
                  <Stack alignItems="center" direction="row" flexWrap="wrap" gap={1}>
                    <Typography fontWeight={950}>{item.name}</Typography>
                    {item.isArchived ? <Chip color="warning" label="Archived" size="small" /> : <Chip color="success" label="Active" size="small" />}
                  </Stack>
                  <Typography color="text.secondary" variant="body2">
                    {item.englishName || "English Name 없음"}
                  </Typography>
                </Stack>
              </Grid>
              <Grid item md={4} xs={12}>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  <Chip label={getExerciseCategoryLabel(item.category)} size="small" />
                  <Chip label={getPrimaryMuscleLabel(item.primaryMuscle)} size="small" variant="outlined" />
                  <Chip label={getEquipmentTypeLabel(item.equipmentType)} size="small" variant="outlined" />
                  <Badge badgeContent={item.aliases.length} color={item.aliases.length ? "primary" : "warning"}>
                    <Chip label="Alias" size="small" variant="outlined" />
                  </Badge>
                </Stack>
              </Grid>
              <Grid item md={2} xs={12}>
                <Typography color="text.secondary" variant="body2">
                  사용 Program {usageCounts[item.id] ?? 0}개
                </Typography>
              </Grid>
              <Grid item md={2} xs={12}>
                <Stack direction="row" justifyContent={{ md: "flex-end", xs: "flex-start" }} spacing={1}>
                  <Button aria-label={`${item.name} 수정`} size="small" variant="outlined" onClick={() => onEdit(item)}>
                    수정
                  </Button>
                  {item.isArchived ? (
                    <Button aria-label={`${item.name} Restore`} size="small" onClick={() => onRestore(item)}>
                      Restore
                    </Button>
                  ) : (
                    <Button aria-label={`${item.name} Archive`} color="warning" size="small" onClick={() => onArchive(item)}>
                      Archive
                    </Button>
                  )}
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
};
