import { Grid, MenuItem, TextField } from "@mui/material";
import { SearchField } from "../../../components/common/SearchField";
import { equipmentTypes, exerciseCategories, primaryMuscles } from "../constants/exerciseCatalogOptions";
import type { ExerciseCatalogFilters as Filters } from "../domain/exerciseCatalog.types";

interface ExerciseCatalogFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const categoryFilterOptions = exerciseCategories.filter((category) =>
  ["full_body", "chest", "back", "lower_body", "shoulder", "other", "recovery"].includes(category.value),
);

export const ExerciseCatalogFilters = ({ filters, onChange }: ExerciseCatalogFiltersProps): JSX.Element => (
  <Grid container spacing={2}>
    <Grid item lg={4} md={6} xs={12}>
      <SearchField
        label="운동명, Display Name, 영문명, Alias 검색"
        value={filters.search}
        onChange={(search) => onChange({ ...filters, search })}
      />
    </Grid>
    <Grid item lg={2} md={3} xs={12}>
      <TextField
        fullWidth
        label="카테고리"
        select
        value={filters.category}
        onChange={(event) => onChange({ ...filters, category: event.target.value as Filters["category"] })}
      >
        <MenuItem value="ALL">전체</MenuItem>
        {categoryFilterOptions.map((category) => (
          <MenuItem key={category.value} value={category.value}>
            {category.label}
          </MenuItem>
        ))}
      </TextField>
    </Grid>
    <Grid item lg={2} md={3} xs={12}>
      <TextField
        fullWidth
        label="주요 근육"
        select
        value={filters.primaryMuscle}
        onChange={(event) => onChange({ ...filters, primaryMuscle: event.target.value as Filters["primaryMuscle"] })}
      >
        <MenuItem value="ALL">전체</MenuItem>
        {primaryMuscles.map((muscle) => (
          <MenuItem key={muscle.value} value={muscle.value}>
            {muscle.label}
          </MenuItem>
        ))}
      </TextField>
    </Grid>
    <Grid item lg={2} md={3} xs={12}>
      <TextField
        fullWidth
        label="장비"
        select
        value={filters.equipmentType}
        onChange={(event) => onChange({ ...filters, equipmentType: event.target.value as Filters["equipmentType"] })}
      >
        <MenuItem value="ALL">전체</MenuItem>
        {equipmentTypes.map((equipment) => (
          <MenuItem key={equipment.value} value={equipment.value}>
            {equipment.label}
          </MenuItem>
        ))}
      </TextField>
    </Grid>
    <Grid item lg={1} md={3} xs={12}>
      <TextField
        fullWidth
        label="상태"
        select
        value={filters.status}
        onChange={(event) => onChange({ ...filters, status: event.target.value as Filters["status"] })}
      >
        <MenuItem value="ACTIVE">Active</MenuItem>
        <MenuItem value="ARCHIVED">Archived</MenuItem>
        <MenuItem value="ALL">All</MenuItem>
      </TextField>
    </Grid>
    <Grid item lg={1} md={3} xs={12}>
      <TextField
        fullWidth
        label="품질"
        select
        value={filters.quality}
        onChange={(event) => onChange({ ...filters, quality: event.target.value as Filters["quality"] })}
      >
        <MenuItem value="ALL">전체</MenuItem>
        <MenuItem value="NO_ALIAS">Alias 없음</MenuItem>
        <MenuItem value="NO_ENGLISH_NAME">English 없음</MenuItem>
        <MenuItem value="NO_MEMO">Memo 없음</MenuItem>
      </TextField>
    </Grid>
  </Grid>
);
