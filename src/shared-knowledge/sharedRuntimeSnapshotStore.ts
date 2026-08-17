export interface SharedRuntimeSnapshot<T> {
  schemaVersion?: number;
  knowledgeVersion?: string;
  revision: number;
  updatedAt?: unknown;
  updatedBy?: string;
  checksum?: string;
  exerciseCount: number;
  items: T[];
  [key: string]: unknown;
}

type SnapshotRecord = Record<string, unknown>;

const recordOf = (value: unknown): SnapshotRecord | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as SnapshotRecord : null;

// Keep this behavior aligned with Condition Lab's canonical normalizer.
export const normalizeSharedRuntimeSnapshot = (value: unknown): SnapshotRecord | null => {
  const source = recordOf(value);
  if (!source) return null;
  if (Array.isArray(source.items)) return source;

  const runtime = recordOf(source.runtime);
  if (!runtime || !Array.isArray(runtime.items)) return null;
  const metadata = recordOf(source.metadata);

  return {
    ...runtime,
    revision: Number(metadata?.revision || 0),
    updatedAt: metadata?.updatedAt || source.publishedAt || runtime.generatedAt || null,
    updatedBy: metadata?.importedBy || runtime.generatedBy || "unknown",
    checksum: metadata?.checksum || "",
    exerciseCount: runtime.exerciseCount ?? metadata?.count ?? runtime.items.length,
  };
};

export const countRawSnapshotItems = (value: unknown): number | null => {
  const source = recordOf(value);
  if (!source) return null;
  if (Array.isArray(source.items)) return source.items.length;
  const runtime = recordOf(source.runtime);
  return Array.isArray(runtime?.items) ? runtime.items.length : null;
};

export const createSharedRuntimeSnapshotStore = <T>(isItem: (value: unknown) => value is T) => {
  let current: SharedRuntimeSnapshot<T> | null = null;
  let lastError: Error | null = null;

  const apply = (raw: unknown): SharedRuntimeSnapshot<T> => {
    const normalized = normalizeSharedRuntimeSnapshot(raw);
    const items = normalized?.items;
    if (!normalized || !Array.isArray(items) || !items.every(isItem)) {
      throw new Error("Shared Runtime document does not match a supported snapshot contract.");
    }

    const exerciseCount = Number(normalized.exerciseCount ?? items.length);
    if (!Number.isFinite(exerciseCount) || exerciseCount !== items.length) {
      throw new Error("Shared Runtime exerciseCount does not match items length.");
    }
    if (current && current.items.length > 0 && items.length === 0) {
      throw new Error("Shared Runtime non-empty snapshot cannot be replaced by an empty snapshot.");
    }

    current = {
      ...normalized,
      revision: Number(normalized.revision || 0),
      exerciseCount,
      items: [...items] as T[],
    };
    lastError = null;
    return current;
  };

  return Object.freeze({
    apply(raw: unknown) {
      try {
        return apply(raw);
      } catch (caught) {
        lastError = caught instanceof Error ? caught : new Error(String(caught));
        throw lastError;
      }
    },
    getCurrent: () => current,
    getError: () => lastError,
  });
};
