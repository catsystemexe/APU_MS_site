import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseSharedFeedback, SHARED_FEEDBACK_STATUS_LABELS, sortSharedFeedback } from "../app/shared-feedback.ts";

const item = (overrides = {}) => ({ id: "sf-1", type: "bug", title: "Title", status: "new", createdAt: "2026-08-22T00:00:00Z", source: "APU Shared", summary: "Summary", details: [{ label: "Problem", text: "Text" }], note: "", ...overrides });

test("parses the valid version 1 Shared Feedback contract", () => {
  const result = parseSharedFeedback({ version: 1, items: [item()] });
  assert.equal(result.error, null);
  assert.equal(result.data?.items[0].id, "sf-1");
});

test("invalid Shared Feedback is rejected without throwing", () => {
  assert.doesNotThrow(() => parseSharedFeedback({ version: 1, items: [item({ status: "unknown" })] }));
  assert.equal(parseSharedFeedback({ version: 1, items: [item({ details: null })] }).data, null);
  assert.match(parseSharedFeedback({ version: 2, items: [] }).error ?? "", /formát/);
});

test("items are ordered by status and then newest date", () => {
  const items = [item({ id: "done", status: "done" }), item({ id: "older", createdAt: "2026-08-20T00:00:00Z" }), item({ id: "discuss", status: "discuss" }), item({ id: "newer", createdAt: "2026-08-22T01:00:00Z" }), item({ id: "rejected", status: "rejected" })];
  assert.deepEqual(sortSharedFeedback(items).map(({ id }) => id), ["newer", "older", "discuss", "done", "rejected"]);
});

test("status labels use the specified Czech mapping", () => {
  assert.deepEqual(SHARED_FEEDBACK_STATUS_LABELS, { new: "NOVÉ", in_progress: "ŘEŠÍME", discuss: "PROBRAT", done: "HOTOVO", rejected: "ZAMÍTNUTO" });
});

test("DEV LOG trigger and payload remain developer-only", async () => {
  const [page, client] = await Promise.all([readFile(new URL("../app/page.tsx", import.meta.url), "utf8"), readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8")]);
  assert.match(page, /sharedFeedback=\{isDeveloper \? loadSharedFeedback\(\) : null\}/);
  assert.match(client, /\{isDeveloper && <DeveloperHeaderControls/);
  assert.match(client, /isDeveloper && isDevLogOpen && sharedFeedback/);
  assert.match(client, /aria-expanded=\{open\}/);
  assert.match(client, /aria-controls="dev-log-panel"/);
});

test("accordion items default closed and toggle independently", async () => {
  const panel = await readFile(new URL("../app/dev-log-panel.tsx", import.meta.url), "utf8");
  assert.match(panel, /useState\(false\)/);
  assert.match(panel, /setOpen\(\(value\) => !value\)/);
  assert.match(panel, /aria-expanded=\{open\}/);
  assert.match(panel, /\{open && <div className="dev-log-item-content"/);
  assert.match(panel, /item\.details\.map/);
});
