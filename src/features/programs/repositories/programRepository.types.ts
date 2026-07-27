import type { AppId, ProgramId } from "../../../types/brandedIds";
import type { Program, ProgramFormValues } from "../types/program.types";

export interface ProgramRepository {
  getPrograms: (appId: AppId) => Promise<Program[]>;
  subscribePrograms: (appId: AppId, callback: (programs: Program[]) => void, onError: (message: string) => void) => () => void;
  getProgram: (appId: AppId, programId: ProgramId) => Promise<Program | null>;
  createProgram: (appId: AppId, values: ProgramFormValues) => Promise<ProgramId>;
  updateProgram: (appId: AppId, programId: ProgramId, values: ProgramFormValues) => Promise<void>;
  archiveProgram: (appId: AppId, programId: ProgramId) => Promise<void>;
  duplicateProgram: (appId: AppId, source: Program, title: string) => Promise<ProgramId>;
  restoreProgram: (appId: AppId, programId: ProgramId) => Promise<void>;
}
