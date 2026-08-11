import RemoveIcon from "@mui/icons-material/Remove";
import AddIcon from "@mui/icons-material/Add";
import { IconButton, Stack, TextField } from "@mui/material";

interface NumericStepperProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}

export const NumericStepper = ({ label, value, min = 1, max = 99, onChange }: NumericStepperProps): JSX.Element => {
  const update = (next: number) => onChange(Math.min(max, Math.max(min, Math.floor(next || min))));
  return (
    <Stack alignItems="center" direction="row" spacing={1}>
      <IconButton aria-label={`${label} 감소`} disabled={value <= min} onClick={() => update(value - 1)} sx={{ minHeight: 48, minWidth: 48 }}>
        <RemoveIcon />
      </IconButton>
      <TextField
        inputProps={{ min, max, inputMode: "numeric", style: { textAlign: "center" } }}
        label={label}
        type="number"
        value={value}
        onChange={(event) => update(Number(event.target.value))}
        sx={{ minWidth: 88, width: 96 }}
      />
      <IconButton aria-label={`${label} 증가`} disabled={value >= max} onClick={() => update(value + 1)} sx={{ minHeight: 48, minWidth: 48 }}>
        <AddIcon />
      </IconButton>
    </Stack>
  );
};
