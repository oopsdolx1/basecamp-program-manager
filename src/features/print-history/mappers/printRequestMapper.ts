import { Timestamp, type DocumentData } from "firebase/firestore";
import {
  PRINT_EXERCISE_ROW_COUNT,
  PRINT_FORMAT,
  PRINT_SET_COLUMN_COUNT,
  PRINT_TEMPLATE_APPROVAL_STATUS,
  PRINT_TEMPLATE_KEY,
  PRINT_TEMPLATE_VERSION,
} from "../../printing/constants/print.constants";
import type { WorkoutPrintDocument } from "../../printing/types/print.types";
import type {
  PrintRequestRecord,
  PrintRequestTemplateSnapshot,
} from "../domain/printRequest.types";

const asDate = (value: unknown): Date => (value instanceof Timestamp ? value.toDate() : new Date(0));

export const createTemplateSnapshot = (): PrintRequestTemplateSnapshot => ({
  templateKey: PRINT_TEMPLATE_KEY,
  templateVersion: PRINT_TEMPLATE_VERSION,
  format: PRINT_FORMAT,
  approvalStatus: PRINT_TEMPLATE_APPROVAL_STATUS,
  exerciseRowCount: PRINT_EXERCISE_ROW_COUNT,
  setColumnCount: PRINT_SET_COLUMN_COUNT,
});

export const printDocumentToRequestSnapshots = (document: WorkoutPrintDocument) => ({
  memberSnapshot: {
    memberId: document.member.memberId,
    name: document.member.name,
  },
  programSnapshot: {
    programId: document.program.programId,
    title: document.program.title,
    category: document.program.category,
    categoryLabel: document.program.categoryLabel,
    difficulty: document.program.difficulty,
    difficultyLabel: document.program.difficultyLabel,
    memo: document.program.memo,
    exercises: document.program.exercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      memo: exercise.memo,
      order: exercise.order,
      configuredSets: exercise.configuredSets,
    })),
  },
  template: createTemplateSnapshot(),
});

export const mapPrintRequestDocument = (id: string, data: DocumentData): PrintRequestRecord => ({
  id,
  schemaVersion: 1,
  requestedAt: asDate(data.requestedAt),
  requestedBy: typeof data.requestedBy === "string" ? data.requestedBy : null,
  requestSource: "quick-print",
  status: "printed",
  workoutSessionId: String(data.workoutSessionId ?? ""),
  printedAt: asDate(data.printedAt ?? data.requestedAt),
  printedBy: typeof data.printedBy === "string" ? data.printedBy : typeof data.requestedBy === "string" ? data.requestedBy : null,
  printer: typeof data.printer === "string" ? data.printer : "unknown",
  copy: typeof data.copy === "number" && data.copy > 0 ? data.copy : 1,
  memberId: String(data.memberId ?? ""),
  programId: String(data.programId ?? ""),
  memberSnapshot: data.memberSnapshot,
  programSnapshot: data.programSnapshot,
  template: data.template,
  createdAt: asDate(data.createdAt),
  createdBy: typeof data.createdBy === "string" ? data.createdBy : null,
  isArchived: data.isArchived === true,
});
