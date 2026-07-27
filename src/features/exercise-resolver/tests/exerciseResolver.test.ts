import type { ExerciseCatalogItem } from "../../exercise-catalog";
import { resolveExercise, resolveExercises } from "../services/exerciseResolverService";
import { normalizeExerciseText } from "../utils/normalizeExerciseText";

const date = new Date(0);

const catalog = [
  {
    id: "lat-pulldown",
    schemaVersion: 1,
    name: "랫풀다운",
    englishName: "Lat Pulldown",
    aliases: ["랫풀다운", "렛풀다운", "lat pulldown", "lat pull down", "latpd"],
    category: "back",
    primaryMuscle: "lats",
    secondaryMuscles: [],
    equipmentType: "cable",
    movementPattern: "pull",
    difficulty: null,
    memo: "",
    isFavorite: false,
    isArchived: false,
    createdAt: date,
    updatedAt: date,
    createdBy: null,
    updatedBy: null,
  },
  {
    id: "wide-lat-pulldown",
    schemaVersion: 1,
    name: "와이드 랫풀다운",
    englishName: "Wide Lat Pulldown",
    aliases: ["와이드 랫풀다운", "wide lat pulldown"],
    category: "back",
    primaryMuscle: "lats",
    secondaryMuscles: [],
    equipmentType: "cable",
    movementPattern: "pull",
    difficulty: null,
    memo: "",
    isFavorite: false,
    isArchived: false,
    createdAt: date,
    updatedAt: date,
    createdBy: null,
    updatedBy: null,
  },
  {
    id: "bench-press",
    schemaVersion: 1,
    name: "벤치프레스",
    englishName: "Bench Press",
    aliases: ["bench press", "bp", "바벨 벤치"],
    category: "chest",
    primaryMuscle: "chest",
    secondaryMuscles: [],
    equipmentType: "barbell",
    movementPattern: "push",
    difficulty: null,
    memo: "",
    isFavorite: false,
    isArchived: false,
    createdAt: date,
    updatedAt: date,
    createdBy: null,
    updatedBy: null,
  },
] satisfies ExerciseCatalogItem[];

export const exerciseResolverTestCases = {
  normalize: normalizeExerciseText(" Lat Pull-Down ") === "latpulldown",
  exact: resolveExercise({ text: "벤치프레스", catalog }).status === "resolved",
  alias: resolveExercise({ text: "lat pull down", catalog }).exercise?.id === "lat-pulldown",
  similarity: resolveExercise({ text: "latpulldwn", catalog }).status !== "unknown",
  unknown: resolveExercise({ text: "무슨운동", catalog }).status === "unknown",
  ambiguous: resolveExercise({ text: "풀다운", catalog }).status !== "resolved",
  batch: resolveExercises({ texts: ["벤치프레스", "lat pull down"], catalog }).length === 2,
};

export const runExerciseResolverTests = (): boolean =>
  Object.values(exerciseResolverTestCases).every((result) => result);
