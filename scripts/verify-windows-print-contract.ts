import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { access, mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkoutPrintTemplateV1 } from "../src/features/printing/components/WorkoutPrintTemplateV1/WorkoutPrintTemplateV1";
import type { PrintRequest } from "../src/features/printing/gateways/browserPrintGateway";
import { createRenderedPrintArtifactFactory } from "../src/features/printing/gateways/printArtifactFactory";
import { createWindowsPrintAdapter } from "../src/features/printing/gateways/windowsPrintAdapter";
import { createPrintAgent } from "../windows-print-agent/server.mjs";
import { createHtmlPdfPipeline, inspectA5LandscapePdf } from "../windows-print-agent/html-pdf-renderer.mjs";

const printCss = readFileSync("src/features/printing/styles/print.css", "utf8");
const createDocument = (count: number): PrintRequest["document"] => {
  const exercises = Array.from({ length: count }, (_, index) => ({ id: `row-${index + 1}`, exerciseId: `exercise-${index + 1}`, name: `운동 ${index + 1}`, memo: index === 0 ? "천천히 수축" : "", order: index + 1, configuredSets: index === 0 ? 3 : 4, memberWhy: index === 0 ? "등 근육 집중" : "" }));
  return { templateKey: "basecamp-workout-log-v1", templateVersion: 1, format: "A5-landscape", member: { memberId: "member-1" as PrintRequest["document"]["member"]["memberId"], name: "계약 테스트 회원" }, workoutSessionId: `session-offline-${count}`, bodyParts: ["등"], program: { programId: "program-1" as PrintRequest["document"]["program"]["programId"], title: "로컬 렌더러 프로그램", category: "back" as PrintRequest["document"]["program"]["category"], categoryLabel: "등", difficulty: "beginner" as PrintRequest["document"]["program"]["difficulty"], difficultyLabel: "초급", memo: "", exercises }, printDate: new Date("2026-09-20T00:00:00.000Z"), layout: { density: count > 7 ? "dense" : "relaxed", topBindingSafeAreaMm: 14 } as PrintRequest["document"]["layout"], rows: exercises.map((exercise) => ({ order: exercise.order, exerciseName: exercise.name, exerciseMemo: exercise.memo, memberWhy: exercise.memberWhy, configuredSets: exercise.configuredSets, isBlank: false })) };
};
const factoryFor = (document: PrintRequest["document"]) => createRenderedPrintArtifactFactory({ getMarkup: () => renderToStaticMarkup(React.createElement(WorkoutPrintTemplateV1, { document })), getPrintCss: () => printCss });

const main = async (): Promise<void> => {
  const denseDocument = createDocument(9); const denseFactory = factoryFor(denseDocument); const artifact = await denseFactory.create({ jobId: "preview", document: denseDocument, copies: 1 });
  for (const expected of ["계약 테스트 회원", "session-offline-9", "운동 1", "운동 9", "등 근육 집중", "SET 1", "14mm"]) assert.equal(artifact.content.includes(expected), true, `missing rendered content: ${expected}`);
  assert.equal(artifact.content.includes("http://"), false); assert.equal(artifact.content.includes("https://"), false); assert.equal(artifact.content.includes("<script"), false);

  const submissions: Array<{ path: string; copies: number; bytes: Buffer; pageCount: number }> = [];
  const backend = { submit: async (job: { pdfPath: string; copies: number }) => { const metadata = await inspectA5LandscapePdf(job.pdfPath); submissions.push({ path: job.pdfPath, copies: job.copies, bytes: await readFile(job.pdfPath), pageCount: metadata.pageCount }); return { status: "submitted" as const }; } };
  const agent = createPrintAgent({ port: 43131, allowedOrigins: [], backend }); await agent.listen();
  try {
    for (const count of [1, 9]) { const document = createDocument(count); const adapter = createWindowsPrintAdapter({ endpoint: "http://127.0.0.1:43131", artifactFactory: factoryFor(document), timeoutMs: 20_000 }); assert.deepEqual(await adapter.print({ jobId: `renderer-e2e-${count}`, document, copies: count === 9 ? 2 : 1 }), { status: "submitted" }); }
  } finally { await agent.close(); }
  assert.deepEqual(submissions.map(({ copies, pageCount }) => ({ copies, pageCount })), [{ copies: 1, pageCount: 1 }, { copies: 2, pageCount: 1 }]);
  for (const submission of submissions) { assert.equal(submission.bytes.subarray(0, 5).toString(), "%PDF-"); assert.equal(submission.bytes.length > 10_000, true); await assert.rejects(access(submission.path)); }

  const failureRoot = await mkdtemp(join(tmpdir(), "basecamp-pdf-failure-test-")); const failingPipeline = createHtmlPdfPipeline({ root: failureRoot, renderer: { render: async () => { throw new Error("renderer_failed"); } } });
  await assert.rejects(failingPipeline.create({ jobId: "cleanup", artifact }), /renderer_failed/u); assert.deepEqual(await readdir(failureRoot), []);
  console.log("Windows print contract: WorkoutPrintDocument -> authoritative renderer -> HTML -> Agent -> valid one-page A5 landscape PDF -> backend PASS (1 and 9 exercises)");
};
void main().catch((error) => { console.error(error); process.exitCode = 1; });