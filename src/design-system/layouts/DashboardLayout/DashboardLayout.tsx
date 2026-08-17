import { Box, type BoxProps } from "@mui/material";
import { colors, spacing } from "../../tokens";
export const DashboardLayout = (props: BoxProps): JSX.Element => <Box {...props} sx={{ bgcolor: colors.neutral.black, color: colors.neutral.white, display: "grid", gap: `${spacing[6]}px`, gridTemplateColumns: { lg: "240px minmax(0, 1fr)", xs: "1fr" }, minHeight: "100vh", p: { lg: `${spacing[8]}px`, md: `${spacing[6]}px`, xs: `${spacing[4]}px` }, ...props.sx }} />;
