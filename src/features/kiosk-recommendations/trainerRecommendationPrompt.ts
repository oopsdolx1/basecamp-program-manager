import type { RecommendedProgram } from "../printing/services/recommendationBuilderService";

export type KioskRecommendationState =
  | { status: "disabled" }
  | { status: "idle" }
  | { status: "loading"; memberId: string }
  | { status: "none"; memberId: string }
  | { status: "ready"; memberId: string; program: RecommendedProgram }
  | { status: "error"; memberId: string };

export type TrainerPromptDecision = { kind: "checking" } | { kind: "prompt"; program: RecommendedProgram } | { kind: "none" } | { kind: "error" };

export const decideTrainerPrompt = (state: KioskRecommendationState, memberId: string | null, alreadyPrompted: boolean): TrainerPromptDecision => {
  if (!memberId || state.status === "disabled") return { kind: "none" };
  if (state.status === "idle" || state.status === "loading" || state.memberId !== memberId) return { kind: "checking" };
  if (state.status === "error") return { kind: "error" };
  if (state.status === "none" || alreadyPrompted) return { kind: "none" };
  return { kind: "prompt", program: state.program };
};

export const TRAINER_PROMPT_MEMORY_TTL_MS = 10 * 60_000;
export const createTrainerPromptMemory = ({ now = () => Date.now(), ttlMs = TRAINER_PROMPT_MEMORY_TTL_MS }: { now?: () => number; ttlMs?: number } = {}) => {
  const prompted = new Map<string, number>();
  return {
    has(memberId: string) { const at = prompted.get(memberId); if (at === undefined) return false; if (now() - at >= ttlMs) { prompted.delete(memberId); return false; } return true; },
    mark(memberId: string) { prompted.set(memberId, now()); },
    clear() { prompted.clear(); },
  };
};

/** Memory only: never persisted to Firebase, Firestore or browser storage. */
export const trainerPromptMemory = createTrainerPromptMemory();
