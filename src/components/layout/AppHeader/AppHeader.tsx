import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import { AppBar, Box, Button, Toolbar, Typography } from "@mui/material";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { routeBuilder } from "../../../app/routeBuilder";
import { routes } from "../../../app/routes";

const navItems = [
  { label: "Print", to: routeBuilder.print(), matches: [routeBuilder.print(), routeBuilder.quickPrint()] },
  { label: "Exercise Catalog", to: routeBuilder.exerciseCatalog(), matches: [routeBuilder.exerciseCatalog()] },
  { label: "Master", to: routeBuilder.master(), matches: [routeBuilder.master(), routes.programs, routes.printHistory] },
];

export const AppHeader = (): JSX.Element => {
  const location = useLocation();

  return (
    <AppBar
      position="sticky"
      sx={{
        bgcolor: "rgba(17, 17, 17, 0.8)",
        backdropFilter: "blur(12px)",
        borderBottom: 1,
        borderColor: "divider",
        color: "text.primary",
        flex: "none",
        zIndex: 50,
      }}
    >
      <Toolbar sx={{ gap: 2, height: 64, maxWidth: 1152, mx: "auto", px: 2, width: "100%" }}>
        <Box sx={{ alignItems: "center", cursor: "pointer", display: "flex", gap: 1.5, userSelect: "none" }}>
          <Box
            sx={{
              alignItems: "center",
              bgcolor: "primary.main",
              borderRadius: 2.5,
              color: "primary.contrastText",
              display: "flex",
              height: 42,
              justifyContent: "center",
              transition: "transform 150ms ease",
              width: 42,
              "&:hover": { transform: "scale(1.04)" },
            }}
          >
            <FitnessCenterIcon />
          </Box>
          <Box sx={{ display: { sm: "flex", xs: "none" }, flexDirection: "column", lineHeight: 1 }}>
            <Typography fontSize={22} fontWeight={950} letterSpacing="-0.03em">
              BASECAMP
            </Typography>
            <Typography color="primary.main" fontSize={11} fontWeight={800} letterSpacing="0.28em" mt={0.5}>
              PROGRAM MANAGER
            </Typography>
          </Box>
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        <Box sx={{ display: { md: "flex", xs: "none" }, gap: 1 }}>
          {navItems.map((item) => {
            const active = item.matches.some(
              (match) => location.pathname === match || location.pathname.startsWith(`${match}/`),
            );
            return (
              <Button
                component={RouterLink}
                key={item.to}
                size="small"
                to={item.to}
                variant={active ? "contained" : "text"}
                sx={{
                  bgcolor: active ? "primary.main" : "transparent",
                  color: active ? "primary.contrastText" : "text.secondary",
                  fontSize: 14,
                  px: 2,
                  "&:hover": {
                    bgcolor: active ? "primary.main" : "rgba(30, 41, 59, 0.75)",
                    color: active ? "primary.contrastText" : "text.primary",
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
