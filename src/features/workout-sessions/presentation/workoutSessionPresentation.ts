import type { WorkoutSessionStatus } from "../domain/workoutSession.types";

export const workoutSessionStatusPresentation: Record<WorkoutSessionStatus, { label: string; color: "default" | "warning" | "success" | "info" | "primary" }> = {
  created: { label: "생성됨", color: "default" },
  printed: { label: "출력 완료", color: "warning" },
  ocr_pending: { label: "OCR 대기", color: "default" },
  ocr_completed: { label: "OCR 완료", color: "success" },
  ai_completed: { label: "AI 완료", color: "info" },
  confirmed: { label: "확인 완료", color: "primary" },
};

export const formatSessionDate = (date: Date | null): string => {
  if (!date || date.getTime() === 0) return "-";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(date);
};
