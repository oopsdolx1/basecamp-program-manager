import { KioskApiError } from "../kiosk-recommendations/kioskRecommendationClient";
import { logKioskError } from "../kiosk-diagnostics/kioskErrorLog";

// User-facing Korean guidance for Kiosk API failures on member-list screens. Internal codes
// (KIOSK_*, NETWORK_ERROR, ...) are never rendered.
export const KIOSK_MEMBER_LIST_MESSAGES = Object.freeze({
  deviceAuth: "키오스크 기기 인증이 필요합니다. 관리자에게 문의해 주세요.",
  // The local agent is not ready yet (Windows startup) or briefly unavailable: recovery runs automatically.
  deviceStarting: "키오스크 서비스를 준비하고 있습니다. 잠시만 기다려 주세요.",
  deviceRevoked: "등록되지 않았거나 사용이 중지된 키오스크입니다. 관리자에게 문의해 주세요.",
  network: "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  server: "일시적인 서버 오류로 회원 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
  unknown: "회원 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
});
const DEVICE_AUTH_CODES = new Set(["KIOSK_DEVICE_NOT_ENROLLED", "KIOSK_DEVICE_IDENTITY_REQUIRED", "KIOSK_DEVICE_AUTH_FAILED"]);
const SERVER_CODES = new Set(["INTERNAL_ERROR", "INVALID_API_RESPONSE"]);

export const kioskMemberListErrorMessage = (error: unknown): string => {
  logKioskError("member list", error);
  if (error instanceof KioskApiError) {
    if (error.code === "KIOSK_DEVICE_STARTING") return KIOSK_MEMBER_LIST_MESSAGES.deviceStarting;
    if (DEVICE_AUTH_CODES.has(error.code)) return KIOSK_MEMBER_LIST_MESSAGES.deviceAuth;
    if (error.code === "KIOSK_DEVICE_NOT_REGISTERED") return KIOSK_MEMBER_LIST_MESSAGES.deviceRevoked;
    if (error.code === "NETWORK_ERROR") return KIOSK_MEMBER_LIST_MESSAGES.network;
    if (SERVER_CODES.has(error.code) || error.status >= 500) return KIOSK_MEMBER_LIST_MESSAGES.server;
  }
  return KIOSK_MEMBER_LIST_MESSAGES.unknown;
};
