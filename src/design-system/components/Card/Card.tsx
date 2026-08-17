import { Card as MuiCard, type CardProps as MuiCardProps } from "@mui/material";
import { colors, radius, shadows, spacing } from "../../tokens";
export type CardVariant = "default" | "member" | "program" | "analysis" | "stat";
export interface CardProps extends Omit<MuiCardProps, "variant"> { variant?: CardVariant }
export const Card = ({ variant = "default", ...props }: CardProps): JSX.Element => <MuiCard {...props} data-variant={variant} sx={{
  bgcolor: colors.neutral.gray900, border: `1px solid ${colors.neutral.gray700}`, borderRadius: `${radius.md}px`,
  boxShadow: variant === "analysis" ? shadows.lg : shadows.sm, color: colors.neutral.white, p: `${spacing[4]}px`, ...props.sx,
}} />;
