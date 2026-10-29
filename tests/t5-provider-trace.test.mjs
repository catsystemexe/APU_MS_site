import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createT5Trace, validateTrace, T5_TRACE_PREFIX } from '../app/telemetry/t5-trace.ts';
import { callOpenAIResponses, createRequestUsageCollector } from '../app/openai-responses-instrumentation.ts';
import { EmulatedTelemetryD1 } from './helpers/telemetry-sql.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const bundle = await build({ stdin: { contents: `export * from './app/telemetry/server.ts'; export * from './app/telemetry/d1-store.ts'; export * from './app/telemetry/model-usage-adapter.ts'; export {runWithExecutionContext} from 'vinext/shims/request-context';`, resolveDir: root, loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'esm' });
const m = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const id = () => crypto.randomUUID();
const RAW = { id: 'NEVER_PROVIDER_ID', model: 'gpt-5.6-terra', service_tier: 'default', status: 'completed', usage: { input_tokens: 100, input_tokens_details: { cached_tokens: 0, cache_write_tokens: null }, output_tokens: 10, output_tokens_details: null, total_tokens: 110 }, output: [{ type: 'message', content: 'NEVER_PEDAGOGICAL_ANSWER' }, { type: 'file_search_call', results: 'NEVER_DOCUMENT' }] };
function transportInput(collector, fetcher) { return { api_key: 'SYNTHETIC_NOT_A_KEY', request_id: id(), phase: 'F2', operation: 'analysis', requested_model: 'gpt-5.6-terra', reasoning_effort: 'low', payload: { store: false, input: 'NEVER_PROMPT' }, collector, fetcher }; }
test('raw provider usage is independent of a deliberately wrong ledger projection; one unchanged provider request', async () => {
  const lines = [], ledger = [], trace = createT5Trace('t5_test', line => lines.push(line)); let calls = 0;
  const collector = createRequestUsageCollector({ trace, sink: record => ledger.push({ ...record, usage: { input_tokens: 999999 } }) });
  await callOpenAIResponses(transportInput(collector, async (_url, init) => { calls++; assert.deepEqual(JSON.parse(init.body), { store: false, input: 'NEVER_PROMPT' }); return Response.json(RAW); }));
  assert.equal(calls, 1); const records = lines.map(s => JSON.parse(s.slice(T5_TRACE_PREFIX.length)));
  assert.deepEqual(records.map(r => r.stage), ['invoke', 'response']); assert.deepEqual(records[1].usage, RAW.usage); assert.equal(records[1].file_search_calls, 1);
  assert.equal(ledger.at(-1).usage.input_tokens, 999999); assert.equal(records[1].usage.input_tokens, 100);
  assert.doesNotMatch(lines.join(''), /NEVER_|SYNTHETIC_NOT_A_KEY|Authorization|email|provider_response_id/);
});
test('absent/null/zero usage stays distinct; malformed usage cannot leak; logger errors fail open', async () => {
  for (const raw of [{ ...RAW, usage: undefined }, { ...RAW, usage: null }, { ...RAW, usage: { input_tokens: 0, output_tokens: 0 } }, { ...RAW, usage: { input_tokens: 'NEVER_SECRET' } }]) {
    if (raw.usage === undefined) delete raw.usage;
    const lines = [], trace = createT5Trace('t5_test', s => lines.push(JSON.parse(s.slice(T5_TRACE_PREFIX.length))));
    const call = trace.call(id(), 'analysis', 0); call.invoke(); call.response(raw, 200);
    const r = lines.at(-1); assert.equal(validateTrace(r), true);
    if (!Object.hasOwn(raw, 'usage')) assert.equal(Object.hasOwn(r, 'usage'), false);
    else if (raw.usage === null) assert.equal(r.usage, null);
    else if (typeof raw.usage.input_tokens === 'number') assert.deepEqual(r.usage, raw.usage);
    else { assert.equal(r.usage_valid, false); assert.doesNotMatch(JSON.stringify(r), /NEVER_SECRET/); }
  }
  const trace = createT5Trace('t5_test', () => { throw Error('logger unavailable'); });
  const result = await callOpenAIResponses(transportInput(createRequestUsageCollector({ sink() {}, trace }), async () => Response.json(RAW)));
  assert.equal(result.usage_record.provider_status, 'completed');
});
test('transport cancellation/failure has one attempt and no raw error; provider failure retains raw numeric usage', async () => {
  for (const error of [new DOMException('NEVER_ABORT_MESSAGE', 'AbortError'), Error('NEVER_ERROR')]) {
    const lines = [], trace = createT5Trace('t5_test', s => lines.push(JSON.parse(s.slice(T5_TRACE_PREFIX.length)))); let calls = 0;
    await assert.rejects(callOpenAIResponses(transportInput(createRequestUsageCollector({ sink() {}, trace }), async () => { calls++; throw error; })));
    assert.equal(calls, 1); assert.deepEqual(lines.map(r => r.stage), ['invoke', 'transport_error']); assert.doesNotMatch(JSON.stringify(lines), /NEVER_/);
  }
  const lines = [], trace = createT5Trace('t5_test', s => lines.push(JSON.parse(s.slice(T5_TRACE_PREFIX.length))));
  await callOpenAIResponses(transportInput(createRequestUsageCollector({ sink() {}, trace }), async () => Response.json({ ...RAW, status: 'failed' }, { status: 500 })));
  assert.equal(lines.at(-1).provider_status, 'failed'); assert.deepEqual(lines.at(-1).usage, RAW.usage);
});
async function contextFixture(t, change = {}) {
  const db = new EmulatedTelemetryD1(), lines = [], writes = [], cohort = 't5_test';
  t.after(() => db.db.close()); t.mock.method(console, 'info', value => lines.push(value));
  const identity = { email: 'catsystem.exe@gmail.com', role: 'tester' };
  const config = { APU_TELEMETRY_ENABLED: '1', APU_TELEMETRY_METADATA_ENABLED: '0', APU_TELEMETRY_ENV: 'dev', APU_TELEMETRY_HOSTNAME: 'apu-ms-site-dev.catsystem-exe.workers.dev', APU_TELEMETRY_SYNTHETIC: '0', APU_TELEMETRY_PRIVACY_APPROVED: '1', APU_TELEMETRY_COHORT: cohort, APU_TELEMETRY_KEY_VERSION: 't5-v1', APU_TELEMETRY_NOTICE_VERSION: 't5-v1', TELEMETRY_PSEUDONYM_KEY: 'synthetic-pseudonym-key'.repeat(3), TELEMETRY_CONTEXT_KEY: 'synthetic-context-key'.repeat(3), APU_T5_TRACE_ENABLED: '1', APU_T5_TRACE_COHORT: cohort };
  config.APU_TELEMETRY_ELIGIBLE = await m.participantId(identity, { cohort, pseudonymKey: config.TELEMETRY_PSEUDONYM_KEY });
  const resources = { config, store: new m.D1TelemetryStore(db) }, origin = 'https://apu-ms-site-dev.catsystem-exe.workers.dev';
  const context = await m.handleContext(new Request(origin + '/api/telemetry/context', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start', opt_in: true, notice_version: 't5-v1', tab_id: id() }) }), identity, resources);
  Object.assign(config, change.config); Object.assign(identity, change.identity);
  const headers = { 'x-apu-telemetry-context': context.context, 'x-apu-telemetry-workflow': id(), 'x-apu-telemetry-operation': id() };
  if (change.noConsent) delete headers['x-apu-telemetry-context'];
  const sink = await m.runWithExecutionContext({ waitUntil(p) { writes.push(p); } }, () => m.createRequestTelemetrySink(new Request((change.origin ?? origin) + '/api/analysis', { headers }), identity, resources));
  return { db, lines, writes, sink, resources };
}
for (const [name, change] of [
  ['disabled', { config: { APU_T5_TRACE_ENABLED: '0' } }], ['PUBLIC', { config: { APU_TELEMETRY_ENV: 'public', APU_TELEMETRY_HOSTNAME: 'apu.catsystem.ai' }, origin: 'https://apu.catsystem.ai' }],
  ['developer', { identity: { role: 'developer' } }], ['other cohort', { config: { APU_T5_TRACE_COHORT: 'other' } }], ['missing consent', { noConsent: true }], ['metadata on', { config: { APU_TELEMETRY_METADATA_ENABLED: '1' } }],
]) test(name + ' produces no trace', async t => { const f = await contextFixture(t, change); assert.equal(f.sink.trace, undefined); await Promise.all(f.writes); assert.equal(f.lines.length, 0); });
test('real request permission and D1 pending/final write acknowledgements, never before or after failed commit', async t => {
  const f = await contextFixture(t); assert.ok(f.sink.trace);
  const collector = createRequestUsageCollector(f.sink);
  await callOpenAIResponses(transportInput(collector, async () => Response.json(RAW))); await Promise.all(f.writes);
  const records = f.lines.map(s => JSON.parse(s.slice(T5_TRACE_PREFIX.length))), acks = records.filter(r => r.stage === 'write_ack');
  assert.deepEqual(acks.map(r => r.state), ['pending', 'final']); assert.equal(f.db.rows('telemetry_ai_calls').length, 1); assert.equal(f.db.rows('telemetry_ai_calls')[0].state, 'final');
  f.lines.length = 0; t.mock.method(f.db, 'prepare', () => { throw Error('synthetic failed D1 write'); });
  await callOpenAIResponses(transportInput(collector, async () => Response.json(RAW))); await Promise.all(f.writes);
  assert.equal(f.lines.map(s => JSON.parse(s.slice(T5_TRACE_PREFIX.length))).filter(r => r.stage === 'write_ack').length, 0);
});
test('trace validator rejects extra or content-bearing nested fields', () => {
  const valid = { v: 1, cohort_id: 't5_test', call_id: id(), stage: 'response', operation: 'analysis', attempt_index: 0, time_ms: 1, http_status: 200, provider_status: 'completed', model: 'gpt-5.6-terra', service_tier: 'default', usage_valid: true, usage: { input_tokens: 0 }, file_search_calls: 0 };
  assert.equal(validateTrace(valid), true);
  for (const change of [{ prompt: 'secret' }, { model: 'catsystem.exe@gmail.com' }, { usage: { input_tokens: 0, prompt: 'secret' } }, { usage: { input_tokens_details: { cached_tokens: 'secret' } } }]) assert.equal(validateTrace({ ...valid, ...change }), false);
  assert.match(readFileSync(new URL('../app/api/chat/route.ts', import.meta.url), 'utf8'), /providerTrace\?\.response\(response, upstream.status\)/);
});
