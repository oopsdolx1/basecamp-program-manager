import { createTheme } from "@mui/material/styles";
import { componentOverrides } from "./componentOverrides";
import { palette as basecampPalette } from "./palette";
import { typography } from "./typography";

export const basecampTheme = createTheme({
  spacing: 4,
  palette: {
    mode: "dark",
    primary: {
      main: basecampPalette.primaryGold,
      dark: basecampPalette.primaryGoldHover,
      light: basecampPalette.primaryGoldLight,
      contrastText: basecampPalette.black,
    },
    secondary: {
      main: basecampPalette.surface,
      contrastText: basecampPalette.white,
    },
    text: {
      primary: basecampPalette.textPrimary,
      secondary: basecampPalette.textSecondary,
    },
    background: {
      default: basecampPalette.appBackground,
      paper: basecampPalette.surface,
    },
    divider: basecampPalette.borderDefault,
    error: { main: basecampPalette.error },
    warning: { main: basecampPalette.warning },
    success: { main: basecampPalette.success },
    info: { main: basecampPalette.info },
  },
  shape: {
    borderRadius: basecampPalette.radiusSm,
  },
  typography,
  components: componentOverrides,
});
