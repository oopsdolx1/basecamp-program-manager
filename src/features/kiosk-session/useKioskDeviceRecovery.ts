import { useEffect, useState } from "react";
import { createFirebaseKioskDeviceIdentity } from "../kiosk-recommendations/kioskFirebaseIdentity";
import type { KioskDeviceIdentity } from "../kiosk-recommendations/kioskRecommendationClient";

/**
 * Increments each time the Kiosk device identity becomes `ready` again after not being ready (startup race with the
 * local agent, agent restart). Screens add it to the dependencies of their initial Kiosk API load, so they reload by
 * themselves instead of keeping the first failure until the browser is restarted.
 */
export const useKioskDeviceRecoveryEpoch = (device: KioskDeviceIdentity = createFirebaseKioskDeviceIdentity()): number => {
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    if (!device.subscribe) return undefined;
    let wasReady = device.getState?.() === "ready";
    return device.subscribe((state) => {
      if (state === "ready" && !wasReady) setEpoch((value) => value + 1);
      wasReady = state === "ready";
    });
  }, [device]);
  return epoch;
};

/** A search on a screen whose member list failed: try the device sign-in again now (throttled, single flight). */
export const requestKioskDeviceRecovery = (device: KioskDeviceIdentity = createFirebaseKioskDeviceIdentity()): void => {
  void device.recover?.().catch(() => undefined);
};
