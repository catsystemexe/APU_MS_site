import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { prepare, sql, verify, snapshot, T5 } from '../scripts/telemetry/t5-evidence.mjs';
import { createModelUsageRecord, finalizeModelUsageRecord } from '../app/usage-ledger.ts';

const id = () => crypto.randomUUID();
function fixture(groundingCount = 0, inputTokens = 100) {
  const plan = prepare(), session = id(), tab = id(), workflow = id();
  const db = new DatabaseSync(':memory:'); db.exec(readFileSync(new URL('../telemetry/migrations/0001_pilot_v1.sql', import.meta.url), 'utf8'));
  const owner = { session_id: session, tab_id: tab, participant_id: plan.participant, cohort_id: plan.cohort, key_version: 't5-v1' };
  db.prepare('INSERT INTO telemetry_sessions(session_id,tab_id,participant_id,cohort_id,key_version,test_class,notice_version,measurement_version,opened_at,last_interaction_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(session, tab, plan.participant, plan.cohort, 't5-v1', 'tester', 't5-v1', 'pilot-v1', 1000, 1000, 100000);
  const evidence = { provider_basis: 'independent-provider-request-metadata', ui_accepted: true, browser_paths: ['/api/extract', '/api/need-route', '/api/analysis'], pending_call_ids: [], calls: [] };
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
    evidence.pending_call_ids.push(callId);
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
  ['no pending observation', e => e.pending_call_ids = [], /BLOCKED_PENDING_NOT_OBSERVED/],
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
test('snapshot is exclusive, scoped, hashed and has the existing B3 target sidecar', () => {
  const f = fixture(), dir = mkdtempSync(join(tmpdir(), 'apu-t5-'));
  try {
    const source = readFileSync(new URL('../telemetry/migrations/0001_pilot_v1.sql', import.meta.url), 'utf8');
    const data = ['telemetry_sessions', 'telemetry_ai_calls', 'telemetry_events'].flatMap(table => f.db.prepare('SELECT * FROM ' + table).all().map(row => {
      const quote = v => v === null ? 'NULL' : typeof v === 'number' ? String(v) : "'" + v.replaceAll("'", "''") + "'";
      return 'INSERT INTO ' + table + ' VALUES (' + Object.values(row).map(quote).join(',') + ');';
    })).join('\n');
    const input = join(dir, 'snapshot.sql'), output = join(dir, 'telemetry-t5.sqlite'); writeFileSync(input, source + '\n' + data);
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
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('known subtotal beyond USD 1 fails the proposed soft budget rather than claiming a hard cap', () => {
  const f = fixture(0, 300000); try { assert.equal(verify(f.db, f.plan.cohort, f.session, f.evidence).result, 'FAIL_SOFT_BUDGET_EXCEEDED'); } finally { f.db.close(); }
});
