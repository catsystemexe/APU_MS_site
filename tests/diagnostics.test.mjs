import assert from "node:assert/strict";
import test from "node:test";
import { summarizeDiagnostics } from "../app/conversation-diagnostics.ts";
import {
  DEFAULT_MODEL_ID,
  FILE_SEARCH_CALL_USD,
  estimateCostUsd,
  isSupportedModel,
} from "../app/model-config.ts";

test("Terra remains the concrete fallback model", () => {
  assert.equal(DEFAULT_MODEL_ID, "gpt-5.6-terra");
});

const first = {
  callId: "call-1",
  model: "gpt-5.6-sol",
  inputTokens: 3_000,
  cachedInputTokens: 2_000,
  outputTokens: 500,
  reasoningTokens: 120,
  totalTokens: 3_500,
  fileSearchCalls: 1,
  estimatedCostUsd: 0.0225,
};

const second = {
  callId: "call-2",
  model: "gpt-5.6-terra",
  inputTokens: 1_000,
  cachedInputTokens: 0,
  outputTokens: 250,
  reasoningTokens: 50,
  totalTokens: 1_250,
  estimatedCostUsd: 0.005,
};

test("conversation totals equal unique response footers", () => {
  const summary = summarizeDiagnostics([first, second]);
  assert.equal(summary.inputTokens, 4_000);
  assert.equal(summary.outputTokens, 750);
  assert.equal(summary.totalTokens, 4_750);
  assert.equal(summary.cachedInputTokens, 2_000);
  assert.equal(summary.reasoningTokens, 170);
  assert.equal(summary.responseCount, 2);
  assert.equal(summary.estimatedCostUsd, 0.0275);
});

test("duplicate call IDs are counted exactly once", () => {
  const summary = summarizeDiagnostics([first, first, { ...first }]);
  assert.equal(summary.responseCount, 1);
  assert.equal(summary.inputTokens, first.inputTokens);
  assert.equal(summary.outputTokens, first.outputTokens);
});

test("an unknown price makes the cumulative estimate unavailable", () => {
  const summary = summarizeDiagnostics([first, { ...second, callId: "call-3", estimatedCostUsd: null }]);
  assert.equal(summary.estimatedCostUsd, null);
  assert.equal(summary.totalTokens, 4_750);
});

test("price separates regular, cached, cache-write and output tokens", () => {
  const price = estimateCostUsd({
    model: "gpt-5.6-sol",
    inputTokens: 10_000,
    cachedInputTokens: 4_000,
    cacheWriteTokens: 1_000,
    outputTokens: 2_000,
    fileSearchCalls: 1,
  });
  const expected = (5_000 * 5 + 4_000 * 0.5 + 1_000 * 6.25 + 2_000 * 30) / 1_000_000 + FILE_SEARCH_CALL_USD;
  assert.equal(price, expected);
});

test("long-context pricing applies above 272k input tokens", () => {
  const price = estimateCostUsd({
    model: "gpt-5.6-terra",
    inputTokens: 272_001,
    outputTokens: 1_000,
  });
  assert.equal(price, (272_001 * 4 + 1_000 * 18) / 1_000_000);
});

test("unknown models never receive a fabricated estimate", () => {
  assert.equal(estimateCostUsd({ model: "unknown", inputTokens: 10, outputTokens: 10 }), null);
});

test("only configured models are accepted", () => {
  assert.equal(isSupportedModel("gpt-5.6-sol"), true);
  assert.equal(isSupportedModel("gpt-5.6-terra"), true);
  assert.equal(isSupportedModel("gpt-5.6-luna"), true);
  assert.equal(isSupportedModel("gpt-5.x"), false);
});
