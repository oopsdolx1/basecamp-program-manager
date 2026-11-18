import { createFirebaseKioskDeviceIdentity } from "../features/kiosk-recommendations/kioskFirebaseIdentity";
import { KioskApiError, resolveKioskApiBaseUrl } from "../features/kiosk-recommendations/kioskRecommendationClient";
import {
  countRawSnapshotItems,
  createSharedRuntimeSnapshotStore,
  type SharedRuntimeSnapshot,
} from "./sharedRuntimeSnapshotStore";

export interface SharedExerciseKnowledge {
  schemaVersion: number;
  id: string;
  status: "active" | "deprecated";
  replacedById: string | null;
  name: string;
  englishName: string;
  aliases: string[];
  tags?: string[];
  bodyPart: string;
  movementPattern: string;
  category: string;
  equipment: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  difficulty: "" | "beginner" | "intermediate" | "advanced";
  purpose: string[];
  memberWhy: string;
  trainerWhy: string;
  coachingCues: string[];
  commonMistakes: string[];
  contraindications: string[];
  progressionExerciseIds: string[];
  regressionExerciseIds: string[];
  relatedExerciseIds: string[];
  ocr: { priority: number; commonMistakes: string[]; deprecatedAliases: string[] };
  memo: string;
}

type RuntimeSnapshot = SharedRuntimeSnapshot<SharedExerciseKnowledge>;

const appId = (import.meta.env.VITE_CONDITION_LAB_APP_ID ?? "").trim();
const listeners = new Set<() => void>();
let exercises: SharedExerciseKnowledge[] = [];
let byId = new Map<string, SharedExerciseKnowledge>();
let revision = 0;
let connectionStatus: "loading" | "ready" | "error" = "loading";
let connectionError = "";
let startPromise: Promise<void> | null = null;

const normalize = (value: unknown): string => String(value ?? "")
  .normalize("NFKC").trim().toLocaleLowerCase().replace(/[\s\-_()[\]{}.,/\\:;!?·]+/g, "");
const copy = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const isExercise = (value: unknown): value is SharedExerciseKnowledge => {
  if (!value || typeof value !== "object") return false;
  const exercise = value as Partial<SharedExerciseKnowledge>;
  return typeof exercise.id === "string" && typeof exercise.name === "string" && Array.isArray(exercise.aliases);
};
const snapshotStore = createSharedRuntimeSnapshotStore(isExercise);
const notify = () => listeners.forEach((listener) => listener());
const replaceSnapshot = (snapshot: RuntimeSnapshot) => {
  exercises = snapshot.items.filter((item) => item.status === "active").map((item) => ({
    ...item,
    aliases: copy(item.aliases), tags: copy(item.tags), purpose: copy(item.purpose),
    secondaryMuscles: copy(item.secondaryMuscles), coachingCues: copy(item.coachingCues),
    commonMistakes: copy(item.commonMistakes), contraindications: copy(item.contraindications),
    progressionExerciseIds: copy(item.progressionExerciseIds), regressionExerciseIds: copy(item.regressionExerciseIds),
    relatedExerciseIds: copy(item.relatedExerciseIds),
  }));
  byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  revision = snapshot.revision;
  connectionStatus = "ready";
  connectionError = "";
  console.info(`[ProgramManager Hydration] Runtime count=${exercises.length}`, { revision });
  notify();
};

const start = (): Promise<void> => {
  if (startPromise) return startPromise;
  startPromise = (async () => {
    if (!appId) throw new Error("VITE_CONDITION_LAB_APP_ID is required for Shared Runtime.");
    const env = import.meta.env as Record<string, string | undefined>;
    const baseUrl = resolveKioskApiBaseUrl(env.VITE_BASECAMP_API_BASE_URL, typeof window === "undefined" ? undefined : window.location.origin);
    if (!appId || !baseUrl) throw new Error("Kiosk API is required for Shared Runtime.");
    const token = await createFirebaseKioskDeviceIdentity().getIdToken();
    if (!token) throw new KioskApiError("KIOSK_DEVICE_NOT_ENROLLED", 0);
    const response = await fetch(`${baseUrl}/v1/kiosk/shared-knowledge-runtime`, { headers: { authorization: `Bearer ${token}` } });
    const body = await response.json().catch(() => null) as { runtime?: unknown; error?: { code?: string } } | null;
    if (!response.ok || !body?.runtime) throw new KioskApiError(body?.error?.code ?? "INVALID_API_RESPONSE", response.status);
    replaceSnapshot(snapshotStore.apply(body.runtime));
  })().catch((error) => {
    startPromise = null;
    connectionStatus = "error";
    connectionError = error instanceof Error ? error.message : String(error);
    console.error("[ProgramManager Runtime] Startup failed; using Empty Runtime.", error);
    notify();
  });
  return startPromise;
};

const getCatalog = ({ keyword = "", bodyPart = "", equipment = "" } = {}) => {
  const query = normalize(keyword);
  return exercises.filter((exercise) => !query || [exercise.name, exercise.englishName, ...exercise.aliases, ...copy(exercise.tags)]
    .some((value) => normalize(value).includes(query)))
    .filter((exercise) => !bodyPart || exercise.bodyPart === bodyPart)
    .filter((exercise) => !equipment || exercise.equipment === equipment);
};
const select = (ids: string[]) => ids.map((id) => byId.get(id)).filter((item): item is SharedExerciseKnowledge => !!item);

export const programManagerRuntime = Object.freeze({
  start,
  stop: () => { startPromise = null; },
  subscribe(listener: () => void) { listeners.add(listener); void start(); return () => { listeners.delete(listener); }; },
  getRevision: () => revision,
  getStatus: () => connectionStatus,
  getError: () => connectionError,
  getAll: () => [...exercises],
  getById: (id: string) => byId.get(id) ?? null,
  getCatalog,
  getClassifications: () => ({
    bodyPart: [...new Set(exercises.map(({ bodyPart }) => bodyPart).filter(Boolean))].sort(),
    movementPattern: [...new Set(exercises.map(({ movementPattern }) => movementPattern).filter(Boolean))].sort(),
    equipment: [...new Set(exercises.map(({ equipment }) => equipment).filter(Boolean))].sort(),
  }),
  search: (keyword: string) => getCatalog({ keyword }),
  searchProgramExercises: (keyword: string) => getCatalog({ keyword }).map(({ id, name, englishName, aliases, equipment }) => ({ id, name, englishName, aliases: [...aliases], equipment })),
  getProgramExercises: (ids: string[]) => select(ids).map(({ id, name, englishName, aliases, equipment }) => ({ id, name, englishName, aliases: [...aliases], equipment })),
  getPrintExercises: (ids: string[]) => select(ids).map(({ id, name, memberWhy }) => ({ id, name, memberWhy })),
  getRecommendationCandidates: () => [...exercises],
  resolveFavorites: select,
  resolveHistory: select,
});

if (import.meta.env.MODE !== "test") void start();
