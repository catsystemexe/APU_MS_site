import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CONTINUE_TO_SOLUTION_LABEL } from "../app/dialog-action.ts";

// Full effective request signatures captured from 5f9230c before envelope changes.
// They pin every instruction byte, dynamic input, schema and model setting.
// Main signature updated for the intentional stateless migration; both turns use it.
const baseline = {
  apu_notepad_extraction: "be84e06aa5e12ff81a9ce0910b415f82ba9e53a52d1ab46061a33746a6d41d1f",
  apu_notepad_grounding_verification: "bfa7082371a257da8deb6b87ffaa40230ecd3581b250c2dfa13ebf80c96fe547",
  apu_notepad_grounding_rescue: "94cbabbce22dec16ede3eccdcd54ba4d5b91b2914c4a7c04c8a19448a56b686a",
  apu_quest_controller: "fcd74c54e61cc3b12bc4e3d9c0a3845e3c137c8c1f83896b924a8d7e2c1d9868",
  main_stateless: "8eb76e981c0a798fa5860f618e24329049bab99724b364127ed42935fd69a7de",
};
const root = fileURLToPath(new URL("..", import.meta.url));
const artifacts = await mkdtemp(join(tmpdir(), "apu-f1-cache-"));
after(() => rm(artifacts, { recursive: true, force: true }));
async function buildHandlers(simulateCRLF = false) {
  const handlers = {};
  for (const operation of ["extract", "chat"]) {
    const outfile = join(artifacts, `${simulateCRLF ? "crlf" : "native"}-${operation}.mjs`);
    await build({
      entryPoints: [join(root, `app/api/${operation}/route.ts`)], outfile,
      bundle: true, platform: "node", format: "esm", logLevel: "silent",
      plugins: [{ name: "mock-unit-boundaries", setup(plugin) {
        plugin.onResolve({ filter: /access-auth$/ }, () => ({ path: "auth", namespace: "unit" }));
        plugin.onLoad({ filter: /.*/, namespace: "unit" }, () => ({ contents: `export async function getAccessIdentity(headers) { return {email:'fixture@example.invalid',role:headers.get('x-fixture-role')}; }`, loader: "js" }));
        plugin.onResolve({ filter: /\.md\?raw$/ }, args => ({ path: join(dirname(args.importer), args.path.replace(/\?raw$/, "")), namespace: "raw" }));
        plugin.onLoad({ filter: /.*/, namespace: "raw" }, async args => {
          const markdown = await readFile(args.path, "utf8");
          const fixture = simulateCRLF ? markdown.replace(/\r?\n/g, "\r\n") : markdown;
          // Canonicalize fixture Markdown only; request/user strings stay byte-exact.
          return { contents: `export default ${JSON.stringify(fixture.replace(/\r\n/g, "\n"))}`, loader: "js" };
        });
      } }],
    });
    handlers[operation] = (await import(pathToFileURL(outfile).href)).POST;
  }
  return handlers;
}
const handlers = await buildHandlers();

const message = "  Synthetic observation. Another observation. 🧪\nPreserve whitespace.  ";
const notebook = [
  { id: "observation", category: "manifestations", text: "Earlier observation. 🧪", trust: "confirmed" },
  { id: "need", category: "goals", text: "Understand the situation.", trust: "unconfirmed" },
];
const candidates = ["Synthetic observation.", "Another observation."].map(sourceQuote => ({
  category: "manifestations", sourceQuote, notebookText: sourceQuote, action: "add", relatedEntryId: null, reason: null,
}));
const usage = { input_tokens: 1500, input_tokens_details: { cached_tokens: 1024, cache_write_tokens: 128 }, output_tokens: 20, output_tokens_details: { reasoning_tokens: 5 }, total_tokens: 1520 };
const controllerResult = {
  phase: "intake", dialog_actions: [
    { type: "SIDE", target: "context", required: false, question: "In which setting?", options: [] },
    { type: "NAV", target: "phase", required: false, question: CONTINUE_TO_SOLUTION_LABEL, options: [{ id: "continue_to_solution", label: CONTINUE_TO_SOLUTION_LABEL }] },
  ], intake_question_policy_applies: true, transition_ready: true, chat_navigation_event: "none",
};

