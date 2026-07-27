import type { ThemeOptions } from "@mui/material/styles";
import { palette } from "./palette";

export const componentOverrides: ThemeOptions["components"] = {
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: 12,
        boxShadow: "none",
        textTransform: "none",
        fontWeight: 700,
        minHeight: 40,
        transition: "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
        "&:focus-visible": {
          outline: "none",
          boxShadow: `0 0 0 2px ${palette.primaryGold}`,
        },
      },
    },
  },
  MuiCard: {
    styleOverrides: {
      root: {
        backgroundColor: "rgba(15, 23, 42, 0.72)",
        borderRadius: 24,
        border: `1px solid ${palette.border}`,
        boxShadow: "0 18px 42px rgba(0, 0, 0, 0.22)",
        transition: "box-shadow 150ms ease, transform 150ms ease, border-color 150ms ease, background-color 150ms ease",
      },
    },
  },
  MuiTextField: {
    defaultProps: {
      size: "small",
    },
    styleOverrides: {
      root: {
        "& .MuiOutlinedInput-root": {
          borderRadius: 12,
          backgroundColor: "rgba(2, 6, 23, 0.6)",
          fontWeight: 800,
        },
      },
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: 18,
      },
    },
  },
  MuiAppBar: {
    styleOverrides: {
      root: {
        backgroundImage: "none",
        boxShadow: "none",
      },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: 999,
        fontWeight: 900,
      },
    },
  },
};
