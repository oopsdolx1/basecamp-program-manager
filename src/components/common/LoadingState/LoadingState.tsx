import { Box, CircularProgress, Typography } from "@mui/material";

export const LoadingState = (): JSX.Element => (
  <Box sx={{ alignItems: "center", display: "flex", gap: 1.5, py: 4 }}>
    <CircularProgress size={22} />
    <Typography color="text.secondary">회원 목록을 불러오는 중입니다.</Typography>
  </Box>
);
