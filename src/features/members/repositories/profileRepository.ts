import { collection, doc, getDoc, onSnapshot, type FirestoreError, type QuerySnapshot } from "firebase/firestore";
import { profilesCollectionPath } from "../../../firebase/firestorePaths";
import { getFirestoreClient } from "../../../firebase/firestoreClient";
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

    if (profile.role !== "member") {
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
  const firestore = getFirestoreClient();
  const snapshot = await getDoc(doc(firestore, profilesCollectionPath(appId), memberId));

  if (!snapshot.exists()) {
    return null;
  }

  const profile = mapProfileDocument(snapshot.id, snapshot.data() as RawProfileDocument);
  if (profile.role !== "member" || !profile.name) {
    return null;
  }

  return toMemberSelectionItem(profile);
};
