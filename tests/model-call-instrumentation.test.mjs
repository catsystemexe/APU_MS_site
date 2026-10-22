import assert from "node:assert/strict";
import test from "node:test";

const moduleUrl = new URL("../app/model-call-instrumentation.ts", import.meta.url).href;
const { createInstrumentedModelCallLifecycle, InstrumentedModelCallError, runInstrumentedModelCall } = await import(moduleUrl);
const { runQuestController } = await import(new URL("../app/quest-controller.ts", import.meta.url).href);
const { createRequestUsageCollector } = await import(new URL("../app/openai-responses-instrumentation.ts", import.meta.url).href);
const { fallbackQuestController, CONTINUE_TO_SOLUTION_LABEL } = await import(new URL("../app/dialog-action.ts", import.meta.url).href);
const { createSessionTelemetry, mergeSessionTelemetry, buildSessionExport } = await import(new URL("../app/session-export.ts", import.meta.url).href);

function baseInput(overrides = {}) {
  const records = [];
  return {
    records,
    input: {
      request_id: "request-1",
      turn_id: "turn-1",
      phase: "F1",
      operation: "main_chat",
      requested_model: "gpt-5.6-terra",
      requested_service_tier: "default",
      reasoning_effort: "medium",
      create_call_id: () => "call-1",
      now: (() => {
        const values = [new Date("2026-08-25T10:00:00Z"), new Date("2026-08-25T10:00:01Z")];
        return () => values.shift() ?? values.at(-1);
      })(),
      sink: (record) => records.push(record),
      ...overrides,
    },
  };
}

test("emits pending before invoking and correlates the final record", async () => {
  const { input, records } = baseInput({
    invoke: async ({ call_id, headers }) => {
      assert.equal(records.length, 1);
      assert.equal(records[0].completed_at, null);
      assert.equal(call_id, "call-1");
      assert.equal(headers["X-Client-Request-Id"], "call-1");
      return { body: { id: "resp-1", status: "completed" } };
    },
  });
  const result = await runInstrumentedModelCall(input);
  assert.equal(records.length, 2);
  assert.equal(result.usage_record.call_id, records[0].call_id);
  assert.equal(result.usage_record.provider_response_id, "resp-1");
});

test("captures completed usage, identifiers, tier and file-search calls", async () => {
  const { input } = baseInput({
    invoke: async () => ({
      headers: { "X-Request-ID": "provider-request-1" },
      body: {
        id: "resp-2",
        model: "gpt-5.6-terra-2026-08-01",
        service_tier: "default",
        status: "completed",
        usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 },
        output: [{ type: "message" }, { type: "file_search_call" }],
      },
    }),
  });
  const { usage_record: record } = await runInstrumentedModelCall(input);
  assert.equal(record.provider_request_id, "provider-request-1");
  assert.equal(record.reported_model, "gpt-5.6-terra-2026-08-01");
  assert.equal(record.file_search_calls, 1);
  assert.equal(record.usage_source, "provider_reported");
  assert.equal(record.pricing_snapshot.status, "priced");
  assert.equal(record.application_status, "accepted");
});

test("preserves and prices usage from an incomplete response", async () => {
  const { input } = baseInput({
    invoke: async () => ({ body: {
      status: "incomplete",
      model: "gpt-5.6-terra",
      service_tier: "default",
      usage: { input_tokens: 50, output_tokens: 10 },
      incomplete_details: { reason: "max_output_tokens" },
    } }),
  });
  const { usage_record: record } = await runInstrumentedModelCall(input);
  assert.equal(record.provider_status, "incomplete");
  assert.equal(record.usage.normalized_total_tokens, 60);
  assert.equal(record.pricing_snapshot.status, "priced");
  assert.deepEqual(record.error, { category: "provider_incomplete", code: "max_output_tokens" });
});

test("emits an uncertain missing-usage record on transport failure", async () => {
  const { input, records } = baseInput({ invoke: async () => { throw new Error("socket closed"); } });
  await assert.rejects(() => runInstrumentedModelCall(input), (error) => {
    assert.ok(error instanceof InstrumentedModelCallError);
    assert.equal(error.usage_record.provider_status, "transport_error");
    assert.equal(error.usage_record.pricing_snapshot.status, "missing_usage");
    assert.deepEqual(error.usage_record.error, { category: "transport", code: null });
    return true;
  });
  assert.equal(records.length, 2);
});

