import { Box, Button } from "@mui/material";
import { palette } from "../../../theme/palette";

export type MasterTab = "programs" | "history";

interface MasterTabsProps {
  value: MasterTab;
  onChange: (value: MasterTab) => void;
}

const tabs: Array<{ value: MasterTab; label: string }> = [
  { value: "programs", label: "Programs" },
  { value: "history", label: "Print History" },
];

export const MasterTabs = ({ value, onChange }: MasterTabsProps): JSX.Element => (
  <Box
    sx={{
      bgcolor: palette.surfaceSection,
      border: `1px solid ${palette.borderDefault}`,
      borderRadius: 4,
      display: "inline-flex",
      gap: 0.75,
      p: 0.75,
      boxShadow: palette.shadowCard,
    }}
  >
    {tabs.map((tab) => (
      <Button
        key={tab.value}
        variant={value === tab.value ? "contained" : "text"}
        onClick={() => onChange(tab.value)}
        sx={{
          color: value === tab.value ? "primary.contrastText" : "text.secondary",
          minWidth: 132,
          "&:hover": {
            color: value === tab.value ? "primary.contrastText" : "text.primary",
          },
        }}
      >
        {tab.label}
      </Button>
    ))}
  </Box>
);
