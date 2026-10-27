import type { WorkoutSessionRecord, WorkoutSessionStatus } from "../domain/workoutSession.types";

export type WorkoutHistoryPeriod = "month" | "quarter" | "all";

const recordedStatuses = new Set<WorkoutSessionStatus>([
  "printed",
  "ocr_pending",
  "ocr_completed",
  "ai_completed",
  "confirmed",
]);

/** A session becomes a kiosk history record only after a physical print was persisted. */
export const isRecordedWorkoutSession = (record: WorkoutSessionRecord): boolean => recordedStatuses.has(record.status);

export const workoutHistoryDate = (record: WorkoutSessionRecord): Date =>
  record.lastPrintedAt ?? record.printedAt ?? record.updatedAt;

const periodStart = (period: WorkoutHistoryPeriod, now: Date): Date | null => {
  if (period === "all") return null;
  const start = new Date(now);
  start.setMonth(start.getMonth() - (period === "month" ? 1 : 3));
  return start;
};

export const filterWorkoutHistory = (
  records: WorkoutSessionRecord[],
  { period, search, now = new Date() }: { period: WorkoutHistoryPeriod; search: string; now?: Date },
): WorkoutSessionRecord[] => {
  const start = periodStart(period, now);
  const normalizedSearch = search.trim().toLocaleLowerCase();

  return records
    .filter(isRecordedWorkoutSession)
    .filter((record) => !start || workoutHistoryDate(record) >= start)
    .filter((record) => {
      if (!normalizedSearch) return true;
      return `${record.memberSnapshot.name} ${record.programSnapshot.title} ${record.sessionId}`
        .toLocaleLowerCase()
        .includes(normalizedSearch);
    })
    .sort((left, right) => workoutHistoryDate(right).getTime() - workoutHistoryDate(left).getTime());
};
