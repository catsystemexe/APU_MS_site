import assert from "node:assert/strict";
import test from "node:test";
import { collectChatDialogState, validateChatDialogContext } from "../app/chat-dialog-context.ts";
import { createProjectResetState } from "../app/project-session.ts";
import { createNotebookStorage } from "../app/notebook-storage.ts";
import { EMPTY_NOTEPAD, compactNotepad } from "../app/notepad-model.ts";

const side = { type: "SIDE", target: "context", question: "Při které činnosti?", required: false, options: [] };
const assistant = (id, actions = [side], extra = {}) => ({ id, role: "assistant", content: "Assistant prose must stay local.", phaseLabel: "[FÁZE 1]", dialogActions: actions, ...extra });

test("only bounded structured questions and enum targets survive; transcript prose is omitted", () => {
  const history = [{ id: "private-user", role: "user", content: "Older user prose must stay local." }, assistant("a1"), assistant("a2", [
    { ...side, type: "MAIN", target: "teacher_need", question: "Co potřebujete?" },
    { ...side, type: "NAV", target: "phase", question: "Přejít dál" },
  ])];
  const state = collectChatDialogState(history, "intake");
  assert.deepEqual(state.dialogContext, { lastQuestions: ["Co potřebujete?"] });
  assert.deepEqual(state.askedRefinementTargets, ["context"]);
  assert.equal(state.pendingSide, undefined, "no revival of the old SIDE");
  assert.doesNotMatch(JSON.stringify(state), /prose|private-user|a1|a2|Přejít/);
  const long = collectChatDialogState([assistant("a", [{ ...side, question: "q".repeat(900) }])], "intake");
  assert.equal(long.dialogContext.lastQuestions[0].length, 600);
});

test("review/resume selects the questions before the reviewed message, not newer dialog", () => {
  const history = [assistant("a1"), { id: "reviewed", role: "user", content: "Při společné práci." }, assistant("a2", [{ ...side, target: "helps", question: "Co pomohlo?" }])];
  const before = structuredClone(history);
  assert.deepEqual(collectChatDialogState(history, "intake", "reviewed").pendingSide, { target: "context", question: "Při které činnosti?" });
  assert.deepEqual(collectChatDialogState(history, "intake").pendingSide, { target: "helps", question: "Co pomohlo?" });
  assert.deepEqual(history, before);
});

test("new response, phase transition and reset clear obsolete question context", () => {
  const history = [assistant("old"), assistant("new", [])];
  assert.equal(collectChatDialogState(history, "intake").dialogContext, undefined);
  assert.equal(collectChatDialogState([assistant("old")], "development").dialogContext, undefined);
  const reset = createProjectResetState({ id: "welcome", role: "assistant", content: "Welcome" });
  assert.deepEqual(collectChatDialogState(reset.messages, reset.phase), { answersNeedQuestion: false, dialogContext: undefined, pendingSide: undefined, askedRefinementTargets: [] });
});

test("context validation rejects oversized/malformed payloads and strips unknown fields", () => {
  assert.equal(validateChatDialogContext(undefined), undefined);
  assert.equal(validateChatDialogContext({ lastQuestions: [] }), undefined);
  for (const value of [null, [], "text", {}, { lastQuestions: [1] }, { lastQuestions: [" "] }, { lastQuestions: ["q".repeat(601)] }, { lastQuestions: ["a", "b", "c"] }]) assert.equal(validateChatDialogContext(value), null);
  assert.deepEqual(validateChatDialogContext({ lastQuestions: [" q "], transcript: "discard" }), { lastQuestions: ["q"] });
});

test("Notebook persistence retains self-contained provenance without a chat transcript", () => {
  const storage = () => {
    const values = new Map();
    return { get length() { return values.size; }, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), key: index => [...values.keys()][index] ?? null };
  };
  const stores = { local: storage(), session: storage() };
  const owner = { email: "synthetic@example.invalid", isDeveloper: false };
  const notebook = structuredClone(EMPTY_NOTEPAD);
  notebook.context.push({ id: "context", text: "Při společné práci.", origin: "extracted", source: { messageId: "unpersisted-message", quote: "Při společné práci.", start: 0, end: 18 } });
  createNotebookStorage(owner, stores).write(notebook);
  const restored = createNotebookStorage(owner, stores).read();
  assert.deepEqual(restored, notebook);
  assert.equal(restored.context[0].source.quote, "Při společné práci.");
  assert.equal(compactNotepad(restored)[0].text, "Při společné práci.");
  for (let i = 0; i < stores.session.length; i++) assert.doesNotMatch(stores.session.getItem(stores.session.key(i)), /"messages"|"dialogContext"|"responseId"/);
});
