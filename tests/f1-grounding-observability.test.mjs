import assert from "node:assert/strict";
import test, { after } from "node:test";
import { build } from "esbuild";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Unit fixture for the actual handler: authentication and provider I/O are mocked,
// never hosted/bypassed or sent to OpenAI. Production parsing/rescue code is bundled.
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const artifactRoot = await mkdtemp(join(tmpdir(), "apu-grounding-observability-"));
const bundle = join(artifactRoot, "extract.mjs");
await build({
  entryPoints: [join(projectRoot, "app/api/extract/route.ts")], outfile: bundle,
  bundle: true, platform: "node", format: "esm", logLevel: "silent",
  plugins: [{
    name: "synthetic-unit-boundaries",
    setup(plugin) {
      plugin.onResolve({ filter: /access-auth$/ }, () => ({ path: "unit-auth", namespace: "unit" }));
      plugin.onLoad({ filter: /.*/, namespace: "unit" }, () => ({ contents: `export async function getAccessIdentity(headers) { const role=headers.get('x-fixture-role'); return role ? {email:'synthetic@example.invalid',role} : null; }`, loader: "js" }));
      plugin.onResolve({ filter: /\.md\?raw$/ }, args => ({ path: join(dirname(args.importer), args.path.replace(/\?raw$/, "")), namespace: "raw" }));
      plugin.onLoad({ filter: /.*/, namespace: "raw" }, async args => ({ contents: `export default ${JSON.stringify(await readFile(args.path, "utf8"))}`, loader: "js" }));
    },
  }],
});
const { POST } = await import(pathToFileURL(bundle).href);
after(() => rm(artifactRoot, { recursive: true, force: true }));

const message = "Synthetic observation. Another observation.";
const candidates = ["Synthetic observation.", "Another observation."].map(sourceQuote => ({
  category: "manifestations", sourceQuote, notebookText: sourceQuote, action: "add", relatedEntryId: null, reason: null,
}));
const primaryAccept = [{ index: 0, accepted: true, reason: "PRIVATE_VERDICT_TEXT" }, { index: 1, accepted: true, reason: null }];
const primaryMixed = [{ index: 0, accepted: true, reason: null }, { index: 1, accepted: false, reason: "PRIVATE_VERDICT_TEXT" }];
const rescued = [{ index: 0, accepted: true, reasonCategory: "accept_shared_subject", reason: "PRIVATE_RESCUE_TEXT" }];
const usage = { input_tokens: 10, output_tokens: 2, total_tokens: 12 };

