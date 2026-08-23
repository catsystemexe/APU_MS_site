import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { authorizeDevLogIdentity, getDevLogState, patchDevLogState, readDevLogOverrides } from "../app/dev-log-state.ts";
import { mergeDevLogState } from "../app/shared-feedback.ts";

const source = { id: "DL-1", type: "bug", title: "Title", status: "new", createdAt: "2026-08-22T00:00:00Z", source: "repository", summary: "Summary", details: [], note: "" };
const developer = { email: "developer@example.com", role: "developer" };
const override = { status: "in_progress", note: "keep me", updatedAt: "2026-08-23T00:00:00Z", updatedBy: "previous@example.com" };

function namespace(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { values, async get(key) { return values.get(key) ?? null; }, async put(key, value) { values.set(key, value); } };
}
function patch(body) { return new Request("https://example.test/api/devlog-state", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }

test("source items merge valid KV overrides and fall back without one", () => {
  assert.equal(mergeDevLogState(source, override).status, "in_progress");
  assert.equal(mergeDevLogState(source, override).note, "keep me");
  assert.deepEqual(mergeDevLogState(source, null), source);
});

test("malformed and invalid-status KV records are ignored independently", async () => {
  const kv = namespace({ "devlog:DL-1": "{bad" });
  assert.deepEqual(await readDevLogOverrides(kv, [source]), {});
  kv.values.set("devlog:DL-1", JSON.stringify({ ...override, status: "invalid" }));
  assert.deepEqual(await readDevLogOverrides(kv, [source]), {});
});

test("developer GET reads current source IDs only", async () => {
  const kv = namespace({ "devlog:DL-1": JSON.stringify(override), "devlog:orphan": JSON.stringify(override) });
  const response = await getDevLogState(kv, [source]);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), { version: 1, items: { "DL-1": override } });
});

test("PATCH persists identity, timestamp, status and existing note", async () => {
  const kv = namespace({ "devlog:DL-1": JSON.stringify(override) });
  const response = await patchDevLogState(patch({ id: "DL-1", status: "done" }), developer, kv, [source]);
  const stored = await response.json();
  assert.equal(response.status, 200);
  assert.equal(stored.status, "done");
  assert.equal(stored.note, "keep me");
  assert.equal(stored.updatedBy, developer.email);
  assert.equal(Number.isNaN(Date.parse(stored.updatedAt)), false);
  assert.deepEqual(JSON.parse(kv.values.get("devlog:DL-1")), stored);
});

test("PATCH rejects unknown IDs and invalid transitions", async () => {
  assert.equal((await patchDevLogState(patch({ id: "unknown", status: "done" }), developer, namespace(), [source])).status, 404);
  const doneSource = { ...source, status: "done" };
  assert.equal((await patchDevLogState(patch({ id: "DL-1", status: "new" }), developer, namespace(), [doneSource])).status, 409);
});

test("GET and PATCH return 503 without a binding", async () => {
  assert.equal((await getDevLogState(undefined, [source])).status, 503);
  assert.equal((await patchDevLogState(patch({ id: "DL-1", status: "done" }), developer, undefined, [source])).status, 503);
});

test("route authenticates both methods and rejects testers", async () => {
  assert.equal(authorizeDevLogIdentity(null).status, 401);
  assert.equal(authorizeDevLogIdentity({ email: "tester@example.com", role: "tester" }).status, 403);
  assert.deepEqual(authorizeDevLogIdentity(developer), developer);
  const route = await readFile(new URL("../app/api/devlog-state/route.ts", import.meta.url), "utf8");
  assert.equal((route.match(/getAccessIdentity\(request\.headers\)/g) ?? []).length, 2);
  assert.equal((route.match(/authorizeDevLogIdentity/g) ?? []).length, 3);
});
