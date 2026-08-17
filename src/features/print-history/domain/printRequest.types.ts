import type { AppId } from "../../../types/brandedIds";
import type { ProgramCategory, ProgramDifficulty } from "../../programs/types/program.types";

export type TemplateApprovalStatus = "provisional" | "approved";
export type PrintRequestSource = "quick-print";

export interface PrintRequestMemberSnapshot {
  memberId: string;
  name: string;
}

export interface PrintRequestExerciseSnapshot {
  id: string;
  name: string;
  memo: string;
  order: number;
  configuredSets: number | null;
}

export interface PrintRequestProgramSnapshot {
  programId: string;
  title: string;
  category: ProgramCategory;
  categoryLabel: string;
  difficulty: ProgramDifficulty;
  difficultyLabel: string;
  memo: string;
  exercises: PrintRequestExerciseSnapshot[];
}

export interface PrintRequestTemplateSnapshot {
  templateKey: "basecamp-workout-log-v1";
  templateVersion: 1;
  format: "A5-portrait" | "A5-landscape";
  approvalStatus: TemplateApprovalStatus;
  exerciseRowCount: 8;
  setColumnCount: 5;
}

export interface PrintRequestRecord {
  id: string;
  schemaVersion: 1;
  requestedAt: Date;
  requestedBy: string | null;
  requestSource: PrintRequestSource;
  status: "printed";
  workoutSessionId: string;
  printedAt: Date;
  printedBy: string | null;
  printer: string;
  copy: number;
  memberId: string;
  programId: string;
  memberSnapshot: PrintRequestMemberSnapshot;
  programSnapshot: PrintRequestProgramSnapshot;
  template: PrintRequestTemplateSnapshot;
  createdAt: Date;
  createdBy: string | null;
  isArchived: boolean;
}

export interface CreatePrintRequestInput {
  appId: AppId;
  requestedBy: string;
  workoutSessionId: string;
  printer: string;
  copy: number;
  memberSnapshot: PrintRequestMemberSnapshot;
  programSnapshot: PrintRequestProgramSnapshot;
  template: PrintRequestTemplateSnapshot;
}

export interface PrintRequestQueryOptions {
  appId: AppId;
  memberId?: string;
  programId?: string;
  category?: ProgramCategory | "ALL";
  search?: string;
  limit?: number;
}
