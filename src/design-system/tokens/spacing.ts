export const spacing = Object.freeze({ 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64, 24: 96 } as const);
export type SpacingToken = keyof typeof spacing;
