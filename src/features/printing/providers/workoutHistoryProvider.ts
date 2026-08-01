import type { ProfileId } from "../../../types/brandedIds";
import type { ProgramCategory } from "../../programs/types/program.types";

export interface WorkoutHistoryExercise {
  name: string;
  sets: number | null;
  reps?: string;
  weight?: number;
}

export interface WorkoutHistoryRecord {
  memberId: ProfileId;
  programId: string;
  programTitle: string;
  category: ProgramCategory | null;
  workoutDate: Date;
  durationMinutes?: number;
  completion?: boolean;
  exercises: WorkoutHistoryExercise[];
}

export interface WorkoutHistoryProvider {
  getRecentWorkoutHistory: (memberId: ProfileId, limit?: number) => Promise<WorkoutHistoryRecord[]>;
}
