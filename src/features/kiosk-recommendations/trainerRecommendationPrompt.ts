import type { RecommendedProgram } from "../printing/services/recommendationBuilderService";

/**
 * Lookup state of the selected member's default Trainer recommendation. Every settled or pending state
 * names the member it belongs to, so a result for a previous member is never read as the current one.
 */
export type KioskRecommendationState =
  | { status: "disabled" }
  | { status: "idle" }
  | { status: "loading"; memberId: string }
  | { status: "none"; memberId: string }
  | { status: "ready"; memberId: string; program: RecommendedProgram }
  | { status: "error"; memberId: string };

/**
 * What the condition step (step 2) does about the Trainer recommendation:
 * - `checking`: lookup not settled for this member yet. Not "no recommendation": the step waits for it.
 * - `prompt`: show the popup once.
 * - `none`: no recommendation, already answered in this flow, or the Kiosk API is not configured.
 * - `error`: lookup failed; shown as a notice that never blocks the existing flow.
 */
export type TrainerPromptDecision =
  | { kind: "checking" }
  | { kind: "prompt"; program: RecommendedProgram }
  | { kind: "none" }
  | { kind: "error" };

export const decideTrainerPrompt = (state: KioskRecommendationState, memberId: string | null, alreadyPrompted: boolean): TrainerPromptDecision => {
  if (!memberId || state.status === "disabled") return { kind: "none" };
  // `idle` right after a selection, or any state of another member, means this member's lookup has not settled.
  if (state.status === "idle" || state.memberId !== memberId || state.status === "loading") return { kind: "checking" };
  if (state.status === "error") return { kind: "error" };
  if (state.status === "none" || alreadyPrompted) return { kind: "none" };
  return { kind: "prompt", program: state.program };
};

/**
 * Memory only (never Firebase or Web Storage): members already shown the popup in the current usage
 * flow. It survives step changes, re-selecting the same member and leaving/re-entering the screen;
 * a document reload ("처음으로") forgets everything. An entry also lapses after the Kiosk member-session
 * default TTL (10 minutes), so the next visit of the same member on a long-running Kiosk page is a new flow.
 */
export const TRAINER_PROMPT_MEMORY_TTL_MS = 10 * 60_000;

export interface TrainerPromptMemory {
  has(memberId: string): boolean;
  mark(memberId: string): void;
  clear(): void;
}

export const createTrainerPromptMemory = ({ now = () => Date.now(), ttlMs = TRAINER_PROMPT_MEMORY_TTL_MS }: { now?: () => number; ttlMs?: number } = {}): TrainerPromptMemory => {
  const prompted = new Map<string, number>();
  return {
    has(memberId) {
      const at = prompted.get(memberId);
      if (at === undefined) return false;
      if (now() - at >= ttlMs) { prompted.delete(memberId); return false; }
      return true;
    },
    mark(memberId) { prompted.set(memberId, now()); },
    clear() { prompted.clear(); },
  };
};

/** The page's single memory; a reload creates a new one. */
export const trainerPromptMemory = createTrainerPromptMemory();
