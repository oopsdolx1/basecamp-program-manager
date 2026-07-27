import { Box, Typography } from "@mui/material";

interface EmptyStateProps {
  title: string;
  description?: string;
}

export const EmptyState = ({ title, description }: EmptyStateProps): JSX.Element => (
  <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 3 }}>
    <Typography fontWeight={700}>{title}</Typography>
    {description ? <Typography color="text.secondary">{description}</Typography> : null}
  </Box>
);
