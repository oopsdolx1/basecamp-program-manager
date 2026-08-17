import { Box } from "@mui/material";
import type { PropsWithChildren } from "react";
import { useLocation } from "react-router-dom";
import { palette } from "../../../theme/palette";
import { AppHeader } from "../AppHeader";

export const AppLayout = ({ children }: PropsWithChildren): JSX.Element => {
  const location = useLocation();
  const isProgramWorkspace = location.pathname === "/program-manager/print";

  return (
    <Box
      sx={{
        bgcolor: "background.default",
        backgroundImage: isProgramWorkspace ? "none" : `radial-gradient(circle at top, ${palette.primaryGoldDark}1F 0%, transparent 32%)`,
        color: "text.primary",
        minHeight: "100vh",
      }}
    >
      {isProgramWorkspace ? null : <AppHeader />}
      {children}
    </Box>
  );
};
