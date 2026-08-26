import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8");
const controller = await readFile(new URL("../app/quest-controller.ts", import.meta.url), "utf8");

test("chat shares one request collector across controller and main streaming calls", () => {
  assert.match(route, /const usageCollector = createRequestUsageCollector\(\)/);
  assert.match(route, /runQuestController\(\{[^]*requestId,[^]*turnId,[^]*collector: usageCollector,/);
  assert.match(route, /createInstrumentedModelCallLifecycle\(\{[^]*request_id: requestId,[^]*operation: "main_chat"[^]*sink: usageCollector\.sink,/);
  assert.match(route, /\.\.\.mainLifecycle\.headers/);
});

test("all main-stream terminal outcomes finalize and return canonical usage records", () => {
  for (const eventType of ["response.completed", "response.incomplete", "response.failed", "error"]) {
    assert.match(route, new RegExp(`event\\.type === "${eventType.replace(".", "\\.")}"`));
  }
  assert.match(route, /finish_transport\("fetch_error"\)/);
  assert.match(route, /finish_transport\("missing_stream_body"\)/);
  assert.match(route, /finish_transport\("stream_ended_without_terminal_event"\)/);
  assert.match(route, /finish_transport\("stream_interrupted"\)/);
  assert.ok((route.match(/model_usage_records: usageCollector\.records\(\)/g) ?? []).length >= 6);
});

test("controller uses the shared non-streaming wrapper and has no direct provider fetch", () => {
  assert.match(controller, /callOpenAIResponses\(\{/);
  assert.match(controller, /operation: "controller"/);
  assert.doesNotMatch(controller, /fetch\("https:\/\/api\.openai\.com\/v1\/responses"/);
  assert.equal((route.match(/fetch\("https:\/\/api\.openai\.com\/v1\/responses"/g) ?? []).length, 1);
});
