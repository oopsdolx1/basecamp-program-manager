import type { ProfileId } from "../../../types/brandedIds";
import type { MemberSelectionItem } from "../../members/types/memberViewModel.types";

export interface MemberProfile {
  id: ProfileId;
  name: string;
  gender?: string;
  age?: number;
  height?: number;
  weight?: number;
  goal?: string;
  memo?: string;
  phone?: string;
  status?: string;
}

export interface MemberProvider {
  listMembers: () => Promise<MemberSelectionItem[]>;
  getMemberProfile: (memberId: ProfileId) => Promise<MemberProfile | null>;
}
