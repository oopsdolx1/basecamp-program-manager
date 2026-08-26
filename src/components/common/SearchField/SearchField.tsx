import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import { IconButton, InputAdornment, TextField } from "@mui/material";
import { palette } from "../../../theme/palette";

interface SearchFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  showLabel?: boolean;
}

export const SearchField = ({ label, value, onChange, showLabel = true }: SearchFieldProps): JSX.Element => (
  <TextField
    inputProps={{ "aria-label": label }}
    fullWidth
    label={showLabel ? label : undefined}
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
          <IconButton aria-label={`${label} 지우기`} edge="end" onClick={() => onChange("")} sx={{ minHeight: 44, minWidth: 44 }}>
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
