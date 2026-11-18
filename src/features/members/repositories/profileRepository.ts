import { getDefaultKioskMemberSessionRuntime } from "../../kiosk-session/defaultKioskMemberSession";
import { withKioskMemberSession } from "../../kiosk-session/kioskSessionRenewal";
import { toProfileId, type AppId, type ProfileId } from "../../../types/brandedIds";
import type { RepositoryError } from "../../../types/common.types";
import { mapProfileDocument, toMemberSelectionItem } from "../mappers/profileMapper";
import { sortMembersByName } from "../services/memberService";
import type { MemberReadDiagnostics, MemberSelectionItem } from "../types/memberViewModel.types";
import type { RawProfileDocument } from "../types/profile.types";

export interface SubscribeMembersParams {
  appId: AppId;
}

export interface SubscribeMembersResult {
  members: MemberSelectionItem[];
  diagnostics: MemberReadDiagnostics;
}

export interface SubscribeMembersCallbacks {
  next: (result: SubscribeMembersResult) => void;
  error: (error: RepositoryError) => void;
}

const emptyDiagnostics = (): MemberReadDiagnostics => ({
  totalDocuments: 0,
  memberDocuments: 0,
  excludedByRole: 0,
  missingRole: 0,
  missingName: 0,
  idMismatches: 0,
  legacyContactFallbacks: 0,
  legacyNoteFallbacks: 0,
});

const mapDirectory = (directory: Array<{ memberId: string; name: string }>): SubscribeMembersResult => {
  const diagnostics = emptyDiagnostics();
  const members = directory.map(({ memberId, name }) => {
    diagnostics.totalDocuments += 1;
    diagnostics.memberDocuments += 1;
    return {
      memberId: toProfileId(memberId),
      displayName: name,
      searchText: name.normalize("NFKC").toLocaleLowerCase("ko-KR"),
    } satisfies MemberSelectionItem;
  });

  return {
    diagnostics,
    members: sortMembersByName(members),
  };
};

export const subscribeMembers = (
  params: SubscribeMembersParams,
  callbacks: SubscribeMembersCallbacks,
): (() => void) => {
  // The API intentionally returns only the device-scoped member directory; raw
  // profile documents remain server-side. This read has no Client SDK fallback.
  void params;
  let active = true;
  const runtime = getDefaultKioskMemberSessionRuntime();
  if (!runtime) {
    callbacks.error({ userMessage: "회원 목록을 읽지 못했습니다. 키오스크 API 설정을 확인해 주세요.", developerMessage: "KIOSK_API_NOT_CONFIGURED" });
    return () => undefined;
  }
  void runtime.client.listMembers()
    .then((directory) => { if (active) callbacks.next(mapDirectory(directory)); })
    .catch((error: unknown) => {
      if (!active) return;
      callbacks.error({ userMessage: "회원 목록을 읽지 못했습니다. 키오스크 연결과 기기 등록을 확인해 주세요.", developerMessage: error instanceof Error ? error.message : "KIOSK_MEMBER_DIRECTORY_FAILED" });
    });
  return () => { active = false; };
};

export const getMemberById = async (
  appId: AppId,
  memberId: ProfileId,
): Promise<MemberSelectionItem | null> => {
  // Kiosk print preview is reached after member selection, so it must keep
  // using that member's server-scoped session instead of reading raw profile
  // data through the Firestore Client SDK.
  void appId;
  const runtime = getDefaultKioskMemberSessionRuntime();
  if (!runtime) throw new Error("키오스크 API가 설정되지 않았습니다.");
  const raw = await withKioskMemberSession(runtime.sessions, String(memberId), (token) => runtime.client.readProfile(token));
  // The session profile intentionally omits the display name. Resolve that
  // already-selected member from the device-only directory rather than
  // broadening the sensitive profile projection.
  const directory = await runtime.client.listMembers();
  const selected = directory.find((item) => item.memberId === String(memberId));
  if (!selected) return null;
  const profile = mapProfileDocument(String(memberId), { ...raw, name: selected.name } as RawProfileDocument);
  if ((profile.role && profile.role !== "member") || !profile.name) {
    return null;
  }

  return toMemberSelectionItem(profile);
};
