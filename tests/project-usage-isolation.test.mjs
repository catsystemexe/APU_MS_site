import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { appendModelUsageSessionRecords, createModelUsageSession, readModelUsageRecords } from "../app/model-usage-collection.ts";
import { createModelUsageRecord, finalizeModelUsageRecord } from "../app/usage-ledger.ts";
import { createNeedRouter, activeNeedRoutingKey } from "../app/f2-need-routing.ts";
import { compactNotepad, getF1ToF2NeedContract, EMPTY_NOTEPAD } from "../app/notepad-model.ts";

// Execute actual client functions with deferred transport/state boundaries. No provider calls.
const client = await readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("apu-client.tsx", client, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = new Map(); let router;
function walk(node) {
  if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node.getText(ast));
  if (ts.isIfStatement(node) && node.expression.getText(ast) === "!needRouterRef.current") router = node.getText(ast);
  ts.forEachChild(node, walk);
}
walk(ast);
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function usage(id, { phase = "F3", operation = "f3_render", failed = false, rejected = false } = {}) {
  return finalizeModelUsageRecord(createModelUsageRecord({
    call_id: id, request_id: `request-${id}`, turn_id: null, phase, operation, attempt_index: 0,
    retry_of_call_id: null, fallback_for_call_id: null, started_at: "2026-10-14T10:00:00.000Z", completed_at: null,
    requested_model: "gpt-5.6-terra", reported_model: null, reasoning_effort: "low", requested_service_tier: "default", reported_service_tier: null,
    provider_request_id: null, provider_response_id: null, provider_status: "unknown", application_status: "not_applicable", error: null,
  }), { completed_at: "2026-10-14T10:00:01.000Z", provider_status: failed ? "failed" : "completed",
    application_status: failed ? "failed" : rejected ? "rejected_invalid_output" : "accepted", provider_usage: { input_tokens: 100, output_tokens: 10 } });
}
function fixture({ queued = false } = {}) {
  let session = createModelUsageSession(); const updates = [], requests = [], effects = [];
  const need = { needId: "n", needText: "Porozumět situaci.", initialF2Path: "POCHOPIT", f3Target: null };
  const specs = [{ id: "component", kind: "hypothesis-expansion", hypothesisId: "h", fingerprint: "fingerprint" }];
  const context = {
    JSON, Response, Error, performance, compactNotepad, getF1ToF2NeedContract, activeNeedRoutingKey, createNeedRouter,
    readModelUsageRecords, appendModelUsageSessionRecords,
    projectEpochRef: { current: 0 }, needRouterRef: { current: null }, f3GenerationEpochRef: { current: null },
    setModelUsageSession: update => { if (queued) updates.push(update); else session = update(session); },
    fetch: (url, init) => { const gate = deferred(); requests.push({ url, body: JSON.parse(init.body), gate }); return gate.promise; },
    f3State: { sourceSnapshot: { sourceFingerprint: "source" } }, latestF2ToF3FingerprintRef: { current: "source" },
    f3Status: "idle", rozborGenerationStatus: "idle", selectedModel: "auto", isDeveloper: false,
    f3GenerationEligibility: () => ({ enabled: true }), createF3RenderRequest: state => ({ sourceSnapshot: state.sourceSnapshot }),
    parseF3RenderResult: value => { if (value.invalid) throw new Error("invalid structured output"); return value; }, acceptF3Render: state => state,
    f2Build: { activePath: "POCHOPIT" }, canonicalF2Need: need, currentRozbor: { POCHOPIT: { config: {}, components: [] } },
    analysis: { hypotheses: [] }, currentAnalysisContext: {},
    f2Situation: () => [], createF2BuildRequest: () => ({ activePath: "POCHOPIT", buildRevision: 0 }), parseF2BuildResult: value => value, applyF2BuildResult: state => state,
    createF2PreviewSnapshot: () => ({}), parseF2RenderedPreview: value => value, acceptRenderedPreview: (_snapshot, value) => value,
    deriveRequiredCurrentRozborComponents: () => specs, reconcileRozborComponents: () => ({ isRozborCurrent: false }),
    createCurrentRozborGenerationRequest: () => ({ config: {}, components: specs }), parseGeneratedRozborComponents: value => value.components,
    latestRozborSourceRef: { current: { activePath: "POCHOPIT", need, hypotheses: [], analysisContext: {} } }, latestCurrentRozborRef: { current: { POCHOPIT: { config: {} } } },
    applyCurrentRozborComponentUpdate: value => value, commitBuildDocument: () => effects.push("commit"),
    activeNeedId: "n", resolveActiveNeed: async value => value, selectedHypothesisId: null, skippedAnalysisQuestions: [],
    latestSourceNeedKeyRef: { current: activeNeedRoutingKey(need) },
  };
  for (const name of ["setF3Status", "setF3Error", "setF3State", "setF2BuildStatus", "setF2BuildError", "setF2Build", "setF2PreviewStatus", "setF2PreviewError", "setF2Preview", "setActivePanel", "setRozborGenerationStatus", "setRozborGenerationError", "setAnalysisStatus", "setAnalysisError"]) {
    context[name] = value => effects.push([name, value]);
  }
  const collector = compile(functions.get("collectModelUsageRecords"));
  const collect = runInNewContext(`${collector}\ncollectModelUsageRecords;`, context);
  context.collectModelUsageRecords = collect;
  return {
    context, requests, effects, collect, updates, session: () => session,
    reset: () => { context.projectEpochRef.current++; context.f3GenerationEpochRef.current = null; context.needRouterRef.current = null; session = createModelUsageSession(); },
    flush: () => { while (updates.length) session = updates.shift()(session); },
    run: (name, ...args) => runInNewContext(`${compile(functions.get(name))}\n${name};`, context)(...args),
    router: () => { runInNewContext(compile(router), context); return context.needRouterRef.current; },
  };
}
function answer(request, record, { failed = false, invalid = false } = {}) {
  request.gate.resolve(Response.json({ model_usage_records: [record], ...(failed ? { error: "Synthetic provider failure." } : {
    result: invalid ? { invalid: true } : { kind: "material" }, components: [], decision: { path: "POCHOPIT", clarification: null }, analysis: {},
  }) }, { status: failed ? 502 : 200 }));
}
const operations = ["renderF3", "executeF2Build", "renderF2Preview", "generateCurrentRozbor"];
const operationIdentity = name => name === "renderF3" ? { phase: "F3", operation: "f3_render" }
  : { phase: "F2", operation: name === "renderF2Preview" ? "f2_preview" : "f2_build" };
