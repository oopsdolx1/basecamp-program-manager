import { Box, type BoxProps } from "@mui/material";
import { colors, spacing } from "../../tokens";
export const WorkspaceLayout = (props: BoxProps): JSX.Element => <Box {...props} sx={{ bgcolor: colors.neutral.black, color: colors.neutral.white, display: "grid", gap: `${spacing[6]}px`, gridTemplateColumns: { lg: "minmax(0, 1fr) 360px", md: "minmax(0, 1fr) 320px", xs: "1fr" }, margin: "0 auto", maxWidth: 1440, minHeight: "100vh", p: { lg: `${spacing[8]}px`, md: `${spacing[6]}px`, xs: `${spacing[4]}px` }, ...props.sx }} />;
