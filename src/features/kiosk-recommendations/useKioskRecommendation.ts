import { useCallback, useEffect, useState } from "react";
import type { KioskRecommendationClient } from "./kioskRecommendationClient";
import type { KioskRecommendationState } from "./trainerRecommendationPrompt";
export type { KioskRecommendationState } from "./trainerRecommendationPrompt";
export const KIOSK_RECOMMENDATION_TIMEOUT_MS = 10_000;

/**
 * Reads the selected member's server-authorized active default recommendation. Cancellation keeps
 * a late response for a previous member from appearing after the selection changes.
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
    client.fetchDefaultProgram(memberId).then((program) => settle(program ? { status: "ready", memberId, program } : { status: "none", memberId }), () => settle({ status: "error", memberId })).finally(() => clearTimeout(timer));
    return () => { settled = true; clearTimeout(timer); };
  }, [attempt, client, memberId, timeoutMs]);
  return { state, retry: useCallback(() => setAttempt((value) => value + 1), []) };
};