// Keep the actual current-Rozbor handler name pinned rather than silently omitting that producer.
assert.ok(functions.has("generateCurrentRozbor"));
for (const operation of operations) for (const failed of [false, true]) test(`${operation}: delayed ${failed ? "failed" : "successful"} response cannot append to a reset project`, async () => {
  const f = fixture(), pending = f.run(operation);
  assert.equal(f.requests.length, 1);
  f.reset(); answer(f.requests[0], usage("old", { ...operationIdentity(operation), failed }), { failed }); await pending;
  assert.equal(f.session().records.length, 0);
  assert.equal(f.session().summary.normalized_total_tokens, 0);
  assert.equal(f.session().summary.known_cost_subtotal_usd, 0);
});

for (const operation of operations.filter(name => name !== "renderF3")) test(`${operation}: current-project failed responses retain their canonical usage`, async () => {
  const f = fixture(), pending = f.run(operation);
  const record = usage("current-failed", { ...operationIdentity(operation), failed: true });
  answer(f.requests[0], record, { failed: true }); await pending;
  assert.deepEqual(f.session().records, [record]);
  assert.equal(f.session().summary.normalized_total_tokens, 110);
});

test("actual collector rejects a queued updater crossing reset, while new ownership collects and upserts normally", () => {
  const f = fixture({ queued: true });
  f.collect({ model_usage_records: [usage("old")] }, 0); assert.equal(f.updates.length, 1);
  f.reset(); f.flush(); assert.equal(f.session().records.length, 0);
  f.collect({ model_usage_records: [usage("new"), usage("new")] }, 1); f.flush();
  assert.equal(f.session().records.length, 1); assert.equal(f.session().summary.normalized_total_tokens, 110);
  const conflict = { ...usage("new"), request_id: "other-identity" };
  f.collect({ model_usage_records: [conflict, { call_id: "partial" }] }, 1); f.flush();
  assert.equal(f.session().records[0].request_id, "request-new");
  f.collect({ model_usage_records: [usage("old-again")] }, 0); assert.equal(f.updates.length, 0);
});

