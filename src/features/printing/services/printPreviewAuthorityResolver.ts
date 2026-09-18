import type { Program } from "../../programs/types/program.types";
import type { ProgramId } from "../../../types/brandedIds";
import type { WorkoutSessionRecord } from "../../workout-sessions/domain/workoutSession.types";

export const programFromSessionPrescription = (session: WorkoutSessionRecord): Program => {
  const prescription = session.prescription;
  if (!prescription) throw new Error("Prescription이 없습니다.");
  return { id: prescription.sourceProgramId as ProgramId, title: prescription.sourceProgramName, schemaVersion: 1, category: "CUSTOM", difficulty: "GENERAL", memo: "", exercises: prescription.exercises.map((exercise, index) => ({ id: exercise.programExerciseId, name: exercise.name, displayName: exercise.name, catalogExerciseId: exercise.exerciseId, order: exercise.order ?? index + 1, sets: exercise.plannedSets ?? 1, memo: exercise.memo })).sort((a, b) => a.order - b.order), createdAt: new Date(), updatedAt: new Date(), usageCount: 0, favorite: false, isArchived: false };
};

export const resolvePrintPreviewSource = async (session: WorkoutSessionRecord, resolveLegacyProgram: () => Promise<Program>): Promise<Program> =>
  session.prescription ? programFromSessionPrescription(session) : resolveLegacyProgram();
