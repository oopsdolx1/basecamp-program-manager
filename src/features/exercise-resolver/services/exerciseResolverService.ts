import type { ExerciseCatalogItem } from "../../exercise-catalog";
import { RESOLVER_CANDIDATE_LIMIT, RESOLVER_CONFIDENCE, RESOLVER_THRESHOLDS } from "../constants/resolverThresholds";
import type { BatchResolveRequest, ResolveRequest, ResolveResult } from "../domain/exerciseResolver.types";
import { normalizeExerciseText } from "../utils/normalizeExerciseText";
import { similarityScore } from "../utils/stringSimilarity";

interface NormalizedCatalogEntry {
  exercise: ExerciseCatalogItem;
  normalizedName: string;
  normalizedEnglishName: string | null;
  normalizedAliases: Array<{ source: string; normalized: string }>;
}

const cache = new WeakMap<ExerciseCatalogItem[], NormalizedCatalogEntry[]>();

const getNormalizedCatalog = (catalog: ExerciseCatalogItem[]): NormalizedCatalogEntry[] => {
  const cached = cache.get(catalog);
  if (cached) return cached;

  const normalized = catalog
    .filter((exercise) => !exercise.isArchived)
    .map((exercise) => ({
      exercise,
      normalizedName: normalizeExerciseText(exercise.name),
      normalizedEnglishName: exercise.englishName ? normalizeExerciseText(exercise.englishName) : null,
      normalizedAliases: exercise.aliases.map((alias) => ({
        source: alias,
        normalized: normalizeExerciseText(alias),
      })),
    }));

  cache.set(catalog, normalized);
  return normalized;
};

const resolved = (
  exercise: ExerciseCatalogItem,
  confidence: number,
  matchedAlias: string | null,
  normalizedText: string,
  reason: string,
): ResolveResult => ({
  status: "resolved",
  exercise,
  confidence,
  matchedAlias,
  normalizedText,
  candidateExercises: [exercise],
  reason,
});

const unknown = (normalizedText: string, reason: string): ResolveResult => ({
  status: "unknown",
  exercise: null,
  confidence: RESOLVER_CONFIDENCE.UNKNOWN,
  matchedAlias: null,
  normalizedText,
  candidateExercises: [],
  reason,
});

const ambiguous = (
  candidates: ExerciseCatalogItem[],
  confidence: number,
  normalizedText: string,
  reason: string,
): ResolveResult => ({
  status: "ambiguous",
  exercise: null,
  confidence,
  matchedAlias: null,
  normalizedText,
  candidateExercises: candidates.slice(0, RESOLVER_CANDIDATE_LIMIT),
  reason,
});

const exactCandidates = (
  entries: NormalizedCatalogEntry[],
  normalizedText: string,
): Array<{ entry: NormalizedCatalogEntry; confidence: number; matchedAlias: string | null; reason: string }> => {
  const matches: Array<{ entry: NormalizedCatalogEntry; confidence: number; matchedAlias: string | null; reason: string }> = [];

  for (const entry of entries) {
    if (normalizeExerciseText(entry.exercise.id) === normalizedText) {
      matches.push({ entry, confidence: RESOLVER_CONFIDENCE.EXACT, matchedAlias: null, reason: "id exact match" });
      continue;
    }
    if (entry.normalizedName === normalizedText) {
      matches.push({ entry, confidence: RESOLVER_CONFIDENCE.EXACT, matchedAlias: entry.exercise.name, reason: "name exact match" });
      continue;
    }
    if (entry.normalizedEnglishName === normalizedText) {
      matches.push({ entry, confidence: RESOLVER_CONFIDENCE.EXACT, matchedAlias: entry.exercise.englishName, reason: "englishName exact match" });
      continue;
    }

    const alias = entry.normalizedAliases.find((candidate) => candidate.normalized === normalizedText);
    if (alias) {
      const confidence = normalizeExerciseText(entry.exercise.name) === alias.normalized
        ? RESOLVER_CONFIDENCE.NORMALIZED
        : RESOLVER_CONFIDENCE.ALIAS_EXACT;
      matches.push({ entry, confidence, matchedAlias: alias.source, reason: "alias exact match" });
    }
  }

  return matches;
};

const similarityCandidates = (entries: NormalizedCatalogEntry[], normalizedText: string) =>
  entries
    .map((entry) => {
      const tokens = [
        entry.normalizedName,
        entry.normalizedEnglishName,
        ...entry.normalizedAliases.map((alias) => alias.normalized),
      ].filter((token): token is string => Boolean(token));
      const score = Math.max(...tokens.map((token) => similarityScore(normalizedText, token)));
      return {
        exercise: entry.exercise,
        confidence: Math.round(score * RESOLVER_CONFIDENCE.SIMILARITY_MAX),
      };
    })
    .filter((candidate) => candidate.confidence >= RESOLVER_THRESHOLDS.AMBIGUOUS_MIN)
    .sort((left, right) => right.confidence - left.confidence || left.exercise.name.localeCompare(right.exercise.name, "ko-KR"));

export const resolveExercise = ({ text, catalog }: ResolveRequest): ResolveResult => {
  const normalizedText = normalizeExerciseText(text);
  if (!normalizedText) return unknown(normalizedText, "empty input");

  const entries = getNormalizedCatalog(catalog);
  const exact = exactCandidates(entries, normalizedText).sort((left, right) => right.confidence - left.confidence);

  if (exact.length === 1) {
    const match = exact[0];
    return resolved(match.entry.exercise, match.confidence, match.matchedAlias, normalizedText, match.reason);
  }

  if (exact.length > 1) {
    const topConfidence = exact[0].confidence;
    const topMatches = exact.filter((match) => match.confidence === topConfidence);
    if (topMatches.length === 1 && topConfidence >= RESOLVER_THRESHOLDS.AUTO_RESOLVE) {
      const match = topMatches[0];
      return resolved(match.entry.exercise, match.confidence, match.matchedAlias, normalizedText, match.reason);
    }

    return ambiguous(
      exact.map((match) => match.entry.exercise),
      topConfidence,
      normalizedText,
      "multiple exact candidates",
    );
  }

  const similar = similarityCandidates(entries, normalizedText);
  if (similar.length === 0 || similar[0].confidence <= RESOLVER_THRESHOLDS.UNKNOWN_MAX) {
    return unknown(normalizedText, "no candidate above threshold");
  }

  const top = similar[0];
  const tiedTop = similar.filter((candidate) => candidate.confidence === top.confidence);
  if (top.confidence >= RESOLVER_THRESHOLDS.AUTO_RESOLVE && tiedTop.length === 1) {
    return resolved(top.exercise, top.confidence, null, normalizedText, "similarity match");
  }

  return ambiguous(
    similar.map((candidate) => candidate.exercise),
    top.confidence,
    normalizedText,
    "similarity candidates require user selection",
  );
};

export const resolveExercises = ({ texts, catalog }: BatchResolveRequest): ResolveResult[] =>
  texts.map((text) => resolveExercise({ text, catalog }));
