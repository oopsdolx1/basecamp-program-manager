export const normalizeText = (value: string): string =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");

export const normalizeDigits = (value: string): string => value.replace(/\D/g, "");

export const normalizeSearchText = (parts: Array<string | undefined>): string =>
  normalizeText(parts.filter(Boolean).join(" "));
