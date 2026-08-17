import { Box, type BoxProps } from "@mui/material";
import { colors, radius, spacing, typography } from "../../tokens";
export const Badge = (props: BoxProps): JSX.Element => <Box component="span" {...props} sx={{ bgcolor: colors.primary.goldDeep, borderRadius: `${radius.full}px`, color: colors.primary.goldLight, display: "inline-flex", px: `${spacing[2]}px`, py: `${spacing[1]}px`, ...typography.caption, ...props.sx }} />;
