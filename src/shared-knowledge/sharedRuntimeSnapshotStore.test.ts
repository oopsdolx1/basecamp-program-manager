import {
  createSharedRuntimeSnapshotStore,
  normalizeSharedRuntimeSnapshot,
} from "./sharedRuntimeSnapshotStore";

interface TestExercise {
  id: string;
  name: string;
  aliases: string[];
}

const exercise: TestExercise = { id: "squat", name: "스쿼트", aliases: ["백 스쿼트"] };
const isExercise = (value: unknown): value is TestExercise => Boolean(
  value && typeof value === "object" && "id" in value && "name" in value && "aliases" in value,
);

const flat = { revision: 1, exerciseCount: 1, items: [exercise] };
const legacy = { items: [exercise] };
const envelope = {
  metadata: { revision: 1, count: 1, checksum: "checksum" },
  runtime: { knowledgeVersion: "2.0.1", exerciseCount: 1, items: [exercise] },
  publishedAt: "2026-08-11T13:57:00.255Z",
};

const rejects = (callback: () => unknown): boolean => {
  try {
    callback();
    return false;
  } catch {
    return true;
  }
};

const protectionStore = createSharedRuntimeSnapshotStore(isExercise);
protectionStore.apply(flat);

export const sharedRuntimeSnapshotStoreTestCases = {
  flat: normalizeSharedRuntimeSnapshot(flat)?.items === flat.items,
  envelope: normalizeSharedRuntimeSnapshot(envelope)?.items === envelope.runtime.items,
  legacy: createSharedRuntimeSnapshotStore(isExercise).apply(legacy).exerciseCount === 1,
  malformedRetainsLastSnapshot: (() => {
    const store = createSharedRuntimeSnapshotStore(isExercise);
    store.apply(flat);
    const rejected = rejects(() => store.apply({ runtime: { items: "invalid" } }));
    return rejected && store.getCurrent()?.items[0]?.id === "squat";
  })(),
  nonEmptyToEmptyBlocked: rejects(() => protectionStore.apply({ items: [] })),
};

export const runSharedRuntimeSnapshotStoreTests = (): boolean =>
  Object.values(sharedRuntimeSnapshotStoreTestCases).every(Boolean);
