import { useCallback, useEffect, useRef } from "react";
import type { KioskMemberSessionRuntime } from "./defaultKioskMemberSession";

/**
 * Screen-level ownership of the Kiosk member session (Phase 3-B).
 *
 * The member chosen in the selection flow (QuickPrintFlow) or the workout history (WorkoutSessionsPage) is
 * handed to the print preview so the print record can be saved with that member's session. Leaving a screen
 * without a hand-off ends the session. The end is deferred by one task so React StrictMode's development
 * mount → unmount → mount does not end a session that was just handed over; a screen that receives the
 * hand-off (`receivesHandoff`) cancels that pending end when it mounts. A reload loses everything (memory only).
 */
let pendingClear: ReturnType<typeof setTimeout> | null = null;

export const useKioskSessionScope = (runtime: KioskMemberSessionRuntime | null, { receivesHandoff = false }: { receivesHandoff?: boolean } = {}): (() => void) => {
  const handedOff = useRef(false);
  useEffect(() => {
    if (!runtime) return undefined;
    handedOff.current = false;
    if (receivesHandoff && pendingClear) { clearTimeout(pendingClear); pendingClear = null; }
    return () => {
      if (handedOff.current) return;
      if (pendingClear) clearTimeout(pendingClear);
      pendingClear = setTimeout(() => { pendingClear = null; runtime.sessions.clear(); }, 0);
    };
  }, [receivesHandoff, runtime]);
  // Call right before navigating to the screen that continues with the same member.
  return useCallback(() => { handedOff.current = true; }, []);
};