async function runExtraction(t, { primary = { verdicts: primaryAccept }, rescue = { verdicts: rescued }, extractionCandidates = candidates, role = "developer", explicitNeed } = {}) {
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "synthetic-unit-key";
  t.after(() => { if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey; });
  const calls = [];
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    const payload = JSON.parse(init.body);
    const name = payload.text.format.name;
    calls.push(name);
    let result;
    if (name === "apu_notepad_extraction") {
      result = { situationRelation: "same", situationReason: null, categoryReview: { manifestations: "found", goals: "none", context: "none", course: "none", helps: "none" }, candidates: extractionCandidates };
    } else if (name === "apu_notepad_grounding_verification") result = primary;
    else if (name === "apu_notepad_grounding_rescue") {
      const submitted = JSON.parse(payload.input).candidates;
      assert.equal(submitted.length, 1, "only the explicit rejection enters rescue");
      assert.equal(submitted[0].sourceQuote, candidates[1].sourceQuote);
      result = rescue;
    } else throw new Error("Unexpected provider call in unit fixture");
    if (result?.transport) throw new Error("PRIVATE_TRANSPORT_DETAIL");
    const { providerStatus = "completed", httpStatus = 200, outputText, missingOutput = false, ...data } = result;
    return Response.json({
      id: `provider-${calls.length}`, model: payload.model, service_tier: "default", status: providerStatus, usage,
      ...(missingOutput ? {} : { output_text: outputText ?? JSON.stringify(data) }),
      ...(providerStatus === "failed" ? { error: { code: "server_error", message: "PRIVATE_PROVIDER_DETAIL" } } : {}),
    }, { status: httpStatus });
  });
  const response = await POST(new Request("http://unit.invalid/api/extract", {
    method: "POST", headers: { "Content-Type": "application/json", "x-fixture-role": role },
    body: JSON.stringify({ message, notebook: [], turnId: "unit-turn", ...(explicitNeed ? { explicitNeed, answersNeedQuestion: true } : {}) }),
  }));
  assert.equal(response.status, 200);
  const body = await response.json();
  const detail = body.telemetry?.grounding;
  if (detail) {
    assert.doesNotMatch(JSON.stringify(detail), /PRIVATE_|Synthetic observation|Another observation|synthetic-unit-key|sourceQuote|notebookText|instructions/);
    assert.deepEqual(body.telemetry.stages.map(stage => stage.name), ["extract", "grounding"], "legacy stage names and aggregate row remain intact");
    for (const attempt of [detail.primary, detail.rescue]) {
      if (attempt.status === "skipped") {
        assert.equal(attempt.call_id, null);assert.equal(attempt.duration_ms, null);assert.equal(attempt.usage, null);
      } else {
        const record = body.model_usage_records.find(record => record.call_id === attempt.call_id);
        assert.ok(record);assert.equal(record.operation, "grounding");
        assert.equal(attempt.provider_status, record.provider_status);
        assert.equal(attempt.application_status, record.application_status);
        assert.equal(attempt.usage.input_tokens, record.usage.input_tokens);
        assert.equal(attempt.usage.output_tokens, record.usage.output_tokens);
        assert.equal(record.pricing_snapshot.status, attempt.provider_status === "transport_error" ? "missing_usage" : "priced");
        assert.ok(attempt.duration_ms >= 0);
      }
    }
  }
  return { body, detail, calls };
}

test("no candidates skip both stages without grounding requests or invented usage", async t => {
  const { detail, calls } = await runExtraction(t, { extractionCandidates: [] });
  assert.deepEqual(calls, ["apu_notepad_extraction"]);
  assert.equal(detail.primary.status, "skipped");assert.equal(detail.rescue.status, "skipped");
  assert.equal(detail.primary.skipped_reason, "no_candidates");assert.equal(detail.rescue.skipped_reason, "no_candidates");
  assert.equal(detail.counts.submitted, 0);assert.equal(detail.counts.final_accepted, 0);
});

test("all primary acceptances skip rescue and preserve two accepted candidates", async t => {
  const { body, detail, calls } = await runExtraction(t);
  assert.equal(calls.length, 2);assert.equal(body.extraction.candidates.length, 2);
  assert.equal(detail.primary.status, "completed");assert.equal(detail.rescue.status, "skipped");
  assert.equal(detail.rescue.skipped_reason, "no_explicit_rejections");
  assert.deepEqual(detail.counts, { submitted: 2, primary_accepted: 2, primary_explicit_rejected: 0, primary_unresolved: 0, rescue_submitted: 0, rescue_accepted: 0, final_accepted: 2 });
});

test("rescue has its own call identity/usage and adds only the explicit rejection", async t => {
  const { body, detail, calls } = await runExtraction(t, { primary: { verdicts: primaryMixed } });
  assert.equal(calls.length, 3);assert.equal(body.extraction.candidates.length, 2);
  assert.equal(detail.rescue.status, "completed");assert.notEqual(detail.primary.call_id, detail.rescue.call_id);
  assert.deepEqual(detail.counts, { submitted: 2, primary_accepted: 1, primary_explicit_rejected: 1, primary_unresolved: 0, rescue_submitted: 1, rescue_accepted: 1, final_accepted: 2 });
  assert.equal(body.model_usage_records.length, 3);
  assert.equal(body.telemetry.stages[1].usage.input_tokens, 20, "legacy aggregate includes both calls exactly once");
});

test("a valid rescue rejection stays rejected, rather than being labelled a failed call", async t => {
  const { body, detail } = await runExtraction(t, { primary: { verdicts: primaryMixed }, rescue: { verdicts: [{ index: 0, accepted: false, reasonCategory: "reject_modifier_only", reason: "PRIVATE_RESCUE_TEXT" }] } });
  assert.equal(detail.rescue.status, "completed");assert.equal(detail.rescue.failure_reason, null);
  assert.equal(detail.counts.rescue_accepted, 0);assert.equal(body.extraction.candidates.length, 1);
});

