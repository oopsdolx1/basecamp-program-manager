import { useCallback, useEffect, useRef, useState } from "react";
import type { RecommendedProgram } from "../printing/services/recommendationBuilderService";
import type { KioskHandoff, KioskRecommendationClient } from "./kioskRecommendationClient";

export type KioskRecommendationState =
  | { status: "disabled" }
  | { status: "idle" }
  | { status: "loading" }
  | { status: "none" }
  | { status: "ready"; memberId: string; handoff: KioskHandoff; programs: RecommendedProgram[] }
  | { status: "error" };

/**
 * Reads this Kiosk's Trainer handoff when a member is selected and shows recommendations only when
 * `handoff.memberId` equals the selected member. Member selection is UX, not authorization: the
 * request carries no member, and a handoff for another member is discarded without display or close.
 * The displayed handoff is closed when the member changes, the flow unmounts, or `closeSession()`
 * is called (after the workout session snapshot is saved); it is hidden at `expiresAt`.
 */
export const useKioskRecommendation = (client: KioskRecommendationClient | null, memberId: string | null) => {
  const [state, setState] = useState<KioskRecommendationState>(client ? { status: "idle" } : { status: "disabled" });
  const shown = useRef<KioskHandoff | null>(null);

  const release = useCallback(async () => {
    const handoff = shown.current;
    shown.current = null;
    if (handoff && client) await client.closeHandoff(handoff.handoffId).catch(() => undefined);
  }, [client]);

  useEffect(() => {
    if (!client) { setState({ status: "disabled" }); return undefined; }
    let cancelled = false;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      if (shown.current && shown.current.memberId !== memberId) await release();
      if (!memberId) { if (!cancelled) setState({ status: "idle" }); return; }
      setState({ status: "loading" });
      try {
        const result = await client.fetchHandoff();
        if (cancelled) return;
        // Not for this member (or none): show nothing and keep the Trainer's handoff for its member.
        if (!result || result.handoff.memberId !== memberId) { setState({ status: "none" }); return; }
        shown.current = result.handoff;
        setState(result.programs.length ? { status: "ready", memberId, handoff: result.handoff, programs: result.programs } : { status: "none" });
        const remaining = result.handoff.expiresAt - Date.now();
        if (result.handoff.expiresAt > 0) expiryTimer = setTimeout(() => { if (shown.current?.handoffId === result.handoff.handoffId) { shown.current = null; setState({ status: "none" }); } }, Math.max(0, remaining));
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    };
    void run();
    return () => { cancelled = true; if (expiryTimer) clearTimeout(expiryTimer); };
  }, [client, memberId, release]);

  useEffect(() => () => { void release(); }, [release]);

  const closeSession = useCallback(async () => {
    await release();
    setState(client ? { status: "idle" } : { status: "disabled" });
  }, [client, release]);

  return { state, closeSession };
};
