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

interface RuntimeDocument {
  schemaVersion: number;
  knowledgeVersion: string;
  platform: "BaseCamp";
  generatedAt: string;
  generatedBy: string;
  sourceWorkbook?: string;
  exerciseCount: number;
  items: SharedExerciseKnowledge[];
}

interface RuntimeEnvelope {
  metadata: {
    revision: number;
    updatedAt: string;
    count: number;
    source: string;
    schemaVersion: number;
    checksum?: string;
  };
  runtime: RuntimeDocument;
}

const appId = (import.meta.env.VITE_CONDITION_LAB_APP_ID ?? "").trim();
const runtimePath = `artifacts/${appId}/public/data/sharedKnowledgeRuntime/current`;
const listeners = new Set<() => void>();
let exercises: SharedExerciseKnowledge[] = [];
let byId = new Map<string, SharedExerciseKnowledge>();
let revision = 0;
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
const isEnvelope = (value: unknown): value is RuntimeEnvelope => {
  if (!value || typeof value !== "object") return false;
  const envelope = value as Partial<RuntimeEnvelope>;
  return !!envelope.metadata && !!envelope.runtime && Array.isArray(envelope.runtime.items)
    && envelope.runtime.items.every(isExercise)
    && envelope.metadata.count === envelope.runtime.items.length
    && envelope.runtime.exerciseCount === envelope.runtime.items.length;
};
const notify = () => listeners.forEach((listener) => listener());
const replaceSnapshot = (envelope: RuntimeEnvelope) => {
  exercises = envelope.runtime.items.filter((item) => item.status === "active").map((item) => ({
    ...item,
    aliases: copy(item.aliases), tags: copy(item.tags), purpose: copy(item.purpose),
    secondaryMuscles: copy(item.secondaryMuscles), coachingCues: copy(item.coachingCues),
    commonMistakes: copy(item.commonMistakes), contraindications: copy(item.contraindications),
    progressionExerciseIds: copy(item.progressionExerciseIds), regressionExerciseIds: copy(item.regressionExerciseIds),
    relatedExerciseIds: copy(item.relatedExerciseIds),
  }));
  byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  revision = envelope.metadata.revision;
  console.info("[ProgramManager Runtime]", { revision, updatedAt: envelope.metadata.updatedAt, count: exercises.length });
  notify();
};

const start = (): Promise<void> => {
  if (startPromise) return startPromise;
  startPromise = (async () => {
    if (!appId) throw new Error("VITE_CONDITION_LAB_APP_ID is required for Shared Runtime.");
    await ensureFirebaseAuth();
    unsubscribeRemote = onSnapshot(doc(getFirestoreClient(), runtimePath), (snapshot) => {
      if (!snapshot.exists()) {
        exercises = []; byId = new Map(); revision = 0; notify();
        return;
      }
      const value: unknown = snapshot.data();
      if (!isEnvelope(value)) {
        console.error("[ProgramManager Runtime] Invalid Shared Runtime document; retaining the last successful snapshot.");
        return;
      }
      replaceSnapshot(value);
    }, (error) => console.error("[ProgramManager Runtime] Subscription failed; retaining the last successful snapshot.", error));
  })().catch((error) => {
    startPromise = null;
    console.error("[ProgramManager Runtime] Startup failed; using Empty Runtime.", error);
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
