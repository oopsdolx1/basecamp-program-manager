// Regression: a recommended program's exercise identity/order/sets come from the Program document only.
// The shared runtime catalog may enrich metadata by catalogExerciseId; it must never pick, rename or replace an exercise.
// Run: npm run test:program-exercise-identity
import assert from "node:assert/strict";
import { mapProgramDocument } from "../src/features/programs/mappers/programMapper";
import { recommendProgram } from "../src/features/printing/services/conditionRecommendationService";
import { createSnapshotBuilderState, recommendPlannedSets } from "../src/features/printing/services/snapshotBuilderService";
import { mapSessionPrescriptionExercises } from "../src/features/workout-sessions/services/sessionPrescriptionMapper";
import { hydrateProgramExerciseKnowledge, resolveProgramExerciseKnowledgeFromCatalog } from "../src/shared-knowledge/programExerciseMetadata";
import type { Program } from "../src/features/programs/types/program.types";

let failures = 0;
const check = (name: string, fn: () => void) => {
  try { fn(); console.log(`PASS  ${name}`); } catch (error) { failures += 1; console.error(`FAIL  ${name}\n${(error as Error).message}`); }
};

// Catalog fixture: two different exercises share the alias "레그프레스" (aliases are not unique in the runtime).
const catalogItem = (id: string, name: string, aliases: string[]) => ({ id, name, englishName: "", aliases, memberWhy: `${id}-why`, bodyPart: "하체" });
const catalog = [
  catalogItem("leg-press-45", "45도 레그프레스", ["레그프레스"]),
  catalogItem("leg-press-horizontal", "호리즌탈 레그프레스", ["레그프레스"]),
  catalogItem("squat", "바벨 백 스쿼트", ["스쿼트"]),
];
const catalogIds = new Set(catalog.map(({ id }) => id));
const identity = (program: Program) => program.exercises.map(({ id, catalogExerciseId, name, order, sets, memo }) => ({ id, catalogExerciseId, name, order, sets, memo }));

// Shape returned by GET /v1/kiosk/programs (condition-lab programView): complete, stored order, 0 is valid.
const apiProgram = {
  id: "program-lower-a", title: "하체 A", category: "LOWER_BODY", difficulty: "GENERAL", memo: "", favorite: false, usageCount: 5, isArchived: false,
  exercises: [
    { id: "r0", name: "스쿼트", catalogExerciseId: "squat", sets: 5, memo: "5회", order: 0 },              // normal ID, order 0
    { id: "r1", name: "레그프레스", sets: 4, memo: "12회", order: 1 },                                      // legacy, name == duplicate alias
    { id: "r2", name: "불가리안 스플릿 스쿼트", catalogExerciseId: "retired-id", sets: 3, memo: "40초", order: 2 }, // ID not in runtime
    { id: "r3", name: "스쿼트", sets: 2, memo: "", order: 3 },                                              // legacy, name == unique alias
    ...Array.from({ length: 6 }, (_, index) => ({ id: `r${index + 4}`, name: `보조 운동 ${index + 4}`, catalogExerciseId: `aux-${index + 4}`, sets: (index % 3) + 2, memo: "", order: index + 4 })),
  ],
};
const source = mapProgramDocument(apiProgram.id, apiProgram as never);
const resolved = resolveProgramExerciseKnowledgeFromCatalog(source, catalog);

