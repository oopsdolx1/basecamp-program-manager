import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { BrowserRouter } from "react-router-dom";
import type { PropsWithChildren } from "react";
import { basecampTheme } from "../theme/basecampTheme";

export const AppProviders = ({ children }: PropsWithChildren): JSX.Element => (
  <ThemeProvider theme={basecampTheme}>
    <CssBaseline />
    <BrowserRouter>{children}</BrowserRouter>
  </ThemeProvider>
);
