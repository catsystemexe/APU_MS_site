import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { pathToFileURL } from "node:url";

const comparisonUrl = pathToFileURL(new URL("../app/usage-shadow-comparison.ts", import.meta.url).pathname).href;
const collectionUrl = pathToFileURL(new URL("../app/model-usage-collection.ts", import.meta.url).pathname).href;
const ledgerUrl = pathToFileURL(new URL("../app/usage-ledger.ts", import.meta.url).pathname).href;
const { compareUsageShadow } = await import(comparisonUrl);
const { appendModelUsageSessionRecords, createModelUsageSession } = await import(collectionUrl);
const { createModelUsageRecord, finalizeModelUsageRecord } = await import(ledgerUrl);
const analysisRoute = await readFile(new URL("../app/api/analysis/route.ts", import.meta.url), "utf8");
const extractRoute = await readFile(new URL("../app/api/extract/route.ts", import.meta.url), "utf8");

function record(callId) {
  const pending = createModelUsageRecord({
    call_id: callId, request_id: "request-1", turn_id: "turn-1", phase: "F1", operation: "extraction",
    attempt_index: 0, retry_of_call_id: null, fallback_for_call_id: null, started_at: "2026-08-26T10:00:00.000Z",
    completed_at: null, requested_model: "gpt-5.6-terra", reported_model: null, reasoning_effort: "low",
    requested_service_tier: "default", reported_service_tier: null, provider_request_id: null, provider_response_id: null,
    provider_status: "unknown", application_status: "not_applicable", error: null,
  });
  return finalizeModelUsageRecord(pending, {
    completed_at: "2026-08-26T10:00:01.000Z", provider_status: "completed", application_status: "accepted",
    provider_usage: { input_tokens: 10, output_tokens: 2 },
  });
}

function session(...records) {
  return appendModelUsageSessionRecords(createModelUsageSession(), records);
}

test("reconciles one legacy diagnostic with its canonical call", () => {
  const canonical = record("call-1");
  const shadow = compareUsageShadow([{
    callId: "legacy-call-1", canonicalCallIds: ["call-1"], model: "gpt-5.6-terra",
    inputTokens: 10, outputTokens: 2, totalTokens: 12, estimatedCostUsd: canonical.pricing_snapshot.estimated_cost_usd,
  }], session(canonical));

  assert.equal(shadow.status, "consistent");
  assert.deepEqual(shadow.observations[0].missing_canonical_call_ids, []);
  assert.deepEqual(shadow.observations[0].token_differences, []);
  assert.equal(shadow.canonical_only_operations.length, 0);
});

test("reconciles a composite legacy diagnostic without treating it as double count", () => {
  const extraction = record("extract-1");
  const grounding = record("grounding-1");
  const shadow = compareUsageShadow([{
    callId: "legacy-extraction", canonicalCallIds: ["extract-1", "grounding-1"], model: "gpt-5.6-terra",
    inputTokens: 20, outputTokens: 4, totalTokens: 24,
    estimatedCostUsd: (extraction.pricing_snapshot.estimated_cost_usd ?? 0) + (grounding.pricing_snapshot.estimated_cost_usd ?? 0),
  }], session(extraction, grounding));

  assert.equal(shadow.status, "consistent");
  assert.deepEqual(shadow.observations[0].token_differences, []);
  assert.equal(shadow.canonical_summary.call_count, 2);
  assert.equal(shadow.legacy_summary.responseCount, 1);
});

test("flags a legacy observation with no canonical record for investigation", () => {
  const shadow = compareUsageShadow([{
    callId: "legacy-missing", canonicalCallIds: ["missing"], model: "gpt-5.6-terra",
    inputTokens: 10, outputTokens: 2, totalTokens: 12, estimatedCostUsd: 0.000044,
  }], session(record("call-1")));

  assert.equal(shadow.status, "needs_investigation");
  assert.deepEqual(shadow.observations[0].missing_canonical_call_ids, ["missing"]);
  assert.deepEqual(shadow.canonical_only_operations, [{ operation: "extraction", count: 1 }]);
});

test("legacy developer diagnostics preserve their canonical call linkage", () => {
  assert.match(analysisRoute, /const callId = usage_record\.call_id/);
  assert.match(analysisRoute, /canonicalCallIds: \[usage_record\.call_id\]/);
  assert.match(extractRoute, /const canonicalCallIds = collector\.records\(\)/);
  assert.match(extractRoute, /canonicalCallIds,/);
});
