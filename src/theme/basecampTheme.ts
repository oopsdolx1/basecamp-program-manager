import { createTheme } from "@mui/material/styles";
import { componentOverrides } from "./componentOverrides";
import { palette as basecampPalette } from "./palette";
import { typography } from "./typography";

export const basecampTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: basecampPalette.primaryGold,
      contrastText: basecampPalette.black,
    },
    text: {
      primary: basecampPalette.dark,
      secondary: basecampPalette.mutedText,
    },
    background: {
      default: basecampPalette.lightBackground,
      paper: basecampPalette.paper,
    },
    divider: basecampPalette.border,
  },
  typography,
  components: componentOverrides,
});
