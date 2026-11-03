import { Box } from "@mui/material";
import type { PropsWithChildren } from "react";
import { useLocation } from "react-router-dom";
import { palette } from "../../../theme/palette";
import { AppHeader } from "../AppHeader";

export const AppLayout = ({ children }: PropsWithChildren): JSX.Element => {
  const location = useLocation();
  const isFixedHeightKioskRoute = location.pathname === "/program-manager/print" || location.pathname.startsWith("/program-manager/workout-sessions");

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
      <Box sx={{ "& > *": isFixedHeightKioskRoute ? { display: "flex", flex: 1, flexDirection: "column", minHeight: 0 } : undefined, display: "flex", flex: "1 1 auto", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
        {children}
      </Box>
    </Box>
  );
};
