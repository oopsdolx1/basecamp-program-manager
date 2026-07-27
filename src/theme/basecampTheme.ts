import { createTheme } from "@mui/material/styles";
import { componentOverrides } from "./componentOverrides";
import { palette as basecampPalette } from "./palette";
import { typography } from "./typography";

export const basecampTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: basecampPalette.primaryGold,
      contrastText: basecampPalette.black,
    },
    secondary: {
      main: basecampPalette.slate800,
      contrastText: basecampPalette.white,
    },
    text: {
      primary: basecampPalette.white,
      secondary: basecampPalette.mutedText,
    },
    background: {
      default: basecampPalette.lightBackground,
      paper: basecampPalette.paper,
    },
    divider: basecampPalette.border,
    error: { main: basecampPalette.danger },
    warning: { main: basecampPalette.warning },
    success: { main: basecampPalette.success },
    info: { main: basecampPalette.info },
  },
  typography,
  components: componentOverrides,
});
