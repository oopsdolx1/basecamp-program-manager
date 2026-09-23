import type { Program } from "../../programs/types/program.types";
import type { ProgramId } from "../../../types/brandedIds";
import type { WorkoutSessionRecord } from "../../workout-sessions/domain/workoutSession.types";
import { createSnapshotProgramId } from "./printSnapshotSession";
import { normalizeWorkoutSource } from "../../workout-sessions/services/workoutSessionSourceResolver";

type PrintPreviewSessionContext = Pick<WorkoutSessionRecord, "memberId" | "programId" | "prescription">;

export const assertPrintPreviewSessionContext = (session: PrintPreviewSessionContext, memberId: string, routeProgramId?: string): void => {
  if (session.memberId !== memberId) throw new Error("Workout Session의 회원이 Preview와 일치하지 않습니다.");
  const sessionSource = normalizeWorkoutSource(session as WorkoutSessionRecord);
  const prescription = session.prescription;
  if (!prescription) { if (sessionSource.type !== "program") throw new Error("Manual Workout Session에는 Prescription이 필요합니다."); if (routeProgramId && sessionSource.programId !== routeProgramId) throw new Error("Workout Session의 프로그램이 Preview와 일치하지 않습니다."); return; }
  const prescriptionSource = normalizeWorkoutSource({ programId: prescription.sourceProgramId, source: prescription.source, prescription } as WorkoutSessionRecord);
  if (sessionSource.type !== prescriptionSource.type) throw new Error("Workout Session의 원본 프로그램 정보가 일치하지 않습니다.");
  if (sessionSource.type === "program" && prescriptionSource.type === "program" && sessionSource.programId !== prescriptionSource.programId) throw new Error("Workout Session의 원본 프로그램 정보가 일치하지 않습니다.");
  if (sessionSource.type === "program" && routeProgramId && routeProgramId !== sessionSource.programId && routeProgramId !== createSnapshotProgramId(sessionSource.programId)) throw new Error("Workout Session의 프로그램이 Preview와 일치하지 않습니다.");
};
export const programFromSessionPrescription = (session: WorkoutSessionRecord): Program => {
  const prescription = session.prescription;
  if (!prescription) throw new Error("Prescription이 없습니다.");
  const source = normalizeWorkoutSource(session);
  const transientId = source.type === "program" ? source.programId : session.sessionId;
  return { id: transientId as ProgramId, title: prescription.sourceProgramName, schemaVersion: 1, category: "CUSTOM", difficulty: "GENERAL", memo: "", exercises: prescription.exercises.map((exercise, index) => ({ id: exercise.programExerciseId, name: exercise.name, displayName: exercise.name, catalogExerciseId: exercise.exerciseId, order: exercise.order ?? index + 1, sets: exercise.plannedSets ?? 1, memo: exercise.memo })).sort((a, b) => a.order - b.order), createdAt: new Date(), updatedAt: new Date(), usageCount: 0, favorite: false, isArchived: false };
};

export const resolvePrintPreviewSource = async (session: WorkoutSessionRecord, resolveLegacyProgram: () => Promise<Program>): Promise<Program> =>
  session.prescription ? programFromSessionPrescription(session) : resolveLegacyProgram();
