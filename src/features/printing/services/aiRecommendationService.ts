import type { MemberSelectionItem } from "../../members";
import { reorderExercises, sanitizeProgramForm } from "../../programs/services/programService";
import type { Program, ProgramFormValues } from "../../programs/types/program.types";
import { buildRecommendationPrompt } from "../prompts/recommendationPrompt";
import { recommendationSystemPrompt } from "../prompts/systemPrompt";
import type { AiRecommendationChange, AiRecommendationResult, ConditionInput, MemberIntelligenceSummary, PeriodizationSummary, RecommendationTrace, RecentWorkoutSummary } from "../types/condition.types";

interface RequestAiRecommendationParams {
  member: MemberSelectionItem;
  condition: ConditionInput;
  recentWorkout: RecentWorkoutSummary | null;
  intelligence: MemberIntelligenceSummary | null;
  periodization: PeriodizationSummary | null;
  recommendedProgram: Program;
  snapshot: ProgramFormValues;
  ruleReason: string;
  recommendationTrace: RecommendationTrace | null;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY ?? "";
const geminiModel = import.meta.env.VITE_GEMINI_MODEL ?? "gemini-2.0-flash";

const normalizeChange = (change: Partial<AiRecommendationChange>): AiRecommendationChange | null => {
  if (!change.exercise || typeof change.exercise !== "string" || !change.exercise.trim()) {
    return null;
  }

  return {
    exercise: change.exercise.trim(),
    sets: typeof change.sets === "number" && Number.isFinite(change.sets) ? Math.max(1, Math.floor(change.sets)) : undefined,
    reps: typeof change.reps === "string" && change.reps.trim() ? change.reps.trim() : undefined,
    memo: typeof change.memo === "string" && change.memo.trim() ? change.memo.trim() : undefined,
    order: typeof change.order === "number" && Number.isFinite(change.order) ? Math.max(1, Math.floor(change.order)) : undefined,
  };
};

export const parseAiRecommendation = (raw: string): AiRecommendationResult => {
  const parsed = JSON.parse(raw) as Partial<AiRecommendationResult> & { changes?: Partial<AiRecommendationChange>[] };

  if (typeof parsed.reason !== "string" || typeof parsed.coach !== "string" || typeof parsed.warning !== "string") {
    throw new Error("AI JSON schema mismatch");
  }

  return {
    reason: parsed.reason.trim(),
    coach: parsed.coach.trim(),
    warning: parsed.warning.trim(),
    changes: Array.isArray(parsed.changes) ? parsed.changes.map(normalizeChange).filter((value): value is AiRecommendationChange => Boolean(value)) : [],
    rawJson: raw,
  };
};

export const requestAiRecommendation = async (params: RequestAiRecommendationParams): Promise<AiRecommendationResult | null> => {
  if (!geminiApiKey.trim()) {
    return null;
  }

  const prompt = buildRecommendationPrompt(params);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: recommendationSystemPrompt }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
  if (!text) {
    throw new Error("AI returned an empty response");
  }

  return parseAiRecommendation(text);
};

const appendMemo = (currentMemo: string, patchMemo?: string, reps?: string): string => {
  const segments = [currentMemo.trim()];
  if (patchMemo) segments.push(patchMemo);
  if (reps) segments.push(`AI 권장 반복 ${reps}`);
  return segments.filter(Boolean).join(" | ");
};

const findExerciseIndex = (values: ProgramFormValues, name: string): number => {
  const normalized = name.trim().toLocaleLowerCase("ko-KR");
  const exactIndex = values.exercises.findIndex((exercise) => exercise.name.trim().toLocaleLowerCase("ko-KR") === normalized);
  if (exactIndex >= 0) return exactIndex;
  return values.exercises.findIndex((exercise) => exercise.name.trim().toLocaleLowerCase("ko-KR").includes(normalized));
};

export const applyAiRecommendationToSnapshot = (snapshot: ProgramFormValues, aiRecommendation: AiRecommendationResult): ProgramFormValues => {
  const nextExercises = snapshot.exercises.map((exercise) => ({ ...exercise }));

  aiRecommendation.changes.forEach((change) => {
    const index = findExerciseIndex({ ...snapshot, exercises: nextExercises }, change.exercise);
    if (index < 0) return;

    const current = nextExercises[index];
    nextExercises[index] = {
      ...current,
      sets: change.sets ?? current.sets,
      memo: appendMemo(current.memo, change.memo, change.reps),
      order: change.order ?? current.order,
    };
  });

  return sanitizeProgramForm({
    ...snapshot,
    memo: appendMemo(snapshot.memo, aiRecommendation.warning || aiRecommendation.coach ? `AI: ${[aiRecommendation.coach, aiRecommendation.warning].filter(Boolean).join(" / ")}` : undefined),
    exercises: reorderExercises(nextExercises),
  });
};





