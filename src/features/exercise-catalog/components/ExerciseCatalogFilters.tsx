import { Grid, MenuItem, TextField } from "@mui/material";
import { SearchField } from "../../../components/common/SearchField";
import { equipmentTypes, exerciseCategories, primaryMuscles } from "../constants/exerciseCatalogOptions";
import type { ExerciseCatalogFilters as Filters } from "../domain/exerciseCatalog.types";

interface ExerciseCatalogFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export const ExerciseCatalogFilters = ({ filters, onChange }: ExerciseCatalogFiltersProps): JSX.Element => (
  <Grid container spacing={2}>
    <Grid item md={3} xs={12}>
      <SearchField label="운동명, 영문명, alias 검색" value={filters.search} onChange={(search) => onChange({ ...filters, search })} />
    </Grid>
    <Grid item md={3} xs={12}>
      <TextField fullWidth label="카테고리" select value={filters.category} onChange={(event) => onChange({ ...filters, category: event.target.value as Filters["category"] })}>
        <MenuItem value="ALL">전체</MenuItem>
        {exerciseCategories.map((category) => <MenuItem key={category.value} value={category.value}>{category.label}</MenuItem>)}
      </TextField>
    </Grid>
    <Grid item md={3} xs={12}>
      <TextField fullWidth label="장비" select value={filters.equipmentType} onChange={(event) => onChange({ ...filters, equipmentType: event.target.value as Filters["equipmentType"] })}>
        <MenuItem value="ALL">전체</MenuItem>
        {equipmentTypes.map((equipment) => <MenuItem key={equipment.value} value={equipment.value}>{equipment.label}</MenuItem>)}
      </TextField>
    </Grid>
    <Grid item md={3} xs={12}>
      <TextField fullWidth label="주요 근육" select value={filters.primaryMuscle} onChange={(event) => onChange({ ...filters, primaryMuscle: event.target.value as Filters["primaryMuscle"] })}>
        <MenuItem value="ALL">전체</MenuItem>
        {primaryMuscles.map((muscle) => <MenuItem key={muscle.value} value={muscle.value}>{muscle.label}</MenuItem>)}
      </TextField>
    </Grid>
  </Grid>
);
