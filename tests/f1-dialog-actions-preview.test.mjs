import { acceptedPilotRulesBindingsPlugin } from "./pilot-rules-fixture.mjs";
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { build } from "esbuild";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cleanDialogActionQuestion, fallbackQuestController } from "../app/dialog-action.ts";
import { enforceStructuredF1Prose } from "../app/f1-response-contract.ts";

// Actual route, with unit-only authentication and provider boundaries. No API calls.
const root = fileURLToPath(new URL("..", import.meta.url));
const artifacts = await mkdtemp(join(tmpdir(), "apu-f1-preview-"));
after(() => rm(artifacts, { recursive: true, force: true }));
const outfile = join(artifacts, "chat.mjs");
await build({
  entryPoints: [join(root, "app/api/chat/route.ts")], outfile,
  bundle: true, platform: "node", format: "esm", logLevel: "silent",
  plugins: [acceptedPilotRulesBindingsPlugin, { name: "synthetic-boundaries", setup(plugin) {
    plugin.onResolve({ filter: /access-auth$/ }, () => ({ path: "auth", namespace: "unit" }));
    plugin.onLoad({ filter: /.*/, namespace: "unit" }, () => ({ contents: `export async function getAccessIdentity(headers) { return {email:'fixture@example.invalid',role:headers.get('x-fixture-role')}; }`, loader: "js" }));
    plugin.onResolve({ filter: /\.md\?raw$/ }, args => ({ path: join(dirname(args.importer), args.path.replace(/\?raw$/, "")), namespace: "raw" }));
    plugin.onLoad({ filter: /.*/, namespace: "raw" }, async args => ({ contents: `export default ${JSON.stringify(await readFile(args.path, "utf8"))}`, loader: "js" }));
  } }],
});
const { POST } = await import(pathToFileURL(outfile).href);
const notebook = [
  { id: "fact", category: "manifestations", text: "Synthetic observation.", trust: "confirmed" },
  { id: "need", category: "goals", text: "Understand the situation.", trust: "confirmed" },
];
const canonical = fallbackQuestController(notebook, "intake");
const actions = canonical.dialog_actions.map(cleanDialogActionQuestion);
const usage = { input_tokens: 1500, input_tokens_details: { cached_tokens: 1024, cache_write_tokens: 128 }, output_tokens: 20, total_tokens: 1520 };

async function fixture(t, { role = "developer", invalidController = false, emptyActions = false, phase = "intake", bypass = false } = {}) {
  const inputNotebook = bypass ? notebook.slice(0, 1) : notebook;
  const expectedActions = fallbackQuestController(inputNotebook, "intake").dialog_actions.map(cleanDialogActionQuestion);
  for (const key of ["OPENAI_API_KEY", "APU_VECTOR_STORE_ID"]) {
    const before = process.env[key]; process.env[key] = "unit-only";
    t.after(() => { if (before === undefined) delete process.env[key]; else process.env[key] = before; });
  }
  const calls = [];
  let releaseMain, rejectMain, producer, mainCalled;
  const called = new Promise(resolve => { mainCalled = resolve; });
  const mainResponse = new Promise((resolve, reject) => { releaseMain = resolve; rejectMain = reject; });
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    const payload = JSON.parse(init.body); calls.push(payload);
    if (payload.stream) { mainCalled(); return mainResponse; }
    const result = invalidController ? { invalid: true } : emptyActions || phase !== "intake"
      ? { phase, dialog_actions: [], intake_question_policy_applies: false, transition_ready: false, chat_navigation_event: "none" }
      : { ...canonical, chat_navigation_event: "none", dialog_actions: canonical.dialog_actions.map(action => action.type === "SIDE" ? { ...action, question: `💬 ${action.question}` } : action) };
    return Response.json({ status: "completed", id: "fixture-controller", model: payload.model, usage, output_text: JSON.stringify(result) });
  });
  const response = await POST(new Request("http://unit.invalid/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json", "x-fixture-role": role },
    body: JSON.stringify({ message: "Synthetic message.", notebook: inputNotebook, phase, controllerFastPathEligible: bypass }),
  }));
  assert.equal(response.status, 200);
  const reader = response.body.getReader(); const decoder = new TextDecoder();
  const events = [];
  async function next() {
    const { value, done } = await reader.read();
    if (!done) events.push(...decoder.decode(value).trim().split("\n").map(line => JSON.parse(line)));
    return done;
  }
  function startMain() {
    releaseMain(new Response(new ReadableStream({ start(controller) { producer = controller; } }), { headers: { "Content-Type": "text/event-stream" } }));
  }
  function emit(event) { producer.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)); }
  function complete(text = "Rozumím.") {
    emit({ type: "response.output_text.delta", delta: text });
    emit({ type: "response.completed", response: { status: "completed", id: "fixture-main", model: calls.at(-1).model, service_tier: "default", usage } });
    producer.close();
  }
  async function drain() { while (!await next()) {} return events; }
  await called;
  return { calls, events, expectedActions, next, drain, startMain, emit, complete, releaseMain, rejectMain, producer: () => producer };
}

