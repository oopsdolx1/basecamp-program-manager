import SearchIcon from "@mui/icons-material/Search";
import { InputAdornment, TextField } from "@mui/material";

interface SearchFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export const SearchField = ({ label, value, onChange }: SearchFieldProps): JSX.Element => (
  <TextField
    fullWidth
    label={label}
    value={value}
    onChange={(event) => onChange(event.target.value)}
    InputProps={{
      startAdornment: (
        <InputAdornment position="start">
          <SearchIcon fontSize="small" />
        </InputAdornment>
      ),
    }}
  />
);
