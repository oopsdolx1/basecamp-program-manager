/*
 * READ-ONLY production verification: Program document → Kiosk API projection → client mapper → runtime hydration →
 * recommendation card → builder. Prints a mismatch count; never writes anywhere.
 *
 * Inputs (pick one):
 *   --programs <file.json> [--runtime <file.json>]   exported snapshot (e.g. from Z:\DEV\Backups\migration-basecamp-c1710)
 *       programs: [{ id|docId, ...data }] | { programs: [...] } | { documents: [{ id, data }] } | { <id>: data }
 *       runtime : sharedKnowledgeRuntime/current data | { runtime: data }
 *   --from-firestore                                  Application Default Credentials, `.get()` only, basecamp-c1710 only
 * Options: --condition-lab <path> (default Z:/DEV/Projects/condition-lab) --expect-active 26 --expect-archived 10 --json <out>
 *
 * Run: npm run verify:production-program-source -- --programs <file> --runtime <file>
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mapProgramDocument } from "../src/features/programs/mappers/programMapper";
import { recommendProgram } from "../src/features/printing/services/conditionRecommendationService";
import { createSnapshotBuilderState, recommendPlannedSets } from "../src/features/printing/services/snapshotBuilderService";
import { hydrateProgramExerciseKnowledge, resolveProgramExerciseKnowledgeFromCatalog } from "../src/shared-knowledge/programExerciseMetadata";
import type { Program } from "../src/features/programs/types/program.types";

const PRODUCTION_PROJECT_ID = "basecamp-c1710";
const PRODUCTION_APP_ID = "basecamp_production";
type Raw = Record<string, unknown>;
type Row = { id: string; catalogExerciseId: string | null; name: string; sets: number; memo: string };

const args = process.argv.slice(2);
const option = (name: string) => { const index = args.indexOf(`--${name}`); return index >= 0 ? args[index + 1] : undefined; };
const flag = (name: string) => args.includes(`--${name}`);
const conditionLab = resolve(option("condition-lab") ?? "Z:/DEV/Projects/condition-lab");
const expectActive = Number(option("expect-active") ?? 26);
const expectArchived = Number(option("expect-archived") ?? 10);
const isRecord = (value: unknown): value is Raw => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const plain = (value: unknown): unknown => {
  if (value && typeof (value as { toMillis?: unknown }).toMillis === "function") return (value as { toMillis: () => number }).toMillis();
  if (Array.isArray(value)) return value.map(plain);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  return value;
};

const normalizePrograms = (input: unknown): Array<[string, Raw]> => {
  const list = isRecord(input) && Array.isArray(input.programs) ? input.programs : isRecord(input) && Array.isArray(input.documents) ? input.documents : input;
  if (Array.isArray(list)) return list.map((item: Raw) => isRecord(item.data) ? [String(item.id ?? item.docId), item.data as Raw] : [String(item.docId ?? item.id), item]);
  if (isRecord(list)) return Object.entries(list).filter(([, value]) => isRecord(value)) as Array<[string, Raw]>;
  throw new Error("Unrecognized programs snapshot format.");
};

const loadFromFirestore = async (): Promise<{ programs: Array<[string, Raw]>; runtime: Raw | null }> => {
  const require = createRequire(pathToFileURL(`${conditionLab}/package.json`));
  const { initializeApp, applicationDefault } = require("firebase-admin/app");
  const { getFirestore } = require("firebase-admin/firestore");
  const app = initializeApp({ credential: applicationDefault(), projectId: PRODUCTION_PROJECT_ID }, "readonly-program-source-verify");
  if (app.options.projectId !== PRODUCTION_PROJECT_ID) throw new Error(`Refusing to read a project other than ${PRODUCTION_PROJECT_ID}.`);
  const db = getFirestore(app);
  const base = `artifacts/${PRODUCTION_APP_ID}/public/data`;
  const programs = (await db.collection(`${base}/programs`).get()).docs.map((doc: { id: string; data: () => Raw }) => [doc.id, plain(doc.data()) as Raw] as [string, Raw]);
  const runtime = await db.doc(`${base}/sharedKnowledgeRuntime/current`).get();
  return { programs, runtime: runtime.exists ? plain(runtime.data()) as Raw : null };
};

// Source of truth: the stored exercise array in stored order (stable; 0 valid; missing order last by array position).
const sourceRows = (data: Raw): Row[] => {
  const list = Array.isArray(data.exercises) ? data.exercises as Raw[] : [];
  const order = (item: Raw) => (typeof item?.order === "number" && Number.isFinite(item.order) ? item.order : Infinity);
  return list.map((item, index) => ({ item, index })).sort((a, b) => order(a.item) - order(b.item) || a.index - b.index)
    .filter(({ item }) => typeof item?.name === "string" && item.name)
    .map(({ item, index }) => ({ id: typeof item.id === "string" ? item.id : `#${index}`, catalogExerciseId: typeof item.catalogExerciseId === "string" ? item.catalogExerciseId : null, name: item.name as string, sets: Math.max(1, Number(item.sets) || 1), memo: typeof item.memo === "string" ? item.memo : "" }));
};
const programRows = (program: Program): Row[] => program.exercises.map(({ id, catalogExerciseId, name, sets, memo }) => ({ id, catalogExerciseId: catalogExerciseId ?? null, name, sets, memo: memo ?? "" }));
const diff = (left: Row[], right: Row[]) => {
  const problems: string[] = [];
  if (left.length !== right.length) problems.push(`count ${left.length}→${right.length}`);
  left.forEach((row, index) => {
    const other = right[index];
    if (!other) return;
    for (const key of ["id", "catalogExerciseId", "name", "sets", "memo"] as const) if (row[key] !== other[key]) problems.push(`#${index + 1} ${key} ${JSON.stringify(row[key])}→${JSON.stringify(other[key])}`);
  });
  return problems;
};

const main = async () => {
  const { programs: rawPrograms, runtime } = flag("from-firestore") ? await loadFromFirestore() : {
    programs: normalizePrograms(JSON.parse(readFileSync(option("programs") ?? (() => { throw new Error("--programs <file> or --from-firestore is required."); })(), "utf8"))),
    runtime: option("runtime") ? (((raw: Raw) => (isRecord(raw.runtime) ? raw.runtime : raw))(JSON.parse(readFileSync(option("runtime")!, "utf8")))) : null,
  };

  // Stage 2: the deployed projection code itself (condition-lab kioskReadService), fed by an in-memory read-only db.
  const { createKioskReadService } = await import(pathToFileURL(`${conditionLab}/server/kiosk/kioskReadService.js`).href);
  const memoryDb = { collection: () => ({ get: async () => ({ docs: rawPrograms.map(([id, data]) => ({ id, data: () => data })) }) }), doc: () => ({ get: async () => ({ exists: Boolean(runtime), data: () => runtime }) }) };
  const reads = createKioskReadService({ db: memoryDb, appId: PRODUCTION_APP_ID });
  const projected = new Map<string, Raw>(((await reads.programs()).programs as Raw[]).map((program) => [String(program.id), program]));
  const catalog = ((await reads.sharedKnowledgeRuntime()).runtime.items ?? []) as Array<{ id: string; memberWhy: string; bodyPart: string }>;

  const active = rawPrograms.filter(([, data]) => data.isArchived !== true);
  const archived = rawPrograms.filter(([, data]) => data.isArchived === true);
  const clientPrograms = [...projected.values()].map((program) => mapProgramDocument(String(program.id), { ...program, createdAt: new Date(Number(program.createdAt) || 0), updatedAt: new Date(Number(program.updatedAt) || 0) }));
  const hydratedPrograms = hydrateProgramExerciseKnowledge(clientPrograms);
  const hydratedById = new Map(hydratedPrograms.map((program) => [program.id as string, program]));

  const report: Array<Record<string, unknown>> = [];
  let mismatch = 0;
  let metadataMissing = 0;
  let builderSetsClamped = 0;
  const neutral = { targetFatigue: "NORMAL", fatigueAreas: [], stress: 3, condition: "NORMAL", sleep: "NORMAL", alcohol: "NO" } as const;

  for (const [id, data] of active) {
    const source = sourceRows(data);
    const stage: Record<string, string[]> = {};
    const projection = projected.get(id);
    if (!projection) stage.apiProjection = ["missing from /v1/kiosk/programs (untitled or no named exercises?)"];
    else stage.apiProjection = diff(source, ((projection.exercises as Raw[]) ?? []).map((item) => ({ id: String(item.id), catalogExerciseId: typeof item.catalogExerciseId === "string" ? item.catalogExerciseId : null, name: String(item.name), sets: Number(item.sets), memo: String(item.memo ?? "") })));
    const hydrated = hydratedById.get(id);
    if (hydrated) {
      stage.hydrated = diff(source, programRows(hydrated));
      const resolved = resolveProgramExerciseKnowledgeFromCatalog(hydrated, catalog);
      metadataMissing += [...resolved.values()].filter((item) => item.metadataMissing).length;
      const recommendation = recommendProgram([hydrated], { ...neutral, workoutTarget: hydrated.category } as never, null, null, null, [], []);
      if (recommendation) {
        stage.recommendationCard = recommendation.program.id === hydrated.id ? diff(source, programRows(recommendation.program)) : [`selected ${recommendation.program.id}`];
        const builder = createSnapshotBuilderState(recommendation.program, neutral);
        stage.builder = diff(source.map((row) => ({ ...row, id: "", sets: 0 })), builder.exercises.map((row) => ({ id: "", catalogExerciseId: row.catalogExerciseId ?? null, name: row.name, sets: 0, memo: row.memo })));
        builderSetsClamped += builder.exercises.filter((row, index) => row.sets !== source[index]?.sets).length;
      } else stage.recommendationCard = [`not recommendable for target ${hydrated.category} (category not a workout target)`];
    }
    const problems = Object.entries(stage).flatMap(([name, list]) => list.filter((item) => !item.startsWith("not recommendable")).map((item) => `${name}: ${item}`));
    if (problems.length) mismatch += 1;
    report.push({ id, title: data.title, exercises: source.length, ok: problems.length === 0, problems, notes: stage.recommendationCard?.filter((item) => item.startsWith("not recommendable")) ?? [] });
  }

  // Archived policy: never projected, never a recommendation candidate.
  const archivedLeaks: string[] = [];
  for (const [id] of archived) if (projected.has(id)) archivedLeaks.push(`${id}: present in /v1/kiosk/programs`);
  const allClient = rawPrograms.map(([id, data]) => mapProgramDocument(id, data));
  for (const target of [...new Set(allClient.map((program) => program.category))]) {
    const result = recommendProgram(hydrateProgramExerciseKnowledge(allClient), { ...neutral, workoutTarget: target } as never, null, null, null, [], []);
    for (const candidate of result?.trace.candidatePrograms ?? []) if (archived.some(([id]) => id === candidate.programId)) archivedLeaks.push(`${candidate.programId}: recommendation candidate for ${target}`);
  }

  const summary = {
    source: flag("from-firestore") ? `firestore:${PRODUCTION_PROJECT_ID}/${PRODUCTION_APP_ID} (read-only)` : `snapshot:${option("programs")}`,
    total: rawPrograms.length, active: active.length, archived: archived.length, runtimeExercises: catalog.length,
    countCheck: active.length === expectActive && archived.length === expectArchived ? "OK" : `UNEXPECTED (expected ${expectActive}/${expectArchived})`,
    mismatch, archivedLeaks: archivedLeaks.length, metadataMissingRows: metadataMissing,
    builderSetsDifferFromProgramSets: builderSetsClamped, plannedSetsNeutralCondition: recommendPlannedSets(neutral),
  };
  for (const row of report) console.log(`${row.ok ? "OK  " : "FAIL"} ${row.id} ${row.title ?? ""} (${row.exercises})${(row.problems as string[]).length ? `\n      ${(row.problems as string[]).join("\n      ")}` : ""}${(row.notes as string[]).length ? `  [${(row.notes as string[]).join("; ")}]` : ""}`);
  for (const leak of archivedLeaks) console.log(`ARCHIVED LEAK ${leak}`);
  console.log(JSON.stringify(summary, null, 2));
  if (option("json")) writeFileSync(option("json")!, JSON.stringify({ summary, report, archivedLeaks }, null, 2));
  process.exit(mismatch || archivedLeaks.length || summary.countCheck !== "OK" ? 1 : 0);
};

main().catch((error) => { console.error(error); process.exit(2); });
