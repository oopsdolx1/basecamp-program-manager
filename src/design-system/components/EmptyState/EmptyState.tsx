import { Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { colors, spacing } from "../../tokens";
export interface EmptyStateProps { title: string; description?: string; action?: ReactNode; icon?: ReactNode }
export const EmptyState = ({ title, description, action, icon }: EmptyStateProps): JSX.Element => <Stack alignItems="center" role="status" spacing={`${spacing[3]}px`} sx={{ color: colors.neutral.gray300, p: `${spacing[12]}px`, textAlign: "center" }}>{icon}<Typography color="inherit" variant="h6">{title}</Typography>{description ? <Typography color={colors.neutral.gray400}>{description}</Typography> : null}{action}</Stack>;
