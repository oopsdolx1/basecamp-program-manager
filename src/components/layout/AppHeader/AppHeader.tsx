import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import { AppBar, Box, Button, Toolbar, Typography } from "@mui/material";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { routeBuilder } from "../../../app/routeBuilder";
import { routes } from "../../../app/routes";
import { palette } from "../../../theme/palette";

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
        bgcolor: palette.surfaceRaised,
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${palette.borderStrong}`,
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
              background: `linear-gradient(135deg, ${palette.primaryGold} 0%, ${palette.primaryGoldHover} 100%)`,
              borderRadius: 3,
              boxShadow: palette.shadowAccent,
              color: "primary.contrastText",
              display: "flex",
              height: 44,
              justifyContent: "center",
              transition: "transform 150ms ease, box-shadow 150ms ease",
              width: 44,
              "&:hover": { transform: "scale(1.04)", boxShadow: palette.shadowAccentStrong },
            }}
          >
            <FitnessCenterIcon />
          </Box>
          <Box sx={{ display: { sm: "flex", xs: "none" }, flexDirection: "column", lineHeight: 1 }}>
            <Typography fontSize={22} fontWeight={900} letterSpacing="-0.03em">
              BASECAMP
            </Typography>
            <Typography color="primary.main" fontSize={11} fontWeight={700} letterSpacing="0.28em" mt={0.75} textTransform="uppercase">
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
                  border: active ? `1px solid ${palette.borderAccent}` : "1px solid transparent",
                  color: active ? "primary.contrastText" : "text.secondary",
                  fontSize: 14,
                  minHeight: 40,
                  px: 2,
                  "&:hover": {
                    bgcolor: active ? "primary.main" : palette.surface,
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
