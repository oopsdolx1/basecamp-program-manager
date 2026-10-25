import { Box } from "@mui/material";
import type { PropsWithChildren } from "react";
import { useLocation } from "react-router-dom";
import { palette } from "../../../theme/palette";
import { AppHeader } from "../AppHeader";

export const AppLayout = ({ children }: PropsWithChildren): JSX.Element => {
  const location = useLocation();
  const isFixedHeightKioskRoute = location.pathname === "/program-manager/print";

  return (
    <Box
      sx={{
        bgcolor: "background.default",
        backgroundImage: isFixedHeightKioskRoute ? "none" : `radial-gradient(circle at top, ${palette.primaryGoldDark}1F 0%, transparent 32%)`,
        color: "text.primary",
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
      }}
    >
      <AppHeader />
      <Box sx={{ flex: "1 1 auto", minHeight: 0, overflowX: "hidden", overflowY: isFixedHeightKioskRoute ? "hidden" : "auto" }}>
        {children}
      </Box>
    </Box>
  );
};
