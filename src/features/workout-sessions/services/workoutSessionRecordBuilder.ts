import { PRINT_FORMAT, PRINT_TEMPLATE_KEY, PRINT_TEMPLATE_VERSION } from "../../printing/constants/print.constants";
import type { CreateWorkoutSessionInput, WorkoutSessionRecord } from "../domain/workoutSession.types";

export const buildWorkoutSessionRecord = (
  input: CreateWorkoutSessionInput,
  trainerId: string,
  sessionId: string,
): Omit<WorkoutSessionRecord, "createdAt" | "updatedAt" | "printedAt" | "lastPrintedAt"> => {
  const exercises = [...input.exercises].sort((left, right) => left.order - right.order);
  return {
    sessionId,
    schemaVersion: 1,
    memberId: input.memberId,
    programId: input.programId,
    trainerId,
    status: "created",
    exerciseIds: exercises.map((exercise) => exercise.exerciseId),
    memberSnapshot: { name: input.memberName },
    programSnapshot: { title: input.programTitle },
    exercises,
    prescription: { sourceProgramId: input.programId, sourceProgramName: input.programTitle, exercises },
    print: {
      format: PRINT_FORMAT,
      templateKey: PRINT_TEMPLATE_KEY,
      templateVersion: PRINT_TEMPLATE_VERSION,
      printHistoryId: null,
      historyIds: [],
      copyCount: 0,
    },
  };
};
