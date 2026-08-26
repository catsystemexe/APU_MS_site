import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";

const collectionUrl = pathToFileURL(new URL("../app/model-usage-collection.ts", import.meta.url).pathname).href;
const ledgerUrl = pathToFileURL(new URL("../app/usage-ledger.ts", import.meta.url).pathname).href;
const {
  appendModelUsageRecords,
  appendModelUsageSessionRecords,
  createModelUsageSession,
  readModelUsageRecords,
} = await import(collectionUrl);
const { createModelUsageRecord, finalizeModelUsageRecord } = await import(ledgerUrl);

function record(callId = "call-1") {
  return createModelUsageRecord({
    call_id: callId,
    request_id: "request-1",
    turn_id: "turn-1",
    phase: "F1",
    operation: "extraction",
    attempt_index: 0,
    retry_of_call_id: null,
    fallback_for_call_id: null,
    started_at: "2026-08-25T10:00:00.000Z",
    completed_at: null,
    requested_model: "gpt-5.6-terra",
    reported_model: null,
    reasoning_effort: "low",
    requested_service_tier: "default",
    reported_service_tier: null,
    provider_request_id: null,
    provider_response_id: null,
    provider_status: "unknown",
    application_status: "not_applicable",
    error: null,
  });
}

test("reads only complete canonical records from the response contract", () => {
  const valid = record();
  const received = readModelUsageRecords({ model_usage_records: [valid, { call_id: "partial" }] });
  assert.deepEqual(received, [valid]);
  assert.deepEqual(readModelUsageRecords({ telemetry: [valid] }), []);
  assert.deepEqual(readModelUsageRecords(null), []);
});

test("deduplicates the same call id while accepting a later finalization", () => {
  const pending = record();
  const final = finalizeModelUsageRecord(pending, {
    completed_at: "2026-08-25T10:00:01.000Z",
    provider_status: "completed",
    application_status: "accepted",
    provider_usage: { input_tokens: 10, output_tokens: 2 },
  });
  const collected = appendModelUsageRecords([pending], [pending, final]);
  assert.equal(collected.length, 1);
  assert.equal(collected[0].provider_status, "completed");
  assert.equal(collected[0].usage.normalized_total_tokens, 12);
});

test("keeps the accepted record when a response conflicts on immutable identity", () => {
  const original = record();
  const conflicting = { ...record(), phase: "F2" };
  const collected = appendModelUsageRecords([original], [conflicting]);
  assert.deepEqual(collected, [original]);
});

test("derives the canonical session summary only from accepted unique records", () => {
  const pending = record();
  const completed = finalizeModelUsageRecord(pending, {
    completed_at: "2026-08-25T10:00:01.000Z",
    provider_status: "completed",
    application_status: "accepted",
    provider_usage: { input_tokens: 10, output_tokens: 2 },
  });
  const session = appendModelUsageSessionRecords(createModelUsageSession(), [pending, completed, completed]);

  assert.equal(session.records.length, 1);
  assert.equal(session.summary.call_count, 1);
  assert.equal(session.summary.completed_call_count, 1);
  assert.equal(session.summary.normalized_total_tokens, 12);
  assert.equal(session.summary.complete_estimated_cost_usd, completed.pricing_snapshot.estimated_cost_usd);
});

test("keeps known session subtotal when an accepted record has unavailable pricing", () => {
  const priced = finalizeModelUsageRecord(record("priced"), {
    completed_at: "2026-08-25T10:00:01.000Z",
    provider_status: "completed",
    application_status: "accepted",
    provider_usage: { input_tokens: 10, output_tokens: 2 },
  });
  const unpriced = finalizeModelUsageRecord(record("unpriced"), {
    completed_at: "2026-08-25T10:00:01.000Z",
    provider_status: "transport_error",
    application_status: "failed",
  });
  const session = appendModelUsageSessionRecords(createModelUsageSession(), [priced, unpriced]);

  assert.equal(session.summary.known_cost_subtotal_usd, priced.pricing_snapshot.estimated_cost_usd);
  assert.equal(session.summary.unpriced_call_count, 1);
  assert.equal(session.summary.uncertain_charge_call_count, 1);
  assert.equal(session.summary.complete_estimated_cost_usd, null);
});
