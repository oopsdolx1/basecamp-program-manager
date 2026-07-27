import type { ThemeOptions } from "@mui/material/styles";

export const typography: ThemeOptions["typography"] = {
  fontFamily:
    '"Pretendard", "Noto Sans KR", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  h1: { fontSize: "1.875rem", fontWeight: 950, letterSpacing: "-0.03em" },
  h2: { fontSize: "1.25rem", fontWeight: 950, letterSpacing: "-0.02em" },
  h3: { fontSize: "1.1rem", fontWeight: 900, letterSpacing: "-0.02em" },
  body1: { letterSpacing: 0 },
  body2: { fontWeight: 700, letterSpacing: 0 },
  button: { letterSpacing: 0, fontWeight: 900 },
};
