export const motion = Object.freeze({
  duration: { fast: 120, normal: 180, slow: 240 },
  easing: { standard: "cubic-bezier(0.2, 0, 0, 1)", emphasized: "cubic-bezier(0.2, 0, 0, 1.2)" },
  transition: "background-color 180ms cubic-bezier(0.2, 0, 0, 1), border-color 180ms cubic-bezier(0.2, 0, 0, 1), color 180ms cubic-bezier(0.2, 0, 0, 1), transform 120ms cubic-bezier(0.2, 0, 0, 1)",
} as const);
