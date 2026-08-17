import { createTheme } from "@mui/material";
import { colors, radius, typography } from "./tokens";
export const baseCampDesignTheme = createTheme({
  palette: { mode: "dark", primary: { main: colors.primary.gold, light: colors.primary.goldLight, dark: colors.primary.goldDark, contrastText: colors.neutral.black }, background: { default: colors.neutral.black, paper: colors.neutral.gray900 }, text: { primary: colors.neutral.white, secondary: colors.neutral.gray300 }, success: { main: colors.semantic.success }, info: { main: colors.semantic.info }, warning: { main: colors.semantic.warning }, error: { main: colors.semantic.error } },
  typography: { fontFamily: typography.fontFamily }, shape: { borderRadius: radius.sm },
  breakpoints: { values: { xs: 0, sm: 768, md: 1024, lg: 1280, xl: 1536 } },
});
