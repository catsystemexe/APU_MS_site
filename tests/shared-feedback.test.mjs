import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canTransitionDevLogStatus, parseSharedFeedback, SHARED_FEEDBACK_STATUS_LABELS, sortSharedFeedback } from "../app/shared-feedback.ts";

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
  assert.match(page, /sharedFeedback=\{isDeveloper \? loadDevLog\(\) : null\}/);
  assert.match(client, /\{isDeveloper && <DeveloperHeaderControls/);
  assert.match(client, /isDeveloper && isDevLogRendered && sharedFeedback/);
  assert.match(client, /aria-expanded=\{open\}/);
  assert.match(client, /aria-controls="dev-log-panel"/);
});

test("DEV LOG loads persistence and rolls an optimistic status back on failure", async () => {
  const panel = await readFile(new URL("../app/dev-log-panel.tsx", import.meta.url), "utf8");
  assert.match(panel, /fetch\("\/api\/devlog-state", \{ cache: "no-store" \}\)/);
  assert.match(panel, /method: "PATCH"/);
  assert.match(panel, /setItems\(\(current\) => current\.map\(\(item\) => item\.id === id \? previous : item\)\)/);
  assert.match(panel, /Původní stav byl obnoven/);
});

test("DEV LOG note UI exposes conditional indicator, leading saved message, and explicit save states", async () => {
  const panel = await readFile(new URL("../app/dev-log-panel.tsx", import.meta.url), "utf8");
  assert.match(panel, /item\.note\.trim\(\) && <MessageCircle/);
  assert.match(panel, /aria-label="Záznam obsahuje poznámku"/);
  assert.ok(panel.indexOf('className="dev-log-note"') < panel.indexOf("item.details.map"));
  assert.match(panel, /<textarea[^>]*maxLength=\{2000\}/);
  assert.match(panel, /disabled=\{noteSaving \|\| noteDraft === item\.note\}/);
  assert.match(panel, /noteSaving \? "Ukládám…" : "Uložit"/);
  assert.match(panel, /catch \{ setNoteError\("Poznámku se nepodařilo uložit\."\); \}/);
  assert.match(panel, /body: JSON\.stringify\(\{ id, note \}\)/);
});

test("DEV LOG uses three typed columns and keeps detail toggles separate from status controls", async () => {
  const panel = await readFile(new URL("../app/dev-log-panel.tsx", import.meta.url), "utf8");
  assert.match(panel, /DEV_LOG_TYPES\.map/);
  assert.match(panel, /visibleItems\.filter\(\(item\) => item\.type === type\)/);
  assert.match(panel, /className="dev-log-statuses"/);
  assert.match(panel, /onClick=\{\(\) => onStatusChange\(status\)\}/);
  assert.match(panel, /setOpen\(\(value\) => !value\)/);
  assert.match(panel, /item\.details\.map/);
  assert.doesNotMatch(panel, /<dt>Typ|<dt>Zdroj|<dt>Stav|<dt>Vytvořeno/);
});

test("DEV LOG permits only the requested status transitions", () => {
  assert.equal(canTransitionDevLogStatus("new", "in_progress"), true);
  assert.equal(canTransitionDevLogStatus("new", "done"), true);
  assert.equal(canTransitionDevLogStatus("in_progress", "new"), true);
  assert.equal(canTransitionDevLogStatus("in_progress", "done"), true);
  assert.equal(canTransitionDevLogStatus("done", "in_progress"), true);
  assert.equal(canTransitionDevLogStatus("done", "new"), false);
  assert.equal(canTransitionDevLogStatus("discuss", "new"), false);
});

test("DEV LOG repository entries satisfy V1 parsing and mapping", async () => {
  const { DEV_LOG_SECTION_LABELS, DEV_LOG_SOURCE_TYPES, loadDevLogEntries, parseDevLogEntry, toDevLogUiItem } = await import("../app/dev-log.ts");
  const directory = new URL("../data/dev-log/entries/", import.meta.url);
  const { readdir } = await import("node:fs/promises");
  const filenames = (await readdir(directory)).filter((name) => name.endsWith(".md"));
  const files = Object.fromEntries(await Promise.all(filenames.map(async (name) => [name, await readFile(new URL(name, directory), "utf8")])));
  const warnings = [];
  const result = loadDevLogEntries(files, (warning) => warnings.push(warning));
  assert.equal(warnings.length, 0);
  assert.equal(result.data?.items.length, 11);
  assert.equal(new Set(result.data?.items.map(({ id }) => id)).size, 11);
  for (const markdown of Object.values(files)) {
    const parsed = parseDevLogEntry(markdown);
    assert.equal(parsed.error, null);
    assert.deepEqual(parsed.entry && Object.keys(parsed.entry.sections), [...DEV_LOG_SECTION_LABELS]);
  }
  const expectedTypes = { BUG: "bug", PRODUCT_CHANGE: "improvement", METHODOLOGY_CHANGE: "improvement", PRODUCT_PROPOSAL: "discussion", METHODOLOGY_PROPOSAL: "discussion", UNCERTAINTY: "discussion" };
  const template = Object.values(files)[0];
  for (const type of DEV_LOG_SOURCE_TYPES) {
    const parsed = parseDevLogEntry(template.replace(/^type: .+$/m, `type: ${type}`).replace(/^id: .+$/m, `id: type-${type}`));
    assert.equal(parsed.entry && toDevLogUiItem(parsed.entry).type, expectedTypes[type]);
  }
});

test("DEV LOG loader skips malformed and duplicate entries with diagnostics", async () => {
  const { loadDevLogEntries } = await import("../app/dev-log.ts");
  const valid = await readFile(new URL("../data/dev-log/entries/DL-20260822-001.md", import.meta.url), "utf8");
  const warnings = [];
  const result = loadDevLogEntries({ "valid.md": valid, "invalid.md": "---\nschema: wrong\n---", "duplicate.md": valid }, (warning) => warnings.push(warning));
  assert.equal(result.data?.items.length, 1);
  assert.equal(warnings.length, 2);
  assert.match(warnings.join("\n"), /invalid\.md.*schema/);
  assert.match(warnings.join("\n"), /DL-20260822-001.*duplicitní ID/);
});
