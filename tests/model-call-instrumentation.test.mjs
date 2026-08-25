import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";

const moduleUrl = pathToFileURL(new URL("../app/model-call-instrumentation.ts", import.meta.url).pathname).href;
const { InstrumentedModelCallError, runInstrumentedModelCall } = await import(moduleUrl);

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
