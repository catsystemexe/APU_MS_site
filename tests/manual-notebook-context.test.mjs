import { acceptedPilotRulesBindingsPlugin } from "./pilot-rules-fixture.mjs";
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { build } from "esbuild";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CATEGORY_IDS, EMPTY_NOTEPAD, F2_PATHS, compactNotepad, getF1ToF2NeedContract, mapPedagogicalNeed } from "../app/notepad-model.ts";
import { fallbackQuestController, requiredIntakeTarget } from "../app/dialog-action.ts";
import { advanceAcceptedF2Source, createCurrentRozborState } from "../app/f2-build-model.ts";
import { createF3State, markF3SourceStale } from "../app/f3-finalization-model.ts";

function manualNotebook(path = "POCHOPIT") {
  const state = structuredClone(EMPTY_NOTEPAD);
  for (const category of CATEGORY_IDS) state[category] = [{
    id: `manual-${category}`, text: `Manual ${category}.`, origin: "manual",
    ...(category === "goals" ? { needMapping: { f2Path: path, f3Target: null } } : {}),
  }];
  return state;
}
const sourced = (id, messageId) => ({ id, text: `${id}.`, origin: "extracted", source: { messageId, quote: id, start: 0, end: id.length } });

test("empty/default compaction preserves nonempty manual entries in all five categories without mutation", () => {
  assert.deepEqual(compactNotepad(EMPTY_NOTEPAD), []);
  const state = manualNotebook();
  state.context.push({ id: "blank", text: " \n\t ", origin: "manual" });
  state.manifestations[0].text = "  Manual manifestations.\n ";
  const before = structuredClone(state);
  const expected = CATEGORY_IDS.map(category => ({ category, id: `manual-${category}`, text: `Manual ${category}.`, trust: "confirmed",
    ...(category === "goals" ? { needMapping: { f2Path: "POCHOPIT", f3Target: null } } : {}) }));
  assert.deepEqual(compactNotepad(state), expected);
  assert.deepEqual(compactNotepad(state, {}), expected);
  assert.deepEqual(compactNotepad(state, { excludeSourceMessageId: undefined }), expected);
  assert.deepEqual(state, before);
});

test("explicit exclusion removes only exact matching sourced records, retaining manual/other sources and order", () => {
  const state = manualNotebook();
  for (const category of CATEGORY_IDS) state[category].push(sourced(`${category}-current`, "current"), sourced(`${category}-older`, "older"));
  const full = compactNotepad(state);
  assert.equal(full.length, 15);
  assert.deepEqual(compactNotepad(state, { excludeSourceMessageId: "current" }), full.filter(item => !item.id.endsWith("-current")));
  assert.deepEqual(compactNotepad(state, { excludeSourceMessageId: "missing" }), full);
  // An explicitly supplied empty ID also uses exact identity, not a truthiness gate.
  state.context.push(sourced("empty-source", ""));
  assert.equal(compactNotepad(state, { excludeSourceMessageId: "" }).some(item => item.id === "empty-source"), false);
});

