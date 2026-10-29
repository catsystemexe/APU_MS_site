import { randomBytes, createHmac, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, lstatSync, realpathSync } from 'node:fs';
import { resolve, isAbsolute, join, relative, sep, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

// Offline preparation/assertions only. No fetch, subprocess, credentials lookup or remote executor.
export const T5 = Object.freeze({ worker: 'apu-ms-site-dev', baseline: '732bf950-30cf-444a-90fc-8927d9c8b16c',
  source: 'd706a55c7ff80b1439079badfda88c9baa5807c4', database: 'apu-ms-site-dev-telemetry',
  observation: 'Ve smyšlené skupině při společném stavění po dlouhém slovním zadání několik účastníků nezačne pracovat; po krátké ukázce se zapojí.',
  need: 'Potřebuji porozumět tomu, jak délka a podoba zadání souvisí se zapojením do společné činnosti.',
  navigation: 'Přejít do fáze 2' });
const uuid = v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const requireThat = (v, code) => { if (!v) throw Error(code); };
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const count = v => Number.isSafeInteger(v) && v >= 0;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const keys = (v, allowed) => requireThat(object(v) && Object.keys(v).every(k => allowed.includes(k)), 'FAIL_UNKNOWN_JSON_FIELD');
export function scope(cohort, session) {
  requireThat(/^t5_\d{8}_[a-f0-9]{8}$/.test(cohort), 'BLOCKED_COHORT');
  if (session !== undefined) requireThat(uuid(session), 'BLOCKED_SESSION');
  return { cohort, session };
}
export function prepare() {
  const cohort = 't5_' + new Date().toISOString().slice(0, 10).replaceAll('-', '') + '_' + randomBytes(4).toString('hex');
  const pseudonymKey = randomBytes(32).toString('base64url'), contextKey = randomBytes(32).toString('base64url');
  const participant = createHmac('sha256', pseudonymKey).update(cohort + '\0catsystem.exe@gmail.com').digest('base64url');
  return { kind: 'apu-t5-overlay-PROPOSAL-NOT-A-DEPLOYMENT-CONFIG', worker: T5.worker, baseline: T5.baseline, cohort, participant,
    vars: { APU_DEVELOPER_EMAILS: '', APU_TELEMETRY_ENABLED: '1', APU_TELEMETRY_METADATA_ENABLED: '0',
      APU_TELEMETRY_ENV: 'dev', APU_TELEMETRY_HOSTNAME: 'apu-ms-site-dev.catsystem-exe.workers.dev',
      APU_TELEMETRY_SYNTHETIC: '0', APU_TELEMETRY_PRIVACY_APPROVED: '1', APU_TELEMETRY_COHORT: cohort,
      APU_TELEMETRY_KEY_VERSION: 't5-v1', APU_TELEMETRY_NOTICE_VERSION: 't5-v1',
      APU_TELEMETRY_NOTICE_TEXT: 'Dobrovolné dočasné technické měření jednoho smyšleného průchodu APU; bez obsahu Zápisníku a odpovědí. Měření lze zastavit.',
      APU_TELEMETRY_ELIGIBLE: participant }, secrets: { TELEMETRY_PSEUDONYM_KEY: pseudonymKey, TELEMETRY_CONTEXT_KEY: contextKey } };
}
export function sql(cohort, session) {
  scope(cohort, session);
  const selected = `SELECT session_id FROM telemetry_sessions WHERE cohort_id='${cohort}' AND test_class='tester'${session ? ` AND session_id='${session}'` : ''}`;
  return {
    before: `SELECT (SELECT count(*) FROM telemetry_sessions) sessions,(SELECT count(*) FROM telemetry_events) events,(SELECT count(*) FROM telemetry_ai_calls) ai_calls;`,
    observe: `SELECT a.call_id,a.state,json_extract(a.projection_json,'$.operation') operation,json_extract(a.projection_json,'$.operation_instance_id') operation_instance_id FROM telemetry_ai_calls a WHERE a.session_id IN (${selected}) ORDER BY a.call_id;`,
    final: `SELECT (SELECT count(*) FROM telemetry_sessions WHERE session_id IN (${selected})) sessions,(SELECT count(*) FROM telemetry_ai_calls WHERE session_id IN (${selected})) ai_calls,(SELECT count(*) FROM telemetry_ai_calls WHERE session_id IN (${selected}) AND state='pending') pending,(SELECT count(*) FROM telemetry_ai_calls WHERE session_id IN (${selected}) AND state='final') final,(SELECT count(*) FROM telemetry_events WHERE session_id IN (${selected}) AND event_name='operation_requested') requested,(SELECT count(*) FROM telemetry_events WHERE session_id IN (${selected}) AND event_name='operation_resolved' AND json_extract(event_json,'$.payload.outcome')='accepted') resolved_accepted,(SELECT count(*) FROM telemetry_sessions WHERE session_id NOT IN (${selected})) outside_sessions;`,
    cleanup: session ? `-- ONLY after verified protected snapshot, stopped session and separate cleanup authorization.\nDELETE FROM telemetry_events WHERE session_id IN (${selected}) AND EXISTS (SELECT 1 FROM telemetry_sessions WHERE session_id='${session}' AND stopped_at IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM telemetry_ai_calls WHERE session_id IN (${selected}) AND state='pending');\nDELETE FROM telemetry_ai_calls WHERE session_id IN (${selected}) AND EXISTS (SELECT 1 FROM telemetry_sessions WHERE session_id='${session}' AND stopped_at IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM telemetry_ai_calls WHERE session_id IN (${selected}) AND state='pending');\nDELETE FROM telemetry_sessions WHERE session_id IN (${selected}) AND stopped_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM telemetry_ai_calls WHERE session_id IN (${selected}));` : '-- BLOCKED: exact session ID required; no cleanup SQL generated.',
  };
}
const projectionKeys = 'schema_version measurement_version source event_name state call_id request_id workflow_id operation_instance_id phase operation attempt_index retry_of_call_id fallback_for_call_id started_at completed_at requested_model reported_model reasoning_effort requested_service_tier reported_service_tier provider_status application_status usage_source usage file_search_calls pricing_snapshot pricing_regime usage_coverage cost_nano_usd error_class'.split(' ');
const usageKeys = 'input_tokens cached_input_tokens cache_write_tokens output_tokens reasoning_tokens provider_total_tokens normalized_total_tokens has_invalid_values'.split(' ');
export function privacy(value, forbiddenValues = []) {
  const forbiddenKey = /^(prompt|messages?|instructions|notebook|content|text|source_?quote|email|ip|ip_address|user_agent|jwt|cookies?|authorization|api_key|credentials?|provider_request_id|provider_response_id)$/i;
  const visit = v => {
    if (typeof v === 'string') requireThat(!/@|bearer\s|sk-|společném stavění|délka a podoba zadání/i.test(v) && forbiddenValues.every(secret => !secret || !v.includes(secret)), 'FAIL_FORBIDDEN_VALUE');
    else if (Array.isArray(v)) v.forEach(visit);
    else if (object(v)) for (const [k, item] of Object.entries(v)) { requireThat(!forbiddenKey.test(k), 'FAIL_FORBIDDEN_KEY'); visit(item); }
  };
  visit(value);
}
export function verify(db, cohort, session, evidence, forbiddenValues = []) {
  scope(cohort, session);
  requireThat(object(evidence) && evidence.provider_basis === 'independent-provider-request-metadata', 'BLOCKED_PROVIDER_EVIDENCE');
  requireThat(evidence.ui_accepted === true && same(evidence.browser_paths, ['/api/extract', '/api/need-route', '/api/analysis']), 'FAIL_UI_OR_ROUTE_COUNT');
  requireThat(same(db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name), ['telemetry_ai_calls', 'telemetry_events', 'telemetry_sessions']), 'FAIL_SNAPSHOT_TABLES');
  const sessions = db.prepare('SELECT * FROM telemetry_sessions').all();
  requireThat(sessions.length === 1 && sessions[0].session_id === session && sessions[0].cohort_id === cohort && sessions[0].test_class === 'tester' && /^[a-zA-Z0-9_-]{43}$/.test(sessions[0].participant_id) && uuid(sessions[0].tab_id) && sessions[0].key_version === 't5-v1' && sessions[0].notice_version === 't5-v1', 'FAIL_SCOPE');
  const rows = db.prepare('SELECT * FROM telemetry_ai_calls').all();
  requireThat(rows.length >= 3 && rows.length <= 5 && new Set(rows.map(r => r.call_id)).size === rows.length, 'FAIL_CALL_COUNT');
  requireThat(Array.isArray(evidence.calls) && evidence.calls.length === rows.length && new Set(evidence.calls.map(c => c.call_id)).size === rows.length, 'BLOCKED_PROVIDER_COUNT');
  requireThat(Array.isArray(evidence.pending_call_ids) && rows.every(r => evidence.pending_call_ids.includes(r.call_id)), 'BLOCKED_PENDING_NOT_OBSERVED');
  const events = db.prepare('SELECT * FROM telemetry_events').all();
  const payloads = { activity_interval: ['start_ms', 'end_ms', 'last_interaction_ms', 'phase'], workflow_started: ['phase'], phase_transition: ['from', 'to', 'reason'], operation_requested: ['operation_instance_id', 'operation', 'reason', 'prior_operation_id'], operation_resolved: ['operation_instance_id', 'outcome', 'error_class'], document_accepted: ['output_id', 'representation', 'format'], session_closed: ['reason'] };
  const parsedEvents = events.map(r => {
    requireThat(r.session_id === session, 'FAIL_EVENT_OWNER'); const e = JSON.parse(r.event_json); privacy(e, forbiddenValues);
    keys(e, 'schema_version measurement_version source event_id event_name session_id tab_id workflow_id client_seq elapsed_ms payload'.split(' '));
    requireThat(payloads[e.event_name], 'FAIL_UNEXPECTED_EVENT'); keys(e.payload, payloads[e.event_name]);
    requireThat(Object.entries(e.payload).every(([key, value]) => value === null || typeof value === 'number' && count(value) || typeof value === 'string' &&
      (key.endsWith('_id') ? uuid(value) : ['F1', 'F2', 'F3', 'unknown', 'user_navigation', 'controller_instruction', 'return', 'extraction', 'need_routing', 'analysis', 'initial', 'accepted', 'baseline', 'logout', 'hidden_close', 'idle'].includes(value))), 'FAIL_EVENT_PAYLOAD');
    requireThat(e.schema_version === 1 && e.measurement_version === 'pilot-v1' && e.source === 'client' && uuid(e.event_id) && e.event_id === r.event_id && e.event_name === r.event_name && e.client_seq === r.client_seq && e.workflow_id === r.workflow_id && (e.workflow_id === null || uuid(e.workflow_id)) && count(e.elapsed_ms) && e.session_id === session && e.tab_id === sessions[0].tab_id, 'FAIL_EVENT_OWNER'); return e;
  });
  let total = 0; const operations = new Set(), workflows = new Set();
  for (const row of rows) {
    const p = JSON.parse(row.projection_json), identity = JSON.parse(row.identity_json);
    privacy(identity, forbiddenValues); privacy(p, forbiddenValues); keys(p, projectionKeys); keys(p.usage, usageKeys);
    keys(identity, ['owner', ...'workflow_id operation_instance_id call_id request_id phase operation started_at requested_model reasoning_effort requested_service_tier attempt_index retry_of_call_id fallback_for_call_id'.split(' ')]);
    keys(identity.owner, ['session_id', 'tab_id', 'participant_id', 'cohort_id', 'key_version']);
    keys(p.pricing_snapshot, 'pricing_version currency context_band service_tier tier_source rates_per_million file_search_rate_per_1000 estimated_cost_usd status'.split(' '));
    keys(p.pricing_snapshot.rates_per_million, ['input', 'cached_input', 'cache_write', 'output']);
    requireThat(row.session_id === session && identity.owner?.session_id === session && identity.owner?.participant_id === sessions[0].participant_id && identity.owner?.cohort_id === cohort && identity.owner?.tab_id === sessions[0].tab_id && identity.owner?.key_version === sessions[0].key_version, 'FAIL_CALL_OWNER');
    requireThat(uuid(p.call_id) && p.call_id === row.call_id && uuid(p.request_id) && uuid(p.workflow_id) && uuid(p.operation_instance_id) && row.workflow_id === p.workflow_id && identity.operation_instance_id === p.operation_instance_id && identity.request_id === p.request_id, 'FAIL_ASSOCIATION');
    requireThat(p.schema_version === 1 && p.measurement_version === 'pilot-v1' && p.source === 'server' && p.error_class === null && p.requested_service_tier === 'default' && (p.reported_service_tier === null || p.reported_service_tier === 'default'), 'FAIL_PROJECTION_CONTRACT');
    requireThat(p.state === 'final' && row.state === 'final' && p.event_name === 'ai_call_finalized' && p.provider_status === 'completed' && p.application_status === 'accepted' && p.usage_source === 'provider_reported', 'FAIL_FINALIZATION');
    const f1 = ['extraction', 'grounding'].includes(p.operation), model = f1 ? 'gpt-5.6-luna' : 'gpt-5.6-terra';
    requireThat(['extraction', 'grounding', 'need_routing', 'analysis'].includes(p.operation) && p.phase === (f1 ? 'F1' : 'F2') && p.requested_model === model && typeof p.reported_model === 'string' && (p.reported_model === model || new RegExp('^' + model.replaceAll('.', '\\.') + '-\\d{4}-\\d{2}-\\d{2}$').test(p.reported_model)) && p.reasoning_effort === 'low' && p.retry_of_call_id === null, 'FAIL_MODEL_OPERATION');
    requireThat(p.operation === 'grounding' && p.attempt_index === 1 ? uuid(p.fallback_for_call_id) && rows.some(r => { const prior = JSON.parse(r.projection_json); return r.call_id === p.fallback_for_call_id && prior.operation === 'grounding' && prior.attempt_index === 0 && prior.operation_instance_id === p.operation_instance_id; }) : p.attempt_index === 0 && p.fallback_for_call_id === null, 'FAIL_ATTEMPT');
    requireThat(Object.keys(identity).filter(k => k !== 'owner').every(k => identity[k] === p[k]), 'FAIL_IDENTITY_PROJECTION');
    const ticketOperation = p.operation === 'grounding' ? 'extraction' : p.operation;
    requireThat(count(p.completed_at) && p.completed_at >= p.started_at && p.started_at === row.started_at && p.usage_coverage === 'observed', 'FAIL_COMPLETENESS');
    const u = p.usage;
    requireThat(usageKeys.every(k => k === 'has_invalid_values' ? u[k] === false : u[k] === null || count(u[k])) && count(u.input_tokens) && count(u.output_tokens), 'FAIL_USAGE');
    requireThat(u.normalized_total_tokens === u.input_tokens + u.output_tokens && (u.cached_input_tokens ?? 0) + (u.cache_write_tokens ?? 0) <= u.input_tokens && (u.reasoning_tokens ?? 0) <= u.output_tokens && (u.provider_total_tokens === null || u.provider_total_tokens === u.normalized_total_tokens), 'FAIL_TOKEN_RELATIONS');
    const call = evidence.calls.find(c => c.call_id === row.call_id);
    requireThat(call && object(call.usage), 'BLOCKED_PROVIDER_USAGE');
    const raw = call.usage;
    const reportedUsage = { input_tokens: raw.input_tokens ?? null, output_tokens: raw.output_tokens ?? null,
      cached_input_tokens: raw.input_tokens_details?.cached_tokens ?? null, cache_write_tokens: raw.input_tokens_details?.cache_write_tokens ?? null,
      reasoning_tokens: raw.output_tokens_details?.reasoning_tokens ?? null, provider_total_tokens: raw.total_tokens ?? null,
      normalized_total_tokens: raw.input_tokens === undefined || raw.output_tokens === undefined ? null : raw.input_tokens + raw.output_tokens, has_invalid_values: false };
    requireThat(call.operation === p.operation && call.model === p.reported_model && call.provider_status === p.provider_status && usageKeys.every(k => Object.is(reportedUsage[k], u[k])) && call.file_search_calls === p.file_search_calls, 'FAIL_PROVIDER_RECONCILIATION');
    requireThat(p.operation === 'analysis' || p.file_search_calls === 0, 'FAIL_ROUTER_FILE_SEARCH');
    const price = p.pricing_snapshot, rates = price.rates_per_million;
    requireThat(['reported', 'requested'].includes(price.tier_source) && price.status === 'priced' && price.currency === 'USD' && price.pricing_version === 'openai-standard-2026-08-25' && price.service_tier === 'default' && p.pricing_regime === 'standard-30m-estimate' && price.file_search_rate_per_1000 === 2.5 && rates && ['input', 'cached_input', 'cache_write', 'output'].every(k => Object.hasOwn(rates, k)) && Object.values(rates).every(v => typeof v === 'number' && v >= 0) && count(p.file_search_calls), 'FAIL_PRICING');
    const expectedRates = model === 'gpt-5.6-luna' ? (u.input_tokens > 272000 ? [0.4, 0.04, 0.5, 1.8] : [0.2, 0.02, 0.25, 1.2]) : (u.input_tokens > 272000 ? [4, 0.4, 5, 18] : [2, 0.2, 2.5, 12]);
    requireThat(price.context_band === (u.input_tokens > 272000 ? 'long' : 'short') && ['input', 'cached_input', 'cache_write', 'output'].every((k, i) => rates[k] === expectedRates[i]), 'FAIL_PRICE_CATALOG');
    const cost = ((u.input_tokens - (u.cached_input_tokens ?? 0) - (u.cache_write_tokens ?? 0)) * rates.input + (u.cached_input_tokens ?? 0) * rates.cached_input + (u.cache_write_tokens ?? 0) * rates.cache_write + u.output_tokens * rates.output) / 1e6 + p.file_search_calls * price.file_search_rate_per_1000 / 1000;
    requireThat(Math.abs(cost - price.estimated_cost_usd) < 1e-12 && row.cost_nano_usd === Math.round(cost * 1e9) && p.cost_nano_usd === row.cost_nano_usd, 'FAIL_COST');
    requireThat(parsedEvents.some(e => e.event_name === 'operation_requested' && e.workflow_id === p.workflow_id && e.payload.operation_instance_id === p.operation_instance_id && e.payload.operation === ticketOperation) && parsedEvents.some(e => e.event_name === 'operation_resolved' && e.workflow_id === p.workflow_id && e.payload.operation_instance_id === p.operation_instance_id && e.payload.outcome === 'accepted'), 'BLOCKED_CLIENT_EVENTS');
    operations.add(p.operation); workflows.add(p.workflow_id); total += row.cost_nano_usd;
  }
  requireThat(operations.has('extraction') && operations.has('need_routing') && operations.has('analysis') && workflows.size === 1, 'FAIL_WORKFLOW');
  const byOperation = op => rows.map(r => JSON.parse(r.projection_json)).filter(p => p.operation === op);
  requireThat(['extraction', 'need_routing', 'analysis'].every(op => byOperation(op).length === 1) && byOperation('grounding').length <= 2 && new Set(byOperation('grounding').map(p => p.attempt_index)).size === byOperation('grounding').length, 'FAIL_OPERATION_COUNT');
  const workflow = [...workflows][0];
  requireThat(parsedEvents.filter(e => e.event_name === 'workflow_started' && e.workflow_id === workflow && e.payload.phase === 'F1').length === 1 && parsedEvents.filter(e => e.event_name === 'phase_transition' && e.workflow_id === workflow && e.payload.from === 'F1' && e.payload.to === 'F2' && e.payload.reason === 'user_navigation').length === 1 && parsedEvents.filter(e => e.event_name === 'operation_requested').length === 3 && parsedEvents.filter(e => e.event_name === 'operation_resolved').length === 3, 'FAIL_WORKFLOW_EVENTS');
  const extraction = byOperation('extraction')[0];
  requireThat(byOperation('grounding').every(p => p.operation_instance_id === extraction.operation_instance_id && p.request_id === extraction.request_id), 'FAIL_GROUNDING_TICKET');
  requireThat(!db.prepare('PRAGMA foreign_key_check').all().length, 'FAIL_FOREIGN_KEYS');
  return { result: total > 1e9 ? 'FAIL_SOFT_BUDGET_EXCEEDED' : 'PASS_SQL_PROVIDER_LINKAGE', calls: rows.length, final: rows.length, pending: 0, known_cost_nano_usd: total, pricing_is_invoice: false };
}
export function snapshot(sqlPath, database, cohort, session, repoPath) {
  scope(cohort, session); privatePath(sqlPath, repoPath);
  requireThat(isAbsolute(database) && /^telemetry-[a-zA-Z0-9_-]+\.sqlite$/.test(basename(database)), 'BLOCKED_SNAPSHOT_PATH');
  privatePath(dirname(database), repoPath, true);
  const source = readFileSync(sqlPath), dbFile = database;
  writeFileSync(dbFile, '', { flag: 'wx', mode: 0o600 }); // Never overwrite an earlier evidence artifact.
  const db = new DatabaseSync(dbFile);
  try {
    db.exec(source.toString('utf8'));
    requireThat(db.prepare('PRAGMA integrity_check').get().integrity_check === 'ok' && !db.prepare('PRAGMA foreign_key_check').all().length, 'FAIL_SNAPSHOT_INTEGRITY');
    requireThat(same(db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name), ['telemetry_ai_calls', 'telemetry_events', 'telemetry_sessions']), 'FAIL_SNAPSHOT_TABLES');
    const owned = db.prepare('SELECT session_id,cohort_id,test_class FROM telemetry_sessions').all();
    requireThat(owned.length === 1 && owned[0].session_id === session && owned[0].cohort_id === cohort && owned[0].test_class === 'tester', 'FAIL_SCOPE');
  } finally { db.close(); }
  const manifest = { kind: 'apu-telemetry', schema_version: 1, mode: 'operator-snapshot', test_class: 'tester', cohorts: [cohort] };
  writeFileSync(dbFile + '.target.json', JSON.stringify(manifest), { flag: 'wx', mode: 0o600 });
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  writeFileSync(dbFile + '.sha256.json', JSON.stringify({ sql: hash(source), sqlite: hash(readFileSync(dbFile)), created_at: new Date().toISOString() }), { flag: 'wx', mode: 0o600 });
  return { result: 'SNAPSHOT_PRESERVED_NOT_ACCEPTANCE_PASS' };
}
function privatePath(path, repoPath, directory = false) {
  requireThat(isAbsolute(path) && realpathSync(path) === resolve(path), 'BLOCKED_PATH');
  const stat = lstatSync(path); requireThat(!stat.isSymbolicLink() && (directory ? stat.isDirectory() : stat.isFile()), 'BLOCKED_PATH');
  requireThat(isAbsolute(repoPath) && realpathSync(repoPath) === resolve(repoPath), 'BLOCKED_REPO_PATH');
  const inside = relative(repoPath, path);
  requireThat(inside.startsWith('..' + sep) || isAbsolute(inside), 'BLOCKED_PRIVATE_PATH_IN_REPO');
  return path;
}
function main(args) {
  if (args.length === 3 && args[0] === 'prepare') {
    const directory = privatePath(args[1], args[2], true), plan = prepare();
    writeFileSync(join(directory, 't5-overlay-proposal.json'), JSON.stringify(plan), { flag: 'wx', mode: 0o600 });
    for (const [name, text] of Object.entries(sql(plan.cohort))) writeFileSync(join(directory, `t5-${name}.sql`), text, { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ result: 'PREPARED_OFFLINE_NOT_ACTIVATED', cohort: plan.cohort, execution: 'BLOCKED_ACTIVATION_METHOD' })); return;
  }
  if (args.length === 4 && args[0] === 'sql') { requireThat(['before', 'observe', 'final', 'cleanup'].includes(args[3]), 'BLOCKED_ARGUMENTS'); console.log(JSON.stringify(sql(args[1], args[2])[args[3]])); return; }
  if (args.length === 6 && args[0] === 'snapshot') { console.log(JSON.stringify(snapshot(args[1], args[2], args[3], args[4], args[5]))); return; }
  if (args.length === 6 && args[0] === 'verify') {
    const database = privatePath(args[1], args[5]), input = privatePath(args[4], args[5]);
    const db = new DatabaseSync(database, { readOnly: true });
    try { const result = verify(db, args[2], args[3], JSON.parse(readFileSync(input, 'utf8'))); console.log(JSON.stringify(result)); if (result.result !== 'PASS_SQL_PROVIDER_LINKAGE') process.exitCode = 1; } finally { db.close(); } return;
  }
  throw Error('BLOCKED_ARGUMENTS');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(/^(FAIL|BLOCKED)_[A-Z_]+$/.test(error.message) ? error.message : 'BLOCKED_LOCAL_EVIDENCE'); process.exitCode = 1; }
}
