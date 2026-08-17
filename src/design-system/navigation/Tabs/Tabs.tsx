import { Tab, Tabs as MuiTabs, type TabsProps as MuiTabsProps } from "@mui/material";
import { colors, spacing } from "../../tokens";
export interface TabItem { label: string; value: string }
export interface TabsProps extends Omit<MuiTabsProps, "children"> { items: TabItem[] }
export const Tabs = ({ items, ...props }: TabsProps): JSX.Element => <MuiTabs {...props} sx={{ minHeight: spacing[12], "& .MuiTabs-indicator": { bgcolor: colors.primary.gold }, "& .MuiTab-root": { color: colors.neutral.gray300, minHeight: spacing[12], minWidth: spacing[12], "&.Mui-selected": { color: colors.primary.goldLight }, "&:focus-visible": { outline: `3px solid ${colors.alpha.goldFocus}` } }, ...props.sx }}>{items.map((item) => <Tab key={item.value} label={item.label} value={item.value} />)}</MuiTabs>;
