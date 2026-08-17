import { Box, Stack, type BoxProps } from "@mui/material";
import { colors, radius, spacing } from "../../tokens";
export const Sidebar = (props: BoxProps): JSX.Element => <Box component="nav" {...props} sx={{ bgcolor: colors.neutral.gray900, border: `1px solid ${colors.neutral.gray700}`, borderRadius: `${radius.md}px`, minWidth: 224, p: `${spacing[4]}px`, ...props.sx }}><Stack spacing={`${spacing[2]}px`}>{props.children}</Stack></Box>;
