import { AppBar, Box, Button, Toolbar, Typography } from "@mui/material";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { routeBuilder } from "../../../app/routeBuilder";
import { routes } from "../../../app/routes";
import { palette } from "../../../theme/palette";

const navItems = [
  { label: "추천 출력", to: routeBuilder.print(), matches: [routeBuilder.print(), routeBuilder.quickPrint(), routeBuilder.dashboard()] },
  { label: "출력 이력", to: routeBuilder.master("history"), matches: [routeBuilder.master(), routes.printHistory] },
  { label: "처음으로", to: routeBuilder.print(), matches: [] },
];

export const AppHeader = (): JSX.Element => {
  const location = useLocation();

  return (
    <AppBar
      position="sticky"
      sx={{
        bgcolor: "rgba(17, 17, 17, 0.94)",
        borderBottom: `1px solid ${palette.borderStrong}`,
        color: "text.primary",
        flex: "none",
        zIndex: 50,
      }}
    >
      <Toolbar sx={{ gap: 2, height: 52, maxWidth: 1440, mx: "auto", px: { md: 4, xs: 2 }, width: "100%" }}>
        <Box sx={{ alignItems: "baseline", display: "flex", gap: 1.25, userSelect: "none" }}>
          <Typography fontSize={16} fontWeight={900} letterSpacing="0.08em">BASECAMP</Typography>
          <Typography color="text.secondary" fontSize={11} fontWeight={700} letterSpacing="0.12em" sx={{ display: { sm: "block", xs: "none" } }}>PROGRAM MANAGER</Typography>
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        <Box sx={{ display: "flex", gap: { sm: 1, xs: 0.5 } }}>
          {navItems.map((item) => {
            const active = item.matches.some(
              (match) => location.pathname === match || location.pathname.startsWith(`${match}/`),
            );
            return (
              <Button
                component={RouterLink}
                reloadDocument={item.label === "처음으로"}
                key={item.to}
                size="small"
                to={item.to}
                variant={active ? "contained" : "text"}
                sx={{
                  bgcolor: "transparent",
                  borderBottom: active ? `2px solid ${palette.primaryGold}` : "2px solid transparent",
                  borderRadius: 0,
                  color: active ? "text.primary" : "text.secondary",
                  fontSize: { sm: 13, xs: 12 },
                  minHeight: 52,
                  minWidth: { sm: 76, xs: 58 },
                  px: { sm: 1.25, xs: 0.75 },
                  "&:hover": {
                    bgcolor: "transparent",
                    color: "text.primary",
                  },
                }}
              >
                {item.label}
              </Button>
            );
          })}
        </Box>
      </Toolbar>
    </AppBar>
  );
};
