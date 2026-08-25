import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";

const moduleUrl = pathToFileURL(new URL("../app/openai-responses-instrumentation.ts", import.meta.url).pathname).href;
const { callOpenAIResponses, createRequestUsageCollector, modelUsagePayload } = await import(moduleUrl);

test("records a completed OpenAI Responses call and forwards its correlation header", async () => {
  const collector = createRequestUsageCollector();
  let headers;
  const result = await callOpenAIResponses({
    api_key: "not-a-real-key", request_id: "request-1", turn_id: "turn-1", phase: "F2", operation: "analysis",
    requested_model: "gpt-5.6-terra", reasoning_effort: "low", requested_service_tier: "default", collector,
    payload: { model: "gpt-5.6-terra" },
    validate_application_response: (body) => body.id,
    fetcher: async (_url, init) => {
      headers = init.headers;
      return new Response(JSON.stringify({ id: "resp-1", model: "gpt-5.6-terra", status: "completed", usage: { input_tokens: 10, output_tokens: 3 } }), { status: 200, headers: { "x-request-id": "provider-request-1" } });
    },
  });
  assert.equal(typeof headers["X-Client-Request-Id"], "string");
  assert.equal(result.application_result, "resp-1");
  assert.equal(collector.records().length, 1);
  assert.equal(collector.records()[0].provider_request_id, "provider-request-1");
  assert.equal(collector.records()[0].usage.normalized_total_tokens, 13);
  assert.equal(modelUsagePayload({ ok: true }, collector).model_usage_records[0].call_id, collector.records()[0].call_id);
});

test("preserves provider failure usage when the HTTP status is non-success", async () => {
  const collector = createRequestUsageCollector();
  const result = await callOpenAIResponses({
    api_key: "not-a-real-key", request_id: "request-2", phase: "F1", operation: "extraction",
    requested_model: "gpt-5.6-luna", reasoning_effort: "low", requested_service_tier: "default", collector,
    payload: { model: "gpt-5.6-luna" },
    fetcher: async () => new Response(JSON.stringify({ error: { code: "rate_limit_exceeded" }, usage: { input_tokens: 7, output_tokens: 0 } }), { status: 429, headers: { "x-request-id": "provider-request-2" } }),
  });
  assert.equal(result.usage_record.provider_status, "failed");
  assert.equal(result.usage_record.provider_request_id, "provider-request-2");
  assert.equal(result.usage_record.usage.normalized_total_tokens, 7);
  assert.deepEqual(result.usage_record.error, { category: "provider_response", code: "rate_limit_exceeded" });
  assert.equal(collector.records().length, 1);
});