test("a sourced record edited into a source-less manual record retains its ID and reaches compact requests", async () => {
  const state = manualNotebook();
  state.goals[0] = sourced("edited-need", "old-message");
  // The existing Notebook editor replaces the record with precisely these fields.
  const value = "Připrav mi pracovní karty.";
  state.goals[0] = { id: state.goals[0].id, text: value, origin: "manual", needMapping: mapPedagogicalNeed(value) };
  assert.deepEqual(compactNotepad(state).find(item => item.id === "edited-need"), {
    category: "goals", id: "edited-need", text: value, trust: "confirmed", needMapping: mapPedagogicalNeed(value),
  });
  assert.equal(compactNotepad(state, { excludeSourceMessageId: "old-message" }).some(item => item.id === "edited-need"), true);
  const editor = await readFile(new URL("../app/notepad.tsx", import.meta.url), "utf8");
  assert.match(editor, /next\[index\] = \{ id: next\[index\]\.id, text: value, origin: "manual",/);
});

test("manual legacy needs retain existing mapping derivation", () => {
  const state = manualNotebook();
  delete state.goals[0].needMapping;
  state.goals[0].text = "Potřebuji týdenní pozorovací tabulku.";
  assert.deepEqual(compactNotepad(state).find(item => item.category === "goals").needMapping, mapPedagogicalNeed(state.goals[0].text));
});

// Exercise the actual route validators/envelopes with mocked authentication/provider boundaries.
const root = fileURLToPath(new URL("..", import.meta.url));
const artifacts = await mkdtemp(join(tmpdir(), "apu-manual-notebook-"));
after(() => rm(artifacts, { recursive: true, force: true }));
const handlers = {};
for (const operation of ["extract", "chat", "analysis"]) {
  const outfile = join(artifacts, `${operation}.mjs`);
  await build({ entryPoints: [join(root, `app/api/${operation}/route.ts`)], outfile, bundle: true, platform: "node", format: "esm", logLevel: "silent",
    plugins: [acceptedPilotRulesBindingsPlugin, { name: "mock-boundaries", setup(plugin) {
      plugin.onResolve({ filter: /access-auth$/ }, () => ({ path: "auth", namespace: "unit" }));
      plugin.onLoad({ filter: /.*/, namespace: "unit" }, () => ({ contents: "export async function getAccessIdentity() { return {email:'fixture@example.invalid',role:'user'}; }", loader: "js" }));
      plugin.onResolve({ filter: /\.md\?raw$/ }, args => ({ path: join(dirname(args.importer), args.path.replace(/\?raw$/, "")), namespace: "raw" }));
      plugin.onLoad({ filter: /.*/, namespace: "raw" }, async args => ({ contents: `export default ${JSON.stringify((await readFile(args.path, "utf8")).replace(/\r\n/g, "\n"))}`, loader: "js" }));
    } }],
  });
  handlers[operation] = (await import(pathToFileURL(outfile).href)).POST;
}
function mockProvider(t, resultFor) {
  for (const key of ["OPENAI_API_KEY", "APU_VECTOR_STORE_ID"]) {
    const before = process.env[key]; process.env[key] = "synthetic-unit-only";
    t.after(() => { if (before === undefined) delete process.env[key]; else process.env[key] = before; });
  }
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    const payload = JSON.parse(init.body); calls.push(payload);
    const response = { id: `fixture-${calls.length}`, status: "completed", model: payload.model, usage: { input_tokens: 100, output_tokens: 10, total_tokens: 110 } };
    if (payload.stream) return new Response([
      { type: "response.output_text.delta", delta: "Rozumím." },
      { type: "response.completed", response: { ...response, output: [{ type: "message" }] } },
    ].map(event => `data: ${JSON.stringify(event)}\n\n`).join(""), { headers: { "Content-Type": "text/event-stream" } });
    return Response.json({ ...response, output_text: JSON.stringify(resultFor(payload)) });
  });
  return calls;
}
const post = (operation, body) => handlers[operation](new Request(`http://unit.invalid/api/${operation}`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
}));
const cachedInput = payload => JSON.parse(payload.input[1].content[0].text);

