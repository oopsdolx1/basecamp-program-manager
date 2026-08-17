import { Chip as MuiChip, type ChipProps as MuiChipProps } from "@mui/material";
import { colors, radius } from "../../tokens";
export interface ChipProps extends MuiChipProps { selected?: boolean; ai?: boolean }
export const Chip = ({ selected, ai, ...props }: ChipProps): JSX.Element => <MuiChip {...props} sx={{ bgcolor: ai ? colors.alpha.aiMuted : selected ? colors.alpha.goldMuted : colors.neutral.gray800, border: `1px solid ${ai ? colors.accent.ai : selected ? colors.primary.gold : colors.neutral.gray700}`, borderRadius: `${radius.sm}px`, color: ai ? colors.accent.ai : selected ? colors.primary.goldLight : colors.neutral.gray100, ...props.sx }} />;
