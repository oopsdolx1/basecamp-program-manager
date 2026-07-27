import type { ThemeOptions } from "@mui/material/styles";

export const typography: ThemeOptions["typography"] = {
  fontFamily:
    '"Pretendard", "Noto Sans KR", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  h1: { fontSize: "1.75rem", fontWeight: 700, letterSpacing: 0 },
  h2: { fontSize: "1.35rem", fontWeight: 700, letterSpacing: 0 },
  h3: { fontSize: "1.1rem", fontWeight: 700, letterSpacing: 0 },
  body1: { letterSpacing: 0 },
  button: { letterSpacing: 0, fontWeight: 700 },
};
