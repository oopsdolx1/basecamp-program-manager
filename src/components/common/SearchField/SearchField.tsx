import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import { IconButton, InputAdornment, TextField } from "@mui/material";
import { palette } from "../../../theme/palette";

interface SearchFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export const SearchField = ({ label, value, onChange }: SearchFieldProps): JSX.Element => (
  <TextField
    fullWidth
    label={label}
    placeholder={label}
    value={value}
    onChange={(event) => onChange(event.target.value)}
    InputProps={{
      startAdornment: (
        <InputAdornment position="start">
          <SearchIcon fontSize="small" color="primary" />
        </InputAdornment>
      ),
      endAdornment: value ? (
        <InputAdornment position="end">
          <IconButton aria-label={`${label} clear`} edge="end" size="small" onClick={() => onChange("")}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </InputAdornment>
      ) : null,
      sx: {
        borderRadius: `${palette.radiusSm}px`,
        minHeight: palette.controlHeightLarge,
      },
    }}
  />
);
