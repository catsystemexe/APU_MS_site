import assert from "node:assert/strict";
import test, { after } from "node:test";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright-core";
import { startHarness } from "../../helpers/telemetry-browser-server.mjs";
import { reportOptions } from "../../helpers/telemetry-browser-fixture.mjs";
import { createReport } from "../../../telemetry/reports/engine.ts";
import { reportCsv } from "../../../telemetry/reports/csv.ts";
import { writeExport } from "../../../telemetry/reports/local.ts";

const evidence = { scope: "isolated synthetic Chromium harness; excludes standard launcher/Vinext/Worker/hosted acceptance", base: "9018512621c8a2d828932ff78e18f18d702b321d", scenarios: [] };
function scenario(name) { const result = { name, status: "FAIL" }; evidence.scenarios.push(result); return result; }
after(async () => { await writeFile(new URL("./evidence.json", import.meta.url), JSON.stringify(evidence, null, 2) + "\n"); });
const executablePath = process.env.CHROMIUM_PATH ?? (process.platform === "linux" ? "/usr/bin/chromium" : undefined);
async function waitFor(check, label) {
  const deadline = performance.now() + 12000;
  while (performance.now() < deadline) { if (await check()) return; await delay(40); }
  throw Error("Timed out: " + label);
}
async function browserFixture(t, { enabled = true, seed = false, rulesAccepted = true } = {}) {
  const h = await startHarness({ syntheticOnly: true, enabled });
  if (!rulesAccepted) h.rules.receipts.clear();
  let context; const observation = evidence.scenarios.at(-1);
  t.after(async () => {
    try { try { await context?.close(); } finally { await h.close(); } assert.equal(existsSync(h.directory), false); }
    catch (error) { observation.status = "FAIL"; observation.failure = "cleanup"; throw error; }
  });
  context = await chromium.launchPersistentContext(join(h.directory, "browser-profile"), { executablePath, headless: true,
    args: ["--no-sandbox", "--disable-background-networking", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"], serviceWorkers: "block", acceptDownloads: false, viewport: { width: 1600, height: 1100 },
    extraHTTPHeaders: { "cf-access-jwt-assertion": await h.token() } });
  evidence.runtime = { node: process.version, platform: process.platform, chromium: context.browser()?.version() };
  const outbound = [], errors = [];
  await context.route("**/*", route => { if (new URL(route.request().url()).origin === h.origin) return route.continue(); outbound.push("blocked_external_request"); return route.abort(); });
  const page = context.pages()[0];
  page.setDefaultTimeout(12000);
  page.on("pageerror", error => errors.push(error.message));
  await page.clock.install({ time: new Date(h.now) });
  await page.goto(h.origin + (seed ? "/?seed=1" : "/"));
  try { await page.locator(rulesAccepted ? "#message:enabled" : ".pilot-rules-dialog").waitFor(); }
  catch (error) {
    const diagnostic = { server_ms: h.now, browser_ms: await page.evaluate(() => Date.now()),
      receipts: [...h.rules.receipts.values()].map(raw => { const r = JSON.parse(raw); return { accepted_at: r.acceptedAt, expires_at: r.expiresAt }; }),
      requests: h.requests.slice(-8).map(({ path, status }) => ({ path, status })),
      boundary: (await page.locator('.pilot-rules-error, .pilot-rules-dialog [role=status], .access-card [role=status]').allTextContents()).slice(0, 3).map(text => text.slice(0, 180)) };
    throw new Error('Synthetic bootstrap not ready: ' + JSON.stringify(diagnostic), { cause: error });
  }
  return { h, context, page, errors, outbound,
    async tick(ms = 15000) { h.advance(ms); await page.clock.fastForward(ms); await delay(80); await h.drain(); },
    async settle() { for (let i = 0; i < 2; i++) { h.advance(15000); await page.clock.fastForward(15000); await delay(100); } await h.drain(); },
    async send(text) { await page.locator("#message").fill(text); await page.getByRole("button", { name: "Odeslat zprávu", exact: true }).click(); await page.locator("#message:enabled").waitFor(); },
    async consent() { await page.getByRole("button", { name: "Zapojit měření pro tuto návštěvu" }).click(); await page.getByRole("button", { name: "Zastavit měření", exact: true }).waitFor(); },
  };
}
const counts = h => ["telemetry_sessions", "telemetry_events", "telemetry_ai_calls"].map(table => h.db.rows(table).length);

test("actual browser default OFF and explicit refusal keep normal AI workflow usable without collection", async t => {
  for (const enabled of [false, true]) await t.test(enabled ? "refusal" : "default OFF", async sub => {
    const result = scenario(enabled ? "refusal" : "default_off");
    const f = await browserFixture(sub, { enabled }); const { h, page } = f;
    assert.deepEqual(counts(h), [0, 0, 0]);
    if (enabled) await page.getByRole("button", { name: "Pokračovat bez měření" }).click();
    else assert.equal(await page.getByRole("button", { name: "Zapojit měření pro tuto návštěvu" }).count(), 0);
    await f.send("Synthetic observation.");
    assert.match(await page.locator(".message-list").innerText(), /Synthetic response/);
    assert.equal(h.providerCalls.length, 3, "one extraction, controller and MAIN call");
    await f.settle(); assert.deepEqual(counts(h), [0, 0, 0]);
    assert.deepEqual(f.errors, []); assert.deepEqual(f.outbound, []); assert.deepEqual(h.blocked, []);
    Object.assign(result, { status: "PASS", provider_calls: 3, rows: [0, 0, 0] });
  });
});

test("actual browser workflow reaches collector, persistent SQLite, SQL report and real CSV", async t => {
  const result = scenario("workflow");
  const f = await browserFixture(t, { seed: true }); const { h, page } = f;
  assert.deepEqual(counts(h), [0, 0, 0]);
  await f.consent(); assert.deepEqual(counts(h), [1, 0, 0]);
  await f.send("Synthetic observation.");
  assert.equal(h.providerCalls.length, 3);
  await page.locator(".dialog-action-nav-card:not(:disabled)").last().click();
  await page.locator(".f3-material").waitFor();
  assert.equal(h.providerCalls.length, 5, "F2 adds one cached need-route classification and one analysis to F1's three");
  await page.locator('.desktop-tool-tabs button[aria-controls="desktop-tool-output"]').click();
  await page.locator(".f3-controls").waitFor();
  assert.equal(h.providerCalls.length, 5, "baseline F3 acceptance adds no AI call");
  await f.settle();
  const initial = createReport(h.db.db, reportOptions);
  assert.equal(initial.rows.summary[0].known_cost_nano_usd, 736000, "3 Luna x 0.000032 + 2 Terra x 0.00032 USD (100 input + 10 output each)");
  const render = page.locator(".f3-render-action button");
  await page.locator(".f3-controls select").nth(0).selectOption("parent");
  await render.click(); await waitFor(() => page.locator(".f3-material").innerText().then(s => s.includes("Synthetic output")), "first generated output");
  assert.equal(h.providerCalls.length, 6);
  h.setUnknownUsage(true);
  await page.locator(".f3-controls select").nth(0).selectOption("internal");
  await render.click();
  await waitFor(() => h.providerCalls.length === 7 && h.db.rows("telemetry_ai_calls").filter(c => c.state === "final").length === 7, "unknown usage ledger final");
  await waitFor(() => render.isDisabled(), "unknown-cost generation finished");
  h.setUnknownUsage(false);
  await page.locator('.desktop-tool-tabs button[aria-controls="desktop-tool-build"]').click();
  await page.locator('.desktop-tool-tabs button[aria-controls="desktop-tool-output"]').click();
  assert.equal(h.providerCalls.length, 7, "return navigation adds no provider call");
  await page.locator(".f3-controls select").nth(0).selectOption("student");
  const release = h.holdReply("_final_render");
  await render.click(); await waitFor(() => h.providerCalls.length === 8, "held generation started");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Nový projekt", exact: true }).click();
  await page.locator("#message:enabled").waitFor(); release();
  await waitFor(() => h.db.rows("telemetry_ai_calls").filter(c => c.state === "final").length === 8, "late generation ledger settled");
  await page.locator("#message").fill("Synthetic new workflow after reset");
  await f.settle();
  assert.equal(await page.locator(".f3-material").count(), 0, "stale result cannot restore reset output");
  const report = createReport(h.db.db, reportOptions);
  assert.equal(report.rows.workflows.length, 2);
  const completed = report.rows.workflows.find(w => w.output_count === 3), resetNew = report.rows.workflows.find(w => w.output_count === 0);
  assert.equal(completed.phase_path, "F1>F2>F3>F2>F3");
  assert.equal(resetNew.phase_path, "F1");
  assert.equal(completed.baseline_outputs, 1);
  assert.equal(completed.generated_outputs, 2);
  assert.equal(completed.first_completion_cost_nano_usd, 736000);
  assert.equal(report.rows.summary[0].ai_count, 8);
  assert.equal(report.rows.summary[0].known_cost_nano_usd, 1376000);
  assert.equal(report.rows.summary[0].unknown_cost_count, 1);
  assert.equal(report.rows.summary[0].complete_cost_nano_usd, null);
  const events = h.db.rows("telemetry_events");
  const semantic = Object.fromEntries(["workflow_started", "operation_requested", "operation_resolved", "phase_transition", "document_accepted", "workflow_reset"].map(name => [name, events.filter(e => e.event_name === name).length]));
  assert.deepEqual(semantic, { workflow_started: 2, operation_requested: 7, operation_resolved: 7, phase_transition: 4, document_accepted: 3, workflow_reset: 1 });
  const calls = h.db.rows("telemetry_ai_calls"), original = events.find(e => e.event_name === "workflow_started" && e.workflow_id === completed.workflow_id);
  assert.ok(report.rows.calls.every(c => c.session_id === original.session_id && c.workflow_id === completed.workflow_id && c.operation_instance_id));
  const delivered = h.requests.filter(r => r.path === "/api/telemetry/events" && r.status === 200).at(-1).body;
  const before = events.length;
  const duplicate = await page.evaluate(async body => (await fetch("/api/telemetry/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json(), delivered);
  assert.equal(duplicate.code, "ready"); assert.equal(h.db.rows("telemetry_events").length, before);
  const csv = reportCsv(report, { operator: true, createdAt: reportOptions.asOf });
  writeExport(join(h.directory, "telemetry-browser.csv"), csv, reportOptions.asOf);
  assert.equal(await readFile(join(h.directory, "telemetry-browser.csv"), "utf8"), csv);
  assert.match(csv, /"ai_count"/); assert.match(csv, /"1376000"/);
  assert.doesNotMatch(csv, /@synthetic|Synthetic observation|Synthetic response|cf-access|pseudonym_key|context_key/);
  // This bounded one-row scalar fixture contains no embedded comma/quote. Reject
  // unexpected quoting, then compare CSV fields independently of report objects.
  const [header, row, end] = csv.split("\r\n"); assert.equal(end, "");
  const decode = line => line.split(",").map(cell => { assert.match(cell, /^(?:"[^"\r\n]*")?$/); return cell === "" ? null : JSON.parse(cell); });
  const names = decode(header), values = decode(row); assert.equal(values.length, names.length);
  const columns = Object.fromEntries(names.map((name, i) => [name, values[i]]));
  assert.equal(columns.ai_count, "8"); assert.equal(columns.known_cost_nano_usd, "1376000");
  assert.equal(columns.unknown_cost_count, "1"); assert.equal(columns.complete_cost_nano_usd, null);
  assert.equal(columns.outputs, "3"); assert.equal(columns.timezone, "Europe/Prague");
  assert.equal(columns.metric_version, "pilot-report-v1"); assert.equal(columns.test_class, "synthetic");
  assert.equal(Date.parse(columns.expires_at) - Date.parse(columns.exported_at), 7 * 86400000);
  assert.ok(!names.some(name => /^(?:email|participant_id|call_id|projection_json|identity_json)$/.test(name)));
  const stored = JSON.stringify([h.db.rows("telemetry_sessions"), events, calls]);
  for (const forbidden of ["browser-a@synthetic.invalid", "Synthetic observation.", "Synthetic response.", h.bindings.TELEMETRY_PSEUDONYM_KEY, h.bindings.TELEMETRY_CONTEXT_KEY]) assert.ok(!stored.includes(forbidden));
  assert.deepEqual(f.errors, []); assert.deepEqual(f.outbound, []); assert.deepEqual(h.blocked, []);
  Object.assign(result, { status: "PASS", provider_calls: 8, known_cost_nano_usd: 1376000, unknown_cost_count: 1, first_output_nano_usd: 736000, outputs: 3, workflows: 2, semantic_events: semantic, duplicate_added_rows: 0, csv_written_and_read: true });
});

test("actual browser outage/retry, stop/re-opt-in, reload, two tabs and identity invalidation isolate collection", async t => {
  const result = scenario("consent_isolation_outage");
  const f = await browserFixture(t); const { h, page, context } = f;
  await f.consent();
  h.setUnavailable(true);
  await f.send("Synthetic observation.");
  assert.match(await page.locator(".message-list").innerText(), /Synthetic response/);
  assert.equal(h.providerCalls.length, 3, "collector outage cannot add AI calls or change the response");
  assert.ok(h.requests.some(r => r.path === "/api/telemetry/events" && r.status === 503));
  h.setUnavailable(false); await f.settle();
  const failed = h.requests.find(r => r.path === "/api/telemetry/events" && r.status === 503).body;
  const ids = new Set(h.db.rows("telemetry_events").map(e => e.event_id));
  assert.ok(failed.events.every(e => ids.has(e.event_id)), "the actual browser queue retries identical events into storage");
  const old = h.requests.filter(r => r.path === "/api/telemetry/events" && r.status === 200).at(-1).body;
  await page.getByRole("button", { name: "Zastavit měření", exact: true }).click();
  await waitFor(() => h.db.rows("telemetry_sessions")[0].stopped_at !== null, "server consent revocation");
  const stoppedCount = h.db.rows("telemetry_events").length;
  await page.locator("#message").fill("Still usable after stop"); await f.settle();
  assert.equal(h.db.rows("telemetry_events").length, stoppedCount);
  assert.equal((await h.request("/api/telemetry/events", { token: await h.token(), body: old })).status, 400);
  await page.getByRole("button", { name: "Možnosti měření" }).click(); await f.consent();
  assert.equal(h.db.rows("telemetry_sessions").length, 2);
  await page.reload(); await page.locator("#message:enabled").waitFor();
  await page.getByRole("button", { name: "Zapojit měření pro tuto návštěvu" }).waitFor();
  assert.equal(h.db.rows("telemetry_sessions").length, 2, "reload never silently restores consent");
  const second = await context.newPage(); await second.clock.install({ time: new Date(h.now) });
  await second.goto(h.origin); await second.locator("#message:enabled").waitFor();
  await second.getByRole("button", { name: "Zapojit měření pro tuto návštěvu" }).click();
  await second.getByRole("button", { name: "Zastavit měření", exact: true }).waitFor();
  assert.equal(h.db.rows("telemetry_sessions").length, 3);
  assert.equal(new Set(h.db.rows("telemetry_sessions").map(s => s.tab_id)).size, 3);
  await second.locator("#message").fill("Second tab synthetic input");
  h.advance(15000); await second.clock.fastForward(15000); await delay(100);
  const participants = new Set(h.db.rows("telemetry_sessions").map(s => s.participant_id));
  for (const tab of [page, second]) {
    const storage = await tab.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
    for (const participant of participants) assert.ok(!storage.includes(participant), "no persistent browser telemetry pseudonym");
    assert.doesNotMatch(storage, /telemetry-context|APU_TELEMETRY|notice_version|"opt_in"/);
  }
  await context.setExtraHTTPHeaders({ "cf-access-jwt-assertion": await h.token({ exp: Math.floor(h.now / 1000) - 1 }) });
  await second.evaluate(() => window.dispatchEvent(new Event("focus")));
  await second.getByRole("heading", { name: "Relace byla ukončena" }).waitFor();
  const invalidatedCount = h.db.rows("telemetry_events").length;
  await second.evaluate(() => window.dispatchEvent(new Event("keydown")));
  h.advance(15000); await second.clock.fastForward(15000); await delay(100);
  assert.equal(h.db.rows("telemetry_events").length, invalidatedCount);
  const sessions = new Map(h.db.rows("telemetry_sessions").map(s => [s.session_id, s]));
  for (const event of h.db.rows("telemetry_events")) assert.equal(event.tab_id, sessions.get(event.session_id).tab_id);
  assert.deepEqual(f.errors, []); assert.deepEqual(f.outbound, []); assert.deepEqual(h.blocked, []);
  Object.assign(result, { status: "PASS", sessions: 3, distinct_tab_contexts: 3, stopped_added_rows: 0, invalidated_added_rows: 0, silent_consent_restore: false, outage_retry_same_event_ids: true });
});

test("actual browser MAIN disconnect retains only its own late ledger and reload requires new consent", async t => {
  const result = scenario("stream_disconnect");
  const f = await browserFixture(t); const { h, page } = f;
  await f.consent(); const release = h.holdStream();
  await page.locator("#message").fill("Synthetic observation.");
  await page.getByRole("button", { name: "Odeslat zprávu", exact: true }).click();
  await waitFor(() => h.providerCalls.length === 3, "MAIN streaming provider starts");
  await page.locator(".dialog-actions-preview").waitFor(); // Real route buffers structured F1 prose until terminal provider event.
  await page.reload(); await page.locator("#message:enabled").waitFor(); release();
  await page.getByRole("button", { name: "Zapojit měření pro tuto návštěvu" }).waitFor();
  await waitFor(() => h.db.rows("telemetry_ai_calls").filter(c => c.state === "final").length === 3, "request lifetime keeps provider completion after disconnect");
  assert.equal(h.db.rows("telemetry_sessions").length, 1); assert.equal(h.providerCalls.length, 3);
  const report = createReport(h.db.db, reportOptions);
  assert.equal(report.rows.summary[0].ai_count, 3);
  assert.equal(report.rows.summary[0].known_cost_nano_usd, 96000);
  assert.equal(report.rows.summary[0].outputs, 0);
  assert.ok(!await page.locator(".message-list").innerText().then(s => s.includes("Synthetic response")), "late response does not overwrite reloaded UI");
  assert.deepEqual(f.errors, []); assert.deepEqual(f.outbound, []); assert.deepEqual(h.blocked, []);
  Object.assign(result, { status: "PASS", provider_calls: 3, ai_rows: 3, known_cost_nano_usd: 96000, outputs: 0, silent_consent_restore: false });
});

test("actual browser controlled activity/blur, interval union and idle renewal need no thirty-minute wait", async t => {
  // Check aligned timers and a controlled 1,032ms offset matching the reported
  // shortfall. This is a regression fixture, not a native Windows clock trace.
  for (const offset of [0, 1032]) await t.test(`input offset ${offset}ms`, async sub => {
    const result = scenario(offset ? "activity_idle_offset" : "activity_idle");
    const f = await browserFixture(sub); const { h, page, context } = f;
    await page.evaluate(() => {
      window.__activityTrace = [];
      for (const type of ["keydown", "input", "focus", "blur", "visibilitychange"])
        window.addEventListener(type, event => {
          // Bounded, test-only observations: no values, targets, IDs or tokens.
          if (window.__activityTrace.length < 32) window.__activityTrace.push({ type: event.type,
            wall: Date.now(), mono: performance.now(), visible: document.visibilityState, focused: document.hasFocus() });
        });
    });
    const intervals = () => h.db.rows("telemetry_events").filter(e => e.event_name === "activity_interval").map(e => JSON.parse(e.event_json).payload);
    const duration = () => intervals().reduce((sum, i) => sum + i.end_ms - i.start_ms, 0);
    const timing = result.timing = [];
    const snapshot = async label => {
      timing.push({ label, server: h.now, browser: await page.evaluate(() => ({ wall: Date.now(), mono: performance.now(),
        visible: document.visibilityState, focused: document.hasFocus(), events: window.__activityTrace.splice(0) })),
        sent: h.requests.filter(r => r.path === "/api/telemetry/events").flatMap(r => (r.body?.events ?? [])
          .filter(e => e.event_name === "activity_interval").map(e => ({ status: r.status, elapsed: e.elapsed_ms, ...e.payload }))),
        persisted: intervals() });
    };
    await page.bringToFront();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    await snapshot("before_pause");
    const at = await page.evaluate(() => Date.now()) + 1000;
    await page.clock.pauseAt(new Date(at)); h.freeze(at);
    await snapshot("paused_before_consent");
    // Keep real mouse input while paused; force skips RAF actionability checks.
    await page.getByRole("button", { name: "Zapojit měření pro tuto návštěvu" }).click({ force: true });
    await page.getByRole("button", { name: "Zastavit měření", exact: true }).waitFor();
    await snapshot("consented");
    assert.equal(await page.evaluate(() => Date.now()), h.now);
    h.advance(offset); await page.clock.runFor(offset);
    // A real keydown starts activity without enqueueing an unrelated workflow.
    await page.locator("#message").press("ArrowLeft");
    await snapshot("input");
    const input = timing.at(-1).browser;
    assert.deepEqual([input.visible, input.focused], ["visible", true]);

    // Hold the actual closing-interval request before the collector, never fake
    // an acknowledgement or storage. A fixed sleep cannot make it observable.
    let release; const gate = new Promise(resolve => { release = resolve; });
    let held = false;
    await context.route("**/api/telemetry/events", async route => {
      const events = route.request().postDataJSON()?.events ?? [];
      if (events.some(e => e.event_name === "activity_interval" && e.payload.end_ms === offset + 15000)) {
        held = true; await gate;
      }
      await route.fallback();
    });
    try {
      h.advance(15000); await page.clock.runFor(15000);
      if (offset) await waitFor(() => duration() === 13968, "first timer fragment persisted");
      await snapshot("advanced");
      const endpoint = timing.at(-1).browser;
      assert.equal(endpoint.mono - input.mono, 15000);
      assert.equal(endpoint.wall - input.wall, 15000);
      assert.equal(h.now, endpoint.wall);
      await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: false });
      await snapshot("focus_override_off");
      // Observe a real browser blur; disabling CDP's focus override alone can
      // leave the native headless window focused. No pilot method is invoked.
      const other = await context.newPage(); await other.goto(h.origin);
      await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: false });
      await waitFor(() => page.evaluate(() => !document.hasFocus() && window.__activityTrace.some(e => e.type === "blur" && !e.focused)), "browser blur delivered");
      await snapshot("blurred");
      assert.equal(timing.at(-1).browser.mono, endpoint.mono);
      // The aligned request is already due at 15s. Only the offset tail needs
      // the next flush tick; never delay a send across the collector skew gate.
      if (offset) { h.advance(15000); await page.clock.runFor(15000); }
      await waitFor(() => held, "closing activity request reached transport gate");
      result.active_ms_before_delivery = duration();
      assert.equal(duration(), offset ? 13968 : 0, "a pending request is not persisted evidence");
      await snapshot("delivery_held");
      release();
      await waitFor(() => duration() === 15000, "all foreground intervals persisted");
      await h.drain(); await snapshot("persisted");
      const beforeRenewal = createReport(h.db.db, reportOptions);
      assert.equal(beforeRenewal.rows.sessions[0].active_ms, 15000, "exactly 15s of actual foreground input before blur");
      assert.equal(beforeRenewal.rows.participants[0].active_ms, 15000);
      assert.equal(beforeRenewal.rows.days[0].active_ms, 15000);
      assert.deepEqual(intervals().map(i => i.end_ms - i.start_ms), offset ? [13968, 1032] : [15000]);
      assert.ok(intervals().every(i => i.start_ms >= offset && i.end_ms <= offset + 15000), "no activity after blur");
      // Another complete tick while blurred must add neither time nor rows.
      const before = intervals();
      h.advance(15000); await page.clock.runFor(15000);
      await h.drain(); assert.deepEqual(intervals(), before);
      await other.close(); await page.bringToFront();
      await page.locator("#message:enabled").waitFor();
      // Focus revalidation clears measurement; re-opt-in remains explicit.
      if (await page.getByRole("button", { name: "Zapojit měření pro tuto návštěvu" }).count()) {
        await page.getByRole("button", { name: "Zapojit měření pro tuto návštěvu" }).press("Enter");
        await page.getByRole("button", { name: "Zastavit měření", exact: true }).waitFor();
      }
      const sessions = h.db.rows("telemetry_sessions").length;
      h.advance(30 * 60000); await page.clock.fastForward(30 * 60000);
      await page.locator("#message").fill("Synthetic input after idle");
      await waitFor(() => h.db.rows("telemetry_sessions").length === sessions + 1, "idle interaction renews to distinct context");
      const renewed = h.db.rows("telemetry_sessions").at(-1);
      assert.ok(h.db.rows("telemetry_sessions").slice(0, -1).every(s => s.session_id !== renewed.session_id && s.tab_id !== renewed.tab_id));
      assert.equal(h.providerCalls.length, 0);
      assert.deepEqual(f.errors, []); assert.deepEqual(f.outbound, []); assert.deepEqual(h.blocked, []);
      Object.assign(result, { status: "PASS", active_ms: 15000, participant_union_ms: 15000, idle_renewal: true, native_os_focus: "NOT VERIFIED" });
    } finally { release(); await snapshot("final"); }
  });
});

test("two actual browser tabs persist overlapping activity and B3 unions participant time", async t => {
  const result = scenario("overlapping_tabs");
  const f = await browserFixture(t, { seed: true }); const { h, page, context } = f;
  const second = await context.newPage(); await second.goto(h.origin + "/?seed=1"); await second.locator("#message:enabled").waitFor();
  const sessions = await Promise.all([page, second].map(p => context.newCDPSession(p)));
  for (const cdp of sessions) await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  const at = await page.evaluate(() => Date.now()) + 1000;
  await page.clock.pauseAt(new Date(at)); h.freeze(at);
  // Freeze before both context requests so RTT does not shift their wall anchors.
  for (const p of [page, second]) {
    await p.getByRole("button", { name: "Zapojit měření pro tuto návštěvu" }).press("Enter");
    await p.getByRole("button", { name: "Zastavit měření", exact: true }).waitFor();
  }
  await page.locator("#message").fill("First overlapping input");
  await second.locator("#message").fill("Second overlapping input");
  for (const p of [page, second]) assert.deepEqual(await p.evaluate(() => [document.visibilityState, document.hasFocus()]), ["visible", true]);
  h.advance(15000); await page.clock.runFor(15000);
  // At the frozen endpoint, actual F1->F2 transitions close the final partial
  // activity intervals and their authorized requests flush them. Explicit stop
  // then ends collection without adding clock time.
  // Enter is a real browser keyboard action and needs no frozen animation frames.
  for (const p of [page, second]) {
    await p.locator("#message").fill("Pokračujme");
    await p.locator("#message").press("Enter");
    await p.locator(".f3-material").waitFor();
  }
  await waitFor(() => h.providerCalls.length === 6, "two extraction/need-route/analysis operations");
  for (const p of [page, second]) await p.getByRole("button", { name: "Zastavit měření", exact: true }).press("Enter");
  await waitFor(() => h.db.rows("telemetry_sessions").every(s => s.stopped_at !== null), "both overlapping visits stop");
  await h.drain();
  const report = createReport(h.db.db, reportOptions);
  assert.deepEqual(report.rows.sessions.map(s => s.active_ms), [15000, 15000]);
  assert.equal(report.rows.participants.length, 1); assert.equal(report.rows.participants[0].active_ms, 15000);
  assert.equal(report.rows.days[0].active_ms, 15000);
  assert.equal(report.rows.summary[0].ai_count, 6);
  assert.equal(report.rows.summary[0].known_cost_nano_usd, 1344000);
  Object.assign(result, { status: "PASS", session_active_ms: [15000, 15000], participant_union_ms: 15000, ai_calls: 6, known_cost_nano_usd: 1344000, focus: "controlled CDP, not native OS acceptance" });
});

test('G1-C5 actual first-entry acceptance, two stateless turns and API re-lock preserve OFF/OFF zero writes', async t => {
  const result = scenario('g1c5_rules_stateless_off');
  const f = await browserFixture(t, { enabled: false, seed: true, rulesAccepted: false });
  const { h, page } = f;
  const proceed = page.getByRole('button', { name: 'Pokračovat do APU', exact: true });
  assert.equal(await proceed.isDisabled(), true);
  assert.equal(await page.locator('#message').isVisible(), false);
  assert.equal(h.providerCalls.length, 0); assert.deepEqual(counts(h), [0, 0, 0]);
  // Receipt validation intentionally rejects future timestamps. Align both
  // synthetic clocks before the real POST, just as in controlled-activity tests.
  const clocksBefore = { server: h.now, browser: await page.evaluate(() => Date.now()) };
  const anchor = Math.max(clocksBefore.server, clocksBefore.browser) + 1000;
  await page.clock.pauseAt(new Date(anchor)); h.freeze(anchor);
  await page.getByRole('checkbox').check(); await proceed.click();
  await page.locator('#message:enabled').waitFor();
  assert.equal(h.rules.writes.length, 1);
  assert.equal(Date.parse(JSON.parse(h.rules.writes[0].value).acceptedAt), anchor);
  assert.equal(await page.evaluate(() => Date.now()), anchor);
  assert.deepEqual(h.rules.writes[0].options, { expirationTtl: 3600 });
  assert.doesNotMatch(JSON.stringify(h.rules.writes), /browser-a@|notebook|SYNTHETIC/);
  for (const text of ['Synthetic first observation.', 'Synthetic second answer.']) await f.send(text);
  const mains = h.providerPayloads.filter(payload => payload.stream);
  assert.equal(mains.length, 2);
  for (const payload of h.providerPayloads) {
    assert.equal(payload.store, false);
    assert.equal(Object.hasOwn(payload, 'previous_response_id'), false);
  }
  assert.ok(mains[1].instructions.includes('dialogContext'));
  assert.ok(mains[1].instructions.includes('AKTUÁLNÍ ZÁPISNÍK'));
  const before = h.providerCalls.length;
  h.rules.receipts.clear();
  await page.locator('#message').fill('Synthetic request after rules revocation.');
  await page.getByRole('button', { name: 'Odeslat zprávu', exact: true }).click();
  await page.locator('.pilot-rules-dialog').waitFor();
  assert.equal(await page.getByRole('checkbox').isChecked(), false);
  assert.equal(h.providerCalls.length, before);
  await h.drain(); assert.deepEqual(counts(h), [0, 0, 0]);
  assert.deepEqual(f.errors, []); assert.deepEqual(f.outbound, []); assert.deepEqual(h.blocked, []);
  Object.assign(result, { status: 'PASS', stateless_main_calls: 2, receipt_writes: 1, clock_skew_before_ms: clocksBefore.server - clocksBefore.browser, aligned_clock_ms: anchor, rows: [0, 0, 0], provider_calls_after_denial: 0 });
});
