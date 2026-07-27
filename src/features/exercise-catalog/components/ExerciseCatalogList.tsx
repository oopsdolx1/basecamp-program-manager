import { Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { EmptyState } from "../../../components/common/EmptyState";
import { getEquipmentTypeLabel, getExerciseCategoryLabel, getPrimaryMuscleLabel } from "../constants/exerciseCatalogOptions";
import type { ExerciseCatalogItem } from "../domain/exerciseCatalog.types";

interface ExerciseCatalogListProps {
  items: ExerciseCatalogItem[];
}

export const ExerciseCatalogList = ({ items }: ExerciseCatalogListProps): JSX.Element => {
  if (items.length === 0) {
    return <EmptyState title="운동 카탈로그가 없습니다." description="검색 조건을 바꾸거나 seed를 실행해 주세요." />;
  }

  return (
    <Stack spacing={1.25}>
      {items.map((item) => (
        <Card key={item.id}>
          <CardContent>
            <Stack spacing={1}>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                <Chip label={getExerciseCategoryLabel(item.category)} size="small" />
                <Chip label={getPrimaryMuscleLabel(item.primaryMuscle)} size="small" variant="outlined" />
                <Chip label={getEquipmentTypeLabel(item.equipmentType)} size="small" variant="outlined" />
                {item.isFavorite ? <Chip color="primary" label="즐겨찾기" size="small" /> : null}
                {item.isArchived ? <Chip color="warning" label="Archive" size="small" /> : null}
              </Stack>
              <Typography fontWeight={800}>{item.name}</Typography>
              {item.englishName ? <Typography color="text.secondary">{item.englishName}</Typography> : null}
              <Typography color="text.secondary" variant="body2">
                aliases: {item.aliases.join(", ")}
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
};
