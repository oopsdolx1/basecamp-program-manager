import { collection, doc, getDoc, onSnapshot, type FirestoreError, type QuerySnapshot } from "firebase/firestore";
import { profilesCollectionPath } from "../../../firebase/firestorePaths";
import { getFirestoreClient } from "../../../firebase/firestoreClient";
import { getDefaultKioskMemberSessionRuntime } from "../../kiosk-session/defaultKioskMemberSession";
import { withKioskMemberSession } from "../../kiosk-session/kioskSessionRenewal";
import type { AppId, ProfileId } from "../../../types/brandedIds";
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

const toRepositoryError = (error: FirestoreError): RepositoryError => ({
  userMessage: "회원 목록을 읽지 못했습니다. Firebase 연결과 권한을 확인해 주세요.",
  developerMessage: `${error.code}: ${error.message}`,
});

const mapSnapshot = (snapshot: QuerySnapshot): SubscribeMembersResult => {
  const diagnostics = emptyDiagnostics();
  const members: MemberSelectionItem[] = [];

  snapshot.forEach((documentSnapshot) => {
    diagnostics.totalDocuments += 1;

    const profile = mapProfileDocument(
      documentSnapshot.id,
      documentSnapshot.data() as RawProfileDocument,
    );

    if (!profile.role) {
      diagnostics.missingRole += 1;
    }

    if (!profile.name) {
      diagnostics.missingName += 1;
    }

    if (profile.warnings.some((warning) => warning.code === "id-mismatch")) {
      diagnostics.idMismatches += 1;
    }

    if (profile.legacyAliases.includes("contact")) {
      diagnostics.legacyContactFallbacks += 1;
    }

    if (profile.legacyAliases.includes("note")) {
      diagnostics.legacyNoteFallbacks += 1;
    }

    // Condition Lab treats missing role as a legacy member; explicit non-member roles stay hidden.
    if (profile.role && profile.role !== "member") {
      diagnostics.excludedByRole += 1;
      return;
    }

    if (!profile.name) {
      return;
    }

    diagnostics.memberDocuments += 1;
    members.push(toMemberSelectionItem(profile));
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
  const firestore = getFirestoreClient();
  const collectionRef = collection(firestore, profilesCollectionPath(params.appId));

  return onSnapshot(
    collectionRef,
    (snapshot) => callbacks.next(mapSnapshot(snapshot)),
    (error) => callbacks.error(toRepositoryError(error)),
  );
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
