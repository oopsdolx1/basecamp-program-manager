import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import { AppBar, Box, Button, Toolbar, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { routeBuilder } from "../../../app/routeBuilder";

export const AppHeader = (): JSX.Element => (
  <AppBar color="inherit" position="static">
    <Toolbar sx={{ borderBottom: 1, borderColor: "divider", gap: 1.5 }}>
      <FitnessCenterIcon color="primary" />
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="h3">BaseCamp Program Manager</Typography>
        <Typography color="text.secondary" variant="body2">
          Quick Print Foundation
        </Typography>
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        <Button component={RouterLink} to={routeBuilder.quickPrint()}>
          Quick Print
        </Button>
        <Button component={RouterLink} to={routeBuilder.programs()}>
          프로그램 관리
        </Button>
        <Button component={RouterLink} to={routeBuilder.exerciseCatalog()}>
          운동 카탈로그
        </Button>
        <Button component={RouterLink} to={routeBuilder.printHistory()}>
          인쇄 요청 기록
        </Button>
      </Box>
    </Toolbar>
  </AppBar>
);