test("retains provider usage when application validation rejects output", async () => {
  const { input, records } = baseInput({
    invoke: async () => ({ body: {
      status: "completed",
      model: "gpt-5.6-terra",
      service_tier: "default",
      usage: { input_tokens: 30, output_tokens: 5 },
    } }),
    validate_application_response: () => { throw new Error("schema mismatch"); },
  });
  await assert.rejects(() => runInstrumentedModelCall(input), (error) => {
    assert.equal(error.usage_record.provider_status, "completed");
    assert.equal(error.usage_record.application_status, "rejected_invalid_output");
    assert.equal(error.usage_record.usage.normalized_total_tokens, 35);
    return true;
  });
  assert.equal(records.length, 2);
});

test("preserves usage and safe error code from a provider failure", async () => {
  const { input } = baseInput({
    invoke: async () => ({ body: {
      status: "failed",
      usage: { input_tokens: 12, output_tokens: 0 },
      error: { code: "server_error" },
    } }),
  });
  const { usage_record: record } = await runInstrumentedModelCall(input);
  assert.equal(record.provider_status, "failed");
  assert.equal(record.usage.normalized_total_tokens, 12);
  assert.deepEqual(record.error, { category: "provider_response", code: "server_error" });
});

test("rejects an invalid client request id before side effects", async () => {
  let invoked = false;
  const { input, records } = baseInput({
    call_id: "non-ascii-ž",
    invoke: async () => { invoked = true; return { body: {} }; },
  });
  await assert.rejects(() => runInstrumentedModelCall(input), /call_id must be/);
  assert.equal(invoked, false);
  assert.equal(records.length, 0);
});

test("stream lifecycle emits one correlated final record and ignores later terminal signals", async () => {
  const { input, records } = baseInput();
  const lifecycleInput = { ...input };
  delete lifecycleInput.invoke;
  const lifecycle = createInstrumentedModelCallLifecycle(lifecycleInput);

  await lifecycle.begin();
  assert.equal(lifecycle.headers["X-Client-Request-Id"], "call-1");
  assert.equal(records.length, 1);

  const completed = await lifecycle.finish_provider({
    status_code: 200,
    headers: { "x-request-id": "provider-stream-1" },
    body: {
      id: "resp-stream-1",
      status: "completed",
      model: "gpt-5.6-terra",
      service_tier: "default",
      usage: { input_tokens: 40, output_tokens: 8 },
    },
  });
  const duplicate = await lifecycle.finish_transport("late_disconnect");

  assert.equal(records.length, 2);
  assert.equal(completed, duplicate);
  assert.equal(completed.provider_status, "completed");
  assert.equal(completed.provider_request_id, "provider-stream-1");
  assert.equal(completed.usage.normalized_total_tokens, 48);
  assert.equal(lifecycle.is_finalized(), true);
});

test("stream lifecycle records an interrupted transport without provider usage", async () => {
  const { input, records } = baseInput();
  const lifecycleInput = { ...input };
  delete lifecycleInput.invoke;
  const lifecycle = createInstrumentedModelCallLifecycle(lifecycleInput);

  const failed = await lifecycle.finish_transport("stream_ended_without_terminal_event");

  assert.equal(records.length, 2);
  assert.equal(failed.provider_status, "transport_error");
  assert.equal(failed.pricing_snapshot.status, "missing_usage");
  assert.deepEqual(failed.error, { category: "transport", code: "stream_ended_without_terminal_event" });
});

const controllerNotebook = [{ category: "manifestations", text: "Synthetic observation." }, { category: "goals", text: "Synthetic need." }];
const controllerUsage = { input_tokens: 100, output_tokens: 20, total_tokens: 120 };
const validController = { ...fallbackQuestController(controllerNotebook, "intake"), chat_navigation_event: "none" };

async function controllerFixture(t, body, { status = 200, transportError = false, collector = createRequestUsageCollector(), refinement = { askedTargets: [] } } = {}) {
  const payloads = [];
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    payloads.push(JSON.parse(init.body));
    if (transportError) throw new Error("Synthetic private transport detail must not escape.");
    return Response.json(body, { status, headers: { "x-request-id": "controller-provider-request" } });
  });
  const run = await runQuestController({
    apiKey: "not-a-real-key", requestId: "controller-request", turnId: "controller-turn", collector,
    coreInstructions: "Synthetic Core only.", message: "Synthetic message.", notebook: controllerNotebook,
    phase: "intake", refinement, applyIntakePolicy: true,
  });
  return { run, records: collector.records(), payloads };
}

