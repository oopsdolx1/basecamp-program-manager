import type { AppId, ProfileId } from "../../../types/brandedIds";
import { toProfileId } from "../../../types/brandedIds";
import { toMemberSelectionItem } from "../../members/mappers/profileMapper";
import { sortMembersByName } from "../../members/services/memberService";
import type { MemberSelectionItem } from "../../members/types/memberViewModel.types";
import { programCategories } from "../../programs/config/programOptions";
import type { ProgramCategory } from "../../programs/types/program.types";
import { analyzeMemberIntelligence } from "../services/memberIntelligenceService";
import type { ConditionInput } from "../types/condition.types";
import type { MemberProfile, MemberProvider } from "./memberProvider";
import type { RecommendationContext, RecommendationProvider } from "./recommendationProvider";
import type { WorkoutHistoryProvider, WorkoutHistoryRecord } from "./workoutHistoryProvider";
import { parseWorkoutDate, validateWorkoutDate } from "./workoutDateIntegrity";
import { getDefaultKioskMemberSessionRuntime } from "../../kiosk-session/defaultKioskMemberSession";
import { withKioskMemberSession } from "../../kiosk-session/kioskSessionRenewal";
import { logKioskError } from "../../kiosk-diagnostics/kioskErrorLog";

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
// Phase 3-E minimal diagnostics: a fixed operation label, timing and aggregate counts only. The detail type
// deliberately allows no identifiers — never a member id, name, token, request/response body or record content.
type DebugDetail = { count?: number; found?: boolean; requestedLimit?: number };
const debugLog = (label: string, startedAt: number, detail: DebugDetail) => {
  const elapsedMs = Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt);
  const { count, found, requestedLimit } = detail;
  console.debug(`[ConditionLabProvider] ${label}`, { elapsedMs, ...(count !== undefined ? { count } : {}), ...(found !== undefined ? { found } : {}), ...(requestedLimit !== undefined ? { requestedLimit } : {}) });
};
const asText = (value: unknown): string | undefined => (typeof value === "string" && value.trim() ? value.trim() : undefined);
const asNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};
const computeAge = (value: unknown): number | undefined => {
  const direct = asNumber(value);
  if (direct !== undefined) return direct;
  const text = asText(value);
  if (!text) return undefined;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return undefined;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const beforeBirthday = today.getMonth() < date.getMonth() || (today.getMonth() === date.getMonth() && today.getDate() < date.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : undefined;
};
const asProgramCategory = (value: unknown): ProgramCategory | null => {
  const text = asText(value);
  if (!text) return null;
  const normalized = text.toLocaleLowerCase("ko-KR");
  return programCategories.find(({ value: category, label }) =>
    category.toLocaleLowerCase("ko-KR") === normalized || label === text)?.value ?? null;
};
const asProgramCategories = (value: unknown): ProgramCategory[] => {
  const text = asText(value);
  if (!text) return [];
  const candidates = text.split(/[,/·+]/).map((part) => part.trim()).filter(Boolean);
  return [...new Set(candidates.map(asProgramCategory).filter((item): item is ProgramCategory => Boolean(item)))];
};
export const mapWorkoutHistoryRecord = (memberId: ProfileId, data: Record<string, unknown>, id: string, nowAt = new Date()): WorkoutHistoryRecord | null => {
  const categories = asProgramCategories(data.category ?? data.target);
  const exercises = Array.isArray(data.exercises) ? data.exercises : [];
  // Workout occurrence is explicit only. Metadata is an integrity signal, never a fallback.
  const workoutDate = validateWorkoutDate(parseWorkoutDate(data.date), data.createdAt, nowAt);
  if (!workoutDate) return null;
  return {
    memberId,
    programId: asText(data.programId) ?? asText(data.workoutSessionId) ?? id,
    programTitle: asText(data.programName) ?? asText(data.title) ?? asText(data.target) ?? "운동 기록",
    category: categories.length === 1 ? categories[0] : null,
    categories,
    workoutDate,
    durationMinutes: asNumber(data.durationMinutes ?? data.duration ?? data.totalMinutes),
    completion: typeof data.completion === "boolean" ? data.completion : undefined,
    exercises: exercises.map((exercise) => ({
      name: typeof exercise?.name === "string" ? exercise.name : "운동 없음",
      sets: Array.isArray(exercise?.sets) ? exercise.sets.length : asNumber(exercise?.sets) ?? null,
      reps: asText(Array.isArray(exercise?.sets) ? exercise.sets[0]?.reps : exercise?.reps),
      weight: asNumber(Array.isArray(exercise?.sets) ? exercise.sets[0]?.weight : exercise?.weight),
    })),
  };
};

export const createConditionLabMemberProvider = (appId: AppId): MemberProvider => {
  let memberListCache: MemberSelectionItem[] | null = null;
  let memberListPromise: Promise<MemberSelectionItem[]> | null = null;
  const profileCache = new Map<ProfileId, MemberProfile | null>();

  const listMembers = async (): Promise<MemberSelectionItem[]> => {
    if (memberListCache) return memberListCache;
    if (memberListPromise) return memberListPromise;
    const startedAt = now();
    const runtime = getDefaultKioskMemberSessionRuntime();
    if (!runtime) return Promise.reject(new Error("키오스크 API가 설정되지 않았습니다."));
    memberListPromise = runtime.client.listMembers()
      .then((items) => {
        const members: MemberSelectionItem[] = items.map(({ memberId, name }) => toMemberSelectionItem({ profileId: toProfileId(memberId), name, role: "member", warnings: [], legacyAliases: [] }));
        memberListCache = sortMembersByName(members);
        debugLog("listMembers success", startedAt, { count: memberListCache.length });
        return memberListCache;
      })
      .catch((error) => {
        logKioskError("member list (provider)", error);
        throw error;
      })
      .finally(() => {
        memberListPromise = null;
      });
    return memberListPromise;
  };

  const getMemberProfile = async (memberId: ProfileId): Promise<MemberProfile | null> => {
    if (profileCache.has(memberId)) return profileCache.get(memberId) ?? null;
    const startedAt = now();
    const runtime = getDefaultKioskMemberSessionRuntime();
    if (!runtime) throw new Error("키오스크 API가 설정되지 않았습니다.");
    // Member-session read: the shared Phase 3-E renewal rule (EXPIRED only, once; never ENDED/device/member change).
    const raw = await withKioskMemberSession(runtime.sessions, String(memberId), (token) => runtime.client.readProfile(token));
    const selected = memberListCache?.find((item) => item.memberId === memberId);
    const profile = selected ? { id: memberId, name: selected.displayName, gender: asText(raw.gender) ?? asText(raw.sex), age: computeAge(raw.age ?? raw.birthday ?? raw.birthDate), height: asNumber(raw.height), weight: asNumber(raw.weight), goal: asText(raw.goal), status: selected.status } : null;
    profileCache.set(memberId, profile);
    debugLog("getMemberProfile success", startedAt, { found: Boolean(profile) });
    return profile;
  };

  return { listMembers, getMemberProfile };
};

export const createConditionLabWorkoutHistoryProvider = (appId: AppId): WorkoutHistoryProvider => {
  const historyCache = new Map<string, WorkoutHistoryRecord[]>();

  return {
    async getRecentWorkoutHistory(memberId: ProfileId, requestedLimit = 20): Promise<WorkoutHistoryRecord[]> {
      const cacheKey = `${memberId}:${requestedLimit}`;
      if (historyCache.has(cacheKey)) return historyCache.get(cacheKey) ?? [];
      const startedAt = now();
      const runtime = getDefaultKioskMemberSessionRuntime();
      if (!runtime) throw new Error("키오스크 API가 설정되지 않았습니다.");
      const limit = Math.min(100, Math.max(requestedLimit, requestedLimit * 4));
      const logs = await withKioskMemberSession(runtime.sessions, String(memberId), (token) => runtime.client.readLogs(token, limit));
      const records = logs
        .map((item) => mapWorkoutHistoryRecord(memberId, item, String(item.id ?? "")))
        .filter((item): item is WorkoutHistoryRecord => Boolean(item))
        .sort((left, right) => right.workoutDate.getTime() - left.workoutDate.getTime())
        .slice(0, requestedLimit);
      historyCache.set(cacheKey, records);
      debugLog("getRecentWorkoutHistory success", startedAt, { requestedLimit, count: records.length });
      return records;
    },
  };
};

export const createConditionLabRecommendationProvider = (
  memberProvider: MemberProvider,
  workoutHistoryProvider: WorkoutHistoryProvider,
): RecommendationProvider => {
  const contextCache = new Map<string, RecommendationContext>();
  return {
    async getRecommendationContext(memberId: ProfileId, condition: ConditionInput): Promise<RecommendationContext> {
      const cacheKey = JSON.stringify({ memberId, condition });
      if (contextCache.has(cacheKey)) return contextCache.get(cacheKey)!;
      const startedAt = now();
      try {
        const [memberProfile, workoutHistory] = await Promise.all([
          memberProvider.getMemberProfile(memberId),
          workoutHistoryProvider.getRecentWorkoutHistory(memberId, 20),
        ]);
        const intelligenceResult = analyzeMemberIntelligence(workoutHistory, condition);
        const context: RecommendationContext = {
          memberProfile,
          workoutHistory,
          recentWorkout: intelligenceResult.recentWorkout,
          intelligence: intelligenceResult.summary,
          metadata: intelligenceResult.metadata,
        };
        contextCache.set(cacheKey, context);
        debugLog("getRecommendationContext success", startedAt, { count: workoutHistory.length });
        return context;
      } catch (error) {
        logKioskError("recommendation context", error);
        throw error;
      }
    },
  };
};