test("project B's own F3 record remains alone when A finishes later", async () => {
  const f = fixture(), old = f.run("renderF3"); f.reset(); const fresh = f.run("renderF3");
  answer(f.requests[1], usage("B")); await fresh;
  answer(f.requests[0], usage("A")); await old;
  assert.deepEqual(f.session().records.map(record => record.call_id), ["B"]);
  assert.equal(f.session().summary.normalized_total_tokens, 110);
});

for (const outcome of ["failed", "invalid", "obsolete"]) test(`current-project F3 ${outcome} output retains actual usage`, async () => {
  const f = fixture(), pending = f.run("renderF3");
  if (outcome === "obsolete") f.context.latestF2ToF3FingerprintRef.current = "changed-source";
  answer(f.requests[0], usage(outcome, { failed: outcome === "failed", rejected: outcome === "invalid" }), { failed: outcome === "failed", invalid: outcome === "invalid" });
  await pending;
  assert.equal(f.session().records.length, 1); assert.equal(f.session().summary.normalized_total_tokens, 110);
  assert.ok(f.effects.some(([name, value]) => name === "setF3Status" && value === "error"));
});

test("current-project obsolete Rozbor generation retains usage even when its source signature is rejected", async () => {
  const f = fixture(), pending = f.run("generateCurrentRozbor");
  f.context.latestRozborSourceRef.current.analysisContext = { changed: true };
  answer(f.requests[0], usage("obsolete-F2", { phase: "F2", operation: "f2_build" })); await pending;
  assert.equal(f.session().records.length, 1); assert.equal(f.effects.includes("commit"), false);
});

test("actual analysis captures ownership before routing and retains same-project source-obsolete usage", async () => {
  const state = structuredClone(EMPTY_NOTEPAD); state.goals = [{ id: "n", text: "Porozumět situaci.", origin: "manual" }];
  for (const reset of [false, true]) {
    const f = fixture(); const pending = f.run("refreshStructuredAnalysis", state); await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.requests.length, 1);
    if (reset) f.reset(); else f.context.latestSourceNeedKeyRef.current = "other-need";
    answer(f.requests[0], usage("analysis", { phase: "F2", operation: "analysis" }));
    if (reset) await pending; else await assert.rejects(pending, /Pedagogická potřeba/);
    assert.equal(f.session().records.length, reset ? 0 : 1);
  }
});

test("Need Router ownership belongs to its original instance even if its callback starts after reset", async () => {
  const f = fixture(), routeA = f.router();
  const pendingA = routeA({ needId: "n", needText: "Need." });
  f.reset(); await Promise.resolve();
  answer(f.requests[0], usage("router-A", { phase: "F2", operation: "need_routing" })); await pendingA;
  assert.equal(f.session().records.length, 0);
  const routeB = f.router(), pendingB = routeB({ needId: "n", needText: "Need." }); await Promise.resolve();
  answer(f.requests[1], usage("router-B", { phase: "F2", operation: "need_routing" })); await pendingB;
  assert.deepEqual(f.session().records.map(record => record.call_id), ["router-B"]);
});

test("actual terminal stream error ingests usage before raising, while old-project events remain blocked", () => {
  let arrow;
  function find(node) { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "processLine") arrow = node.getText(ast); ts.forEachChild(node, find); }
  find(ast); assert.ok(arrow);
  const f = fixture(); Object.assign(f.context, { isCurrentRequest: () => f.context.projectEpochRef.current === 0, requestScope: { epoch: 0 }, phase: "intake" });
  const processLine = runInNewContext(`${compile(`const ${arrow};`)}\nprocessLine;`, f.context);
  const error = JSON.stringify({ type: "error", message: "Synthetic stream failure.", model_usage_records: [usage("main", { phase: "F1", operation: "main_chat", failed: true })] });
  assert.throws(() => processLine(error), /Synthetic stream failure/); assert.equal(f.session().records.length, 1);
  f.reset(); processLine(error); assert.equal(f.session().records.length, 0);
});
