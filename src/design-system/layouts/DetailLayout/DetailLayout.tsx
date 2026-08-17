import { Stack, type StackProps } from "@mui/material";
import { colors, spacing } from "../../tokens";
export const DetailLayout = (props: StackProps): JSX.Element => <Stack {...props} spacing={`${spacing[6]}px`} sx={{ bgcolor: colors.neutral.black, color: colors.neutral.white, margin: "0 auto", maxWidth: 1120, minHeight: "100vh", p: { lg: `${spacing[8]}px`, md: `${spacing[6]}px`, xs: `${spacing[4]}px` }, ...props.sx }} />;
