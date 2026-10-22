import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = (name) => readFile(new URL(`../app/api/${name}/route.ts`, import.meta.url), "utf8");

test("every non-streaming model route keeps accounting and serializes usage with verified identity", async () => {
  const sources = await Promise.all(["extract", "analysis", "need-route", "f2", "f3"].map(route));
  for (const source of sources) {
    assert.match(source, /callOpenAIResponses/);
    assert.match(source, /createRequestUsageCollector/);
    assert.match(source, /modelUsagePayload/);
    assert.match(source, /usageErrorPayload/);
    assert.match(source, /collector, identity/);
  }
});

test("non-streaming operations use their audited phase and operation identifiers", async () => {
  const [extract, analysis, f2, f3] = await Promise.all([route("extract"), route("analysis"), route("f2"), route("f3")]);
  assert.match(extract, /phase: "F1", operation: "extraction"/);
  assert.match(extract, /phase: "F1", operation: "grounding"/);
  assert.match(analysis, /phase: "F2", operation: "analysis"/);
  assert.match(f2, /operation: operation === "build" \? "f2_build" : operation === "preview" \? "f2_preview" : "f2_component_generation"/);
  assert.match(f3, /phase: "F3", operation: "f3_render"/);
});
