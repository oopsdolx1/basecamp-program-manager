import { FormControl, InputLabel, MenuItem, Select as MuiSelect, type SelectProps as MuiSelectProps } from "@mui/material";
import { colors, radius, spacing } from "../../tokens";
export interface SelectOption { label: string; value: string }
export interface SelectProps extends Omit<MuiSelectProps<string>, "children"> { label?: string; options: SelectOption[] }
export const Select = ({ label, options, ...props }: SelectProps): JSX.Element => <FormControl fullWidth={props.fullWidth}>
  {label ? <InputLabel>{label}</InputLabel> : null}<MuiSelect {...props} label={label} sx={{ bgcolor: colors.neutral.gray900, borderRadius: `${radius.xs}px`, color: colors.neutral.white, minHeight: spacing[12], "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: colors.primary.gold } }}>
    {options.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
  </MuiSelect>
</FormControl>;
