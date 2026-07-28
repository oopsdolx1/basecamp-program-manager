import { Card, CardContent, Grid, Stack, Typography } from "@mui/material";
import type { ExerciseCatalogItem } from "../domain/exerciseCatalog.types";

interface ExerciseCatalogDashboardProps {
  items: ExerciseCatalogItem[];
}

const emptyValue = (value: string | null | undefined): boolean => !value || !value.trim();

export const ExerciseCatalogDashboard = ({ items }: ExerciseCatalogDashboardProps): JSX.Element => {
  const stats = [
    { label: "전체 운동", value: items.length },
    { label: "활성", value: items.filter((item) => !item.isArchived).length },
    { label: "Archive", value: items.filter((item) => item.isArchived).length },
    { label: "Alias 없음", value: items.filter((item) => item.aliases.length === 0).length },
    { label: "English Name 없음", value: items.filter((item) => emptyValue(item.englishName)).length },
    { label: "Memo 없음", value: items.filter((item) => emptyValue(item.memo)).length },
    { label: "Category 누락", value: items.filter((item) => item.category === "other").length },
    { label: "Primary Muscle 누락", value: items.filter((item) => item.primaryMuscle === "other").length },
  ];

  return (
    <Grid container spacing={1.5}>
      {stats.map((stat) => (
        <Grid item key={stat.label} lg={1.5} md={3} sm={4} xs={6}>
          <Card sx={{ bgcolor: "rgba(2, 6, 23, 0.68)", height: "100%" }}>
            <CardContent>
              <Stack spacing={0.5}>
                <Typography color="text.secondary" fontSize={12} fontWeight={900}>
                  {stat.label}
                </Typography>
                <Typography color="primary.main" fontSize={30} fontWeight={950}>
                  {stat.value}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};