function effective(payload) {
  if (typeof payload.input === "string") return payload;
  const { prompt_cache_options, input, ...settings } = payload;
  return { ...settings, instructions: input[0].content.map(block => block.text).join(""), input: input[1].content[0].text };
}
function signature(value) {
  const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;
  return createHash("sha256").update(JSON.stringify(ordered(value))).digest("hex");
}
function assertCached(payload) {
  assert.equal(Object.hasOwn(payload, "instructions"), false);
  assert.deepEqual(payload.prompt_cache_options, { mode: "explicit" });
  assert.deepEqual(payload.input.map(item => item.role), ["developer", "user"]);
  assert.equal(payload.input[0].content.length, 1);
  assert.deepEqual(Object.keys(payload.input[0].content[0]).sort(), ["prompt_cache_breakpoint", "text", "type"]);
  assert.equal(payload.input[0].content[0].type, "input_text");
  assert.deepEqual(payload.input[0].content[0].prompt_cache_breakpoint, { mode: "explicit" });
  assert.deepEqual(payload.input[1].content, [{ type: "input_text", text: effective(payload).input }]);
  for (const field of ["prompt_cache_key", "prompt_cache_retention"]) assert.equal(Object.hasOwn(payload, field), false);
}

function assertBaselineRequests(payloads, names) {
  assert.equal(payloads.length, names.length, "unchanged provider-call count");
  for (const [index, name] of names.entries()) {
    const payload = payloads[index];
    if (!name.startsWith("main_")) assertCached(payload);
    assert.equal(signature(effective(payload)), baseline[name], name);
  }
}
const extractionNames = ["apu_notepad_extraction", "apu_notepad_grounding_verification", "apu_notepad_grounding_rescue"];

async function run(t, operation, { role = "developer", rescue = true, currentMessage = message, currentNotebook = notebook, previousResponseId, context = {}, fixtureHandlers = handlers, expectedStatus = 200, fixtureCandidates = candidates } = {}) {
  for (const key of ["OPENAI_API_KEY", "APU_VECTOR_STORE_ID"]) {
    const previous = process.env[key];
    process.env[key] = "synthetic-unit-only";
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  const payloads = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    const payload = JSON.parse(init.body);
    payloads.push(payload);
    const response = { id: `fixture-${payloads.length}`, status: "completed", model: payload.model, service_tier: "default", usage };
    if (payload.stream) return new Response([
      { type: "response.output_text.delta", delta: "Rozumím." },
      { type: "response.completed", response: { ...response, output: [{ type: "message" }] } },
    ].map(event => `data: ${JSON.stringify(event)}\n\n`).join(""), { headers: { "Content-Type": "text/event-stream" } });
    const name = payload.text.format.name;
    let result;
    if (name === "apu_notepad_extraction") result = { situationRelation: "same", situationReason: null, categoryReview: { manifestations: "found", goals: "none", context: "none", course: "none", helps: "none" }, candidates: fixtureCandidates };
    else if (name === "apu_notepad_grounding_verification") result = { verdicts: [{ index: 0, accepted: true, reason: null }, { index: 1, accepted: !rescue, reason: null }] };
    else if (name === "apu_notepad_grounding_rescue") result = { verdicts: [{ index: 0, accepted: true, reasonCategory: "accept_shared_subject", reason: "Synthetic rescue justification." }] };
    else if (name === "apu_quest_controller") result = controllerResult;
    else throw new Error("Unexpected provider call");
    return Response.json({ ...response, output_text: JSON.stringify(result) });
  });
  const response = await fixtureHandlers[operation](new Request(`http://unit.invalid/api/${operation}`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-fixture-role": role },
    body: JSON.stringify({ message: currentMessage, notebook: currentNotebook, phase: "intake", turnId: "fixture-turn", previousResponseId, ...context }),
  }));
  assert.equal(response.status, expectedStatus);
  if (expectedStatus !== 200) return { payloads, result: await response.json() };
  const result = operation === "extract" ? await response.json() : (await response.text()).trim().split("\n").map(line => JSON.parse(line));
  return { payloads, result };
}

test("extraction, primary and rescue preserve complete baseline requests and usage with a stable developer-only boundary", async t => {
  const { payloads, result } = await run(t, "extract");
  assertBaselineRequests(payloads, extractionNames);
  assert.equal(result.extraction.candidates.length, 2);
  for (const payload of payloads) {
    const context = JSON.parse(effective(payload).input);
    assert.equal(context.newUserMessage, message);
    assert.deepEqual(context.currentNotebook, notebook);
  }
  assert.equal(JSON.parse(effective(payloads[2]).input).candidates.length, 1);
  for (const record of result.model_usage_records) {
    assert.equal(record.usage.cached_input_tokens, 1024);
    assert.equal(record.usage.cache_write_tokens, 128);
    assert.equal(record.usage.provider_total_tokens, 1520);
    assert.equal(record.pricing_snapshot.status, "priced");
  }
});

