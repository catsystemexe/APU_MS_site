import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { createCurrentRozborState, createF2ToF3Snapshot } from "../app/f2-build-model.ts";
import { createF3RenderRequest, createF3State } from "../app/f3-finalization-model.ts";

const hypothesis = { id: "h", rank: 1, title: "Možnost", summary: "Nejistá interpretace", relevantNeeds: [], question: null, questions: [], supportingInformation: [], limitations: ["Málo evidence"], unknowns: [] };
const source = (path) => createF2ToF3Snapshot({ needId: "n", needText: "Cíl", initialF2Path: path, f3Target: null }, [hypothesis], path, createCurrentRozborState()[path], 0);
let calls = [];
globalThis.__f3BaselineAPI = {
  getAccessIdentity: async () => ({ role: "teacher" }),
  createRequestUsageCollector: () => ({}), modelUsagePayload: (payload) => payload, usageErrorPayload: () => null,
  callOpenAIResponses: async (request) => {
    calls.push(request);
    return { response: { body: {} }, usage_record: { provider_status: "completed" }, application_result: { kind: "material", title: "B", introduction: "Materiál", sections: [{ heading: "Část", content: "Obsah" }], table: null, cards: [], usageNote: null } };
  },
};
let code = await readFile(new URL("../app/api/f3/route.ts", import.meta.url), "utf8");
code = code.replace(/import \{ createRequestTelemetrySink \} from [^;]+;/, "const createRequestTelemetrySink = async () => ({ sink() {} });")
  .replace(/import \{ getAccessIdentity \} from [^;]+;/, 'const { getAccessIdentity } = globalThis.__f3BaselineAPI;')
  .replace(/import \{ callOpenAIResponses[^;]+;/, 'const { callOpenAIResponses, createRequestUsageCollector, modelUsagePayload, usageErrorPayload } = globalThis.__f3BaselineAPI;')
  .replace(/from "(\.\.\/\.\.\/[^";]+)"/g, (_, relative) => `from ${JSON.stringify(new URL(`../app/${relative.replace('../../', '')}.ts`, import.meta.url).href)}`)
  .replace('const apiKey = process.env.OPENAI_API_KEY;', 'const apiKey = "mock-configuration-binding";');
const js = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { POST } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const post = (body) => POST(new Request("https://apu.test/api/f3", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));

test("D/E: server independently blocks unsupported baseline specialization before a model call", async () => {
  const validRequest = createF3RenderRequest(createF3State(source("POCHOPIT")));
  for (const path of ["POZOROVAT", "VYTVOŘIT"]) {
    const snapshot = source(path);
    const response = await post({ ...validRequest, sourceSnapshot: snapshot, sourceSnapshotId: snapshot.snapshotId, sourceFingerprint: snapshot.sourceFingerprint });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).result.kind, "boundary_issue");
  }
  assert.equal(calls.length, 0);
});
test("C: model input contains only accepted F2 source and presentation, never another F3 representation", async () => {
  const request = createF3RenderRequest(createF3State(source("POCHOPIT")));
  const response = await post({ ...request, finalRender: { content: "GENERATED_A_NEVER_SOURCE" }, previousRepresentation: "GENERATED_A_NEVER_SOURCE" });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).result.kind, "material");
  assert.equal(calls.length, 1);
  assert.ok(!calls[0].payload.input.includes("GENERATED_A_NEVER_SOURCE"));
  assert.deepEqual(JSON.parse(calls[0].payload.input).source.baselineHypotheses, request.sourceSnapshot.baselineHypotheses);
  assert.equal(calls[0].payload.store, false);
});
