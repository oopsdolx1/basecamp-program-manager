import { createFirebaseKioskDeviceIdentity } from "../kiosk-recommendations/kioskFirebaseIdentity";
import { resolveKioskApiBaseUrl } from "../kiosk-recommendations/kioskRecommendationClient";
import { createKioskMemberSessionClient, type KioskMemberSessionClient } from "./kioskMemberSessionClient";
import { createKioskMemberSessionManager, type KioskMemberSessionManager } from "./kioskMemberSessionManager";

export interface KioskMemberSessionRuntime { client: KioskMemberSessionClient; sessions: KioskMemberSessionManager }

let runtime: KioskMemberSessionRuntime | null | undefined;
/**
 * The browser's single Kiosk member-session runtime (one manager per page, memory only).
 * Null when `VITE_CONDITION_LAB_API_BASE_URL` is unset/invalid: then no session can be issued and
 * workout sessions cannot be saved (there is deliberately no Client SDK fallback).
 */
export const getDefaultKioskMemberSessionRuntime = (): KioskMemberSessionRuntime | null => {
  if (runtime !== undefined) return runtime;
  const env = import.meta.env as Record<string, string | undefined> | undefined;
  const baseUrl = resolveKioskApiBaseUrl(env?.VITE_CONDITION_LAB_API_BASE_URL, typeof window === "undefined" ? undefined : window.location.origin);
  if (!baseUrl) { runtime = null; return runtime; }
  const client = createKioskMemberSessionClient({ baseUrl, device: createFirebaseKioskDeviceIdentity() });
  runtime = { client, sessions: createKioskMemberSessionManager({ client }) };
  // Leaving the page ends the session (best effort; the server TTL still bounds it if this is lost).
  if (typeof window !== "undefined") window.addEventListener("pagehide", () => runtime?.sessions.clear({ keepalive: true }));
  return runtime;
};
