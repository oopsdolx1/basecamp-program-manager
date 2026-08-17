export const colors = Object.freeze({
  primary: { gold: "#D9C54B", goldLight: "#E8D77A", goldDark: "#C1A53A", goldDeep: "#8E6A1F" },
  neutral: {
    black: "#0D0D0D", gray900: "#141414", gray800: "#1F1F1F", gray700: "#2A2A2A",
    gray600: "#303035", gray400: "#7A7A7A", gray300: "#9A9A9D", gray100: "#E6E6E6", white: "#FFFFFF",
  },
  semantic: { success: "#22C55E", info: "#3B82F6", warning: "#F59E0B", error: "#EF4444" },
  accent: { default: "#7A4DE8", ai: "#18A999" },
  alpha: {
    goldFocus: "rgba(217, 197, 75, 0.45)", goldMuted: "rgba(217, 197, 75, 0.14)",
    successMuted: "rgba(34, 197, 94, 0.14)", infoMuted: "rgba(59, 130, 246, 0.14)",
    warningMuted: "rgba(245, 158, 11, 0.14)", errorMuted: "rgba(239, 68, 68, 0.14)", aiMuted: "rgba(24, 169, 153, 0.14)",
  },
} as const);

export type BaseCampColors = typeof colors;
