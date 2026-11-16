import { useEffect, useState } from "react";
import type { RecommendedProgram } from "../printing/services/recommendationBuilderService";
import type { KioskRecommendationClient } from "./kioskRecommendationClient";

export type KioskRecommendationState =
  | { status: "disabled" }
  | { status: "idle" }
  | { status: "loading" }
  | { status: "none" }
  | { status: "ready"; memberId: string; program: RecommendedProgram }
  | { status: "error" };

/**
 * Reads the selected member's server-authorized active default recommendation. Cancellation keeps
 * a late response for a previous member from appearing after the selection changes.
 */
export const useKioskRecommendation = (client: KioskRecommendationClient | null, memberId: string | null) => {
  const [state, setState] = useState<KioskRecommendationState>(client ? { status: "idle" } : { status: "disabled" });
  useEffect(() => {
    if (!client) { setState({ status: "disabled" }); return undefined; }
    let cancelled = false;
    const run = async () => {
      if (!memberId) { if (!cancelled) setState({ status: "idle" }); return; }
      setState({ status: "loading" });
      try {
        const program = await client.fetchDefaultProgram(memberId);
        if (cancelled) return;
        setState(program ? { status: "ready", memberId, program } : { status: "none" });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [client, memberId]);
  return { state };
};
