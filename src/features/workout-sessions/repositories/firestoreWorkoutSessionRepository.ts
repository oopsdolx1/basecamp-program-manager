import { Timestamp, type DocumentData, type Unsubscribe } from "firebase/firestore";
import type { AppId } from "../../../types/brandedIds";
import type { WorkoutSessionRecord } from "../domain/workoutSession.types";
import type { ProgramCategory } from "../../programs/types/program.types";
import { getDefaultKioskMemberSessionRuntime } from "../../kiosk-session/defaultKioskMemberSession";
import { withKioskMemberSession } from "../../kiosk-session/kioskSessionRenewal";

// Firestore Timestamp (direct SDK reads) or epoch milliseconds (the Kiosk read API serializes Timestamps that way).
// Anything else keeps the existing epoch-0 fallback.
const asDate = (value: unknown): Date => {
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value);
  return new Date(0);
};
const statuses = new Set(["created", "printed", "ocr_pending", "ocr_completed", "ai_completed", "confirmed"]);
const categories = new Set<ProgramCategory>(["FULL_BODY", "CHEST", "BACK", "LOWER_BODY", "SHOULDER", "ARMS", "RECOVERY", "ETC", "CUSTOM"]);
const categoryOf = (value: unknown): ProgramCategory | undefined => typeof value === "string" && categories.has(value as ProgramCategory) ? value as ProgramCategory : undefined;
const categoriesOf = (value: unknown): ProgramCategory[] => Array.isArray(value) ? value.map(categoryOf).filter((item): item is ProgramCategory => Boolean(item)) : [];
const optionalString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized && normalized !== "undefined" && normalized !== "null" ? normalized : undefined;
};

export const mapWorkoutSessionRecord = (id: string, data: DocumentData): WorkoutSessionRecord => {
  const programId = optionalString(data.programId);
  const sourceProgramId = optionalString(data.prescription?.sourceProgramId);

  return {
    sessionId: id,
    schemaVersion: 1,
    memberId: String(data.memberId ?? ""),
    ...(programId ? { programId } : {}),
    ...(data.source ? { source: data.source } : {}),
    trainerId: String(data.trainerId ?? ""),
    status: statuses.has(data.status) ? data.status : data.status === "preview" ? "created" : "created",
    exerciseIds: Array.isArray(data.exerciseIds) ? data.exerciseIds.map(String) : [],
    memberSnapshot: data.memberSnapshot,
    programSnapshot: { title: String(data.programSnapshot?.title ?? ""), ...(categoryOf(data.programSnapshot?.category) ? { category: categoryOf(data.programSnapshot?.category) } : {}), ...(categoriesOf(data.programSnapshot?.categories).length ? { categories: categoriesOf(data.programSnapshot?.categories) } : {}) },
    exercises: Array.isArray(data.exercises) ? data.exercises : [],
    prescription: data.prescription && Array.isArray(data.prescription.exercises) ? { source: data.prescription.source, ...(sourceProgramId ? { sourceProgramId } : {}), sourceProgramName: String(data.prescription.sourceProgramName), ...(categoryOf(data.prescription.category) ? { category: categoryOf(data.prescription.category) } : {}), ...(categoriesOf(data.prescription.categories).length ? { categories: categoriesOf(data.prescription.categories) } : {}), exercises: data.prescription.exercises } : undefined,
    print: {
      format: "A5-landscape",
      templateKey: "basecamp-workout-log-v1",
      templateVersion: 1,
      printHistoryId: typeof data.print?.printHistoryId === "string" ? data.print.printHistoryId : null,
      historyIds: Array.isArray(data.print?.historyIds)
        ? data.print.historyIds.map(String)
        : typeof data.print?.printHistoryId === "string" ? [data.print.printHistoryId] : [],
      copyCount: Number.isFinite(data.print?.copyCount) ? data.print.copyCount : data.status === "printed" ? 1 : 0,
    },
    createdAt: asDate(data.createdAt),
    updatedAt: asDate(data.updatedAt),
    printedAt: data.printedAt ? asDate(data.printedAt) : null,
    lastPrintedAt: data.lastPrintedAt ? asDate(data.lastPrintedAt) : data.printedAt ? asDate(data.printedAt) : null,
  };
};

// Creation is server-only (Condition Lab `POST /v1/kiosk/workout-sessions`, see workoutSessionService.createWorkoutSession).
// Print status is recorded server-side too (POST /v1/kiosk/workout-sessions/{id}/prints, Phase 3-B).
// This repository only reads; there is intentionally no browser write here.
export const firestoreWorkoutSessionRepository = {
  async get(_appId: AppId, memberId: string, sessionId: string): Promise<WorkoutSessionRecord | null> {
    const runtime = getDefaultKioskMemberSessionRuntime();
    if (!runtime) throw new Error("키오스크 API가 설정되지 않았습니다.");
    const record = await withKioskMemberSession(runtime.sessions, memberId, (token) => runtime.client.readWorkoutSession(token, sessionId));
    return record ? mapWorkoutSessionRecord(sessionId, record) : null;
  },

  subscribe(_appId: AppId, memberId: string, callback: (records: WorkoutSessionRecord[]) => void, onError: (message: string) => void): Unsubscribe {
    let cancelled = false;
    const runtime = getDefaultKioskMemberSessionRuntime();
    if (!runtime) { onError("키오스크 API가 설정되지 않았습니다."); return () => undefined; }
    void withKioskMemberSession(runtime.sessions, memberId, (token) => runtime.client.readWorkoutSessions(token))
      .then((records) => { if (!cancelled) callback(records.map((record) => mapWorkoutSessionRecord(String(record.sessionId ?? ""), record))); })
      .catch((error: unknown) => { if (!cancelled) onError(error instanceof Error ? error.message : "read_failed"); });
    return () => { cancelled = true; };
  },
};
