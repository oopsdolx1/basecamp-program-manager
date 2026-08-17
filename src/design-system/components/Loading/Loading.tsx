import { CircularProgress, LinearProgress, Stack, Typography } from "@mui/material";
import { colors, spacing } from "../../tokens";
export interface LoadingProps { label?: string; progress?: number; inline?: boolean }
export const Loading = ({ label = "로딩 중", progress, inline }: LoadingProps): JSX.Element => inline ? <CircularProgress aria-label={label} size={spacing[6]} sx={{ color: colors.primary.gold }} /> : <Stack aria-live="polite" role="status" spacing={`${spacing[3]}px`} sx={{ p: `${spacing[6]}px` }}><Typography>{label}</Typography>{typeof progress === "number" ? <LinearProgress value={progress} variant="determinate" /> : <LinearProgress />}</Stack>;
