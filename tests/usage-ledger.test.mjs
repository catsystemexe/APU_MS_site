import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  USAGE_FILE_SEARCH_RATE_PER_1000,
  createModelUsageRecord,
  finalizeModelUsageRecord,
  normalizeProviderUsage,
  priceUsageRecord,
  summarizeUsageRecords,
  upsertUsageRecord,
} from "../app/usage-ledger.ts";

function record(overrides = {}) {
  return createModelUsageRecord({
    call_id: "call-1",
    request_id: "request-1",
    turn_id: "turn-1",
    phase: "F1",
    operation: "main_chat",
    attempt_index: 1,
    retry_of_call_id: null,
    fallback_for_call_id: null,
    started_at: "2026-08-25T10:00:00.000Z",
    completed_at: "2026-08-25T10:00:01.000Z",
    requested_model: "gpt-5.6-sol",
    reported_model: "gpt-5.6-sol",
    reasoning_effort: "medium",
    requested_service_tier: "default",
    reported_service_tier: "default",
    provider_request_id: "req_provider_1",
    provider_response_id: "resp_1",
    provider_status: "completed",
    application_status: "accepted",
    error: null,
    provider_usage: {
      input_tokens: 10_000,
      input_tokens_details: { cached_tokens: 4_000, cache_write_tokens: 1_000 },
      output_tokens: 2_000,
      output_tokens_details: { reasoning_tokens: 500 },
      total_tokens: 12_000,
    },
    file_search_calls: 1,
    ...overrides,
  });
}

test("normalizer keeps provider usage nullable and does not double-count reasoning", () => {
  const usage = normalizeProviderUsage({
    input_tokens: 100,
    output_tokens: 20,
    output_tokens_details: { reasoning_tokens: 7 },
    total_tokens: 120,
  });
  assert.equal(usage.normalized_total_tokens, 120);
  assert.equal(usage.reasoning_tokens, 7);
  assert.equal(usage.has_invalid_values, false);
});

test("pricing uses current standard Sol rates and file-search rate", () => {
  const priced = record().pricing_snapshot;
  const expected = (5_000 * 4 + 4_000 * 0.4 + 1_000 * 5 + 2_000 * 20) / 1_000_000 + USAGE_FILE_SEARCH_RATE_PER_1000 / 1_000;
  assert.equal(priced.status, "priced");
  assert.equal(priced.estimated_cost_usd, expected);
  assert.equal(priced.rates_per_million?.output, 20);
});

