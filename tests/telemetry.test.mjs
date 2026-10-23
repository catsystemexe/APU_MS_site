import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const bundle = await build({ stdin: { contents: `
export * from './app/telemetry/contract.ts';
export * from './app/telemetry/server.ts';
export * from './app/telemetry/client.ts';
export * from './app/telemetry/d1-store.ts';
export * from './app/telemetry/model-usage-adapter.ts';
export * from './app/telemetry/runtime.ts';
export * from './app/telemetry/store.ts';
export * from './app/usage-ledger.ts';
export * from './app/model-call-instrumentation.ts';
export * from './app/openai-responses-instrumentation.ts';
export {runWithExecutionContext} from 'vinext/shims/request-context';
export {POST as contextPOST} from './app/api/telemetry/context/route.ts';
export {POST as eventsPOST} from './app/api/telemetry/events/route.ts';
export {default as worker} from './worker/index.ts';`, resolveDir: root, loader: "ts" }, bundle: true, write: false,
  platform: "node", format: "esm", plugins: [{ name: "synthetic-rsc-only", setup(b) {
    b.onResolve({ filter: /^next\/headers$/ }, () => ({ path: "headers", namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const headers=()=>{throw Error('No auth bypass permitted')};", loader: "js" }));
    b.onResolve({ filter: /^virtual:vinext-rsc-entry$/ }, () => ({ path: "synthetic", namespace: "rsc" }));
    b.onLoad({ filter: /.*/, namespace: "rsc" }, () => ({ contents: "export default (...args) => globalThis.__telemetryRscFixture(...args);", loader: "js" }));
  } }] });
const m = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const migration = await readFile(new URL("../telemetry/migrations/0001_pilot_v1.sql", import.meta.url), "utf8");
const id = () => crypto.randomUUID(), NOW = Date.now();
const a = { email: "participant-a@synthetic.invalid", role: "tester" };
const b = { email: "participant-b@synthetic.invalid", role: "tester" };
class EmulatedD1 {
  db = new DatabaseSync(":memory:");
  constructor() { this.db.exec(migration); }
  prepare(sql) {
    const statement = this.db.prepare(sql); let values = [];
    const result = { bind(...v) { values = v; return result; },
      async first() { const row = statement.get(...values); return row ? { ...row } : null; },
      async run() { return { meta: { changes: Number(statement.run(...values).changes) } }; },
      execute() { return { meta: { changes: Number(statement.run(...values).changes) } }; } };
    return result;
  }
  async batch(statements) {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result = statements.map(s => s.execute()); this.db.exec("COMMIT"); return result; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  rows(table) { return this.db.prepare(`SELECT * FROM ${table}`).all().map(row => ({ ...row })); }
}
function request(path, body, origin = "http://localhost") {
  return new Request(`http://localhost/api/telemetry/${path}`, { method: "POST", headers: {
    Origin: origin, "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin" }, body: JSON.stringify(body) });
}
async function fixture(t) {
  const db = new EmulatedD1(); t.after(() => db.db.close());
  const config = { APU_TELEMETRY_ENABLED: "1", APU_TELEMETRY_ENV: "dev", APU_TELEMETRY_HOSTNAME: "localhost",
    APU_TELEMETRY_SYNTHETIC: "1", APU_TELEMETRY_COHORT: "test-cohort", APU_TELEMETRY_KEY_VERSION: "k1", APU_TELEMETRY_NOTICE_VERSION: "n1",
    TELEMETRY_PSEUDONYM_KEY: "synthetic-pseudonym-key-".repeat(3), TELEMETRY_CONTEXT_KEY: "synthetic-context-key-".repeat(3) };
  const participants = await Promise.all([a,b].map(identity => m.participantId(identity, { cohort: config.APU_TELEMETRY_COHORT, pseudonymKey: config.TELEMETRY_PSEUDONYM_KEY })));
  config.APU_TELEMETRY_ELIGIBLE = participants.join(",");
  const resources = { config, store: new m.D1TelemetryStore(db) };
  const start = (identity = a, time = NOW) => m.handleContext(request("context", { action: "start", opt_in: true, notice_version: "n1", tab_id: id() }), identity, resources, time);
  const context = await start();
  const event = (overrides = {}) => ({ schema_version: 1, measurement_version: "pilot-v1", source: "client", event_id: id(), event_name: "workflow_started",
    session_id: context.session_id, tab_id: context.tab_id, workflow_id: id(), client_seq: 0, elapsed_ms: 0, payload: { phase: "F1" }, ...overrides });
  const ingest = (events, token = context.context, identity = a, time = NOW) => m.handleEvents(request("events", { context: token, events, sent_elapsed_ms: Math.max(time - NOW, ...events.map(e => e?.elapsed_ms ?? 0)) }), identity, resources, time);
  const stop = () => m.handleContext(request("context", { action: "stop", context: context.context }), a, resources, NOW + 1);
  return { db, config, resources, context, participants, start, event, ingest, stop };
}
function code(expected) { return error => { assert.equal(error.code, expected); assert.equal(error.message, expected); return true; }; }
function record(overrides = {}) {
  return m.createModelUsageRecord({ call_id: id(), request_id: id(), turn_id: "PRIVATE_NOTEBOOK_ID", phase: "F1", operation: "main_chat", attempt_index: 0,
    retry_of_call_id: null, fallback_for_call_id: null, started_at: new Date(NOW).toISOString(), completed_at: null,
    requested_model: "gpt-5.6-luna", reported_model: null, reasoning_effort: "low", requested_service_tier: "default", reported_service_tier: null,
    provider_request_id: "PRIVATE_PROVIDER_REQUEST", provider_response_id: "PRIVATE_RESPONSE", provider_status: "unknown", application_status: "not_applicable", error: null, ...overrides });
}
function final(pending) {
  return m.finalizeModelUsageRecord(pending, { completed_at: new Date(NOW + 1000).toISOString(), reported_model: "gpt-5.6-luna", reported_service_tier: "default",
    provider_status: "completed", application_status: "accepted", provider_usage: { input_tokens: 1000, output_tokens: 100,
      input_tokens_details: { cached_tokens: 200, cache_write_tokens: 100 }, output_tokens_details: { reasoning_tokens: 20 } },
    provider_request_id: "PRIVATE_PROVIDER_REQUEST", provider_response_id: "PRIVATE_RESPONSE", error: { category: "PRIVATE_PEDAGOGY", code: "PRIVATE_SECRET" } });
}

test("v1 contracts reject server claims, unknown recursive keys, malformed times/IDs and whole invalid batches", async t => {
  const f = await fixture(t), good = f.event(); assert.deepEqual(m.validateBatch([good]), [good]);
  const bad = [null, [], { ...good, schema_version: 2 }, { ...good, measurement_version: "v2" }, { ...good, source: "server" },
    { ...good, event_name: "ai_call_finalized" }, { ...good, received_at: NOW }, { ...good, participant_id: f.participants[0] },
    { ...good, payload: { phase: "F1", text: "PRIVATE_PEDAGOGY" } }, { ...good, elapsed_ms: -1 }, { ...good, client_seq: 1.5 },
    { ...good, event_id: "a".repeat(3000) }, { ...good, workflow_id: "business-id" }, { ...good, costs: 0.1 },
    { ...good, payload: { phase: "F4" } }];
  for (const value of bad) { assert.throws(() => m.validateClientEvent(value)); await assert.rejects(f.ingest([good, value])); }
  assert.equal(f.db.rows("telemetry_events").length, 0);
  await assert.rejects(f.ingest(Array(21).fill(good)));
  const row = { ...good, event_name: "activity_interval", workflow_id: null, elapsed_ms: 15000,
    payload: { start_ms: 0, end_ms: 15000, last_interaction_ms: 0, phase: "F1" } };
  assert.doesNotThrow(() => m.validateClientEvent(row));
  for (const payload of [{ ...row.payload, end_ms: 15001 }, { ...row.payload, start_ms: -1 }, { ...row.payload, last_interaction_ms: 15001 },
    { ...row.payload, end_ms: 90000 }]) assert.throws(() => m.validateClientEvent({ ...row, payload }));
});
test("closed discriminants and metadata gate accept only their specified payloads", async t => {
  const f = await fixture(t), base = f.event();
  const examples = {
    phase_transition: { from: "F1", to: "F2", reason: "user_navigation" },
    operation_requested: { operation_instance_id: id(), operation: "f2_local_reconciliation", reason: "initial", prior_operation_id: null },
    operation_resolved: { operation_instance_id: id(), outcome: "local_noop" },
    document_accepted: { output_id: id(), representation: "baseline" }, workflow_reset: { reason: "reset" }, session_closed: { reason: "idle" } };
  for (const [event_name, payload] of Object.entries(examples)) {
    assert.doesNotThrow(() => m.validateClientEvent({ ...base, event_name, payload }));
    assert.throws(() => m.validateClientEvent({ ...base, event_name, payload: { ...payload, text: "PRIVATE" } }));
  }
  const metadata = { ...base, event_name: "workflow_metadata", payload: { activePath: "POCHOPIT", format: "cards" } };
  assert.throws(() => m.validateClientEvent(metadata)); assert.doesNotThrow(() => m.validateClientEvent(metadata, true));
  assert.throws(() => m.validateClientEvent({ ...metadata, payload: { activePath: "PRIVATE_PEDAGOGY" } }, true));
  await assert.rejects(f.ingest([metadata]));
});
test("same-ID delivery is idempotent; conflicting ID/sequence rolls back the entire transaction and budget", async t => {
  const f = await fixture(t), e = f.event();
  for (let i = 0; i < 3; i++) assert.deepEqual((await f.ingest([e])).acknowledged, [e.event_id]);
  assert.equal(f.db.rows("telemetry_events").length, 1);
  await assert.rejects(f.ingest([{ ...e, payload: { phase: "F2" } }]), code("conflict"));
  await assert.rejects(f.ingest([{ ...e, event_id: id() }]), code("conflict"));
  const valid = f.event({ client_seq: 1 });
  await assert.rejects(f.ingest([valid, { ...e, payload: { phase: "F3" } }]), code("conflict"));
  assert.equal(f.db.rows("telemetry_events").length, 1); assert.equal(f.db.rows("telemetry_sessions")[0].budget_count, 3);
  // Reordering remains valid; retries with a later receive time don't mutate event identity/time.
  await f.ingest([f.event({ client_seq: 9 }), valid], f.context.context, a, NOW + 10);
  assert.equal(f.db.rows("telemetry_events").length, 3);
});
test("atomic session budget counts duplicate submissions, renews per minute and never blocks app state", async t => {
  const f = await fixture(t), e = f.event();
  for (let i = 0; i < 6; i++) await f.ingest(Array(20).fill(e));
  assert.equal(f.db.rows("telemetry_events").length, 1);
  await assert.rejects(f.ingest([e]), code("rate_limited"));
  assert.equal(f.db.rows("telemetry_sessions")[0].budget_count, 120);
  await f.ingest([e], f.context.context, a, NOW + 60000);
  assert.equal(f.db.rows("telemetry_sessions")[0].budget_count, 1);
});
test("context budget is atomic and cohort/pseudonym scoped", async t => {
  const f = await fixture(t);
  const results = await Promise.allSettled(Array.from({ length: 35 }, () => f.start()));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 29);
  assert.ok(results.filter(r => r.status === "rejected").every(r => r.reason.code === "rate_limited"));
  await f.start(b); assert.equal(f.db.rows("telemetry_sessions").length, 31);
});
test("HMAC cohort isolation, signed token ownership, tab binding and explicit consent", async t => {
  const f = await fixture(t);
  assert.notEqual(f.participants[0], f.participants[1]);
  assert.notEqual(await m.participantId(a, { cohort: "other", pseudonymKey: f.config.TELEMETRY_PSEUDONYM_KEY }), f.participants[0]);
  for (const identity of [null, { ...a, email: "unenrolled@synthetic.invalid" }, { ...a, email: "real@example.com" }])
    await assert.rejects(f.start(identity));
  await assert.rejects(f.ingest([f.event()], f.context.context, b), code("invalid_context"));
  await assert.rejects(f.ingest([f.event()], f.context.context.slice(0, -4) + "aaaa"), code("invalid_context"));
  await assert.rejects(f.ingest([f.event({ tab_id: id() })]));
  for (const [opt_in, notice_version] of [[false,"n1"],[true,"wrong"]]) await assert.rejects(
    m.handleContext(request("context", { action: "start", opt_in, notice_version, tab_id: id() }), a, f.resources, NOW), code("consent_required"));
  const serialized = JSON.stringify({ sessions: f.db.rows("telemetry_sessions"), context: f.context });
  assert.doesNotMatch(serialized, /@|PRIVATE|email|jwt|Bearer/); assert.ok(!f.context.participant_id);
});
test("stop boundary rejects queued/late events and cannot be reversed; heartbeat cannot extend inactivity", async t => {
  const f = await fixture(t), e = f.event(); await f.ingest([e]); await f.stop(); await f.stop();
  await assert.rejects(f.ingest([f.event({ client_seq: 1 })], f.context.context, a, NOW + 2), code("invalid_context"));
  assert.equal(f.db.rows("telemetry_events").length, 1);
  const g = await fixture(t);
  const act = g.event({ event_name: "activity_interval", elapsed_ms: 15000, payload: { start_ms: 0, end_ms: 15000, last_interaction_ms: 0, phase: "F1" } });
  await g.ingest([act], g.context.context, a, NOW + 15000);
  assert.equal(g.db.rows("telemetry_sessions")[0].last_interaction_at, NOW);
  await assert.rejects(g.ingest([g.event({ client_seq: 1, elapsed_ms: 1800000 })], g.context.context, a, NOW + 1800000), code("invalid_context"));
  const fresh = await g.start(a, NOW + 1800000); assert.notEqual(fresh.session_id, g.context.session_id);
  await assert.rejects(g.ingest([g.event({ elapsed_ms: 43200000 })], g.context.context, a, NOW + 43200000), code("invalid_context"));
});
test("origin, JSON, streaming body limits and monotonic clock boundaries reject without raw-body logging", async t => {
  const f = await fixture(t); let logs = ""; t.mock.method(console,"warn",(...v)=>logs+=v.join(" "));
  await assert.rejects(m.handleEvents(request("events", {}, "https://evil.invalid"), a, f.resources, NOW), code("invalid_request"));
  for (const text of ['{bad', JSON.stringify({ text: "PRIVATE".repeat(6000) })]) {
    const req = new Request("http://localhost/api/telemetry/events", { method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json" }, body: text });
    await assert.rejects(m.handleEvents(req, a, f.resources, NOW), code("invalid_request"));
  }
  await assert.rejects(f.ingest([f.event({ elapsed_ms: 5001 })]));
  await assert.rejects(f.ingest([f.event()], f.context.context, a, NOW + 120001));
  await f.ingest([f.event({ elapsed_ms: 5000 })]);
  assert.equal(logs, ""); assert.equal(f.db.rows("telemetry_events").length, 1);
});
test("gates fail closed on missing/invalid config, key, host, enrollment and privacy approval", async t => {
  const f = await fixture(t), req = request("context", {});
  assert.equal(m.readiness(req, { config: {} }).code, "disabled");
  for (const [field,value] of [["APU_TELEMETRY_ENV","public"],["APU_TELEMETRY_HOSTNAME","other.invalid"],
    ["TELEMETRY_CONTEXT_KEY",f.config.TELEMETRY_PSEUDONYM_KEY],["TELEMETRY_PSEUDONYM_KEY",undefined],["APU_TELEMETRY_ELIGIBLE",""],
    ["APU_TELEMETRY_SYNTHETIC","0"]]) assert.equal(m.readiness(req, { ...f.resources, config: { ...f.config, [field]: value } }).code, "not_ready");
  assert.equal(m.readiness(req, { config: f.config }).code, "not_ready");
  const real = { ...f.config, APU_TELEMETRY_HOSTNAME: "apu-ms-site-dev.catsystem-exe.workers.dev", APU_TELEMETRY_SYNTHETIC: "0" };
  const hosted = new Request("https://apu-ms-site-dev.catsystem-exe.workers.dev/");
  assert.equal(m.readiness(hosted, { ...f.resources, config: real }).code, "not_ready");
  real.APU_TELEMETRY_PRIVACY_APPROVED = "1"; assert.equal(m.readiness(hosted, { ...f.resources, config: real }).code, "ready");
  assert.equal(m.readiness(new Request("https://apu.catsystem.ai/"), { ...f.resources, config: real }).code, "not_ready");
});
test("pending/final projection is monotonic, conflicts are immutable, no provider IDs/errors/content are stored", async t => {
  const f = await fixture(t), session = await f.resources.store.getSession(f.context.session_id), scope = { owner: m.ownerOf(session), workflow_id: id(), operation_instance_id: id() };
  const pending = record(), done = final(pending), p = m.projectModelUsage(pending, scope), d = m.projectModelUsage(done, scope);
  await f.resources.store.upsertAi(d); await f.resources.store.upsertAi(p); await f.resources.store.upsertAi(d);
  assert.equal(f.db.rows("telemetry_ai_calls").length, 1); const stored = JSON.parse(f.db.rows("telemetry_ai_calls")[0].projection_json);
  assert.equal(stored.state, "final"); assert.ok(stored.cost_nano_usd > 0); assert.equal(stored.usage.reasoning_tokens, 20);
  await assert.rejects(f.resources.store.upsertAi(m.projectModelUsage({ ...done, request_id: id() }, scope)), code("conflict"));
  await assert.rejects(f.resources.store.upsertAi(m.projectModelUsage({ ...done, completed_at: new Date(NOW + 2000).toISOString() }, scope)), code("conflict"));
  assert.doesNotMatch(JSON.stringify(f.db.rows("telemetry_ai_calls")), /PRIVATE|@|provider_request_id|provider_response_id|turn_id|error.code/);
  await f.stop(); await f.resources.store.upsertAi(d); // authorized in-flight calls retain original association
  const invalid = m.projectModelUsage({ ...done, usage: { ...done.usage, reasoning_tokens: 101 } }, scope);
  assert.equal(invalid.projection.cost_nano_usd, null); assert.equal(invalid.projection.usage_coverage, "incomplete");
  const uncertain = m.projectModelUsage({ ...done, provider_status: "transport_error" }, scope);
  assert.equal(uncertain.projection.cost_nano_usd, null);
});
test("real pinned Vinext Worker delegation isolates two interleaved requests and late stream writes", async t => {
  const f = await fixture(t), contexts = [f.context, await f.start(b)], writes = [[],[]], pending = [record(),record()];
  const identities = [a,b]; let arrived = 0, release; const barrier = new Promise(r => release = r);
  globalThis.__telemetryRscFixture = async request => {
    const index = Number(new URL(request.url).searchParams.get("i"));
    const resources = m.telemetryResources();
    assert.equal(resources.config.marker, index);
    if (++arrived === 2) release(); await barrier;
    const sink = await m.createRequestTelemetrySink(request, identities[index]);
    const collector = m.createRequestUsageCollector(sink.sink);
    await collector.sink(pending[index]);
    // Callback captured by this request is used after the response returns, as with MAIN streaming.
    return new Response(new ReadableStream({ async start(controller) {
      await new Promise(resolve => setTimeout(resolve, index ? 1 : 5));
      await collector.sink(final(pending[index])); controller.enqueue(new TextEncoder().encode("synthetic")); controller.close();
    } }));
  };
  t.after(() => { delete globalThis.__telemetryRscFixture; });
  const responses = await Promise.all(contexts.map((c,index) => m.worker.fetch(new Request(`http://localhost/api/chat?i=${index}`, {
    headers: { "x-apu-telemetry-context": c.context, "x-apu-telemetry-workflow": id(), "x-apu-telemetry-operation": id() } }),
    { ...f.config, marker: index, TELEMETRY_DB: f.db }, { waitUntil: p => writes[index].push(p) })));
  await Promise.all(responses.map(r => r.text())); await Promise.all(writes.flat());
  assert.ok(writes.every(v => v.length >= 3));
  const rows = f.db.rows("telemetry_ai_calls"); assert.equal(rows.length, 2);
  for (const [index,p] of pending.entries()) {
    const row = rows.find(r => r.call_id === p.call_id); assert.equal(row.session_id, contexts[index].session_id);
    assert.equal(JSON.parse(row.identity_json).owner.participant_id, f.participants[index]); assert.equal(row.state,"final");
  }
  assert.deepEqual(m.telemetryResources(), { config: {} });
});
test("safe sink contains reject/throw/timeout without altering provider outcome, retaining late writes via waitUntil", async t => {
  const f = await fixture(t), session = await f.resources.store.getSession(f.context.session_id), scope = { owner: m.ownerOf(session), workflow_id: id(), operation_instance_id: id() };
  for (const mode of ["reject","throw","late"]) {
    const writes = []; let late = 0, release; const gate = new Promise(resolve => release = resolve);
    const store = { upsertAi() { if (mode === "late") return gate.then(() => { late++; }); if(mode === "throw") throw Error("PRIVATE_SECRET"); return Promise.reject(Error("PRIVATE_SECRET")); } };
    await m.runWithExecutionContext({ waitUntil: p => writes.push(p) }, async () => {
      const safe = m.createSafeRequestSink(store, scope), collector = m.createRequestUsageCollector(safe.sink), start = performance.now();
      const result = await m.runInstrumentedModelCall({ request_id: id(), phase:"F1",operation:"main_chat",requested_model:"gpt-5.6-luna",sink: collector.sink,
        invoke: async () => ({ body: { status:"completed", model:"gpt-5.6-luna", usage: { input_tokens:10,output_tokens:2 } } }) });
      assert.equal(result.response.body.status,"completed"); assert.ok(performance.now()-start < 1000, "two bounded 100ms writes plus scheduler margin");
      if(mode==="late") assert.equal(late,0,"provider finishes before held writes");
      assert.equal(collector.records().length,1); assert.ok(["unavailable","sink_timeout"].includes(safe.health()));
    });
    release(); await Promise.all(writes); if(mode==="late")assert.equal(late,2);
  }
  const outside = m.createSafeRequestSink({ upsertAi() { throw Error("must not write"); } }, scope);
  await outside.sink(record()); assert.equal(outside.health(),"unavailable");
  for(const sink of [()=>{throw Error("PRIVATE");},()=>Promise.reject(Error("PRIVATE"))]){
    const collector=m.createRequestUsageCollector(sink); await collector.sink(record()); assert.equal(collector.records().length,1);
  }
});
test("disabled client performs no requests, timers, persistent storage or tracking IDs; refusal preserves no-op", async t => {
  let requests = 0, timers = 0; t.mock.method(globalThis,"setInterval",()=>{timers++;return 1;});
  t.mock.method(crypto,"randomUUID",()=>{throw Error("no ID while off");});
  const client = m.createTelemetryClient({ fetcher: async () => { requests++; throw Error("network prohibited"); } });
  assert.equal(await client.optIn(),false); assert.equal(client.emit("workflow_started",null,{phase:"F1"}),false);
  await client.flush(); await client.stop(); await client.refuse(); client.identityUncertain();
  assert.deepEqual(client.operationHeaders(idSafe(),idSafe()),{}); assert.equal(requests,0); assert.equal(timers,0);
  const source=await readFile(new URL("../app/telemetry/client.ts",import.meta.url),"utf8");
  assert.doesNotMatch(source,/localStorage|sessionStorage|indexedDB|document\.cookie/);
});
const idSafe = () => "12345678-1234-4234-8234-123456789abc";
async function clientFixture(t, responder) {
  let now = 0; const sent = []; const f = await fixture(t);
  const client = m.createTelemetryClient({ enabled:true, eligible:true, noticeVersion:"n1", monotonic:()=>now, random:()=>0,
    fetcher: async(path,init)=>{
      const body=JSON.parse(init.body);sent.push({path,body});
      if(responder){const response=await responder(path,body);if(response)return response;}
      try { return m.telemetryResponse(path.endsWith("context") ? await m.handleContext(request("context",body),a,f.resources,NOW+now) :
        await m.handleEvents(request("events",body),a,f.resources,NOW+now)); } catch(error){return m.telemetryFailure(error);}
    } });
  t.after(()=>client.stop(false)); return { ...f, client, sent, time: n=>now=n };
}
test("client opt-in, queue bounds, immutable retries, stop and identity uncertainty", async t => {
  let fail = true; const f=await clientFixture(t,(path)=>path.endsWith("events")&&fail?new Response("",{status:503}):null);
  assert.equal(f.client.emit("workflow_started",id(),{phase:"F1"}),false); assert.equal(f.sent.length,0);
  assert.equal(await f.client.optIn(),true);
  const payload={phase:"F1"}; assert.equal(f.client.emit("workflow_started",id(),payload),true);payload.phase="F3";
  await f.client.flush();f.time(1000);await f.client.flush();
  assert.deepEqual(f.sent[1].body.events,f.sent[2].body.events);assert.equal(f.sent[1].body.events[0].payload.phase,"F1");
  fail=false;f.time(3000);await f.client.flush();assert.equal(f.client.status().queued,0);assert.equal(f.db.rows("telemetry_events").length,1);
  for(let i=0;i<105;i++)f.client.emit("workflow_started",id(),{phase:"F1"});
  assert.equal(f.client.status().queued,100);assert.equal(f.client.status().dropped,5);
  await f.client.stop();assert.equal(f.client.status().queued,0);const count=f.sent.length;
  assert.equal(f.client.emit("workflow_started",id(),{phase:"F1"}),false);await f.client.flush();assert.equal(f.sent.length,count);
  assert.equal(f.db.rows("telemetry_events").length,1);
  assert.equal(await f.client.optIn(),true);f.client.emit("workflow_started",id(),{phase:"F1"});f.client.identityUncertain();
  await f.client.flush();assert.equal(f.client.status().queued,0);assert.deepEqual(f.client.operationHeaders(id(),id()),{});
});
test("client two-retry limit, expiration, idle/expiry boundary and terminal auth failure", async t => {
  const f=await clientFixture(t,path=>path.endsWith("events")?new Response("",{status:503}):null);
  await f.client.optIn();f.client.emit("workflow_started",id(),{phase:"F1"});
  for(const n of [0,1000,3000,6000]){f.time(n);await f.client.flush();}
  assert.equal(f.sent.filter(v=>v.path.endsWith("events")).length,3);assert.equal(f.client.status().queued,0);
  f.client.emit("workflow_started",id(),{phase:"F1"});f.time(130000);await f.client.flush();assert.equal(f.client.status().queued,0);
  f.time(1800000);assert.equal(f.client.interaction(),false);assert.equal(f.client.status().active,false);
  const g=await clientFixture(t,path=>path.endsWith("events")?new Response("",{status:401}):null);
  await g.client.optIn();g.client.emit("workflow_started",id(),{phase:"F1"});await g.client.flush();
  assert.equal(g.client.status().code,"unauthorized");assert.equal(g.client.status().queued,0);
});
test("actual routes default off skip auth/body/store, return private no-store and never set browser state", async t => {
  let calls=0; t.mock.method(globalThis,"fetch",()=>{calls++;throw Error("network prohibited");});
  for(const route of [m.contextPOST,m.eventsPOST]){
    const response=await route(new Request("https://apu.catsystem.ai/api/telemetry/events",{method:"POST",body:"PRIVATE MALFORMED"}));
    assert.equal(response.status,200);assert.deepEqual(await response.json(),{code:"disabled"});
    assert.match(response.headers.get("cache-control"),/private.*no-store/);assert.equal(response.headers.get("set-cookie"),null);
  }
  assert.equal(calls,0);
});
test("send-time anchor rejects >5s clock inconsistency even for otherwise fresh event",async t=>{
  const f=await fixture(t);
  await assert.rejects(m.handleEvents(request("events",{context:f.context.context,events:[f.event()],sent_elapsed_ms:6000}),a,f.resources,NOW));
  await assert.rejects(m.handleEvents(request("events",{context:f.context.context,events:[f.event()],sent_elapsed_ms:0}),a,f.resources,NOW+6000));
  assert.equal(f.db.rows("telemetry_events").length,0);
});
test("enabled HTTP routes reuse actual Access JWT verification, enrollment, consent, stop and fixed errors",async t=>{
  const f=await fixture(t), issuer="https://telemetry-auth.synthetic.invalid", audience="synthetic-audience";
  const pair=await crypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
  const jwk={...await crypto.subtle.exportKey("jwk",pair.publicKey),kid:"synthetic-telemetry",alg:"RS256"};
  const vars={NODE_ENV:"production",APU_LOCAL_DEV_AUTH:"0",CF_ACCESS_TEAM_DOMAIN:issuer,CF_ACCESS_AUD:audience,APU_DEVELOPER_EMAILS:""};
  const saved=Object.fromEntries(Object.keys(vars).map(k=>[k,process.env[k]]));Object.assign(process.env,vars);
  t.after(()=>{for(const[k,v]of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
  let network=0; t.mock.method(globalThis,"fetch",async url=>{network++;assert.equal(String(url),issuer+"/cdn-cgi/access/certs");return Response.json({keys:[jwk]});});
  const segment=value=>Buffer.from(JSON.stringify(value)).toString("base64url");
  const raw=segment({alg:"RS256",kid:jwk.kid})+"."+segment({iss:issuer,aud:audience,email:a.email,exp:Math.floor(Date.now()/1000)+300});
  const signature=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",pair.privateKey,Buffer.from(raw));
  const jwt=raw+"."+Buffer.from(signature).toString("base64url");
  const invoke=(route,body,auth=true)=>m.runWithTelemetryResources({...f.config,TELEMETRY_DB:f.db},()=>{
    const req=request("context",body);if(auth)req.headers.set("cf-access-jwt-assertion",jwt);return route(req);
  });
  const absent=await invoke(m.contextPOST,{action:"start",opt_in:true,notice_version:"n1",tab_id:id()},false);
  assert.equal(absent.status,401);assert.deepEqual(await absent.json(),{code:"unauthorized"});
  const denied=await invoke(m.contextPOST,{action:"start",opt_in:false,notice_version:"n1",tab_id:id()});
  assert.equal(denied.status,400);assert.equal(f.db.rows("telemetry_sessions").length,1);
  const response=await invoke(m.contextPOST,{action:"start",opt_in:true,notice_version:"n1",tab_id:id()});
  assert.equal(response.status,200);assert.match(response.headers.get("cache-control"),/no-store/);const ctx=await response.json();
  const e=f.event({session_id:ctx.session_id,tab_id:ctx.tab_id});
  const accepted=await invoke(m.eventsPOST,{context:ctx.context,events:[e],sent_elapsed_ms:0});assert.equal(accepted.status,200);
  assert.deepEqual((await accepted.json()).acknowledged,[e.event_id]);
  const conflict=await invoke(m.eventsPOST,{context:ctx.context,events:[{...e,payload:{phase:"F2"}}],sent_elapsed_ms:0});
  assert.equal(conflict.status,409);assert.deepEqual(await conflict.json(),{code:"conflict"});
  await invoke(m.contextPOST,{action:"stop",context:ctx.context});
  const stopped=await invoke(m.eventsPOST,{context:ctx.context,events:[e],sent_elapsed_ms:0});assert.equal(stopped.status,400);
  assert.equal(f.db.rows("telemetry_events").length,1);assert.equal(network,1,"only synthetic JWKS, never provider transport");
  assert.doesNotMatch(JSON.stringify(f.db.rows("telemetry_events")),/@|PRIVATE|jwt|email/);
});
test("concurrent stop before atomic ingest commit prevents every new row and rolls back budget",async t=>{
  const f=await fixture(t), original=f.db.batch.bind(f.db);let intercept=true;
  f.db.batch=async statements=>{if(intercept){intercept=false;await f.stop();}return original(statements);};
  await assert.rejects(f.ingest([f.event()]),code("invalid_context"));
  assert.equal(f.db.rows("telemetry_events").length,0);assert.equal(f.db.rows("telemetry_sessions")[0].budget_count,0);
  const stored=f.db.rows("telemetry_sessions")[0];
  await assert.rejects(f.resources.store.createSession({...stored,session_id:id(),participant_id:a.email}));
});
