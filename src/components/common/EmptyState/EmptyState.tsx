import SearchOffIcon from "@mui/icons-material/SearchOff";
import { Box, Typography } from "@mui/material";

interface EmptyStateProps {
  title: string;
  description?: string;
}

export const EmptyState = ({ title, description }: EmptyStateProps): JSX.Element => (
  <Box
    sx={{
      alignItems: "center",
      border: 1,
      borderColor: "divider",
      borderRadius: 4,
      display: "flex",
      flexDirection: "column",
      gap: 1,
      p: 4,
      textAlign: "center",
    }}
  >
    <SearchOffIcon color="disabled" />
    <Typography fontWeight={950}>{title}</Typography>
    {description ? (
      <Typography color="text.secondary" variant="body2">
        {description}
      </Typography>
    ) : null}
  </Box>
);