test("manual facts/needs reach extraction and Controller while Main excludes only current-turn sourced information", async t => {
  const state = manualNotebook();
  state.manifestations.push(sourced("current-fact", "current-turn"), sourced("older-fact", "older-turn"));
  const full = compactNotepad(state);
  const calls = mockProvider(t, payload => {
    if (payload.text.format.name === "apu_notepad_extraction") return {
      situationRelation: "same", situationReason: null, categoryReview: Object.fromEntries(CATEGORY_IDS.map(category => [category, "none"])), candidates: [],
    };
    assert.equal(payload.text.format.name, "apu_quest_controller");
    return { ...fallbackQuestController(full, "intake"), chat_navigation_event: "none" };
  });
  const extraction = await post("extract", { message: "New message.", notebook: full });
  assert.equal(extraction.status, 200);
  await extraction.json();
  assert.deepEqual(cachedInput(calls[0]).currentNotebook, full);
  assert.equal(calls.length, 1, "no grounding calls for zero candidates");
  const mainNotebook = compactNotepad(state, { excludeSourceMessageId: "current-turn" });
  const chat = await post("chat", { message: "New message.", phase: "intake", notebook: mainNotebook, intakeNotebook: full });
  assert.equal(chat.status, 200);
  const events = (await chat.text()).trim().split("\n").map(line => JSON.parse(line));
  assert.ok(events.some(event => event.type === "done"));
  assert.equal(calls.length, 3, "one extraction, one Controller, one Main; no extra calls");
  assert.deepEqual(cachedInput(calls[1]).currentNotebook, full);
  assert.equal(requiredIntakeTarget(full), null);
  assert.ok(calls[2].instructions.includes(JSON.stringify(mainNotebook)));
  assert.equal(calls[2].instructions.includes("current-fact"), false);
  assert.ok(calls[2].instructions.includes("older-fact"));
  assert.equal(calls[2].input, "New message.");
  const client = await readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8");
  assert.match(client, /message: rawText,\s*notebook: compactNotepad\(notepad\)/);
  assert.match(client, /notebook: compactNotepad\(notepadForChat, \{ excludeSourceMessageId: sourceMessageId \}\),\s*intakeNotebook: compactNotepad\(notepadForChat\)/);
});

for (const path of F2_PATHS) test(`manual need passes actual analysis canonical matching and immutable source ownership: ${path}`, async t => {
  const state = manualNotebook(path);
  const notebook = compactNotepad(state);
  const canonicalNeed = getF1ToF2NeedContract(state, "manual-goals");
  const calls = mockProvider(t, () => ({
    hypotheses: [{ id: "h1", rank: 1, title: "Working hypothesis", summary: "Possible explanation.", relevantNeeds: [canonicalNeed.needId], question: null }],
    needs: [{ needId: canonicalNeed.needId, title: "Manual need", relevantHypotheses: ["h1"], direction: "Examine the situation.", question: null }],
    mainUncertainty: "Still uncertain.", chatUpdate: { kind: "entry", summary: "Working analysis.", nextPrompt: null }, transitionReady: false,
  }));
  const response = await post("analysis", { notebook, canonicalNeed });
  assert.equal(response.status, 200);
  const { analysis } = await response.json();
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(calls[0].input).notebook, notebook);
  assert.deepEqual(JSON.parse(calls[0].input).canonicalNeed, canonicalNeed);
  assert.equal(analysis.needs[0].sourceText, canonicalNeed.needText);
  const context = { mainUncertainty: analysis.mainUncertainty, summary: analysis.chatUpdate.summary, needAnalysis: analysis.needs[0], notebookContext: notebook.map(({ category, text }) => ({ category, text })) };
  const source = advanceAcceptedF2Source(null, canonicalNeed, analysis.hypotheses, path, createCurrentRozborState()[path], context);
  assert.deepEqual(source.analysisContext.notebookContext, context.notebookContext);
  assert.ok(Object.isFrozen(source.analysisContext.notebookContext));
  const f3 = createF3State(source);
  state.context[0].text = "Edited manual context.";
  const updatedContext = { ...context, notebookContext: compactNotepad(state).map(({ category, text }) => ({ category, text })) };
  const updated = advanceAcceptedF2Source(source, canonicalNeed, analysis.hypotheses, path, createCurrentRozborState()[path], updatedContext);
  assert.notEqual(updated.sourceFingerprint, source.sourceFingerprint);
  assert.equal(updated.sourceRevision, source.sourceRevision + 1);
  assert.deepEqual(source.analysisContext.notebookContext, context.notebookContext);
  assert.equal(markF3SourceStale(f3, updated.sourceFingerprint).sourceStatus, "stale");
  // Keep the existing canonical guard strict: a missing or mismatched manual need is rejected before a call.
  for (const invalid of [{ ...canonicalNeed, needText: "Different need." }, { ...canonicalNeed, initialF2Path: F2_PATHS.find(value => value !== path) }]) {
    assert.equal((await post("analysis", { notebook, canonicalNeed: invalid })).status, 400);
  }
  assert.equal((await post("analysis", { notebook: notebook.filter(item => item.category !== "goals"), canonicalNeed })).status, 400);
  assert.equal(calls.length, 1);
});
