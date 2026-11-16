import type { WorkoutTarget } from "../types/condition.types";

/** The kiosk permits up to three workout targets in a single recommendation. */
export const MAX_WORKOUT_TARGET_SELECTIONS = 3;

export type WorkoutTargetSelectionResult =
  | { targets: WorkoutTarget[]; directComposition?: boolean; message?: never }
  | { targets: WorkoutTarget[]; directComposition?: never; message: string };

export const toggleWorkoutTarget = (
  selectedTargets: WorkoutTarget[],
  target: WorkoutTarget,
): WorkoutTargetSelectionResult => {
  if (selectedTargets.includes(target)) {
    return { targets: selectedTargets.filter((item) => item !== target) };
  }

  if (target === "FULL_BODY") {
    return { targets: ["FULL_BODY"], directComposition: true };
  }

  if (selectedTargets.includes("FULL_BODY")) {
    return {
      targets: selectedTargets,
      message: "전신 운동은 원하는 운동 종목을 직접 선택해 주세요.",
    };
  }

  if (selectedTargets.length >= MAX_WORKOUT_TARGET_SELECTIONS) {
    return {
      targets: selectedTargets,
      message: `운동 부위는 ${MAX_WORKOUT_TARGET_SELECTIONS}개까지 선택할 수 있습니다. 다른 부위를 선택하려면 기존 선택 중 하나를 먼저 해제해 주세요.`,
    };
  }

  return { targets: [...selectedTargets, target] };
};