test("changing Notebook/user content leaves all cached instruction blocks unchanged and rescue eligibility intact", async t => {
  const first = await run(t, "extract");
  const changedNotebook = [...notebook, { id: "setting", category: "context", text: "Different setting. 🧪", trust: "confirmed" }];
  const changedMessage = `${message}\nDifferent variable suffix. 🧪`;
  const second = await run(t, "extract", { currentMessage: changedMessage, currentNotebook: changedNotebook, role: "user", rescue: false });
  assert.equal(second.payloads.length, 2, "no rescue or cache-prewarming call when primary accepts both");
  for (const [index, payload] of second.payloads.entries()) {
    assertCached(payload);
    assert.equal(effective(payload).instructions, effective(first.payloads[index]).instructions);
    const context = JSON.parse(effective(payload).input);
    assert.equal(context.newUserMessage, changedMessage);
    assert.deepEqual(context.currentNotebook, changedNotebook);
    assert.ok(!effective(payload).instructions.includes("Different variable suffix"));
    assert.ok(!effective(payload).instructions.includes("Different setting"));
  }
  assert.equal(second.result.telemetry, undefined, "normal-user telemetry gating remains unchanged");
});

test("Controller changing context stays entirely in the user block and preserves Main context ordering", async t => {
  const first = await run(t, "chat");
  const context = {
    askedRefinementTargets: ["context"], pendingSide: { target: "context", question: "In which setting?" },
    functionalMapping: { profiles: "P1", blocks: "A", zones: "1" },
    selectedHypothesisId: "synthetic-hypothesis", activeNeedId: "synthetic-need",
    analysisContext: { hypothesis: { title: "Variable hypothesis", summary: "Keep this context.", limitations: ["One limit"], unknowns: ["One unknown"] }, need: { title: "Variable need", direction: "One direction", limitations: ["Need limit"] }, analysisMode: "working", mainUncertainty: "Variable uncertainty" },
  };
  const second = await run(t, "chat", { currentMessage: `${message}\nNew context.`, context, role: "user" });
  assert.equal(second.payloads.length, 2);
  const [controller, main] = second.payloads;
  assertCached(controller);
  assert.equal(effective(controller).instructions, effective(first.payloads[0]).instructions);
  assert.deepEqual(JSON.parse(effective(controller).input), {
    phase: "intake", currentMessage: `${message}\nNew context.`, currentNotebook: notebook,
    askedRefinementTargets: context.askedRefinementTargets, pendingSide: context.pendingSide,
    applyIntakePolicy: true, lastFunctionalMapping: context.functionalMapping,
  });
  const headingOrder = ["TECHNICKÝ RUNTIME WRAPPER", "TECHNICKÉ NASTAVENÍ FÁZE", "TECHNICKÁ KOMUNIKAČNÍ VRSTVA", "AKTIVNÍ KONTEXT ROZBORU", "TECHNICKÝ KONTEXT APU EXTENSION", "TECHNICKÉ ROZHODNUTÍ QUEST CONTROLLERU", "TECHNICKÝ KONTRAKT DEVELOPMENT DEBUG"];
  const offsets = headingOrder.map(heading => main.instructions.indexOf(heading));
  assert.ok(offsets.every((offset, index) => offset >= 0 && (!index || offset > offsets[index - 1])));
  for (const value of ["Variable hypothesis", "Keep this context.", "One limit", "One unknown", "Variable need", "One direction", "Need limit", "Variable uncertainty"]) assert.ok(main.instructions.includes(value));
  assert.equal(second.result.find(event => event.type === "done").telemetry, undefined);
});

for (const previousResponseId of [undefined, "previous-fixture"]) {
  test(`Controller envelope preserves authority and Main uses independent stateless requests (${previousResponseId ?? "first turn"})`, async t => {
    const { payloads, result } = await run(t, "chat", { previousResponseId });
    assertBaselineRequests(payloads, ["apu_quest_controller", "main_stateless"]);
    const [controller, main] = payloads;
    assert.equal(main.input, message);
    assert.equal(typeof main.instructions, "string");
    assert.ok(main.instructions.includes(JSON.stringify(notebook)));
    assert.ok(main.instructions.includes("In which setting?"));
    assert.equal(Object.hasOwn(main, "prompt_cache_options"), false);
    assert.equal(Object.hasOwn(main, "previous_response_id"), false);
    assert.equal(main.store, false);
    const complete = result.find(event => event.type === "done");
    assert.ok(complete);
    assert.equal(complete.controllerFallback, false);
    assert.equal(complete.model_usage_records.length, 2);
  });
}

test("simulated Windows CRLF Markdown preserves every original request baseline", async t => {
  const fixtureHandlers = await buildHandlers(true);
  const extraction = await run(t, "extract", { fixtureHandlers });
  assertBaselineRequests(extraction.payloads, extractionNames);
  for (const previousResponseId of [undefined, "previous-fixture"]) {
    const chat = await run(t, "chat", { fixtureHandlers, previousResponseId });
    assertBaselineRequests(chat.payloads, ["apu_quest_controller", "main_stateless"]);
  }
});

