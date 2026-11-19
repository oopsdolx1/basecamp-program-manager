#!/usr/bin/env node
/*
 * READ-ONLY integrity audit of the stored Program documents (the prescription source of truth).
 * Looks for damage the former Program Studio read→save bug could have written into the source itself, plus shape
 * anomalies that break projection/recommendation. Never writes; Firestore access is `.get()` on basecamp-c1710 only.
 *
 * Inputs (pick one):
 *   --programs <file.json> [--runtime <file.json>]   exported snapshot (formats: see verify-production-program-source.ts)
 *   --from-firestore                                  Application Default Credentials, basecamp-c1710 / basecamp_production
 * Options: --condition-lab <path> (firebase-admin location, default Z:/DEV/Projects/condition-lab)
 *          --expect-total 36 --expect-active 26 --expect-archived 10 --expect-runtime 59 --json <out.json>
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PRODUCTION_PROJECT_ID = 'basecamp-c1710';
const PRODUCTION_APP_ID = 'basecamp_production';
const args = process.argv.slice(2);
const option = (name) => { const index = args.indexOf(`--${name}`); return index >= 0 ? args[index + 1] : undefined; };
const flag = (name) => args.includes(`--${name}`);
const expect = { total: Number(option('expect-total') ?? 36), active: Number(option('expect-active') ?? 26), archived: Number(option('expect-archived') ?? 10), runtime: Number(option('expect-runtime') ?? 59) };
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const plain = (value) => (value && typeof value.toMillis === 'function' ? value.toMillis() : Array.isArray(value) ? value.map(plain) : isRecord(value) ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)])) : value);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIRESTORE_AUTO_ID = /^[A-Za-z0-9]{20}$/;
const looksGenerated = (value) => typeof value === 'string' && (UUID.test(value) || FIRESTORE_AUTO_ID.test(value));

const normalizePrograms = (input) => {
  const list = isRecord(input) && Array.isArray(input.programs) ? input.programs : isRecord(input) && Array.isArray(input.documents) ? input.documents : input;
  if (Array.isArray(list)) return list.map((item) => (isRecord(item.data) ? [String(item.id ?? item.docId), item.data] : [String(item.docId ?? item.id), item]));
  if (isRecord(list)) return Object.entries(list).filter(([, value]) => isRecord(value));
  throw new Error('Unrecognized programs snapshot format.');
};

const load = async () => {
  if (!flag('from-firestore')) {
    if (!option('programs')) throw new Error('--programs <file> or --from-firestore is required.');
    const runtimeRaw = option('runtime') ? JSON.parse(readFileSync(option('runtime'), 'utf8')) : null;
    return { source: `snapshot:${option('programs')}`, programs: normalizePrograms(JSON.parse(readFileSync(option('programs'), 'utf8'))), runtime: runtimeRaw && isRecord(runtimeRaw.runtime) ? runtimeRaw.runtime : runtimeRaw };
  }
  const conditionLab = resolve(option('condition-lab') ?? 'Z:/DEV/Projects/condition-lab');
  const require = createRequire(pathToFileURL(`${conditionLab}/package.json`));
  const { initializeApp, applicationDefault } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const app = initializeApp({ credential: applicationDefault(), projectId: PRODUCTION_PROJECT_ID }, 'readonly-program-integrity-audit');
  if (app.options.projectId !== PRODUCTION_PROJECT_ID) throw new Error(`Refusing to read a project other than ${PRODUCTION_PROJECT_ID}.`);
  const db = getFirestore(app);
  const base = `artifacts/${PRODUCTION_APP_ID}/public/data`;
  const programs = (await db.collection(`${base}/programs`).get()).docs.map((doc) => [doc.id, plain(doc.data())]);
  const runtime = await db.doc(`${base}/sharedKnowledgeRuntime/current`).get();
  return { source: `firestore:${PRODUCTION_PROJECT_ID}/${PRODUCTION_APP_ID} (read-only .get())`, programs, runtime: runtime.exists ? plain(runtime.data()) : null };
};

const auditProgram = (id, data, catalogIds) => {
  const rows = Array.isArray(data.exercises) ? data.exercises : [];
  const findings = [];
  const add = (code, detail) => findings.push(detail === undefined ? code : `${code}: ${detail}`);
  const sets = rows.map((row) => row?.sets);
  const orders = rows.map((row) => row?.order);
  const catalogKnown = catalogIds.size > 0;

  if (data.isArchived !== undefined && typeof data.isArchived !== 'boolean') add('ARCHIVE_FLAG_NOT_BOOLEAN', JSON.stringify(data.isArchived)); // server `=== true` vs client fallback disagree
  if (!rows.length) add('NO_EXERCISES');
  if (rows.length >= 9) add('EXERCISE_COUNT_GE_9', rows.length);
  if (rows.length >= 2 && sets.every((value) => Number(value) === 1)) add('ALL_SETS_ONE');
  if (sets.some((value) => Number(value) > 5)) add('SETS_GT_5', sets.filter((value) => Number(value) > 5).join(','));
  if (sets.some((value) => !(typeof value === 'number' && Number.isFinite(value) && value >= 1))) add('SETS_MISSING_OR_INVALID', sets.map((value) => JSON.stringify(value)).join(','));

  const numericOrders = orders.filter((value) => typeof value === 'number' && Number.isFinite(value));
  if (numericOrders.length !== rows.length) add('ORDER_MISSING', `${rows.length - numericOrders.length}/${rows.length}`);
  if (new Set(numericOrders).size !== numericOrders.length) add('ORDER_DUPLICATE', numericOrders.join(','));
  if (numericOrders.includes(0)) add('ORDER_ZERO');
  const sorted = [...numericOrders].sort((a, b) => a - b);
  if (sorted.length && sorted.some((value, index) => value !== sorted[0] + index)) add('ORDER_NON_CONSECUTIVE', sorted.join(','));
  if (numericOrders.length === rows.length && orders.some((value, index) => index > 0 && value < orders[index - 1])) add('ORDER_ARRAY_UNSORTED');

  rows.forEach((row, index) => {
    const at = `#${index + 1}`;
    if (!isRecord(row)) return add('ROW_NOT_OBJECT', at);
    const { id: rowId, name, displayName, catalogExerciseId: catalogId } = row;
    if (typeof name !== 'string' || !name.trim()) add('ROW_NAME_MISSING', at);
    if (looksGenerated(name)) add('NAME_LOOKS_LIKE_ID', `${at} ${name}`);
    if (looksGenerated(displayName)) add('DISPLAYNAME_LOOKS_LIKE_ID', `${at} ${displayName}`);
    if (typeof name === 'string' && (name === rowId || name === catalogId)) add('NAME_EQUALS_ID', `${at} ${name}`);
    if (catalogId !== undefined && typeof catalogId !== 'string') add('CATALOG_ID_NOT_STRING', at);
    if (typeof catalogId === 'string') {
      if (catalogId === rowId) add('CATALOG_ID_EQUALS_ROW_ID', `${at} ${catalogId}`);
      if (UUID.test(catalogId) && (!catalogKnown || !catalogIds.has(catalogId))) add('CATALOG_ID_UUID_NOT_IN_RUNTIME', `${at} ${catalogId}`);
      if (catalogKnown && !catalogIds.has(catalogId)) add('METADATA_MISSING', `${at} ${catalogId}`);
    } else {
      add('LEGACY_NO_CATALOG_ID', at); // also metadataMissing for the kiosk
      if (looksGenerated(rowId) === false && typeof rowId !== 'string') add('LEGACY_NO_ROW_ID', at);
    }
    if (typeof rowId !== 'string' || !rowId) add('ROW_ID_MISSING', at);
  });
  if (new Set(rows.map((row) => row?.id).filter(Boolean)).size !== rows.filter((row) => row?.id).length) add('ROW_ID_DUPLICATE');

  // Signature of a former Program Studio re-save (C bug): every row rewritten to sets 1, order 1..n, displayName === name.
  const studioShape = rows.length >= 2 && rows.every((row) => isRecord(row) && Number(row.sets) === 1 && typeof row.displayName === 'string' && row.displayName === row.name && UUID.test(String(row.id)))
    && orders.every((value, index) => value === index + 1);
  if (studioShape) add('STUDIO_RESAVE_SIGNATURE');
  return findings;
};

const DAMAGE_CODES = new Set(['ALL_SETS_ONE', 'STUDIO_RESAVE_SIGNATURE', 'NAME_LOOKS_LIKE_ID', 'DISPLAYNAME_LOOKS_LIKE_ID', 'NAME_EQUALS_ID', 'CATALOG_ID_EQUALS_ROW_ID', 'CATALOG_ID_UUID_NOT_IN_RUNTIME']);

const main = async () => {
  const { source, programs, runtime } = await load();
  const runtimeItems = Array.isArray(runtime?.items) ? runtime.items.filter((item) => item?.status === 'active' && item.id) : [];
  const catalogIds = new Set(runtimeItems.map((item) => String(item.id)));
  const results = programs.map(([id, data]) => ({ id, title: typeof data.title === 'string' ? data.title : '', archived: data.isArchived === true, exercises: Array.isArray(data.exercises) ? data.exercises.length : 0, updatedAt: data.updatedAt ?? null, findings: auditProgram(id, data, catalogIds) }));
  const codeOf = (finding) => finding.split(':')[0];
  const count = (code) => results.filter((result) => result.findings.some((finding) => codeOf(finding) === code)).length;
  const rowCount = (code) => results.reduce((sum, result) => sum + result.findings.filter((finding) => codeOf(finding) === code).length, 0);
  const active = results.filter((result) => !result.archived);
  const suspected = results.filter((result) => result.findings.some((finding) => DAMAGE_CODES.has(codeOf(finding))));
  const summary = {
    source, runtimeExercises: catalogIds.size,
    counts: { total: results.length, active: active.length, archived: results.length - active.length, ok: results.length === expect.total && active.length === expect.active && results.length - active.length === expect.archived && catalogIds.size === expect.runtime ? 'OK' : `UNEXPECTED (expected ${expect.total}/${expect.active}/${expect.archived}, runtime ${expect.runtime})` },
    suspectedDamagedPrograms: suspected.length,
    programs: { ALL_SETS_ONE: count('ALL_SETS_ONE'), STUDIO_RESAVE_SIGNATURE: count('STUDIO_RESAVE_SIGNATURE'), EXERCISE_COUNT_GE_9: count('EXERCISE_COUNT_GE_9'), SETS_GT_5: count('SETS_GT_5'), ORDER_MISSING: count('ORDER_MISSING'), ORDER_DUPLICATE: count('ORDER_DUPLICATE'), ORDER_ZERO: count('ORDER_ZERO'), ORDER_NON_CONSECUTIVE: count('ORDER_NON_CONSECUTIVE'), ORDER_ARRAY_UNSORTED: count('ORDER_ARRAY_UNSORTED'), ARCHIVE_FLAG_NOT_BOOLEAN: count('ARCHIVE_FLAG_NOT_BOOLEAN'), NO_EXERCISES: count('NO_EXERCISES') },
    rows: { NAME_LOOKS_LIKE_ID: rowCount('NAME_LOOKS_LIKE_ID'), DISPLAYNAME_LOOKS_LIKE_ID: rowCount('DISPLAYNAME_LOOKS_LIKE_ID'), NAME_EQUALS_ID: rowCount('NAME_EQUALS_ID'), CATALOG_ID_UUID_NOT_IN_RUNTIME: rowCount('CATALOG_ID_UUID_NOT_IN_RUNTIME'), CATALOG_ID_EQUALS_ROW_ID: rowCount('CATALOG_ID_EQUALS_ROW_ID'), METADATA_MISSING: rowCount('METADATA_MISSING'), LEGACY_NO_CATALOG_ID: rowCount('LEGACY_NO_CATALOG_ID'), ROW_ID_MISSING: rowCount('ROW_ID_MISSING'), SETS_MISSING_OR_INVALID: count('SETS_MISSING_OR_INVALID') },
    note: catalogIds.size ? undefined : 'No runtime supplied: METADATA_MISSING and runtime matching were not evaluated.',
  };
  for (const result of results) if (result.findings.length) console.log(`${suspected.includes(result) ? 'SUSPECT' : 'NOTE   '} ${result.archived ? '[archived] ' : ''}${result.id} ${result.title} (${result.exercises})\n          ${result.findings.join('\n          ')}`);
  console.log(JSON.stringify(summary, null, 2));
  if (option('json')) writeFileSync(option('json'), JSON.stringify({ summary, results }, null, 2));
};

main().catch((error) => { console.error(error?.message ?? error); process.exit(2); });
