const DAY_MS = 86_400_000;
const FUTURE_CLOCK_SKEW_MS = 5 * 60_000;
// Bounded production audit: legitimate-looking records reached 1,612 days from
// createdAt; known-corrupt 2019 records were 2,450–2,502 days apart.
const MAX_CREATED_AT_DISCREPANCY_MS = 1_700 * DAY_MS;

const timestampToDate = (value: unknown): Date | null => {
  const timestampDate = (value as { toDate?: () => unknown } | null)?.toDate?.();
  if (timestampDate instanceof Date && !Number.isNaN(timestampDate.getTime())) return timestampDate;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  return null;
};

const parseMetadataDate = (value: unknown): Date | null => {
  const timestampDate = timestampToDate(value);
  if (timestampDate) return timestampDate;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1_000_000_000_000) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isStrictDateOnly = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);
const isStrictIsoTimestamp = (value: string): boolean => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value);

export const parseWorkoutDate = (value: unknown): Date | null => {
  const timestampDate = timestampToDate(value);
  if (timestampDate) return timestampDate;
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!isStrictDateOnly(text) && !isStrictIsoTimestamp(text)) return null;
  const date = new Date(isStrictDateOnly(text) ? `${text}T00:00:00.000Z` : text);
  if (Number.isNaN(date.getTime())) return null;
  if (isStrictDateOnly(text) && date.toISOString().slice(0, 10) !== text) return null;
  return date;
};

export const validateWorkoutDate = (workoutDate: Date | null, createdAt: unknown, nowAt = new Date()): Date | null => {
  if (!workoutDate || workoutDate.getTime() > nowAt.getTime() + FUTURE_CLOCK_SKEW_MS) return null;
  const createdDate = parseMetadataDate(createdAt);
  if (createdDate && Math.abs(workoutDate.getTime() - createdDate.getTime()) > MAX_CREATED_AT_DISCREPANCY_MS) return null;
  return workoutDate;
};