test("fixture EOL repair still rejects non-EOL instruction, input, schema, settings and call-count mutations", async t => {
  const { payloads } = await run(t, "extract");
  assertBaselineRequests(payloads, extractionNames);
  for (const [name, mutate] of [
    ["instruction character", calls => { calls[0].input[0].content[0].text += "!"; }],
    ["user character", calls => {
      const context = JSON.parse(calls[0].input[1].content[0].text);
      context.newUserMessage += "!";
      calls[0].input[1].content[0].text = JSON.stringify(context);
    }],
    ["user line endings", calls => { calls[0].input[1].content[0].text = JSON.stringify({ currentNotebook: notebook, newUserMessage: message.replace(/\n/g, "\r\n") }); }],
    ["Notebook context", calls => {
      const context = JSON.parse(calls[0].input[1].content[0].text);
      context.currentNotebook[0].text += "!";
      calls[0].input[1].content[0].text = JSON.stringify(context);
    }],
    ["schema", calls => { calls[0].text.format.schema.additionalProperties = true; }],
    ["model", calls => { calls[0].model = "changed-model"; }],
    ["reasoning", calls => { calls[0].reasoning.effort = "medium"; }],
    ["service tier", calls => { calls[0].service_tier = "priority"; }],
    ["output limit", calls => { calls[0].max_output_tokens += 1; }],
    ["store", calls => { calls[0].store = true; }],
    ["extra provider call", calls => { calls.push(structuredClone(calls[0])); }],
    ["missing provider call", calls => { calls.pop(); }],
  ]) {
    const changed = structuredClone(payloads);
    mutate(changed);
    assert.throws(() => assertBaselineRequests(changed, extractionNames), assert.AssertionError, name);
  }
});

test("short replies use Notebook and last questions without stored response/transcript replay", async t => {
  const dialogContext = { lastQuestions: ["Při které činnosti?"] };
  const { payloads, result } = await run(t, "chat", { currentMessage: "Při společné práci.", previousResponseId: "obsolete-response", context: {
    dialogContext, messages: [{ role: "user", content: "OBSOLETE_TRANSCRIPT_SENTINEL" }],
  } });
  const [controller, main] = payloads;
  assert.deepEqual(JSON.parse(effective(controller).input).dialogContext, dialogContext);
  assert.equal(effective(controller).instructions.includes("Při které činnosti?"), false, "questions stay outside the cached controller instruction block");
  assert.ok(main.instructions.includes(JSON.stringify(notebook)));
  assert.ok(main.instructions.includes(JSON.stringify({ dialogContext })));
  assert.equal(main.input, "Při společné práci.");
  for (const payload of payloads) {
    assert.equal(payload.store, false);
    assert.equal(Object.hasOwn(payload, "previous_response_id"), false);
    assert.doesNotMatch(JSON.stringify(payload), /OBSOLETE_TRANSCRIPT_SENTINEL|obsolete-response/);
  }
  const done = result.find(event => event.type === "done");
  assert.equal(done.telemetry.context_sizes.previous_response_context, 0);
  assert.equal(done.model_usage_records.length, 2);
});

test("extraction and both grounding stages receive the same bounded questions with raw source unchanged", async t => {
  const dialogContext = { lastQuestions: ["Co pozorujete?"] };
  const { payloads, result } = await run(t, "extract", { context: { dialogContext } });
  assert.equal(payloads.length, 3);
  for (const payload of payloads) {
    assertCached(payload);
    const input = JSON.parse(effective(payload).input);
    assert.deepEqual(input.dialogContext, dialogContext);
    assert.equal(input.newUserMessage, message);
    assert.deepEqual(input.currentNotebook, notebook);
    assert.equal(payload.store, false);
    assert.equal(effective(payload).instructions.includes("Co pozorujete?"), false);
  }
  for (const candidate of result.extraction.candidates) {
    assert.ok(message.includes(candidate.sourceQuote));
    assert.equal(message.slice(candidate.start, candidate.end), candidate.sourceQuote);
  }
});

test("an assistant question cannot supply an absent source quote for a Notebook fact", async t => {
  const question = "Při společné práci odchází?";
  const { payloads, result } = await run(t, "extract", { currentMessage: "ano", context: { dialogContext: { lastQuestions: [question] } }, fixtureCandidates: [
    { ...candidates[0], sourceQuote: question, notebookText: "Při společné práci odchází." },
  ] });
  assert.equal(result.extraction.candidates.length, 0);
  assert.equal(payloads.length, 1, "an ungrounded question quote is discarded before grounding");
});

for (const operation of ["chat", "extract"]) test(`${operation} rejects malformed dialog context before provider calls`, async t => {
  const { payloads } = await run(t, operation, { expectedStatus: 400, context: { dialogContext: { lastQuestions: ["q".repeat(601)] } } });
  assert.equal(payloads.length, 0);
});
