import type { ProgramCategory } from "../../programs/types/program.types";

export type BodyPartKey =
  | "chest"
  | "back"
  | "shoulder"
  | "biceps"
  | "triceps"
  | "core"
  | "quadriceps"
  | "hamstrings"
  | "calves"
  | "upperRecovery"
  | "lowerRecovery";

export const bodyPartLabels: Array<{ key: BodyPartKey; label: string; group: "상체" | "하체" | "회복" }> = [
  { key: "chest", label: "가슴", group: "상체" },
  { key: "back", label: "등", group: "상체" },
  { key: "shoulder", label: "어깨", group: "상체" },
  { key: "biceps", label: "이두", group: "상체" },
  { key: "triceps", label: "삼두", group: "상체" },
  { key: "core", label: "코어", group: "상체" },
  { key: "quadriceps", label: "대퇴사두", group: "하체" },
  { key: "hamstrings", label: "햄스트링", group: "하체" },
  { key: "calves", label: "종아리", group: "하체" },
  { key: "upperRecovery", label: "상체", group: "회복" },
  { key: "lowerRecovery", label: "하체", group: "회복" },
];

export const mapCategoryToBodyParts = (category: ProgramCategory): BodyPartKey[] => {
  switch (category) {
    case "CHEST":
      return ["chest"];
    case "BACK":
      return ["back"];
    case "SHOULDER":
      return ["shoulder"];
    case "ARMS":
      return ["biceps", "triceps"];
    case "LOWER_BODY":
      return ["quadriceps", "hamstrings", "calves"];
    case "FULL_BODY":
    case "RECOVERY":
    case "ETC":
    case "CUSTOM":
      return [];
  }
};
