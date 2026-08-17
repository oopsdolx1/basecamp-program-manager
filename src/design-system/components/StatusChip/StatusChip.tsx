import { Chip } from "@mui/material";
import { colors, radius } from "../../tokens";
export type StatusTone = "success" | "warning" | "pending" | "error" | "info";
const tone = {
  success: [colors.semantic.success, colors.alpha.successMuted], warning: [colors.semantic.warning, colors.alpha.warningMuted],
  pending: [colors.neutral.gray300, colors.neutral.gray800], error: [colors.semantic.error, colors.alpha.errorMuted], info: [colors.semantic.info, colors.alpha.infoMuted],
} as const;
export const StatusChip = ({ label, status = "pending" }: { label: string; status?: StatusTone }): JSX.Element => <Chip label={label} size="small" sx={{ bgcolor: tone[status][1], border: `1px solid ${tone[status][0]}`, borderRadius: `${radius.full}px`, color: tone[status][0], fontWeight: 700 }} />;
