import { Box } from "@mui/material";
import type { PropsWithChildren } from "react";
import { palette } from "../../../theme/palette";
import { AppHeader } from "../AppHeader";

export const AppLayout = ({ children }: PropsWithChildren): JSX.Element => (
  <Box
    sx={{
      bgcolor: "background.default",
      backgroundImage: `radial-gradient(circle at top, ${palette.primaryGoldDark}1F 0%, transparent 32%)`,
      color: "text.primary",
      minHeight: "100vh",
    }}
  >
    <AppHeader />
    {children}
  </Box>
);
