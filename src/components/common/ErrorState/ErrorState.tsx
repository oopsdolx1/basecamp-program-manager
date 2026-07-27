import { Alert } from "@mui/material";

interface ErrorStateProps {
  message: string;
}

export const ErrorState = ({ message }: ErrorStateProps): JSX.Element => (
  <Alert severity="error">{message}</Alert>
);
