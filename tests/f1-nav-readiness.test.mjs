import { createPilot } from "../app/telemetry/pilot.ts";
import { fetchWithPilot } from "../app/telemetry/fetch.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { compactNotepad, EMPTY_NOTEPAD } from "../app/notepad-model.ts";
import { resolveDialogEvent, resolveTextDialogEvent } from "../app/dialog-action.ts";

// Execute the actual client shortcut with local state/API spies, not a duplicate implementation.
const client = await readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("apu-client.tsx", client, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let node;
function find(value) {
  if (ts.isFunctionDeclaration(value) && value.name?.text === "requestAssistant") node = value;
  ts.forEachChild(value, find);
}
find(ast);
assert.ok(node);
const functionSource = ts.transpileModule(node.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function notebook(manual = false) {
  const state = structuredClone(EMPTY_NOTEPAD);
  for (const category of ["manifestations", "goals"]) state[category].push({
    id: category, text: category === "goals" ? "Porozumět situaci." : "Při práci odkládá tužku.", origin: manual ? "manual" : "extracted",
    ...(manual ? {} : { source: { messageId: "older", quote: "Fixture", start: 0, end: 7 } }),
  });
  return state;
}
function fixture(state, { epoch = 1, requestId = "request", currentRequest = true } = {}) {
  const scope = { requestId: "request", assistantId: "assistant", epoch: 1 };
  const history = { id: "older", content: "Existing answer.", dialogActions: resolveDialogEvent("continue_to_solution", compactNotepad(notebook()), "intake")?.dialog_actions };
  let messages = [history, { id: "assistant", content: "", role: "assistant" }];
  const calls = [], phases = [];
  const context = {
    pilot: createPilot({ enabled: false }), fetchWithPilot,
    assistantRequestRef: { current: currentRequest ? scope : null }, projectEpochRef: { current: epoch }, phase: "intake",
    compactNotepad, resolveDialogEvent, resolveTextDialogEvent,
    setPhase: value => phases.push(value),
    setMessages: update => { messages = update(messages); },
    clearF1ProcessingStatus: () => calls.push("clear-processing"),
    clearDialogActionsPreview: id => calls.push(["clear-preview", id]),
    refreshStructuredAnalysis: async (...args) => { calls.push(["analysis", ...args]); return { analysis: { hypotheses: [], chatUpdate: { nextPrompt: null } } }; },
    usesDesktopWorkspaceLayout: () => false,
    entryHypotheses: value => value.hypotheses,
    withCompletedLifecycleRecord: (message, lifecycle) => ({ ...message, lifecycle }),
  };
  return { run: (dialogEvent = "continue_to_solution") => runInNewContext(`${functionSource}\nrequestAssistant;`, context)("Přejít do fáze 2", "assistant", state, "", "turn", requestId, dialogEvent),
    calls, phases, messages: () => messages, history };
}

for (const manual of [false, true]) test(`actual shortcut preserves direct valid NAV and ready text entry (${manual ? "manual" : "sourced"})`, async () => {
  for (const event of ["continue_to_solution", undefined]) {
    const f = fixture(notebook(manual));
    // Passing null exercises text navigation without the fixture's default event.
    await f.run(event ?? null);
    assert.deepEqual(f.phases, ["development"]);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0][0], "analysis");
    assert.equal(f.calls[0][5], "F1");
    assert.equal(f.messages()[0], f.history);
    assert.equal(f.messages()[1].lifecycle.operation, "analysis-entry");
  }
});

