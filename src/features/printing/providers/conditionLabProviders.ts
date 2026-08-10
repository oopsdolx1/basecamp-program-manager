import { collection, doc, getDoc, getDocs, limit, orderBy, query, where, type DocumentData, type QueryConstraint } from "firebase/firestore";
import { getFirestoreClient } from "../../../firebase/firestoreClient";
import { printHistoryCollectionPath, profilesCollectionPath } from "../../../firebase/firestorePaths";
import type { AppId, ProfileId } from "../../../types/brandedIds";
import { mapProfileDocument, toMemberSelectionItem } from "../../members/mappers/profileMapper";
import { sortMembersByName } from "../../members/services/memberService";
import type { MemberSelectionItem } from "../../members/types/memberViewModel.types";
import type { RawProfileDocument } from "../../members/types/profile.types";
import { analyzeMemberIntelligence } from "../services/memberIntelligenceService";
import type { ConditionInput } from "../types/condition.types";
import type { MemberProfile, MemberProvider } from "./memberProvider";
import type { RecommendationContext, RecommendationProvider } from "./recommendationProvider";
import type { WorkoutHistoryProvider, WorkoutHistoryRecord } from "./workoutHistoryProvider";

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const debugLog = (label: string, startedAt: number, detail: Record<string, unknown>) => {
  const elapsedMs = Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt);
  console.debug(`[ConditionLabProvider] ${label}`, { elapsedMs, ...detail });
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
const buildProfile = (memberId: ProfileId, raw: RawProfileDocument & Record<string, unknown>): MemberProfile | null => {
  const mapped = mapProfileDocument(String(memberId), raw);
  if (mapped.role !== "member" || !mapped.name) return null;
  return {
    id: mapped.profileId,
    name: mapped.name,
    gender: asText(raw.gender) ?? asText(raw.sex),
    age: computeAge(raw.age ?? raw.birthday ?? raw.birthDate),
    height: asNumber(raw.height),
    weight: asNumber(raw.weight),
    goal: asText(raw.goal),
    memo: mapped.memo,
    phone: mapped.phone,
    status: mapped.status,
  };
};
const mapHistoryRecord = (memberId: ProfileId, data: DocumentData, id: string): WorkoutHistoryRecord | null => {
  const snapshot = (data.programSnapshot ?? {}) as Record<string, unknown>;
  const exercises = Array.isArray(snapshot.exercises) ? snapshot.exercises : [];
  const requestedAt = data.requestedAt?.toDate?.() instanceof Date ? data.requestedAt.toDate() : data.createdAt?.toDate?.() instanceof Date ? data.createdAt.toDate() : null;
  if (!requestedAt) return null;
  return {
    memberId,
    programId: typeof snapshot.programId === "string" && snapshot.programId ? snapshot.programId : String(data.programId ?? id),
    programTitle: typeof snapshot.title === "string" && snapshot.title ? snapshot.title : "제목 없음",
    category: typeof snapshot.category === "string" ? snapshot.category as WorkoutHistoryRecord["category"] : null,
    workoutDate: requestedAt,
    durationMinutes: asNumber(data.durationMinutes ?? data.duration ?? data.totalMinutes),
    completion: typeof data.completion === "boolean" ? data.completion : true,
    exercises: exercises.map((exercise) => ({
      name: typeof exercise?.name === "string" ? exercise.name : "운동 없음",
      sets: typeof exercise?.configuredSets === "number" ? exercise.configuredSets : asNumber(exercise?.sets) ?? null,
      reps: asText(exercise?.reps),
      weight: asNumber(exercise?.weight),
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
    memberListPromise = getDocs(collection(getFirestoreClient(), profilesCollectionPath(appId)))
      .then((snapshot) => {
        const members: MemberSelectionItem[] = [];
        snapshot.forEach((documentSnapshot) => {
          const raw = documentSnapshot.data() as RawProfileDocument & Record<string, unknown>;
          const mapped = mapProfileDocument(documentSnapshot.id, raw);
          if (mapped.role !== "member" || !mapped.name) return;
          const profile = buildProfile(mapped.profileId, raw);
          profileCache.set(mapped.profileId, profile);
          members.push(toMemberSelectionItem(mapped));
        });
        memberListCache = sortMembersByName(members);
        debugLog("listMembers success", startedAt, { count: memberListCache.length, appId });
        return memberListCache;
      })
      .catch((error) => {
        console.debug("[ConditionLabProvider] listMembers failure", { appId, error });
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
    const snapshot = await getDoc(doc(getFirestoreClient(), profilesCollectionPath(appId), memberId));
    if (!snapshot.exists()) {
      profileCache.set(memberId, null);
      debugLog("getMemberProfile missing", startedAt, { memberId });
      return null;
    }
    const profile = buildProfile(memberId, snapshot.data() as RawProfileDocument & Record<string, unknown>);
    profileCache.set(memberId, profile);
    debugLog("getMemberProfile success", startedAt, { memberId, found: Boolean(profile) });
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
      const constraints: QueryConstraint[] = [where("isArchived", "==", false), where("memberId", "==", memberId), orderBy("requestedAt", "desc"), limit(requestedLimit)];
      const snapshot = await getDocs(query(collection(getFirestoreClient(), printHistoryCollectionPath(appId)), ...constraints));
      const records = snapshot.docs
        .map((item) => mapHistoryRecord(memberId, item.data(), item.id))
        .filter((item): item is WorkoutHistoryRecord => Boolean(item))
        .sort((left, right) => right.workoutDate.getTime() - left.workoutDate.getTime());
      historyCache.set(cacheKey, records);
      debugLog("getRecentWorkoutHistory success", startedAt, { memberId, requestedLimit, count: records.length, source: "printHistory" });
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
        debugLog("getRecommendationContext success", startedAt, { memberId, historyCount: workoutHistory.length });
        return context;
      } catch (error) {
        console.debug("[ConditionLabProvider] getRecommendationContext failure", { memberId, error });
        throw error;
      }
    },
  };
};
