import { Badge, Card, CardContent, Chip, Grid, Stack, Typography } from "@mui/material";
import { EmptyState } from "../../../components/common/EmptyState";
import { getEquipmentTypeLabel, getExerciseCategoryLabel, getPrimaryMuscleLabel } from "../constants/exerciseCatalogOptions";
import type { ExerciseCatalogItem } from "../domain/exerciseCatalog.types";

interface ExerciseCatalogListProps {
  items: ExerciseCatalogItem[];
  usageCounts: Record<string, number>;
  onEdit?: (item: ExerciseCatalogItem) => void;
  onArchive?: (item: ExerciseCatalogItem) => void;
  onRestore?: (item: ExerciseCatalogItem) => void;
}

export const ExerciseCatalogList = ({ items, usageCounts }: ExerciseCatalogListProps): JSX.Element => {
  if (items.length === 0) return <EmptyState title="운동이 없습니다." description="검색 또는 필터 조건을 변경해 주세요." />;

  return <Stack spacing={1.25}>{items.map((item) => (
    <Card key={item.id}><CardContent><Grid alignItems="center" container spacing={2}>
      <Grid item md={4} xs={12}><Stack spacing={0.5}>
        <Stack alignItems="center" direction="row" flexWrap="wrap" gap={1}>
          <Typography fontWeight={950}>{item.name}</Typography><Chip color="success" label="Shared Runtime" size="small" />
        </Stack>
        <Typography color="text.secondary" variant="body2">{item.englishName || "English Name 없음"}</Typography>
      </Stack></Grid>
      <Grid item md={5} xs={12}><Stack direction="row" flexWrap="wrap" gap={1}>
        <Chip label={item.bodyPart || getExerciseCategoryLabel(item.category)} size="small" />
        <Chip label={getPrimaryMuscleLabel(item.primaryMuscle)} size="small" variant="outlined" />
        <Chip label={item.equipment || getEquipmentTypeLabel(item.equipmentType)} size="small" variant="outlined" />
        <Badge badgeContent={item.aliases.length} color={item.aliases.length ? "primary" : "warning"}><Chip label="Alias" size="small" variant="outlined" /></Badge>
      </Stack></Grid>
      <Grid item md={3} xs={12}><Typography color="text.secondary" variant="body2">사용 Program {usageCounts[item.id] ?? 0}개</Typography></Grid>
    </Grid></CardContent></Card>
  ))}</Stack>;
};
