import type { ThemeOptions } from "@mui/material/styles";

export const typography: ThemeOptions["typography"] = {
  fontFamily: '"Pretendard", "Inter", "Noto Sans KR", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  h1: {
    fontSize: "1.875rem",
    fontWeight: 900,
    letterSpacing: "-0.03em",
    lineHeight: 1.1,
  },
  h2: {
    fontSize: "1.5rem",
    fontWeight: 900,
    letterSpacing: "-0.02em",
    lineHeight: 1.15,
  },
  h3: {
    fontSize: "1.125rem",
    fontWeight: 900,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  body1: {
    fontSize: "1rem",
    fontWeight: 500,
    lineHeight: 1.6,
    letterSpacing: 0,
  },
  body2: {
    fontSize: "0.875rem",
    fontWeight: 700,
    lineHeight: 1.5,
    letterSpacing: 0,
  },
  caption: {
    fontSize: "0.75rem",
    fontWeight: 700,
    lineHeight: 1.4,
    letterSpacing: 0,
  },
  button: {
    fontSize: "0.95rem",
    letterSpacing: 0,
    fontWeight: 900,
    lineHeight: 1.2,
  },
  subtitle1: {
    fontSize: "1rem",
    fontWeight: 900,
    lineHeight: 1.3,
    letterSpacing: "-0.01em",
  },
  subtitle2: {
    fontSize: "0.875rem",
    fontWeight: 700,
    lineHeight: 1.4,
    letterSpacing: 0,
  },
};
