import { useState } from "react";
import type { AppId } from "../../../types/brandedIds";
import type { WorkoutPrintDocument } from "../../printing/types/print.types";
import { createPrintRequestFromDocument } from "../services/printRequestService";

export const useCreatePrintRequest = (appId: AppId) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (document: WorkoutPrintDocument) => {
    if (saving) return null;

    setSaving(true);
    setError(null);
    try {
      return await createPrintRequestFromDocument(appId, document);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "인쇄 요청을 저장하지 못했습니다.";
      setError(message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  return { create, saving, error };
};
