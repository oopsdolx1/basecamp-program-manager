import { Box, type BoxProps } from "@mui/material";
import { colors, spacing } from "../../tokens";
export const Topbar = (props: BoxProps): JSX.Element => <Box component="header" {...props} sx={{ alignItems: "center", bgcolor: colors.neutral.gray900, borderBottom: `1px solid ${colors.neutral.gray700}`, display: "flex", minHeight: spacing[16], px: `${spacing[6]}px`, ...props.sx }} />;
