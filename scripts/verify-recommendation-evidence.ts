import assert from "node:assert/strict";
import { buildRecommendationEvidence } from "../src/features/printing/services/recommendationEvidenceService";
import type { Program } from "../src/features/programs/types/program.types";
import type { WorkoutHistoryRecord } from "../src/features/printing/providers/workoutHistoryProvider";
import type { ConditionInput, RecommendationTraceFactor } from "../src/features/printing/types/condition.types";

const now = new Date("2026-10-27T12:00:00Z");
const condition: ConditionInput = { condition: "NORMAL", sleep: "NORMAL", workoutTarget: "SHOULDER", targetFatigue: "NORMAL", fatigueAreas: [], stress: 3, alcohol: "NO" };
const program = { id: "shoulder" as Program["id"], title: "어깨 A", category: "SHOULDER", difficulty: "GENERAL", exercises: [], schemaVersion: 1, memo: "", favorite: false, usageCount: 0, createdAt: now, updatedAt: now, isArchived: false } satisfies Program;
const record = (date: string, category: WorkoutHistoryRecord["category"]): WorkoutHistoryRecord => ({ memberId: "m" as WorkoutHistoryRecord["memberId"], programId: "p", programTitle: "p", category, categories: category ? [category] : [], workoutDate: new Date(date), exercises: [{ name: "덤벨 숄더 프레스", sets: 3, weight: 20 }] });
const factor = (key: RecommendationTraceFactor["key"], score: number, reason: string): RecommendationTraceFactor => ({ key, score, reason, label: key });

let evidence = buildRecommendationEvidence({ factors: [factor("history", 4, "history")], history: [record("2026-10-20", "BACK"), record("2026-10-12", "CHEST")], program, condition, now });
assert.equal(evidence[0]?.type, "low_body_part_frequency");
evidence = buildRecommendationEvidence({ factors: [factor("history", 4, "history")], history: [record("2026-10-18", "SHOULDER"), record("2026-10-10", "BACK")], program, condition, now });
assert.equal(evidence[0]?.type, "body_part_rest_days");
evidence = buildRecommendationEvidence({ factors: [factor("recentWorkout", -16, "repeat")], history: [record("2026-10-26", "SHOULDER"), record("2026-10-24", "SHOULDER"), record("2026-10-20", "BACK")], program, condition, now });
assert.equal(evidence[0]?.type, "recent_body_part_repetition");
evidence = buildRecommendationEvidence({ factors: [factor("condition", -18, "수면이 부족해 볼륨과 강도가 낮은 구성을 우선했습니다.")], history: [record("2026-10-26", "BACK"), record("2026-10-20", "CHEST")], program, condition, now });
assert.equal(evidence[0]?.type, "condition_adjustment");
evidence = buildRecommendationEvidence({ factors: [factor("history", 4, "fallback")], history: [record("2026-10-20", "BACK")], program, condition, now });
assert.equal(evidence[0]?.type, "history_fallback");
console.log("Recommendation evidence checks: PASS");
