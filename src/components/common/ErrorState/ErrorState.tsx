import { Alert } from "@mui/material";
import { palette } from "../../../theme/palette";

interface ErrorStateProps {
  message: string;
}

export const ErrorState = ({ message }: ErrorStateProps): JSX.Element => (
  <Alert
    severity="error"
    sx={{
      borderRadius: `${palette.radiusSm}px`,
      border: `1px solid rgba(239, 68, 68, 0.3)`,
      backgroundColor: `rgba(239, 68, 68, 0.1)`,
      color: "#fca5a5",
      fontWeight: 700,
      alignItems: "center",
    }}
  >
    {message}
  </Alert>
);
