import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { NEED_ROUTING_SCHEMA } from "../app/f2-need-routing.ts";

// Mock dependencies and the configuration binding: never read or use a real key.
let identity = { role: "teacher" };
let output = { path: "POCHOPIT", clarification: null };
let providerCalls = [];
globalThis.__needRouteTest = {
  getAccessIdentity: async () => identity,
  createRequestUsageCollector: () => ({}),
  modelUsagePayload: (value, _collector, identity) => identity.role === "developer" ? ({ ...value, model_usage_records: [{ operation: "need_routing" }] }) : value,
  usageErrorPayload: () => null,
  callOpenAIResponses: async (request) => {
    providerCalls.push(request);
    return { usage_record: { provider_status: "completed" }, application_result: request.validate_application_response({ output: [{ content: [{ text: JSON.stringify(output) }] }] }) };
  },
};
const source = (await readFile(new URL("../app/api/need-route/route.ts", import.meta.url), "utf8"))
  .replace(/import \{ createRequestTelemetrySink \} from [^;]+;/, "const createRequestTelemetrySink = async () => ({ sink() {} });")
  .replace(/import \{ getAccessIdentity \} from [^;]+;/, 'const { getAccessIdentity } = globalThis.__needRouteTest;')
  .replace(/import \{ callOpenAIResponses[^;]+;/, 'const { callOpenAIResponses, createRequestUsageCollector, modelUsagePayload, usageErrorPayload } = globalThis.__needRouteTest;')
  .replace('"../../f2-need-routing"', JSON.stringify(new URL("../app/f2-need-routing.ts", import.meta.url).href))
  .replace('const apiKey = process.env.OPENAI_API_KEY;', 'const apiKey = "mock-configuration-binding";');
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { POST } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
const request = (value) => new Request("https://apu.test/api/need-route", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });

test("unauthenticated and invalid routing requests cannot reach the provider", async () => {
  identity = null;
  assert.equal((await POST(request({ needText: "Cíl" }))).status, 401);
  identity = { role: "teacher" };
  for (const value of [{}, { needText: " " }, { needText: "a".repeat(2001) }, { needText: 7 }]) assert.equal((await POST(request(value))).status, 400);
  assert.equal(providerCalls.length, 0);
});
test("provider routing is bounded, validates all three strategies, ignores routing hints, and exposes usage only to developers", async () => {
  for (const role of ["teacher", "developer"]) for (const path of ["POCHOPIT", "POZOROVAT", "VYTVOŘIT"]) {
    identity = { role }; output = { path, clarification: null };
    const response = await POST(request({ needText: "Aktivní kanonická potřeba", path: "OTHER", scenarioPath: "OTHER", needMapping: { f2Path: "OTHER" } }));
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(payload.decision, output);
    if (role === "developer") assert.equal(payload.model_usage_records[0].operation, "need_routing");
    else assert.equal(payload.model_usage_records, undefined);
    const call = providerCalls.at(-1);
    assert.equal(call.operation, "need_routing");
    assert.equal(call.phase, "F2");
    assert.equal(call.payload.store, false);
    assert.equal(call.payload.tools, undefined);
    assert.equal(call.payload.text.format.strict, true);
    assert.deepEqual(call.payload.text.format.schema, NEED_ROUTING_SCHEMA);
    assert.deepEqual(JSON.parse(call.payload.input), { needText: "Aktivní kanonická potřeba" });
  }
});
test("ambiguous output returns one question; invalid or contradictory provider output fails closed", async () => {
  output = { path: null, clarification: "Jaký výsledek by vám nyní pomohl?" };
  assert.deepEqual((await (await POST(request({ needText: "Posunout se" }))).json()).decision, output);
  for (const invalid of [{ path: "OTHER", clarification: null }, { path: null, clarification: null }, { path: "POCHOPIT", clarification: "Co chcete?" }]) {
    output = invalid;
    const response = await POST(request({ needText: "Posunout se" }));
    assert.equal(response.status, 502);
    assert.equal((await response.json()).decision, undefined);
  }
});
