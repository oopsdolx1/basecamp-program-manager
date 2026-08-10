import { Grid, MenuItem, TextField } from "@mui/material";
import { SearchField } from "../../../components/common/SearchField";
import type { ExerciseCatalogFilters as Filters } from "../domain/exerciseCatalog.types";

interface ExerciseCatalogFiltersProps {
  filters: Filters;
  bodyParts: string[];
  equipment: string[];
  onChange: (filters: Filters) => void;
}

export const ExerciseCatalogFilters = ({ filters, bodyParts, equipment, onChange }: ExerciseCatalogFiltersProps): JSX.Element => (
  <Grid container spacing={2}>
    <Grid item md={4} xs={12}>
      <SearchField label="운동명, 영문명, Alias 검색" value={filters.search} onChange={(search) => onChange({ ...filters, search })} />
    </Grid>
    <Grid item md={4} xs={12}>
      <TextField fullWidth label="부위" select value={filters.bodyPart} onChange={(event) => onChange({ ...filters, bodyPart: event.target.value })}>
        <MenuItem value="ALL">전체</MenuItem>
        {bodyParts.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
      </TextField>
    </Grid>
    <Grid item md={4} xs={12}>
      <TextField fullWidth label="기구" select value={filters.equipment} onChange={(event) => onChange({ ...filters, equipment: event.target.value })}>
        <MenuItem value="ALL">전체</MenuItem>
        {equipment.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
      </TextField>
    </Grid>
  </Grid>
);