check("client mapper keeps all 10 rows, order 0 and stored sequence", () => {
  assert.equal(source.exercises.length, 10);
  assert.deepEqual(source.exercises.map(({ id, order }) => [id, order]), apiProgram.exercises.map(({ id, order }) => [id, order]));
});
check("A1 legacy row without catalogExerciseId keeps its identity and name (metadataMissing)", () => {
  assert.deepEqual(resolved.get("r1"), { id: "r1", name: "레그프레스", memberWhy: "", bodyPart: "", metadataMissing: true });
});
check("A2 duplicate alias never resolves a legacy row to another catalog exercise", () => {
  for (const rowId of ["r1", "r3"]) assert.equal(catalogIds.has(resolved.get(rowId)!.id), false, `${rowId} → ${resolved.get(rowId)!.id}`);
  assert.equal(resolved.get("r3")!.name, "스쿼트");
});
check("A3 retired catalog id keeps its id and the program name (metadataMissing)", () => {
  assert.deepEqual(resolved.get("r2"), { id: "retired-id", name: "불가리안 스플릿 스쿼트", memberWhy: "", bodyPart: "", metadataMissing: true });
});
check("A4 valid catalog id resolves by ID only and only adds metadata", () => {
  assert.deepEqual(resolved.get("r0"), { id: "squat", name: "스쿼트", memberWhy: "squat-why", bodyPart: "하체", metadataMissing: false });
});
check("A5 hydration leaves exerciseId/name/order/sets/memo unchanged", () => {
  const [hydrated] = hydrateProgramExerciseKnowledge([source]);
  assert.deepEqual(identity(hydrated), identity(source));
  assert.deepEqual(hydrated.exercises.map(({ displayName }) => displayName), source.exercises.map(({ displayName }) => displayName));
});

// Invariant: source → hydrated → recommendation card → builder → session prescription keep identity and order.
const archived = { ...source, id: "program-archived" as Program["id"], isArchived: true, usageCount: 99 };
const condition = { workoutTarget: "LOWER_BODY", targetFatigue: "HIGH", fatigueAreas: [], stress: 3, condition: "BAD", sleep: "LACK", alcohol: "NO" } as const;
const recommendation = recommendProgram(hydrateProgramExerciseKnowledge([archived, source]), condition as never, null, null, null, [], []);
check("recommendation selects the source programId and never an archived program", () => {
  assert.equal(recommendation?.program.id, source.id);
  assert.equal(recommendation?.trace.candidatePrograms.some(({ programId }) => programId === archived.id), false);
});
check("recommendation card model == program source (id/catalogId/name/order/sets/memo)", () => {
  assert.deepEqual(identity(recommendation!.program), identity(source));
});
const builder = createSnapshotBuilderState(recommendation!.program, condition);
check("builder keeps exercise identity, sequence and program.sets; plannedSets is the separate condition-derived value", () => {
  assert.deepEqual(builder.exercises.map(({ catalogExerciseId, name, sets, memo }) => ({ catalogExerciseId, name, sets, memo })),
    source.exercises.map(({ catalogExerciseId, name, sets, memo }) => ({ catalogExerciseId, name, sets, memo: memo ?? "" })));
  assert.deepEqual(builder.exercises.map(({ order }) => order), source.exercises.map((_, index) => index + 1), "builder renumbers 1..n in source sequence");
  const expectedPlanned = recommendPlannedSets(condition);
  assert.ok(builder.exercises.every(({ plannedSets }) => plannedSets === expectedPlanned), `plannedSets must equal recommendPlannedSets(condition)=${expectedPlanned}`);
});
check("session prescription stores catalog id (or the row identity when none) — never an alias-matched exercise", () => {
  const builderProgram = { ...source, exercises: builder.exercises.map(({ id, name, displayName, catalogExerciseId, sets, memo, order }) => ({ id, name, displayName, catalogExerciseId, sets, memo, order })) };
  const session = mapSessionPrescriptionExercises(builder.exercises, resolveProgramExerciseKnowledgeFromCatalog(builderProgram, catalog));
  assert.deepEqual(session.map(({ name }) => name), source.exercises.map(({ name }) => name));
  assert.deepEqual(session.map(({ exerciseId, programExerciseId }, index) => exerciseId === (source.exercises[index].catalogExerciseId ?? programExerciseId)), session.map(() => true));
  assert.equal(session.some(({ exerciseId }) => exerciseId === "leg-press-45" || exerciseId === "leg-press-horizontal"), false);
});

if (failures) { console.error(`${failures} program exercise identity check(s) failed`); process.exit(1); }
console.log("Program exercise identity checks: PASS");