test("model metadata cannot reintroduce an independent runtime pricing table", async () => {
  const modelConfig = await readFile(new URL("../app/model-config.ts", import.meta.url), "utf8");
  assert.doesNotMatch(modelConfig, /(?:standard|longContext)\s*:/);
  assert.doesNotMatch(modelConfig, /(?:input|cachedInput|cacheWrite|output)\s*:\s*\d/);
  assert.match(modelConfig, /priceUsageRecord\s*\(/);
});

test("reported tier wins, while a missing reported default tier safely uses the requested tier", () => {
  const defaultFallback = record({ reported_service_tier: null }).pricing_snapshot;
  assert.equal(defaultFallback.status, "priced");
  assert.equal(defaultFallback.tier_source, "requested");

  const unknownTier = record({ reported_service_tier: "fast" }).pricing_snapshot;
  assert.equal(unknownTier.status, "unknown_tier");
  assert.equal(unknownTier.estimated_cost_usd, null);
});

test("invalid cache decomposition and missing usage are never priced as facts", () => {
  const invalid = priceUsageRecord({
    requested_model: "gpt-5.6-sol", reported_model: null,
    requested_service_tier: "default", reported_service_tier: null,
    usage: normalizeProviderUsage({ input_tokens: 10, input_tokens_details: { cached_tokens: 9, cache_write_tokens: 2 }, output_tokens: 1 }),
    file_search_calls: 0,
  });
  const missing = record({ provider_usage: undefined }).pricing_snapshot;
  assert.equal(invalid.status, "invalid_usage");
  assert.equal(invalid.estimated_cost_usd, null);
  assert.equal(missing.status, "missing_usage");
  assert.equal(missing.estimated_cost_usd, null);
});

test("unknown models are never priced through a fallback", () => {
  const unknown = record({ requested_model: "unknown", reported_model: "unknown" }).pricing_snapshot;
  assert.equal(unknown.status, "unknown_model");
  assert.equal(unknown.estimated_cost_usd, null);
});

test("finalization preserves billable usage when the application rejects provider output", () => {
  const pending = record({
    completed_at: null,
    provider_status: "unknown",
    application_status: "not_applicable",
    provider_usage: undefined,
    file_search_calls: 0,
  });
  const finalized = finalizeModelUsageRecord(pending, {
    completed_at: "2026-08-25T10:00:02.000Z",
    provider_status: "completed",
    application_status: "rejected_invalid_output",
    provider_usage: { input_tokens: 50, output_tokens: 10, total_tokens: 60 },
  });
  assert.equal(finalized.application_status, "rejected_invalid_output");
  assert.equal(finalized.usage_source, "provider_reported");
  assert.equal(finalized.pricing_snapshot.status, "priced");
});

test("provider failures stay visible without fabricating missing usage", () => {
  const failed = record({
    provider_status: "failed",
    application_status: "failed",
    provider_usage: undefined,
    error: { category: "provider", code: "500" },
    file_search_calls: 0,
  });
  assert.equal(failed.usage_source, "unavailable");
  assert.equal(failed.pricing_snapshot.status, "missing_usage");
  assert.equal(failed.pricing_snapshot.estimated_cost_usd, null);
});

test("upsert is idempotent by local call id and rejects conflicting immutable identity", () => {
  const first = record();
  const finalized = finalizeModelUsageRecord(first, { completed_at: "2026-08-25T10:00:03.000Z" });
  const upserted = upsertUsageRecord(upsertUsageRecord([], first), finalized);
  assert.equal(upserted.length, 1);
  assert.equal(upserted[0].completed_at, "2026-08-25T10:00:03.000Z");
  assert.throws(() => upsertUsageRecord(upserted, record({ operation: "controller" })), /Conflicting immutable usage identity/);
});

test("each retry is a separately counted provider attempt", () => {
  const first = record({ provider_status: "failed", application_status: "failed", provider_usage: undefined, error: { category: "provider", code: "429" } });
  const retry = record({
    call_id: "call-2",
    attempt_index: 2,
    retry_of_call_id: "call-1",
    provider_status: "completed",
    application_status: "accepted",
  });
  const summary = summarizeUsageRecords([first, retry]);
  assert.equal(summary.call_count, 2);
  assert.equal(summary.failed_call_count, 1);
  assert.equal(summary.completed_call_count, 1);
});

test("summary keeps known subtotal while exposing incomplete billing coverage", () => {
  const completed = record();
  const incomplete = record({
    call_id: "call-2",
    operation: "controller",
    attempt_index: 2,
    provider_status: "incomplete",
    application_status: "failed",
    provider_usage: { input_tokens: 20, output_tokens: 5, total_tokens: 25 },
    file_search_calls: 0,
  });
  const transportFailure = record({
    call_id: "call-3",
    operation: "analysis",
    attempt_index: 3,
    provider_status: "transport_error",
    application_status: "failed",
    provider_usage: undefined,
    error: { category: "transport", code: "timeout" },
    file_search_calls: 0,
  });
  const summary = summarizeUsageRecords([completed, incomplete, transportFailure, completed]);
  assert.equal(summary.call_count, 3);
  assert.equal(summary.completed_call_count, 1);
  assert.equal(summary.incomplete_call_count, 1);
  assert.equal(summary.failed_call_count, 1);
  assert.equal(summary.uncertain_charge_call_count, 1);
  assert.equal(summary.priced_call_count, 2);
  assert.equal(summary.unpriced_call_count, 1);
  assert.ok(summary.known_cost_subtotal_usd > 0);
  assert.equal(summary.complete_estimated_cost_usd, null);
});
