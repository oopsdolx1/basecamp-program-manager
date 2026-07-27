import type { ProfileId } from "../../../types/brandedIds";

export interface RawProfileDocument {
  id?: unknown;
  name?: unknown;
  role?: unknown;
  phone?: unknown;
  contact?: unknown;
  memo?: unknown;
  note?: unknown;
  centerId?: unknown;
  trainerId?: unknown;
  status?: unknown;
}

export interface ProfileMappingWarning {
  code: "id-mismatch" | "missing-name" | "missing-role";
  profileId: ProfileId;
}

export interface ProfileView {
  profileId: ProfileId;
  name: string;
  role?: string;
  phone?: string;
  memo?: string;
  centerId?: string;
  trainerId?: string;
  status?: string;
  warnings: ProfileMappingWarning[];
  legacyAliases: Array<"contact" | "note">;
}