for (const options of [{}, { invalidController: true }, { bypass: true }, { role: "user" }]) {
  test(`resolved F1 actions preview before Main response, then remain identical on done ${JSON.stringify(options)}`, async t => {
    const f = await fixture(t, options);
    await f.next(); await f.next();
    assert.deepEqual(f.events.map(event => event.type), ["status", "dialog_actions_preview"]);
    assert.deepEqual(f.events[1], { type: "dialog_actions_preview", dialogActions: f.expectedActions });
    assert.equal(f.calls.length, options.bypass ? 1 : 2);
    assert.equal(f.calls.at(-1).stream, true);
    f.startMain(); f.complete(); await f.drain();
    const done = f.events.find(event => event.type === "done");
    assert.deepEqual(done.dialogActions, f.events[1].dialogActions);
    assert.equal(done.controllerFallback, options.invalidController === true);
    assert.equal(f.events.filter(event => event.type === "dialog_actions_preview").length, 1);
    if (options.role === "user") assert.equal(done.model_usage_records, undefined);
    else assert.equal(done.model_usage_records.length, f.calls.length);
    assert.equal(Boolean(done.telemetry), options.role !== "user");
    assert.equal(f.calls.length, options.bypass ? 1 : 2, "no extra provider calls");
  });
}

for (const text of [actions[0].question, "Ve které části dne si toho všímáte nejčastěji?"]) {
  test("unsafe structured prose remains buffered until completion and filtered", async t => {
    const f = await fixture(t); await f.next(); await f.next(); f.startMain();
    f.emit({ type: "response.output_text.delta", delta: text });
    let arrived = false;
    const pendingRead = f.next().then(() => { arrived = true; });
    await new Promise(resolve => setTimeout(resolve, 15));
    assert.equal(arrived, false, "no unfiltered interim delta reaches the client");
    f.emit({ type: "response.completed", response: { id: "fixture-main", status: "completed", model: f.calls.at(-1).model, usage } });
    f.producer().close(); await pendingRead; await f.drain();
    assert.deepEqual(f.events.filter(event => event.type === "delta").map(event => event.text), [enforceStructuredF1Prose(text, actions)]);
  });
}

for (const options of [{ emptyActions: true }, { phase: "development" }]) {
  test(`nonstructured delivery has no preview ${JSON.stringify(options)}`, async t => {
    const f = await fixture(t, options); f.startMain(); f.complete("Natural unstructured response."); await f.drain();
    assert.equal(f.events.some(event => event.type === "dialog_actions_preview"), false);
    assert.equal(f.events.find(event => event.type === "delta").text, "Natural unstructured response.");
    assert.equal(f.calls.length, 2);
  });
}

for (const failure of ["provider", "incomplete", "interrupted", "transport"]) {
  test(`Main ${failure} retains error accounting and never completes preview actions`, async t => {
    const f = await fixture(t); await f.next(); await f.next();
    if (failure === "provider") f.releaseMain(Response.json({ status: "failed", model: f.calls.at(-1).model, usage, error: { code: "server_error" } }, { status: 503 }));
    else if (failure === "transport") f.rejectMain(new Error("synthetic transport failure"));
    else {
      f.startMain();
      if (failure === "interrupted") f.producer().error(new Error("synthetic interruption"));
      else { f.emit({ type: "response.incomplete", response: { id: "fixture-main", status: "incomplete", model: f.calls.at(-1).model, usage, incomplete_details: { reason: "max_output_tokens" } } }); f.producer().close(); }
    }
    await f.drain();
    assert.equal(f.events.some(event => event.type === "done" || event.type === "delta"), false);
    const error = f.events.find(event => event.type === "error"); assert.ok(error);
    assert.equal(error.model_usage_records.length, 2);
    assert.equal(f.calls.length, 2);
  });
}

test("preview lives outside canonical messages/export and shares disabled card behavior", async () => {
  const [client, sessionExport, card] = await Promise.all([
    readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/session-export.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dialog-action-card.tsx", import.meta.url), "utf8"),
  ]);
  const handler = client.slice(client.indexOf('if (event.type === "dialog_actions_preview"'), client.indexOf('if (event.type === "status"'));
  assert.match(handler, /setDialogActionsPreview/);
  assert.doesNotMatch(handler, /setMessages|setNotepad|setPhase|setResponseId|setF[23]/);
  assert.match(client, /action=\{action\} active=\{false\}/);
  assert.match(client, /!message\.dialogActions\?\.length/);
  assert.match(client, /assistantRequestRef\.current === requestScope && projectEpochRef\.current === requestScope\.epoch/);
  assert.doesNotMatch(sessionExport, /dialogActionsPreview|dialog_actions_preview/);
  assert.match(card, /disabled=\{!active\}/);
});
