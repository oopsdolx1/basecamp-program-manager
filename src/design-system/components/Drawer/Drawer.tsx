import { Drawer as MuiDrawer, type DrawerProps as MuiDrawerProps } from "@mui/material";
import { colors, spacing } from "../../tokens";
export const Drawer = (props: MuiDrawerProps): JSX.Element => <MuiDrawer anchor="right" {...props} PaperProps={{ sx: { bgcolor: colors.neutral.gray900, borderLeft: `1px solid ${colors.neutral.gray700}`, color: colors.neutral.white, p: `${spacing[6]}px`, width: { md: 400, xs: "min(90vw, 400px)" } } }} />;
