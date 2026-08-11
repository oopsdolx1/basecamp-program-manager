import type { MemberSelectionItem } from "../types/memberViewModel.types";

export const KOREAN_INITIALS = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"] as const;
export type KoreanInitial = typeof KOREAN_INITIALS[number];
export type MemberInitialFilter = "ALL" | KoreanInitial | "OTHER";

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const INITIAL_STRIDE = 21 * 28;
const unicodeInitials = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"] as const;
const groupedInitials: Record<string, KoreanInitial> = { ㄲ: "ㄱ", ㄸ: "ㄷ", ㅃ: "ㅂ", ㅆ: "ㅅ", ㅉ: "ㅈ" };

export const getKoreanInitial = (name: string): KoreanInitial | "OTHER" => {
  const first = name.trim().codePointAt(0);
  if (first === undefined || first < HANGUL_BASE || first > HANGUL_END) return "OTHER";
  const initial = unicodeInitials[Math.floor((first - HANGUL_BASE) / INITIAL_STRIDE)];
  return groupedInitials[initial] ?? initial;
};

export const filterMembersByInitial = (
  members: MemberSelectionItem[],
  initial: MemberInitialFilter,
): MemberSelectionItem[] => initial === "ALL"
  ? members
  : members.filter((member) => getKoreanInitial(member.displayName) === initial);
