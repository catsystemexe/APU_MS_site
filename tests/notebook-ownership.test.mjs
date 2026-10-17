import assert from "node:assert/strict";
import test from "node:test";
import { createNotebookStorage, notebookStorageKey, notebookEpochKey } from "../app/notebook-storage.ts";
import { EMPTY_NOTEPAD, NOTEPAD_STORAGE_KEY, LEGACY_NOTEPAD_STORAGE_KEY } from "../app/notepad-model.ts";

class MemoryStorage {
  values = new Map();
  get length() { return this.values.size; }
  key(i) { return [...this.values.keys()][i] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}
const identity = (email = "a@example.invalid", isDeveloper = false) => ({ email, isDeveloper });
const data = (text = "Owned observation") => ({ ...structuredClone(EMPTY_NOTEPAD), manifestations: [{ id: "fact", text, origin: "manual" }] });
const browser = () => ({ local: new MemoryStorage(), session: new MemoryStorage() });

test("ordinary Notebook reload restores validated own session data, with no persistent pedagogical data", () => {
  const storage = browser(), owner = identity(), first = createNotebookStorage(owner, storage);
  first.write(data()); first.close();
  assert.deepEqual(createNotebookStorage(owner, storage).read(), data());
  assert.equal(storage.local.length, 0);
  assert.ok(storage.session.getItem(notebookStorageKey(owner)));
  assert.deepEqual(createNotebookStorage(owner, { ...storage, session: new MemoryStorage() }).read(), EMPTY_NOTEPAD);
});
test("same-tab A to B to A cannot revive a prior ordinary session; DEV may restore only its own local copy", () => {
  const storage = browser();
  for (const developer of [false, true]) {
    const a = identity("a@example.invalid", developer), b = identity("b@example.invalid", developer);
    createNotebookStorage(a, storage).write(data("A private"));
    const bs = createNotebookStorage(b, storage); assert.deepEqual(bs.read(), EMPTY_NOTEPAD); bs.write(data("B private"));
    assert.deepEqual(createNotebookStorage(a, storage).read(), developer ? data("A private") : EMPTY_NOTEPAD);
    if (developer) assert.deepEqual(createNotebookStorage(b, storage).read(), data("B private"));
  }
});
test("legacy unowned v1/v2 records remain byte-identical and are never claimed by either role", () => {
  const storage = browser();
  storage.local.setItem(NOTEPAD_STORAGE_KEY, JSON.stringify(data("LEGACY PRIVATE")));
  storage.local.setItem(LEGACY_NOTEPAD_STORAGE_KEY, '{"manifestations":["OLD PRIVATE"]}');
  const before = [...storage.local.values];
  for (const isDeveloper of [false, true]) {
    const store = createNotebookStorage(identity(undefined, isDeveloper), storage);
    assert.deepEqual(store.read(), EMPTY_NOTEPAD); store.write(data()); store.invalidate(true);
  }
  for (const [key, value] of before) assert.equal(storage.local.getItem(key), value);
});
test("logout clears only current owned records, preserves preferences and rejects late writes/old-tab resurrection", () => {
  const storage = browser(), a = identity(), b = identity("b@example.invalid", true);
  storage.local.setItem("apu.theme", "dark");
  createNotebookStorage(b, storage).write(data("B"));
  const first = createNotebookStorage(a, storage), secondTabStorage = { local: storage.local, session: new MemoryStorage() };
  const second = createNotebookStorage(a, secondTabStorage);
  first.write(data("A")); second.write(data("A tab2"));
  const dev = createNotebookStorage({ ...a, isDeveloper: true }, { local: storage.local, session: new MemoryStorage() }); dev.write(data("A dev"));
  first.invalidate(true); first.write(data("Late first")); second.write(data("Late tab2")); dev.write(data("Late dev"));
  assert.equal(storage.local.getItem(notebookStorageKey(a)), null);
  assert.deepEqual(createNotebookStorage(a, secondTabStorage).read(), EMPTY_NOTEPAD);
  assert.deepEqual(createNotebookStorage(b, storage).read(), data("B"));
  assert.equal(storage.local.getItem("apu.theme"), "dark");
});
test("record owner, epoch and NotepadState validation all remain mandatory", () => {
  for (const change of [{ owner: "b@example.invalid" }, { epoch: "revoked" }, { entries: { manifestations: [{ text: "invalid" }] } }]) {
    const storage = browser(), a = identity();
    createNotebookStorage(a, storage).write(data());
    const key = notebookStorageKey(a); storage.session.setItem(key, JSON.stringify({ ...JSON.parse(storage.session.getItem(key)), ...change }));
    assert.deepEqual(createNotebookStorage(a, storage).read(), EMPTY_NOTEPAD);
  }
});
test("reset followed immediately by reload cannot hydrate the previous Notebook", () => {
  const storage = browser(), a = identity(), store = createNotebookStorage(a, storage);
  store.write(data()); store.write(structuredClone(EMPTY_NOTEPAD));
  assert.deepEqual(createNotebookStorage(a, storage).read(), EMPTY_NOTEPAD);
});
test("identity invalidation closes writes and clears session data without deleting another identity or own DEV recovery", () => {
  const storage = browser(), a = identity(undefined, true), store = createNotebookStorage(a, storage);
  store.write(data()); store.invalidate(false); store.write(data("Late"));
  assert.deepEqual(createNotebookStorage(a, storage).read(), data());
  assert.equal(storage.local.getItem(notebookEpochKey(a)), null);
});
