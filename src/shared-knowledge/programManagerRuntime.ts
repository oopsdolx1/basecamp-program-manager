import { doc, onSnapshot } from "firebase/firestore";
import { ensureFirebaseAuth } from "../firebase/firebaseAuth";
import { getFirestoreClient } from "../firebase/firestoreClient";

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

interface RuntimeSnapshot {
  schemaVersion: number;
  knowledgeVersion: string;
  revision: number;
  updatedAt: unknown;
  updatedBy: string;
  checksum: string;
  exerciseCount: number;
  items: SharedExerciseKnowledge[];
}

interface RuntimeDistributionEnvelope {
  metadata?: {
    revision?: number;
    updatedAt?: unknown;
    importedBy?: string;
    checksum?: string;
    count?: number;
  };
  runtime?: Partial<RuntimeSnapshot>;
}

const appId = (import.meta.env.VITE_CONDITION_LAB_APP_ID ?? "").trim();
const projectId = (import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "").trim();
const runtimePath = `artifacts/${appId}/public/data/sharedKnowledgeRuntime/current`;
const listeners = new Set<() => void>();
let exercises: SharedExerciseKnowledge[] = [];
let byId = new Map<string, SharedExerciseKnowledge>();
let revision = 0;
let connectionStatus: "loading" | "ready" | "error" = "loading";
let connectionError = "";
let unsubscribeRemote: (() => void) | null = null;
let startPromise: Promise<void> | null = null;

const normalize = (value: unknown): string => String(value ?? "")
  .normalize("NFKC").trim().toLocaleLowerCase().replace(/[\s\-_()[\]{}.,/\\:;!?·]+/g, "");
const copy = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const isExercise = (value: unknown): value is SharedExerciseKnowledge => {
  if (!value || typeof value !== "object") return false;
  const exercise = value as Partial<SharedExerciseKnowledge>;
  return typeof exercise.id === "string" && typeof exercise.name === "string" && Array.isArray(exercise.aliases);
};
const isRuntimeSnapshot = (value: unknown): value is RuntimeSnapshot => {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<RuntimeSnapshot>;
  return typeof snapshot.revision === "number" && Array.isArray(snapshot.items)
    && snapshot.items.every(isExercise)
    && snapshot.exerciseCount === snapshot.items.length;
};
const unwrapRuntimeSnapshot = (value: unknown): RuntimeSnapshot | null => {
  if (isRuntimeSnapshot(value)) return value;
  if (!value || typeof value !== "object") return null;
  const envelope = value as RuntimeDistributionEnvelope;
  if (!envelope.runtime || !envelope.metadata) return null;
  const candidate = {
    ...envelope.runtime,
    revision: envelope.metadata.revision,
    updatedAt: envelope.metadata.updatedAt,
    updatedBy: envelope.metadata.importedBy ?? "",
    checksum: envelope.metadata.checksum ?? "",
    exerciseCount: envelope.runtime.exerciseCount ?? envelope.metadata.count,
  };
  return isRuntimeSnapshot(candidate) ? candidate : null;
};
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
  console.info("[SharedRuntime Receive]", {
    documentExists: true,
    projectId,
    appId,
    documentPath: runtimePath,
    revision,
    firestoreCount: snapshot.exerciseCount,
    receivedCount: snapshot.items.length,
    catalogCount: exercises.length,
    exerciseIds: exercises.map(({ id }) => id),
  });
  notify();
};

const start = (): Promise<void> => {
  if (startPromise) return startPromise;
  startPromise = (async () => {
    if (!appId) throw new Error("VITE_CONDITION_LAB_APP_ID is required for Shared Runtime.");
    await ensureFirebaseAuth();
    unsubscribeRemote = onSnapshot(doc(getFirestoreClient(), runtimePath), (snapshot) => {
      if (!snapshot.exists()) {
        exercises = []; byId = new Map(); revision = 0; connectionStatus = "ready"; connectionError = ""; notify();
        console.info("[SharedRuntime Receive]", {
          documentExists: false, projectId, appId, documentPath: runtimePath, revision: 0, receivedCount: 0, exerciseIds: [],
        });
        return;
      }
      const value = unwrapRuntimeSnapshot(snapshot.data());
      if (!value) {
        connectionStatus = "error";
        connectionError = "Shared Runtime document does not match the production contract.";
        console.error("[ProgramManager Runtime] Invalid Shared Runtime document; retaining the last successful snapshot.");
        notify();
        return;
      }
      replaceSnapshot(value);
    }, (error) => {
      connectionStatus = "error";
      connectionError = error.message;
      console.error("[ProgramManager Runtime] Subscription failed; retaining the last successful snapshot.", error);
      notify();
    });
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
  stop: () => { unsubscribeRemote?.(); unsubscribeRemote = null; startPromise = null; },
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

void start();
