import type { ThemeOptions } from "@mui/material/styles";
import { palette } from "./palette";

export const componentOverrides: ThemeOptions["components"] = {
  MuiCssBaseline: {
    styleOverrides: {
      body: {
        backgroundColor: palette.appBackground,
        color: palette.textPrimary,
        overflowX: "hidden",
      },
    },
  },
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: palette.radiusSm,
        boxShadow: "none",
        textTransform: "none",
        fontWeight: 900,
        minHeight: palette.controlHeight,
        paddingInline: 20,
        transition: "background-color 150ms ease, border-color 150ms ease, color 150ms ease, transform 150ms ease, box-shadow 150ms ease",
        "&:focus-visible": {
          outline: "none",
          boxShadow: palette.shadowAccent,
        },
      },
      containedPrimary: {
        backgroundColor: palette.primaryGold,
        color: palette.black,
        boxShadow: palette.shadowAccent,
        "&:hover": {
          backgroundColor: palette.primaryGoldHover,
          boxShadow: palette.shadowAccentStrong,
          transform: "translateY(-1px)",
        },
        "&.Mui-disabled": {
          backgroundColor: palette.surface,
          color: palette.textMuted,
          boxShadow: "none",
        },
      },
      outlined: {
        borderColor: palette.borderDefault,
        color: palette.textSecondary,
        backgroundColor: "transparent",
        "&:hover": {
          borderColor: palette.borderAccent,
          backgroundColor: "rgba(17, 17, 17, 0.88)",
          color: palette.textPrimary,
        },
      },
      text: {
        color: palette.textSecondary,
        "&:hover": {
          backgroundColor: "rgba(17, 17, 17, 0.88)",
          color: palette.textPrimary,
        },
      },
    },
  },
  MuiCard: {
    styleOverrides: {
      root: {
        backgroundColor: palette.surfaceSection,
        borderRadius: palette.radiusMd,
        border: `1px solid ${palette.borderDefault}`,
        boxShadow: palette.shadowCard,
        backdropFilter: "blur(12px)",
        transition: "box-shadow 150ms ease, transform 150ms ease, border-color 150ms ease, background-color 150ms ease",
      },
    },
  },
  MuiCardContent: {
    styleOverrides: {
      root: {
        padding: palette.cardPadding,
        "&:last-child": {
          paddingBottom: palette.cardPadding,
        },
      },
    },
  },
  MuiTextField: {
    defaultProps: {
      size: "medium",
      variant: "outlined",
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: {
        borderRadius: palette.radiusSm,
        backgroundColor: palette.inputBackground,
        minHeight: palette.controlHeight,
        fontWeight: 700,
        color: palette.textPrimary,
        transition: "border-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease",
        "& .MuiOutlinedInput-notchedOutline": {
          borderColor: palette.borderDefault,
        },
        "&:hover .MuiOutlinedInput-notchedOutline": {
          borderColor: palette.borderAccent,
        },
        "&.Mui-focused": {
          boxShadow: palette.shadowAccent,
        },
        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
          borderColor: palette.primaryGold,
        },
        "&.Mui-disabled": {
          backgroundColor: "rgba(17, 17, 17, 0.55)",
          color: palette.textMuted,
        },
      },
      input: {
        color: palette.textPrimary,
        fontWeight: 700,
        paddingBlock: 12,
        "&::placeholder": {
          color: palette.textMuted,
          opacity: 1,
        },
      },
    },
  },
  MuiInputLabel: {
    styleOverrides: {
      root: {
        color: palette.textMuted,
        fontWeight: 700,
        "&.Mui-focused": {
          color: palette.primaryGold,
        },
      },
    },
  },
  MuiAutocomplete: {
    styleOverrides: {
      paper: {
        borderRadius: palette.radiusMd,
        border: `1px solid ${palette.borderDefault}`,
        backgroundColor: palette.surface,
        boxShadow: palette.shadowPanel,
      },
      option: {
        color: palette.textPrimary,
        "&[aria-selected='true']": {
          backgroundColor: palette.primaryGoldMuted,
          color: palette.textPrimary,
        },
      },
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: palette.radiusLg,
        border: `1px solid ${palette.borderDefault}`,
        backgroundColor: palette.surfaceRaised,
        boxShadow: palette.shadowPanel,
        backdropFilter: "blur(12px)",
      },
    },
  },
  MuiDialogTitle: {
    styleOverrides: {
      root: {
        fontWeight: 900,
        letterSpacing: "-0.02em",
        borderBottom: `1px solid ${palette.borderDefault}`,
      },
    },
  },
  MuiDialogActions: {
    styleOverrides: {
      root: {
        padding: 16,
        borderTop: `1px solid ${palette.borderDefault}`,
      },
    },
  },
  MuiAppBar: {
    styleOverrides: {
      root: {
        backgroundColor: palette.surfaceRaised,
        backgroundImage: "none",
        boxShadow: `0 10px 30px rgba(0, 0, 0, 0.45)`,
        backdropFilter: "blur(12px)",
      },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: 999,
        fontWeight: 900,
      },
      outlined: {
        borderColor: palette.borderDefault,
        color: palette.textSecondary,
        backgroundColor: "rgba(0, 0, 0, 0.3)",
      },
      filledPrimary: {
        backgroundColor: palette.primaryGoldMuted,
        color: palette.primaryGold,
        border: `1px solid ${palette.borderAccent}`,
      },
    },
  },
  MuiList: {
    styleOverrides: {
      root: {
        backgroundColor: "transparent",
      },
    },
  },
};
