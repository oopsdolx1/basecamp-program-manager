import { FormControlLabel, Grid, MenuItem, Switch, TextField } from "@mui/material";
import { SearchField } from "../../../../components/common/SearchField";
import { programCategories, programDifficulties } from "../../config/programOptions";
import type { ProgramFilters as ProgramFiltersValue } from "../../types/programViewModel.types";

interface ProgramFiltersProps {
  filters: ProgramFiltersValue;
  onChange: (filters: ProgramFiltersValue) => void;
}

export const ProgramFilters = ({ filters, onChange }: ProgramFiltersProps): JSX.Element => (
  <Grid container spacing={2}>
    <Grid item md={4} xs={12}>
      <SearchField
        label="프로그램 또는 운동명 검색"
        value={filters.query}
        onChange={(query) => onChange({ ...filters, query })}
      />
    </Grid>
    <Grid item md={2} xs={6}>
      <TextField
        fullWidth
        label="카테고리"
        select
        value={filters.category}
        onChange={(event) => onChange({ ...filters, category: event.target.value as ProgramFiltersValue["category"] })}
      >
        <MenuItem value="ALL">전체</MenuItem>
        {programCategories.map((category) => (
          <MenuItem key={category.value} value={category.value}>
            {category.label}
          </MenuItem>
        ))}
      </TextField>
    </Grid>
    <Grid item md={2} xs={6}>
      <TextField
        fullWidth
        label="난이도"
        select
        value={filters.difficulty}
        onChange={(event) =>
          onChange({ ...filters, difficulty: event.target.value as ProgramFiltersValue["difficulty"] })
        }
      >
        <MenuItem value="ALL">전체</MenuItem>
        {programDifficulties.map((difficulty) => (
          <MenuItem key={difficulty.value} value={difficulty.value}>
            {difficulty.label}
          </MenuItem>
        ))}
      </TextField>
    </Grid>
    <Grid item md={2} xs={6}>
      <FormControlLabel
        control={
          <Switch
            checked={filters.favoriteOnly}
            onChange={(event) => onChange({ ...filters, favoriteOnly: event.target.checked })}
          />
        }
        label="즐겨찾기"
      />
    </Grid>
    <Grid item md={2} xs={6}>
      <FormControlLabel
        control={
          <Switch
            checked={filters.includeArchived}
            onChange={(event) => onChange({ ...filters, includeArchived: event.target.checked })}
          />
        }
        label="Archive 보기"
      />
    </Grid>
  </Grid>
);
