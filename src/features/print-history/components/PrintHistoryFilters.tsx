import { Grid, MenuItem, TextField } from "@mui/material";
import { SearchField } from "../../../components/common/SearchField";
import { programCategories } from "../../programs/config/programOptions";
import type { PrintHistoryFilters as Filters } from "../hooks/usePrintRequests";

interface PrintHistoryFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export const PrintHistoryFilters = ({ filters, onChange }: PrintHistoryFiltersProps): JSX.Element => (
  <Grid container spacing={2}>
    <Grid item md={6} xs={12}>
      <SearchField
        label="회원 또는 프로그램 검색"
        value={filters.search}
        onChange={(search) => onChange({ ...filters, search })}
      />
    </Grid>
    <Grid item md={3} xs={12}>
      <TextField
        fullWidth
        label="카테고리"
        select
        value={filters.category}
        onChange={(event) => onChange({ ...filters, category: event.target.value as Filters["category"] })}
      >
        <MenuItem value="ALL">전체</MenuItem>
        {programCategories.map((category) => (
          <MenuItem key={category.value} value={category.value}>
            {category.label}
          </MenuItem>
        ))}
      </TextField>
    </Grid>
  </Grid>
);