for (const fixture of [
  { name: "provider failure", status: 503, body: { status: "failed", error: { code: "server_error", message: "Private generated details." } }, reason: "provider_failure", provider: "failed", application: "failed" },
  { name: "HTTP failure despite completed body", status: 429, body: { status: "completed" }, reason: "provider_failure", provider: "failed", application: "failed" },
  { name: "incomplete provider response", body: { status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }, reason: "incomplete_provider_response", provider: "incomplete", application: "failed" },
  { name: "transport failure", transportError: true, body: {}, reason: "transport_failure", provider: "transport_error", application: "failed" },
  { name: "malformed controller JSON", body: { status: "completed", output_text: "Private malformed generated text." }, reason: "json_parse_failure", provider: "completed", application: "rejected_invalid_output" },
  { name: "controller contract rejection", body: { status: "completed", output_text: JSON.stringify({ ...validController, phase: "output" }) }, reason: "controller_contract_validation_failure", provider: "completed", application: "rejected_invalid_output" },
  { name: "unknown provider status", body: { status: "unexpected" }, reason: "unknown_failure", provider: "unknown", application: "not_applicable" },
]) {
  test(`controller classifies ${fixture.name} without losing canonical usage or making another call`, async t => {
    const { run, records, payloads } = await controllerFixture(t, {
      model: "gpt-5.6-luna", service_tier: "default", usage: controllerUsage, ...fixture.body,
    }, fixture);
    assert.equal(run.usedFallback, true);
    assert.equal(run.fallbackReason, fixture.reason);
    assert.equal(run.rejectionReason, fixture.reason === "controller_contract_validation_failure" ? "phase_mismatch" : null);
    assert.deepEqual(run.result, fallbackQuestController(controllerNotebook, "intake"));
    assert.equal(run.response, null);
    assert.equal(payloads.length, 1);
    assert.equal(records.length, 1);
    const record = records[0];
    assert.equal(record.provider_status, fixture.provider);
    assert.equal(record.application_status, fixture.application);
    assert.equal(record.usage.normalized_total_tokens, fixture.transportError ? null : 120);
    assert.equal(record.pricing_snapshot.status, fixture.transportError ? "missing_usage" : "priced");
    assert.equal(record.provider_request_id, fixture.transportError ? null : "controller-provider-request");
    const telemetry = mergeSessionTelemetry(createSessionTelemetry({ requestId: "controller-request", turnId: "controller-turn", phase: "intake" }), {
      controller: { mode: "llm_fallback", fallback_reason: run.fallbackReason },
    });
    const exported = buildSessionExport({
      session: { id: "test", startedAt: "2026-10-14T00:00:00Z", phase: "intake", communicationProfile: "apu", activePanel: null, appVersion: "test", coreVersion: "test", coreReleaseId: "test", runtimeWrapper: "test" },
      messages: [], notepad: {}, analysis: null, output: null, telemetry: [telemetry],
    });
    assert.deepEqual(exported.telemetry[0].controller, { mode: "llm_fallback", fallback_reason: fixture.reason });
    assert.doesNotMatch(JSON.stringify(exported.telemetry[0].controller), /Private|Synthetic|not-a-real-key/);
  });
}