for (const [name, failure, reason] of [
  ["provider failure", { providerStatus: "failed", httpStatus: 503 }, "provider_failure"],
  ["incomplete response", { providerStatus: "incomplete" }, "incomplete_provider_response"],
  ["transport failure", { transport: true }, "transport_failure"],
  ["JSON parse failure", { outputText: "PRIVATE_INVALID_JSON" }, "json_parse_failure"],
  ["missing structured output", { missingOutput: true }, "missing_structured_output"],
  ["invalid verdict contract", { verdicts: [] }, "grounding_contract_validation_failure"],
]) {
  test(`rescue ${name} is observable and preserves primary acceptance without retries`, async t => {
    const { body, detail, calls } = await runExtraction(t, { primary: { verdicts: primaryMixed }, rescue: failure });
    assert.equal(calls.length, 3);assert.equal(body.extraction.candidates.length, 1);
    assert.equal(body.extraction.candidates[0].sourceQuote, candidates[0].sourceQuote);
    assert.equal(detail.rescue.status, "failed");assert.equal(detail.rescue.failure_reason, reason);
    assert.equal(detail.counts.rescue_accepted, 0);assert.equal(detail.counts.final_accepted, 1);
  });
}

for (const [name, failure, reason] of [
  ["provider failure", { providerStatus: "failed", httpStatus: 503 }, "provider_failure"],
  ["incomplete response", { providerStatus: "incomplete" }, "incomplete_provider_response"],
  ["transport failure", { transport: true }, "transport_failure"],
  ["JSON parse failure", { outputText: "PRIVATE_INVALID_JSON" }, "json_parse_failure"],
  ["missing structured output", { missingOutput: true }, "missing_structured_output"],
  ["missing verdict array", {}, "grounding_contract_validation_failure"],
]) {
  test(`primary ${name} is observable and never creates rescue eligibility`, async t => {
    const { body, detail, calls } = await runExtraction(t, { primary: failure });
    assert.equal(calls.length, 2);assert.equal(body.extraction.candidates.length, 0);
    assert.equal(detail.primary.status, "failed");assert.equal(detail.primary.failure_reason, reason);
    assert.equal(detail.rescue.status, "skipped");assert.equal(detail.rescue.skipped_reason, "primary_failed");
    assert.equal(detail.counts.primary_unresolved, 2);assert.equal(detail.counts.rescue_submitted, 0);
  });
}

test("partial/contradictory primary verdicts retain the existing permissive monotonic decisions", async t => {
  const { body, detail, calls } = await runExtraction(t, { primary: { verdicts: [
    { index: 0, accepted: false }, { index: 0, accepted: true },
    { index: 1, accepted: false }, { index: 1, accepted: false }, { index: 99, accepted: true }, null,
  ] } });
  assert.equal(calls.length, 2);assert.equal(body.extraction.candidates.length, 1);
  assert.equal(detail.primary.status, "completed");assert.equal(detail.counts.primary_accepted, 1);
  assert.equal(detail.counts.primary_unresolved, 1);assert.equal(detail.counts.rescue_submitted, 0);
});

test("normal users receive unchanged extraction/usage contracts without developer grounding details", async t => {
  const { body, calls } = await runExtraction(t, { role: "tester" });
  assert.equal(calls.length, 2);assert.equal(body.extraction.candidates.length, 2);
  assert.equal(body.telemetry, undefined);assert.equal(body.diagnostics, undefined);
  assert.equal(body.model_usage_records.length, 2);
});

test("explicit teacher-need fast path remains provider-free and does not invent telemetry", async t => {
  const { body, calls } = await runExtraction(t, { explicitNeed: "POCHOPIT" });
  assert.equal(calls.length, 0);assert.equal(body.telemetry, undefined);
  assert.equal(body.extraction.candidates[0].needMapping.f2Path, "POCHOPIT");
});
