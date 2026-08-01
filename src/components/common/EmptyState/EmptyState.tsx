import SearchOffIcon from "@mui/icons-material/SearchOff";
import { Box, Typography } from "@mui/material";
import { palette } from "../../../theme/palette";

interface EmptyStateProps {
  title: string;
  description?: string;
}

export const EmptyState = ({ title, description }: EmptyStateProps): JSX.Element => (
  <Box
    sx={{
      alignItems: "center",
      bgcolor: palette.surfaceInteractive,
      border: 1,
      borderColor: "divider",
      borderStyle: "dashed",
      borderRadius: `${palette.radiusMd}px`,
      display: "flex",
      flexDirection: "column",
      gap: 1.5,
      p: 5,
      textAlign: "center",
    }}
  >
    <SearchOffIcon color="disabled" sx={{ fontSize: 28 }} />
    <Typography fontWeight={900}>{title}</Typography>
    {description ? (
      <Typography color="text.secondary" variant="body2">
        {description}
      </Typography>
    ) : null}
  </Box>
);