for (const missing of [["manifestations"], ["goals"], ["manifestations", "goals"]]) test(`actual stale NAV shortcut rejects deleted/empty fields: ${missing.join("+")}`, async () => {
  for (const empty of [false, true]) {
    const state = notebook(true);
    for (const category of missing) { if (empty) state[category][0].text = " \n "; else state[category] = []; }
    const before = structuredClone(state), f = fixture(state);
    await f.run();
    assert.deepEqual(f.phases, []);
    assert.equal(f.calls.some(call => Array.isArray(call) && call[0] === "analysis"), false);
    assert.deepEqual(f.calls, ["clear-processing", ["clear-preview", "request"]]);
    assert.equal(f.messages()[0], f.history, "unrelated history is untouched");
    const fallback = f.messages()[1];
    assert.equal(fallback.content, "");
    assert.equal(fallback.phaseLabel, "[FÁZE 1]");
    assert.deepEqual(fallback.dialogActions, resolveDialogEvent("continue_to_solution", compactNotepad(state), "intake").dialog_actions);
    assert.equal(fallback.dialogActions[0].target, missing.includes("manifestations") ? "observed_phenomenon" : "teacher_need");
    assert.equal(fallback.dialogActions.some(action => action.type === "NAV"), false);
    assert.equal(resolveTextDialogEvent("Přejít do fáze 2", compactNotepad(state), "intake"), null);
    assert.deepEqual(state, before);
  }
});

test("actual shortcut accepts restored required information and ignores obsolete request/project identities", async () => {
  const state = notebook(true);
  state.manifestations = [];
  const f = fixture(state);
  await f.run();
  state.manifestations = notebook(true).manifestations;
  const ready = fixture(state); await ready.run();
  assert.deepEqual(ready.phases, ["development"]);
  for (const options of [{ epoch: 2 }, { requestId: "other-request" }, { currentRequest: false }]) {
    const obsolete = fixture(state, options); await obsolete.run();
    assert.deepEqual(obsolete.phases, []); assert.deepEqual(obsolete.calls, []);
    assert.equal(obsolete.messages()[1].dialogActions, undefined);
  }
});

test("actual client request transmits bounded question state and Notebook, without a response ID or transcript", async () => {
  const { collectChatDialogState } = await import("../app/chat-dialog-context.ts");
  const scope = { requestId: "request", assistantId: "assistant", epoch: 1 };
  const questions = [{ type: "SIDE", target: "context", question: "Při které činnosti?", required: false, options: [] }];
  const history = [
    { id: "older-user", role: "user", content: "DO_NOT_REPLAY_USER_HISTORY" },
    { id: "older-assistant", role: "assistant", content: "DO_NOT_REPLAY_ASSISTANT_PROSE", dialogActions: questions, phaseLabel: "[FÁZE 1]" },
  ];
  for (const resumed of [false, true]) {
    const messages = resumed ? [...history, { id: "current", role: "user", content: "Při společné práci." }, {
      id: "later", role: "assistant", content: "Later response", dialogActions: [{ ...questions[0], question: "Later question?" }],
    }] : history;
    const state = notebook(true);
    let request;
    const context = {
      pilot: createPilot({ enabled: false }), fetchWithPilot,
      assistantRequestRef: { current: scope }, projectEpochRef: { current: 1 }, phase: "intake", messages,
      compactNotepad, resolveDialogEvent, resolveTextDialogEvent, collectChatDialogState,
      selectedModel: "auto", communicationProfile: "fixture", selectedHypothesisId: null, activeNeedId: null,
      analysis: { hypotheses: [], needs: [], mode: "entry", mainUncertainty: null },
      // Stop after observing the real request boundary; no simulated rendering needed.
      fetch: async (url, init) => { request = { url, body: JSON.parse(init.body) }; throw new Error("captured-request"); },
    };
    const run = runInNewContext(`${functionSource}\nrequestAssistant;`, context);
    await assert.rejects(run("Při společné práci.", "assistant", state, "current", "turn", "request"), /captured-request/);
    assert.equal(request.url, "/api/chat");
    assert.deepEqual(request.body.notebook, compactNotepad(state));
    assert.deepEqual(request.body.intakeNotebook, compactNotepad(state));
    assert.deepEqual(request.body.dialogContext, { lastQuestions: ["Při které činnosti?"] });
    assert.equal(request.body.previousResponseId, undefined);
    assert.doesNotMatch(JSON.stringify(request.body), /DO_NOT_REPLAY|Later question|Later response/);
  }
});
