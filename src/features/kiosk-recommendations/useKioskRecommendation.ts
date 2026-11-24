import { useCallback, useEffect, useState } from "react";
import type { KioskRecommendationClient } from "./kioskRecommendationClient";
import type { KioskRecommendationState } from "./trainerRecommendationPrompt";

export type { KioskRecommendationState } from "./trainerRecommendationPrompt";

/** A lookup that has not answered by then counts as failed, so the condition step is never held indefinitely. */
export const KIOSK_RECOMMENDATION_TIMEOUT_MS = 10_000;

/**
 * Reads the selected member's server-authorized active default recommendation, starting as soon as a
 * member is selected. A response for a previous member is dropped after the selection changes, and every
 * state names its member; `retry` repeats the lookup for the same member after a failure.
 */
export const useKioskRecommendation = (client: KioskRecommendationClient | null, memberId: string | null, { timeoutMs = KIOSK_RECOMMENDATION_TIMEOUT_MS }: { timeoutMs?: number } = {}) => {
  const [state, setState] = useState<KioskRecommendationState>(client ? { status: "idle" } : { status: "disabled" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!client) { setState({ status: "disabled" }); return undefined; }
    if (!memberId) { setState({ status: "idle" }); return undefined; }
    let settled = false;
    const settle = (next: KioskRecommendationState) => { if (!settled) { settled = true; setState(next); } };
    setState({ status: "loading", memberId });
    const timer = setTimeout(() => settle({ status: "error", memberId }), timeoutMs);
    client.fetchDefaultProgram(memberId).then(
      (program) => settle(program ? { status: "ready", memberId, program } : { status: "none", memberId }),
      () => settle({ status: "error", memberId }),
    ).finally(() => clearTimeout(timer));
    return () => { settled = true; clearTimeout(timer); };
  }, [attempt, client, memberId, timeoutMs]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { state, retry };
};
