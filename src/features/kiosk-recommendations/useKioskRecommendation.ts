import { useCallback, useEffect, useRef, useState } from "react";
import type { RecommendedProgram } from "../printing/services/recommendationBuilderService";
import type { KioskRecommendationClient, KioskSession } from "./kioskRecommendationClient";

export type KioskRecommendationState =
  | { status: "disabled" }
  | { status: "idle" }
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; memberId: string; programs: RecommendedProgram[] }
  | { status: "error" };

/**
 * Opens a Kiosk session for the selected member, reads that member's recommendations and closes
 * the session when the member changes, the flow unmounts, or `closeSession()` is called (after the
 * workout session snapshot is created). Failures never block the existing manual flow.
 */
export const useKioskRecommendation = (client: KioskRecommendationClient | null, memberId: string | null) => {
  const [state, setState] = useState<KioskRecommendationState>(client ? { status: "idle" } : { status: "disabled" });
  const held = useRef<KioskSession | null>(null);

  const release = useCallback(async () => {
    const session = held.current;
    held.current = null;
    if (session && client) await client.closeSession(session).catch(() => undefined);
  }, [client]);

  useEffect(() => {
    if (!client) { setState({ status: "disabled" }); return undefined; }
    let cancelled = false;
    const run = async () => {
      if (held.current && held.current.memberId !== memberId) await release();
      if (!memberId) { if (!cancelled) setState({ status: "idle" }); return; }
      setState({ status: "loading" });
      try {
        let session = held.current;
        if (!session) {
          session = await client.startSession(memberId);
          if (cancelled) { await client.closeSession(session).catch(() => undefined); return; }
          held.current = session;
        }
        const programs = await client.listPrograms(session);
        if (cancelled) return;
        setState(programs.length ? { status: "ready", memberId, programs } : { status: "empty" });
      } catch {
        if (cancelled) return;
        held.current = null;
        setState({ status: "error" });
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [client, memberId, release]);

  useEffect(() => () => { void release(); }, [release]);

  const closeSession = useCallback(async () => {
    await release();
    setState(client ? { status: "idle" } : { status: "disabled" });
  }, [client, release]);

  return { state, closeSession };
};
