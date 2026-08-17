import { Button as MuiButton, CircularProgress, type ButtonProps as MuiButtonProps } from "@mui/material";
import { colors, motion, radius, spacing } from "../../tokens";

export interface ButtonProps extends Omit<MuiButtonProps, "variant" | "color"> {
  variant?: "primary" | "secondary" | "tertiary";
  loading?: boolean;
}

export const Button = ({ variant = "primary", loading = false, disabled, children, ...props }: ButtonProps): JSX.Element => {
  const primary = variant === "primary";
  const secondary = variant === "secondary";
  return <MuiButton {...props} disabled={disabled || loading} aria-busy={loading} sx={{
    bgcolor: primary ? colors.primary.gold : "transparent",
    border: secondary ? `1px solid ${colors.primary.gold}` : "1px solid transparent",
    borderRadius: `${radius.sm}px`, color: primary ? colors.neutral.black : secondary ? colors.primary.gold : colors.neutral.gray100,
    minHeight: spacing[12], minWidth: spacing[12], px: `${spacing[4]}px`, textTransform: "none", transition: motion.transition,
    "&:hover": { bgcolor: primary ? colors.primary.goldLight : colors.neutral.gray800 },
    "&:active": { bgcolor: primary ? colors.primary.goldDark : colors.neutral.gray700, transform: "translateY(1px)" },
    "&:focus-visible": { outline: `3px solid ${colors.alpha.goldFocus}`, outlineOffset: 2 },
    "&.Mui-disabled": { bgcolor: colors.neutral.gray800, color: colors.neutral.gray400, borderColor: "transparent" },
    ...props.sx,
  }}>{loading ? <CircularProgress color="inherit" size={spacing[4]} sx={{ mr: `${spacing[2]}px` }} /> : null}{children}</MuiButton>;
};
