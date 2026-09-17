import assert from "node:assert/strict";
import { parseWorkoutDate, validateWorkoutDate } from "../src/features/printing/providers/workoutDateIntegrity";
import { recommendProgram } from "../src/features/printing/services/conditionRecommendationService";
import type { Program } from "../src/features/programs/types/program.types";
import type { WorkoutHistoryRecord } from "../src/features/printing/providers/workoutHistoryProvider";

const now = new Date("2026-07-10T00:00:00.000Z");
const memberId = "member-test" as WorkoutHistoryRecord["memberId"];
const record = (date: unknown, createdAt: unknown, id = "record", category: WorkoutHistoryRecord["category"] = "BACK"): WorkoutHistoryRecord | null => {
  const workoutDate = validateWorkoutDate(parseWorkoutDate(date), createdAt, now);
  return workoutDate ? { memberId, programId: id, programTitle: id, category, categories: category ? [category] : [], workoutDate, exercises: [] } : null;
};
const timestamp = { toDate: () => new Date("2026-07-09T00:00:00.000Z") };

assert(parseWorkoutDate(timestamp), "Firestore Timestamp");
assert(parseWorkoutDate("2026-07-09T12:30:00Z"), "strict ISO timestamp");
assert(parseWorkoutDate("2026-07-09"), "strict YYYY-MM-DD");
assert.equal(parseWorkoutDate(1_783_555_200_000), null, "numeric workout dates are not an established contract");
assert.equal(parseWorkoutDate(1_783_555_200), null, "ambiguous numeric seconds rejected");
assert.equal(parseWorkoutDate("07/09/2026"), null, "locale date rejected");
assert.equal(record(undefined, 1_783_555_200_000), null, "missing date does not fall back");
assert.equal(record("not-a-date", 1_783_555_200_000), null, "malformed date does not fall back");
assert.equal(validateWorkoutDate(parseWorkoutDate("2026-07-11"), null, now), null, "future date rejected");
assert.equal(record("2019-10-25", 1_783_653_975_429, "1783653806055_1"), null, "known corrupt BACK fixture rejected");

const validBack = record("2026-07-01", 1_783_555_200_000, "valid-back");
const validChest = record("2026-06-30", 1_783_555_200_000, "valid-chest", "CHEST");
assert(validBack && validChest);
const composite: WorkoutHistoryRecord = { memberId, programId: "composite", programTitle: "composite", category: null, categories: ["LOWER_BODY", "SHOULDER"], workoutDate: now, exercises: [] };
assert.deepEqual(composite.categories, ["LOWER_BODY", "SHOULDER"], "composite target mapping remains compatible");
const source = [record("2019-10-25", 1_783_653_975_429, "bad-back"), validBack, validChest].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
assert.equal(source.filter((entry) => entry?.category === "BACK").length, 1, "invalid latest target cannot hide older valid history");
assert.equal(source.filter((entry) => entry && now.getTime() - entry.workoutDate.getTime() <= 30 * 86_400_000 && entry.category === "BACK").length, 1, "invalid record cannot affect 30-day frequency");
const twentyValid = Array.from({ length: 20 }, (_, index) => record(`2026-06-${String(20 - index).padStart(2, "0")}`, 1_783_555_200_000, `valid-${index}`)).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
assert.equal(twentyValid.length, 20, "invalid records do not consume recent-20 valid-history slots");
const program = { id: "back" as Program["id"], title: "BACK", category: "BACK", difficulty: "GENERAL", memo: "", favorite: false, usageCount: 0, lastUsedAt: null, createdAt: now, updatedAt: now, createdBy: null, updatedBy: null, isArchived: false, exercises: [] } satisfies Program;
const result = recommendProgram([program], { workoutTarget: "BACK", targetFatigue: "NORMAL", fatigueAreas: [], stress: 3, condition: "NORMAL", sleep: "NORMAL", alcohol: "NO" }, null, null, null, source, []);
assert(result && !result.reasons.some((reason) => reason.includes("2519일")), "2019 fixture cannot generate 2519-day explanation");
console.log("Workout history date integrity checks: PASS");
