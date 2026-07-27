import { Box } from "@mui/material";
import type { PropsWithChildren } from "react";
import { AppHeader } from "../AppHeader";

export const AppLayout = ({ children }: PropsWithChildren): JSX.Element => (
  <Box sx={{ bgcolor: "background.default", color: "text.primary", minHeight: "100vh" }}>
    <AppHeader />
    {children}
  </Box>
);