test("valid controller output uses canonical NAV instructions and retains answered history's exact pending SIDE", async t => {
  const refinement = { askedTargets: ["context"], pendingSide: { target: "context", question: "Unanswered synthetic question?" } };
  const result = { ...fallbackQuestController(controllerNotebook, "intake", refinement), chat_navigation_event: "none" };
  const { run, records, payloads } = await controllerFixture(t, {
    status: "completed", model: "gpt-5.6-luna", service_tier: "default", usage: controllerUsage, output_text: JSON.stringify(result),
  }, { refinement });
  assert.equal(run.usedFallback, false);
  assert.equal(run.fallbackReason, null);
  assert.equal(run.rejectionReason, null);
  assert.equal(run.result.dialog_actions[0].question, refinement.pendingSide.question);
  assert.equal(records[0].application_status, "accepted");
  assert.equal(payloads.length, 1);
  const instructions = payloads[0].input[0].content[0].text;
  assert.ok(instructions.includes(`s labelem „${CONTINUE_TO_SOLUTION_LABEL}“`));
  assert.match(instructions, /target musí být "phase" a required musí být false/);
  assert.match(instructions, /options musí obsahovat přesně jednu položku/);
  const canonical = instructions.match(/^- Kanonický objekt F1 NAV: (\{.*\})\.$/m);
  assert.ok(canonical, "the provider receives an explicit complete canonical NAV object");
  assert.deepEqual(JSON.parse(canonical[1]), {
    type: "NAV", target: "phase", required: false, question: CONTINUE_TO_SOLUTION_LABEL,
    options: [{ id: "continue_to_solution", label: CONTINUE_TO_SOLUTION_LABEL }],
  });
  assert.equal(payloads[0].model, "gpt-5.6-luna");
  assert.deepEqual(payloads[0].reasoning, { effort: "low" });
  assert.equal(payloads[0].text.format.strict, true);
});

test("unexpected controller setup error reports only unknown_failure without a provider call", async t => {
  const collector = { sink() { throw new Error("Private setup details."); }, records: () => [] };
  const { run, payloads } = await controllerFixture(t, {}, { collector });
  assert.equal(run.fallbackReason, "unknown_failure");
  assert.equal(run.usedFallback, true);
  assert.equal(payloads.length, 0);
});

test("invalid NAV/controller options expose a safe detailed reason while retaining canonical failure accounting", async t => {
  const invalid = structuredClone(validController);
  invalid.dialog_actions[1].options[0].label = "PRIVATE_GENERATED_TEXT";
  const { run, records, payloads } = await controllerFixture(t, {
    status: "completed", model: "gpt-5.6-luna", service_tier: "default", usage: controllerUsage, output_text: JSON.stringify(invalid),
  });
  assert.equal(run.fallbackReason, "controller_contract_validation_failure");
  assert.equal(run.rejectionReason, "nav_option_mismatch");
  assert.equal(payloads.length, 1);
  assert.equal(records[0].provider_status, "completed");
  assert.equal(records[0].application_status, "rejected_invalid_output");
  assert.equal(records[0].usage.normalized_total_tokens, 120);
  assert.equal(records[0].pricing_snapshot.status, "priced");
  assert.doesNotMatch(JSON.stringify({ fallback_reason: run.fallbackReason, rejection_reason: run.rejectionReason }), /PRIVATE_/);
});

test("invalid NAV structure preserves existing fallback/rejection telemetry and makes no retry call", async t => {
  for (const [name, update] of [
    ["required true", nav => { nav.required = true; }],
    ["non-NAV target", nav => { nav.target = "context"; }],
    ["missing option", nav => { nav.options = []; }],
  ]) {
    await t.test(name, async t => {
      const invalid = structuredClone(validController);
      update(invalid.dialog_actions[1]);
      const { run, records, payloads } = await controllerFixture(t, {
        status: "completed", model: "gpt-5.6-luna", service_tier: "default", usage: controllerUsage,
        output_text: JSON.stringify(invalid),
      });
      assert.equal(run.usedFallback, true);
      assert.deepEqual(run.result, fallbackQuestController(controllerNotebook, "intake"));
      assert.equal(run.response, null);
      assert.equal(run.fallbackReason, "controller_contract_validation_failure");
      assert.equal(run.rejectionReason, "invalid_nav_contract");
      assert.equal(payloads.length, 1);assert.equal(records.length, 1);
      assert.equal(records[0].provider_status, "completed");
      assert.equal(records[0].application_status, "rejected_invalid_output");
      assert.equal(records[0].usage.normalized_total_tokens, 120);
      assert.equal(records[0].pricing_snapshot.status, "priced");
      const telemetry = mergeSessionTelemetry(createSessionTelemetry({
        requestId: "nav-contract", turnId: "nav-turn", phase: "intake", startedAt: "2026-10-14T00:00:00Z",
      }), { controller: { mode: "llm_fallback", fallback_reason: run.fallbackReason, rejection_reason: run.rejectionReason } });
      assert.deepEqual(telemetry.controller, {
        mode: "llm_fallback", fallback_reason: "controller_contract_validation_failure", rejection_reason: "invalid_nav_contract",
      });
    });
  }
});
