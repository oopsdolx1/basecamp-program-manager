import { normalizeDigits, normalizeSearchText } from "../../../utils/normalizeText";
import { toProfileId } from "../../../types/brandedIds";
import type { MemberSelectionItem } from "../types/memberViewModel.types";
import type { ProfileMappingWarning, ProfileView, RawProfileDocument } from "../types/profile.types";

const asText = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

export const mapProfileDocument = (documentId: string, raw: RawProfileDocument): ProfileView => {
  const profileId = toProfileId(documentId);
  const warnings: ProfileMappingWarning[] = [];
  const legacyAliases: ProfileView["legacyAliases"] = [];
  const rawId = asText(raw.id);
  const name = asText(raw.name);
  const role = asText(raw.role);
  const phone = asText(raw.phone) ?? asText(raw.contact);
  const memo = asText(raw.memo) ?? asText(raw.note);

  if (rawId && rawId !== documentId) {
    warnings.push({ code: "id-mismatch", profileId });
  }

  if (!name) {
    warnings.push({ code: "missing-name", profileId });
  }

  if (!role) {
    warnings.push({ code: "missing-role", profileId });
  }

  if (!asText(raw.phone) && asText(raw.contact)) {
    legacyAliases.push("contact");
  }

  if (!asText(raw.memo) && asText(raw.note)) {
    legacyAliases.push("note");
  }

  return {
    profileId,
    name: name ?? "",
    role,
    phone,
    memo,
    centerId: asText(raw.centerId),
    trainerId: asText(raw.trainerId),
    status: asText(raw.status),
    warnings,
    legacyAliases,
  };
};

export const toMemberSelectionItem = (profile: ProfileView): MemberSelectionItem => ({
  memberId: profile.profileId,
  displayName: profile.name,
  phone: profile.phone,
  status: profile.status,
  centerId: profile.centerId,
  trainerId: profile.trainerId,
  searchText: normalizeSearchText([profile.name, profile.phone, normalizeDigits(profile.phone ?? "")]),
});
