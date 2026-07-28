import { Box, Card, CardContent, Grid, Stack, Typography } from "@mui/material";
import {
  getEquipmentTypeLabel,
  getExerciseCategoryLabel,
} from "../constants/exerciseCatalogOptions";
import type { EquipmentType, ExerciseCatalogItem, ExerciseCategory } from "../domain/exerciseCatalog.types";

interface ExerciseCatalogStatisticsProps {
  items: ExerciseCatalogItem[];
}

const countBy = <TKey extends string>(items: ExerciseCatalogItem[], getKey: (item: ExerciseCatalogItem) => TKey) =>
  items.reduce<Record<TKey, number>>(
    (acc, item) => ({
      ...acc,
      [getKey(item)]: (acc[getKey(item)] ?? 0) + 1,
    }),
    {} as Record<TKey, number>,
  );

const percent = (value: number, total: number): number => (total === 0 ? 0 : Math.round((value / total) * 100));

const BarList = ({ rows }: { rows: Array<{ label: string; value: number; total: number }> }): JSX.Element => (
  <Stack spacing={1.25}>
    {rows.map((row) => {
      const ratio = percent(row.value, row.total);
      return (
        <Stack key={row.label} spacing={0.5}>
          <Stack direction="row" justifyContent="space-between">
            <Typography fontWeight={850}>{row.label}</Typography>
            <Typography color="text.secondary" variant="body2">
              {row.value}개 · {ratio}%
            </Typography>
          </Stack>
          <Box sx={{ bgcolor: "rgba(148, 163, 184, 0.16)", borderRadius: 999, height: 8, overflow: "hidden" }}>
            <Box sx={{ bgcolor: "primary.main", height: 1, width: `${ratio}%` }} />
          </Box>
        </Stack>
      );
    })}
  </Stack>
);

export const ExerciseCatalogStatistics = ({ items }: ExerciseCatalogStatisticsProps): JSX.Element => {
  const total = items.length;
  const activeItems = items.filter((item) => !item.isArchived);
  const categoryCounts = countBy(activeItems, (item) => item.category);
  const equipmentCounts = countBy(activeItems, (item) => item.equipmentType);
  const aliasRatio = percent(items.filter((item) => item.aliases.length > 0).length, total);
  const englishRatio = percent(items.filter((item) => item.englishName).length, total);
  const archiveRatio = percent(items.filter((item) => item.isArchived).length, total);

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h2">Statistics</Typography>
          <Grid container spacing={2}>
            <Grid item md={6} xs={12}>
              <Typography color="text.secondary" mb={1} fontWeight={900}>
                Category 분포
              </Typography>
              <BarList
                rows={Object.entries(categoryCounts).map(([category, value]) => ({
                  label: getExerciseCategoryLabel(category as ExerciseCategory),
                  value,
                  total: activeItems.length,
                }))}
              />
            </Grid>
            <Grid item md={6} xs={12}>
              <Typography color="text.secondary" mb={1} fontWeight={900}>
                Equipment 분포
              </Typography>
              <BarList
                rows={Object.entries(equipmentCounts).map(([equipment, value]) => ({
                  label: getEquipmentTypeLabel(equipment as EquipmentType),
                  value,
                  total: activeItems.length,
                }))}
              />
            </Grid>
          </Grid>
          <Grid container spacing={1.5}>
            {[
              { label: "Alias 보유율", value: aliasRatio },
              { label: "English Name 보유율", value: englishRatio },
              { label: "Archive 비율", value: archiveRatio },
            ].map((item) => (
              <Grid item key={item.label} md={4} xs={12}>
                <Box sx={{ border: 1, borderColor: "divider", borderRadius: 3, p: 2 }}>
                  <Typography color="text.secondary" fontWeight={900}>
                    {item.label}
                  </Typography>
                  <Typography color="primary.main" fontSize={28} fontWeight={950}>
                    {item.value}%
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Stack>
      </CardContent>
    </Card>
  );
};
