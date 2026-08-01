import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { palette } from "../../../theme/palette";

interface LoadingStateProps {
  message?: string;
}

export const LoadingState = ({ message = "정보를 불러오는 중입니다." }: LoadingStateProps): JSX.Element => (
  <Stack alignItems="center" spacing={2.5} sx={{ py: 4, textAlign: "center" }}>
    <Box sx={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 84, height: 84 }}>
      <Box sx={{ position: "absolute", inset: 0, borderRadius: "999px", border: `4px solid ${palette.primaryGoldMuted}` }} />
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: "999px",
          background: `linear-gradient(135deg, ${palette.primaryGoldHover} 0%, ${palette.primaryGoldLight} 100%)`,
          boxShadow: palette.shadowAccentStrong,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress size={24} sx={{ color: palette.black }} thickness={5} />
      </Box>
    </Box>
    <Typography
      color="text.secondary"
      variant="body2"
      sx={{
        bgcolor: palette.surfacePanel,
        border: 1,
        borderColor: "divider",
        borderRadius: `${palette.radiusMd}px`,
        maxWidth: 420,
        px: 3,
        py: 2,
      }}
    >
      {message}
    </Typography>
  </Stack>
);
