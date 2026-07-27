import { Box, CircularProgress, Typography } from "@mui/material";

interface LoadingStateProps {
  message?: string;
}

export const LoadingState = ({ message = "정보를 불러오는 중입니다." }: LoadingStateProps): JSX.Element => (
  <Box sx={{ alignItems: "center", display: "flex", gap: 1.5, py: 3 }}>
    <CircularProgress size={22} />
    <Typography color="text.secondary" variant="body2">
      {message}
    </Typography>
  </Box>
);
