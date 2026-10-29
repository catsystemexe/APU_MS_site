import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { prepare, sql, verify, snapshot, artifactPaths, restorePlan, boundedRestore, windowDecision, T5 } from '../scripts/telemetry/t5-evidence.mjs';
import { createModelUsageRecord, finalizeModelUsageRecord } from '../app/usage-ledger.ts';

const id = () => crypto.randomUUID();
function fixture(groundingCount = 0, inputTokens = 100, plan = prepare()) {
  const session = id(), tab = id(), workflow = id();
  const db = new DatabaseSync(':memory:'); db.exec(readFileSync(new URL('../telemetry/migrations/0001_pilot_v1.sql', import.meta.url), 'utf8'));
  const owner = { session_id: session, tab_id: tab, participant_id: plan.participant, cohort_id: plan.cohort, key_version: 't5-v1' };
  db.prepare('INSERT INTO telemetry_sessions(session_id,tab_id,participant_id,cohort_id,key_version,test_class,notice_version,measurement_version,opened_at,last_interaction_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(session, tab, plan.participant, plan.cohort, 't5-v1', 'tester', 't5-v1', 'pilot-v1', 1000, 1000, 100000);
  const evidence = { provider_basis: 'response-boundary-trace-v1', ui_accepted: true, browser_paths: ['/api/extract', '/api/need-route', '/api/analysis'], lifecycle_observations: [], calls: [] };
  let seq = 0, groundingIndex = 0, primaryId; const extractionTicket = { operationId: id(), requestId: id() };
  for (const operation of ['extraction', ...Array(groundingCount).fill('grounding'), 'need_routing', 'analysis']) {
    const { operationId, requestId } = ['extraction', 'grounding'].includes(operation) ? extractionTicket : { operationId: id(), requestId: id() }; const callId = id();
    const attempt_index = operation === 'grounding' ? groundingIndex++ : 0, fallback_for_call_id = attempt_index === 1 ? primaryId : null;
    if (operation === 'grounding' && attempt_index === 0) primaryId = callId;
    const phase = ['extraction', 'grounding'].includes(operation) ? 'F1' : 'F2', model = ['extraction', 'grounding'].includes(operation) ? 'gpt-5.6-luna' : 'gpt-5.6-terra';
    const rawUsage = { input_tokens: inputTokens, output_tokens: 10, total_tokens: inputTokens + 10 };
    const pending = createModelUsageRecord({ call_id: callId, request_id: requestId, turn_id: null, phase, operation, attempt_index, retry_of_call_id: null, fallback_for_call_id, started_at: '2026-10-29T00:00:00Z', completed_at: null, requested_model: model, reported_model: null, reasoning_effort: 'low', requested_service_tier: 'default', reported_service_tier: null, provider_request_id: null, provider_response_id: null, provider_status: 'unknown', application_status: 'not_applicable', file_search_calls: 0, error: null });
    const record = finalizeModelUsageRecord(pending, { completed_at: '2026-10-29T00:00:01Z', reported_model: model, reported_service_tier: 'default', provider_status: 'completed', application_status: 'accepted', provider_usage: rawUsage, file_search_calls: operation === 'analysis' ? 1 : 0 });
    const identity = { owner, workflow_id: workflow, operation_instance_id: operationId, call_id: callId, request_id: requestId, phase, operation, started_at: 1000, requested_model: model, reasoning_effort: 'low', requested_service_tier: 'default', attempt_index, retry_of_call_id: null, fallback_for_call_id };
    const projection = { schema_version: 1, measurement_version: 'pilot-v1', source: 'server', event_name: 'ai_call_finalized', state: 'final', call_id: callId, request_id: requestId, workflow_id: workflow, operation_instance_id: operationId, phase, operation, attempt_index, retry_of_call_id: null, fallback_for_call_id, started_at: 1000, completed_at: 2000, requested_model: model, reported_model: model, reasoning_effort: 'low', requested_service_tier: 'default', reported_service_tier: 'default', provider_status: 'completed', application_status: 'accepted', usage_source: 'provider_reported', usage: record.usage, file_search_calls: record.file_search_calls, pricing_snapshot: record.pricing_snapshot, pricing_regime: 'standard-30m-estimate', usage_coverage: 'observed', cost_nano_usd: Math.round(record.pricing_snapshot.estimated_cost_usd * 1e9), error_class: null };
    // Emulate actual pending -> final PK upsert, without writing a second accounting row.
    db.prepare('INSERT INTO telemetry_ai_calls VALUES (?,?,?,?,?,?,?,?)').run(callId, session, workflow, 1000, 'pending', JSON.stringify(identity), JSON.stringify({ ...projection, state: 'pending', completed_at: null }), null);
    evidence.lifecycle_observations.push({ call_id: callId, state: 'pending', observed_at: 1000, source: 'd1-sql' }, { call_id: callId, state: 'final', observed_at: 2000, source: 'd1-sql' });
    db.prepare("UPDATE telemetry_ai_calls SET state='final',projection_json=?,cost_nano_usd=? WHERE call_id=? AND state='pending'").run(JSON.stringify(projection), projection.cost_nano_usd, callId);
    evidence.calls.push({ call_id: callId, operation, model, provider_status: 'completed', usage: rawUsage, file_search_calls: record.file_search_calls });
    if (operation === 'grounding') continue; // Server subcalls share the extraction ticket; no invented client grounding event.
    for (const [event_name, payload] of [['operation_requested', { operation_instance_id: operationId, operation, reason: 'initial', prior_operation_id: null }], ['operation_resolved', { operation_instance_id: operationId, outcome: 'accepted' }]]) {
      const e = { schema_version: 1, measurement_version: 'pilot-v1', source: 'client', event_id: id(), event_name, session_id: session, tab_id: tab, workflow_id: workflow, client_seq: seq++, elapsed_ms: 0, payload };
      db.prepare('INSERT INTO telemetry_events VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(e.event_id, session, tab, e.client_seq, workflow, event_name, 1, 'pilot-v1', 1000, 1000, 'unknown', JSON.stringify(e));
    }
  }
  for (const [event_name, payload] of [['workflow_started', { phase: 'F1' }], ['phase_transition', { from: 'F1', to: 'F2', reason: 'user_navigation' }]]) {
    const e = { schema_version: 1, measurement_version: 'pilot-v1', source: 'client', event_id: id(), event_name, session_id: session, tab_id: tab, workflow_id: workflow, client_seq: seq++, elapsed_ms: 0, payload };
    db.prepare('INSERT INTO telemetry_events VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(e.event_id, session, tab, e.client_seq, workflow, event_name, 1, 'pilot-v1', 1000, 1000, 'unknown', JSON.stringify(e));
  }
  const mutate = change => { const row = db.prepare("SELECT * FROM telemetry_ai_calls WHERE json_extract(projection_json,'$.operation')='analysis'").get(); const p = JSON.parse(row.projection_json); change(p, row); db.prepare('UPDATE telemetry_ai_calls SET projection_json=? WHERE call_id=?').run(JSON.stringify(p), row.call_id); };
  return { db, plan, session, evidence, mutate };
}
test('offline plan uses exact DEV HMAC contract and never contains provider credentials', () => {
  const p = prepare(); assert.equal(p.participant, createHmac('sha256', p.secrets.TELEMETRY_PSEUDONYM_KEY).update(p.cohort + '\0catsystem.exe@gmail.com').digest('base64url'));
  assert.notEqual(p.secrets.TELEMETRY_PSEUDONYM_KEY, p.secrets.TELEMETRY_CONTEXT_KEY);
  assert.equal(p.vars.APU_TELEMETRY_METADATA_ENABLED, '0'); assert.equal(p.vars.APU_DEVELOPER_EMAILS, '');
  assert.doesNotMatch(JSON.stringify(p), /OPENAI_API_KEY|APU_VECTOR_STORE_ID|86400/);
});
test('real schema and canonical pricing reconcile three final calls, nullable usage, file_search and events', () => {
  const f = fixture(); try { const r = verify(f.db, f.plan.cohort, f.session, f.evidence); assert.equal(r.result, 'PASS_SQL_PROVIDER_LINKAGE'); assert.equal(r.calls, 3); assert.equal(r.known_cost_nano_usd, 3172000); const status = f.db.prepare(sql(f.plan.cohort, f.session).final).get(); assert.equal(status.pending, 0); assert.equal(status.requested, 3); assert.equal(status.resolved_accepted, 3); } finally { f.db.close(); }
});
for (const [name, mutate, expected] of [
  ['prompt leak', p => p.prompt = T5.observation, /FAIL_FORBIDDEN_KEY/],
  ['raw email value', p => p.reported_model = 'catsystem.exe@gmail.com', /FAIL_FORBIDDEN_VALUE/],
  ['unknown nested identity', (p, row, db) => { const i = JSON.parse(row.identity_json); i.leak = 'opaque'; db.prepare('UPDATE telemetry_ai_calls SET identity_json=? WHERE call_id=?').run(JSON.stringify(i), row.call_id); }, /FAIL_UNKNOWN_JSON_FIELD/],
  ['pending outcome', p => p.state = 'pending', /FAIL_FINALIZATION/],
  ['wrong operation', p => p.operation = 'main_chat', /FAIL_MODEL_OPERATION/],
  ['wrong context', p => p.operation_instance_id = id(), /FAIL_ASSOCIATION/],
  ['missing usage', p => p.usage.input_tokens = null, /FAIL_USAGE/],
  ['missing coverage', p => p.usage_coverage = 'incomplete', /FAIL_COMPLETENESS/],
  ['token mismatch', p => p.usage.normalized_total_tokens++, /FAIL_TOKEN_RELATIONS/],
  ['wrong price', p => p.pricing_snapshot.estimated_cost_usd++, /FAIL_COST/],
]) test('verification rejects ' + name, () => { const f = fixture(); try { f.mutate((p, row) => mutate(p, row, f.db)); assert.throws(() => verify(f.db, f.plan.cohort, f.session, f.evidence), expected); } finally { f.db.close(); } });
for (const [name, change, expected] of [
  ['no independent provider evidence', e => delete e.provider_basis, /BLOCKED_PROVIDER_EVIDENCE/],
  ['not accepted UI', e => e.ui_accepted = false, /FAIL_UI_OR_ROUTE_COUNT/],
  ['unexpected fourth request', e => e.browser_paths.push('/api/chat'), /FAIL_UI_OR_ROUTE_COUNT/],
  ['provider usage null differs from zero', e => e.calls[0].usage.input_tokens_details = { cached_tokens: 0 }, /FAIL_PROVIDER_RECONCILIATION/],
]) test('evidence rejects ' + name, () => { const f = fixture(); try { change(f.evidence); assert.throws(() => verify(f.db, f.plan.cohort, f.session, f.evidence), expected); } finally { f.db.close(); } });
test('SQL scope rejects substitutions and cleanup is exact/stopped/pending guarded', () => {
  assert.throws(() => sql("t5_' OR 1=1--", id()), /BLOCKED_COHORT/);
  const f = fixture(); try { const q = sql(f.plan.cohort, f.session); f.db.exec(q.cleanup); assert.equal(f.db.prepare('SELECT count(*) n FROM telemetry_sessions').get().n, 1); f.db.prepare('UPDATE telemetry_sessions SET stopped_at=3000').run(); f.db.exec(q.cleanup); assert.equal(f.db.prepare('SELECT count(*) n FROM telemetry_sessions').get().n, 0); assert.doesNotMatch(q.cleanup, /DROP|DELETE FROM (?!telemetry_)/); } finally { f.db.close(); }
});

for (const n of [1, 2]) test('conditional grounding shares extraction ownership: ' + n + ' subcalls', () => {
  const f = fixture(n); try { assert.equal(verify(f.db, f.plan.cohort, f.session, f.evidence).calls, 3 + n); } finally { f.db.close(); }
});
test('pending records prevent every cleanup delete', () => {
  const f = fixture(); try {
    f.db.prepare('UPDATE telemetry_sessions SET stopped_at=3000').run();
    f.db.prepare("UPDATE telemetry_ai_calls SET state='pending'").run();
    f.db.exec(sql(f.plan.cohort, f.session).cleanup);
    assert.equal(f.db.prepare('SELECT count(*) n FROM telemetry_ai_calls').get().n, 3);
    assert.equal(f.db.prepare('SELECT count(*) n FROM telemetry_events').get().n, 8);
    assert.equal(f.db.prepare('SELECT count(*) n FROM telemetry_sessions').get().n, 1);
  } finally { f.db.close(); }
});
function exportFixture(db) {
  // Like a SQLite dump, recreate triggers after loading data: stopped sessions legitimately own old events.
  const definitions = db.prepare("SELECT type,sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY rowid").all();
  const source = definitions.filter(r => r.type !== 'trigger').map(r => r.sql + ';').join('\n');
  const triggers = definitions.filter(r => r.type === 'trigger').map(r => r.sql + ';').join('\n');
  const quote = v => v === null ? 'NULL' : typeof v === 'number' ? String(v) : "'" + v.replaceAll("'", "''") + "'";
  return source + '\n' + ['telemetry_sessions', 'telemetry_ai_calls', 'telemetry_events'].flatMap(table => db.prepare('SELECT * FROM ' + table).all().map(row => 'INSERT INTO ' + table + ' VALUES (' + Object.values(row).map(quote).join(',') + ');')).join('\n') + '\n' + triggers;
}
test('snapshot is exclusive, scoped, hashed and has the existing B3 target sidecar', () => {
  const f = fixture(), dir = mkdtempSync(join(tmpdir(), 'apu-t5-'));
  try {
    const input = join(dir, 'snapshot.sql'), output = join(dir, 'telemetry-t5.sqlite'); writeFileSync(input, exportFixture(f.db));
    assert.equal(snapshot(input, output, f.plan.cohort, f.session, process.cwd()).result, 'SNAPSHOT_PRESERVED_NOT_ACCEPTANCE_PASS');
    assert.equal(JSON.parse(readFileSync(output + '.target.json')).test_class, 'tester');
    assert.match(JSON.parse(readFileSync(output + '.sha256.json')).sqlite, /^[a-f0-9]{64}$/);
    assert.throws(() => snapshot(input, output, f.plan.cohort, f.session, process.cwd()), /EEXIST/);
  } finally { f.db.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('actual normal client navigation extracts before entering F2; no internal dialogEvent shortcut', async () => {
  const ts = await import('typescript'), { runInNewContext } = await import('node:vm');
  const { resolveTextDialogEvent, resolveDialogEvent } = await import('../app/dialog-action.ts');
  const { EMPTY_NOTEPAD, compactNotepad, applyCandidates } = await import('../app/notepad-model.ts');
  const { createPilot } = await import('../app/telemetry/pilot.ts');
  const { fetchWithPilot } = await import('../app/telemetry/fetch.ts');
  const source = readFileSync(new URL('../app/apu-client.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('apu-client.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), declarations = new Map();
  const walk = n => { if (ts.isFunctionDeclaration(n) && n.name) declarations.set(n.name.text, n.getText(ast)); ts.forEachChild(n, walk); }; walk(ast);
  const notebook = { ...EMPTY_NOTEPAD, manifestations: [{ id: 'm', text: T5.observation }], goals: [{ id: 'g', text: T5.need }] };
  const calls = [], noop = () => {};
  const c = { pilot: createPilot(), phase: 'intake', isChatReadOnly: false, isLoading: false, isNotepadHydrated: true,
    isDictating: false, notepad: notebook, messages: [], projectEpochRef: { current: 0 }, assistantRequestRef: { current: null },
    chatAtBottomRef: { current: false }, telemetryClockRef: { current: new Map() }, performance, Date, JSON, Response,
    createMessageId: id, createSessionTelemetry: () => ({}), communicationProfile: 'test',
    handleF2OutputNavigation: () => false, collectChatDialogState: () => ({}), compactNotepad, applyCandidates,
    resolveTextDialogEvent, resolveDialogEvent, usesDesktopWorkspaceLayout: () => false,
    fetchWithPilot, fetch: async url => { calls.push(url); return Response.json({ extraction: { situationRelation: 'same', candidates: [] } }); },
    refreshStructuredAnalysis: async () => { calls.push('F2-analysis-boundary'); return { analysis: {} }; },
  };
  for (const name of ['setDialogActionsPreview', 'setSessionTelemetry', 'setMessages', 'setComposerInput', 'setError', 'setFailedInput', 'setIsLoading', 'showF1ProcessingStatus', 'startF1ProcessingSequence', 'collectModelUsageRecords', 'clearF1ProcessingStatus', 'clearDialogActionsPreview', 'setPhase']) c[name] = noop;
  const code = ['requestAssistant', 'sendMessage'].map(n => { assert.ok(declarations.has(n)); return declarations.get(n); }).join('\n');
  const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const send = runInNewContext(compiled + '\nsendMessage;', c);
  await send(T5.navigation);
  assert.deepEqual(calls, ['/api/extract', 'F2-analysis-boundary']);
  assert.equal(resolveTextDialogEvent(T5.navigation, compactNotepad(notebook), 'intake'), 'continue_to_solution');
  assert.equal(resolveTextDialogEvent('Přejít do Rozboru', compactNotepad(notebook), 'intake'), null);
});

test('CLI refuses overwrites, invalid SQL phases and evidence inside the repository without printing keys', () => {
  const dir = mkdtempSync(join(tmpdir(), 'apu-t5-cli-')), helper = new URL('../scripts/telemetry/t5-evidence.mjs', import.meta.url);
  const run = args => { const result = spawnSync(process.execPath, [fileURLToPath(helper), ...args], { encoding: 'utf8' }); if (result.error) throw result.error; return result; };
  try {
    const first = run(['prepare', dir, process.cwd()]); assert.equal(first.status, 0);
    assert.equal(JSON.parse(first.stdout).execution, 'BLOCKED_ACTIVATION_METHOD');
    const plan = JSON.parse(readFileSync(join(dir, 't5-overlay-proposal.json')));
    assert.ok(!first.stdout.includes(plan.secrets.TELEMETRY_PSEUDONYM_KEY));
    assert.equal(run(['prepare', dir, process.cwd()]).status, 1);
    assert.equal(run(['prepare', process.cwd(), process.cwd()]).status, 1);
    assert.equal(run(['sql', plan.cohort, id(), 'anything']).status, 1);
    const guard = run(['execute-reviewed-restore', 'MISSING_CLI', 'MISSING_CONFIG', 'MISSING_LOG', process.cwd(), '1', 'T5_PRESERVING_AND_10220_REVIEWED', 'NO_GUARD']);
    assert.equal(guard.status, 1); assert.match(guard.stderr, /BLOCKED_RESTORE_GUARD/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('known subtotal beyond USD 1 fails the proposed soft budget rather than claiming a hard cap', () => {
  const f = fixture(0, 300000); try { assert.equal(verify(f.db, f.plan.cohort, f.session, f.evidence).result, 'FAIL_SOFT_BUDGET_EXCEEDED'); } finally { f.db.close(); }
});

test('missing SQL pending observations allow final reconciliation but never full hosted lifecycle PASS', () => {
  const f = fixture(); try {
    f.evidence.lifecycle_observations = [];
    const result = verify(f.db, f.plan.cohort, f.session, f.evidence);
    assert.equal(result.reconciliation, 'PASS'); assert.equal(result.lifecycle.status, 'NOT_VERIFIED'); assert.equal(result.result, 'PARTIAL_LIFECYCLE_NOT_VERIFIED');
    f.evidence.lifecycle_observations = [{ call_id: f.evidence.calls[0].call_id, state: 'final', observed_at: 3000, source: 'd1-sql' }];
    assert.equal(verify(f.db, f.plan.cohort, f.session, f.evidence).result, 'PARTIAL_LIFECYCLE_NOT_VERIFIED');
    f.evidence.lifecycle_observations.push({ call_id: f.evidence.calls[0].call_id, state: 'pending', observed_at: 4000, source: 'd1-sql' });
    assert.throws(() => verify(f.db, f.plan.cohort, f.session, f.evidence), /FAIL_LIFECYCLE_ORDER/);
  } finally { f.db.close(); }
});
test('full CLI prepare -> distinct export path -> snapshot flow has no query/export collision', () => {
  const dir = mkdtempSync(join(tmpdir(), 'apu-t5-flow-')); let f;
  const run = args => { const r = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/telemetry/t5-evidence.mjs', import.meta.url)), ...args], { encoding: 'utf8' }); if (r.error) throw r.error; return r; };
  try {
    assert.equal(run(['prepare', dir, process.cwd()]).status, 0);
    f = fixture(0, 100, JSON.parse(readFileSync(join(dir, 't5-overlay-proposal.json'))));
    const paths = JSON.parse(run(['paths', dir, process.cwd()]).stdout);
    assert.equal(new Set(Object.values(paths)).size, Object.values(paths).length);
    const query = readFileSync(paths.final, 'utf8'); assert.match(query, /^SELECT /);
    // Local fixture export into the real handoff path; exclusive creation would reproduce the original bug.
    writeFileSync(paths.exportFinal, exportFixture(f.db), { flag: 'wx' });
    assert.equal(run(['snapshot', paths.exportFinal, paths.snapshotFinal, f.plan.cohort, f.session, process.cwd()]).status, 0);
    assert.equal(readFileSync(paths.final, 'utf8'), query);
    assert.equal(JSON.parse(readFileSync(paths.snapshotFinal + '.target.json')).cohorts[0], f.plan.cohort);
    const e = join(dir, 'provider.json'); f.evidence.lifecycle_observations = []; writeFileSync(e, JSON.stringify(f.evidence));
    const partial = run(['verify', paths.snapshotFinal, f.plan.cohort, f.session, e, process.cwd()]);
    assert.equal(partial.status, 2); assert.equal(JSON.parse(partial.stdout).result, 'PARTIAL_LIFECYCLE_NOT_VERIFIED');
    const plan = restorePlan(paths.restoreConfig, process.cwd());
    assert.equal(plan.args[0], 'rollback'); assert.equal(plan.args[1], T5.baseline); assert.ok(!plan.args.includes('deploy'));
    const c = JSON.parse(readFileSync(paths.restoreConfig)); c.vars = { APU_TELEMETRY_ENABLED: '1' }; writeFileSync(paths.restoreConfig, JSON.stringify(c));
    assert.throws(() => restorePlan(paths.restoreConfig, process.cwd()), /BLOCKED_RESTORE_CONFIG/);
  } finally { f?.db.close(); rmSync(dir, { recursive: true, force: true }); }
});
test('failure deadline is independent of pending completion; snapshots retain pending and cleanup remains blocked', () => {
  const f = fixture(), dir = mkdtempSync(join(tmpdir(), 'apu-t5-pending-'));
  try {
    const opened = 1000, submitted = 2000;
    assert.equal(windowDecision(opened, submitted, submitted + T5.drainMs - 1, 1).action, 'DRAIN_WITHIN_DEADLINE');
    const close = windowDecision(opened, submitted, submitted + T5.drainMs, 1);
    assert.equal(close.action, 'SNAPSHOT_STOP_RESTORE_NOW'); assert.equal(close.cleanup_allowed, false); assert.equal(close.hosted_closed, 'NOT_VERIFIED');
    assert.ok(close.restore_by <= close.absolute_close_by);
    assert.equal(windowDecision(opened, null, opened + T5.windowMs - T5.evidenceMs - T5.restoreMs, 0).action, 'SNAPSHOT_STOP_RESTORE_NOW');
    assert.throws(() => windowDecision(opened, submitted, opened - 1, 1), /BLOCKED_WINDOW_CLOCK/);
    for (const row of f.db.prepare('SELECT call_id,projection_json FROM telemetry_ai_calls').all()) {
      const p = { ...JSON.parse(row.projection_json), state: 'pending', event_name: 'ai_call_started', completed_at: null, cost_nano_usd: null, usage_coverage: 'incomplete' };
      f.db.prepare("UPDATE telemetry_ai_calls SET state='pending',projection_json=?,cost_nano_usd=NULL WHERE call_id=?").run(JSON.stringify(p), row.call_id);
    }
    f.db.prepare('UPDATE telemetry_sessions SET stopped_at=3000').run();
    const paths = artifactPaths(dir, process.cwd()); writeFileSync(paths.exportFailure, exportFixture(f.db), { flag: 'wx' });
    snapshot(paths.exportFailure, paths.snapshotFailure, f.plan.cohort, f.session, process.cwd());
    const copy = new DatabaseSync(paths.snapshotFailure, { readOnly: true });
    try { assert.equal(copy.prepare("SELECT count(*) n FROM telemetry_ai_calls WHERE state='pending' AND json_extract(projection_json,'$.state')='pending' AND cost_nano_usd IS NULL").get().n, 3); } finally { copy.close(); }
    f.db.exec(sql(f.plan.cohort, f.session).cleanup);
    assert.equal(f.db.prepare('SELECT count(*) n FROM telemetry_sessions').get().n, 1);
  } finally { f.db.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('installed Wrangler proves latest-only secret patch, and exact-version deployment restore without code reconstruction', async () => {
  const { runInNewContext } = await import('node:vm'), { createHash } = await import('node:crypto');
  const cli = readFileSync(new URL('../node_modules/wrangler/wrangler-dist/cli.js', import.meta.url), 'utf8');
  assert.equal(JSON.parse(readFileSync(new URL('../node_modules/wrangler/package.json', import.meta.url))).version, '4.150.0');
  assert.equal(createHash('sha256').update(cli).digest('hex'), '71da1f9bcf69a9f56c4ff4f68e71315365d03db8ea11207577b47a8e1a0a1064');
  const patch = cli.slice(cli.indexOf('async function patchLatestWorkerVersionWithSecrets('), cli.indexOf('var versionsSecretNamespace,'));
  const writes = [], fakeFetch = async (config, path, init) => { writes.push({ path, body: JSON.parse(init.body) }); return { id: 'synthetic-version' }; };
  const fn = runInNewContext('(' + patch + ')', { fetchResult2: fakeFetch, getMetricsUsageHeaders: async () => ({}) });
  await fn({ config: {}, accountId: T5.account, scriptName: T5.worker, secrets: { SYNTHETIC: 'fixture-only' } });
  assert.match(writes[0].path, /\/versions\/latest$/);
  assert.deepEqual(writes[0].body.env, { SYNTHETIC: { type: 'secret_text', text: 'fixture-only' } });
  const bulk = cli.slice(cli.indexOf('// src/versions/secrets/bulk.ts'), cli.indexOf('// src/versions/secrets/delete.ts'));
  assert.ok(!bulk.includes('"version-id"') && !bulk.includes('"from-version"'));
  const start = cli.indexOf('async function createDeployment('), end = cli.indexOf('async function patchNonVersionedScriptSettings(', start);
  const deploy = runInNewContext('(' + cli.slice(start, end).trim() + ')', { fetchResult: fakeFetch });
  await deploy({}, T5.account, T5.worker, new Map([[T5.baseline, 100]]), 'T5 bounded window restore');
  assert.deepEqual(writes[1].body.versions, [{ version_id: T5.baseline, percentage: 100 }]);
  assert.deepEqual(Object.keys(writes[1].body).sort(), ['annotations', 'strategy', 'versions']);
  await deploy({}, T5.account, T5.worker, new Map([[T5.baseline, 100]]), 'T5 bounded window restore', true);
  assert.match(writes[2].path, /deployments\?force=true$/);
});

test('bounded restore is explicit, exact-version-only, deadline capped, exclusive and never claims hosted closure', () => {
  const dir = mkdtempSync(join(tmpdir(), 'apu-t5-restore-')), cfg = join(dir, 'restore.json'), log = join(dir, 't5-restore-result-test.jsonl');
  const cli = realpathSync(fileURLToPath(new URL('../node_modules/wrangler/wrangler-dist/cli.js', import.meta.url)));
  writeFileSync(cfg, JSON.stringify({ name: T5.worker, account_id: T5.account, send_metrics: false }));
  const approved = 'T5_PRESERVING_AND_10220_REVIEWED'; let attempts = 0;
  const runner = (file, args, options) => { attempts++; assert.equal(file, process.execPath); assert.deepEqual(args.slice(1), restorePlan(cfg, process.cwd()).args); assert.equal(options.timeout, 10000); assert.equal(options.killSignal, 'SIGKILL'); return { error: { code: 'ETIMEDOUT' }, status: null, stdout: 'PRIVATE_DO_NOT_LOG', stderr: 'PRIVATE_DO_NOT_LOG' }; };
  try {
    assert.throws(() => boundedRestore(cli, cfg, log, process.cwd(), 11000, 'not authorized', runner, () => 1000), /BLOCKED_RESTORE_AUTHORIZATION/);
    assert.throws(() => boundedRestore(cli, cfg, log, process.cwd(), -1, approved, runner, () => 1000), /BLOCKED_WINDOW_CLOCK/);
    assert.equal(attempts, 0);
    const r = boundedRestore(cli, cfg, log, process.cwd(), 11000, approved, runner, () => 1000);
    assert.equal(attempts, 1); assert.equal(r.result, 'RESTORE_UNCONFIRMED'); assert.equal(r.hosted_closed, 'NOT_VERIFIED'); assert.equal(r.cleanup_allowed, false);
    assert.doesNotMatch(readFileSync(log, 'utf8'), /PRIVATE_DO_NOT_LOG/);
    assert.throws(() => boundedRestore(cli, cfg, log, process.cwd(), 11000, approved, runner, () => 1000), /EEXIST/); assert.equal(attempts, 1);
    const ok = boundedRestore(cli, cfg, join(dir, 't5-restore-result-ok.jsonl'), process.cwd(), 1000000, approved, (_file, _args, options) => { assert.equal(options.timeout, 60000); return { status: 0 }; }, () => 1000);
    assert.equal(ok.result, 'RESTORE_COMMAND_COMPLETED_READBACK_REQUIRED'); assert.equal(ok.hosted_closed, 'NOT_VERIFIED');
    const overdue = boundedRestore(cli, cfg, join(dir, 't5-restore-result-overdue.jsonl'), process.cwd(), 999, approved, (_file, _args, options) => { assert.equal(options.timeout, 60000); return { status: 0 }; }, () => 1000);
    assert.equal(overdue.deadline_missed, true); assert.equal(overdue.result, 'RESTORE_COMMAND_COMPLETED_READBACK_REQUIRED'); assert.equal(overdue.hosted_closed, 'NOT_VERIFIED');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
