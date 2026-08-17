import { TextField, type TextFieldProps } from "@mui/material";
import { colors, radius, spacing } from "../../tokens";
export type InputProps = TextFieldProps;
export const Input = (props: InputProps): JSX.Element => <TextField {...props} variant="outlined" sx={{
  "& .MuiOutlinedInput-root": { bgcolor: colors.neutral.gray900, borderRadius: `${radius.xs}px`, color: colors.neutral.white, minHeight: spacing[12],
    "& fieldset": { borderColor: colors.neutral.gray600 }, "&:hover fieldset": { borderColor: colors.neutral.gray400 },
    "&.Mui-focused fieldset": { borderColor: colors.primary.gold }, "&.Mui-error fieldset": { borderColor: colors.semantic.error },
    "&.Mui-disabled": { bgcolor: colors.neutral.gray800, color: colors.neutral.gray400 } }, ...props.sx,
}} />;
