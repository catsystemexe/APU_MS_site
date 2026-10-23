import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { get } from "node:http";
import { startHarness } from "./helpers/telemetry-browser-server.mjs";
import { createReport } from "../telemetry/reports/engine.ts";
import { reportOptions } from "./helpers/telemetry-browser-fixture.mjs";

const start = () => ({ action: "start", opt_in: true, notice_version: "h1", tab_id: crypto.randomUUID() });
const count = h => ["telemetry_sessions", "telemetry_events", "telemetry_ai_calls"].map(n => h.db.rows(n).length);

test("browser fixture requires explicit isolation, defaults OFF, uses actual Home/auth and removes its SQLite resources", async () => {
  await assert.rejects(startHarness(), /Explicit synthetic/);
  const NativeDate = Date;
  const h = await startHarness({ syntheticOnly: true });
  try {
    assert.match(h.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
    const response = await h.request("/api/telemetry/context", { token: await h.token(), body: start() });
    assert.deepEqual(await response.json(), { code: "disabled" });
    const home = await h.fetch(h.origin, { headers: { "cf-access-jwt-assertion": await h.token() } });
    assert.equal(home.status, 200); assert.match(await home.text(), /"enabled":false/);
    assert.equal((await h.fetch(h.origin)).status, 401);
    assert.deepEqual(count(h), [0, 0, 0]);
    for (const path of ["app/apu-client.tsx", "app/telemetry/use-pilot.tsx", "app/telemetry/pilot.ts", "app/telemetry/client.ts"]) assert.ok(h.inputs.some(p => p.replaceAll("\\", "/").endsWith(path)), path);
    assert.ok(!h.inputs.some(p => /telemetry-browser-(server|fixture)|access-auth|node:sqlite/.test(p)));
    assert.equal(await new Promise((yes, no) => { get(h.origin + "/api/session", { headers: { Host: "unexpected.invalid" } }, r => { r.resume(); yes(r.statusCode); }).on("error", no); }), 403);
  } finally { await h.close(); }
  assert.equal(existsSync(h.directory), false);
  assert.equal(Date, NativeDate, "the route-bundle clock never replaces Node's clock");
});

test("actual HTTP authentication, cohort/privacy/consent/context/event boundaries reject unauthorized writes", async t => {
  const h = await startHarness({ syntheticOnly: true, enabled: true }); t.after(() => h.close());
  const token = await h.token();
  for (const [name, jwt] of [
    ["missing JWT", null], ["malformed JWT", "invalid"], ["expired JWT", await h.token({ exp: Math.floor(h.now / 1000) - 1 })],
    ["bad signature", await h.token({}, { badSignature: true })], ["wrong issuer", await h.token({ iss: "https://wrong.synthetic.invalid" })],
    ["wrong audience", await h.token({ aud: "wrong" })], ["missing identity", await h.token({ email: null })],
  ]) await t.test(name, async () => {
    const response = await h.request("/api/telemetry/context", { token: jwt, body: start() });
    assert.equal(response.status, 401); assert.deepEqual(await response.json(), { code: "unauthorized" }); assert.deepEqual(count(h), [0, 0, 0]);
  });
  for (const [name, jwt] of [["non-synthetic identity", await h.token({ email: "not-a-participant@example.invalid" })], ["unenrolled participant", await h.token({ email: "other@synthetic.invalid" })]]) await t.test(name, async () => {
    const response = await h.request("/api/telemetry/context", { token: jwt, body: start() });
    assert.deepEqual(await response.json(), { code: "ineligible" }); assert.deepEqual(count(h), [0, 0, 0]);
  });
  await t.test("wrong cohort", async () => {
    h.bindings.APU_TELEMETRY_COHORT = "not-enrolled";
    try { assert.deepEqual(await (await h.request("/api/telemetry/context", { token, body: start() })).json(), { code: "ineligible" }); }
    finally { h.bindings.APU_TELEMETRY_COHORT = reportOptions.cohort; }
    assert.deepEqual(count(h), [0, 0, 0]);
  });
  for (const [name, body, headers, code] of [
    ["wrong origin", start(), { Origin: "http://wrong.invalid" }, "invalid_request"],
    ["wrong notice", { ...start(), notice_version: "wrong" }, {}, "consent_required"],
    ["refused consent", { ...start(), opt_in: false }, {}, "consent_required"],
  ]) await t.test(name, async () => {
    const response = await h.request("/api/telemetry/context", { token, body, headers });
    assert.equal(response.status, 400); assert.deepEqual(await response.json(), { code }); assert.deepEqual(count(h), [0, 0, 0]);
  });
  const context = await (await h.request("/api/telemetry/context", { token, body: start() })).json();
  assert.equal(context.code, "ready"); assert.deepEqual(count(h), [1, 0, 0]);
  const event = { schema_version: 1, measurement_version: "pilot-v1", source: "client", event_id: crypto.randomUUID(), event_name: "workflow_started", session_id: context.session_id, tab_id: context.tab_id, workflow_id: crypto.randomUUID(), client_seq: 0, elapsed_ms: 0, payload: { phase: "F1" } };
  const batch = { context: context.context, events: [event], sent_elapsed_ms: 0 };
  for (const [name, body] of [["missing context", { events: [event], sent_elapsed_ms: 0 }], ["invalid context", { ...batch, context: "wrong" }], ["invalid event", { ...batch, events: [{ ...event, payload: { phase: "PRIVATE_TEXT" } }] }]] ) await t.test(name, async () => {
    assert.equal((await h.request("/api/telemetry/events", { token, body })).status, 400); assert.deepEqual(count(h), [1, 0, 0]);
  });
  await t.test("actual store outage/retry and duplicate/conflicting events", async () => {
    h.setUnavailable(true);
    assert.equal((await h.request("/api/telemetry/events", { token, body: batch })).status, 503); assert.deepEqual(count(h), [1, 0, 0]);
    h.setUnavailable(false);
    for (let i = 0; i < 2; i++) assert.deepEqual((await (await h.request("/api/telemetry/events", { token, body: batch })).json()).acknowledged, [event.event_id]);
    assert.deepEqual(count(h), [1, 1, 0]);
    assert.equal((await h.request("/api/telemetry/events", { token, body: { ...batch, events: [{ ...event, payload: { phase: "F2" } }] } })).status, 409);
    assert.deepEqual(count(h), [1, 1, 0]);
  });
  await t.test("stopped context refuses later events", async () => {
    await h.request("/api/telemetry/context", { token, body: { action: "stop", context: context.context } });
    assert.equal((await h.request("/api/telemetry/events", { token, body: batch })).status, 400); assert.deepEqual(count(h), [1, 1, 0]);
  });
  assert.equal(createReport(h.db.db, reportOptions).rows.sessions.length, 1);
  assert.doesNotMatch(JSON.stringify(h.db.rows("telemetry_events")), /@|PRIVATE_TEXT|email|jwt/);
  assert.equal(h.providerCalls.length, 0); assert.deepEqual(h.blocked, []);
});

test("concurrent actual Home and routes preserve authenticated actor/request scope", async t => {
  const h = await startHarness({ syntheticOnly: true, enabled: true }); t.after(() => h.close());
  const emails = ["browser-a@synthetic.invalid", "browser-b@synthetic.invalid"];
  const tokens = await Promise.all(emails.map(email => h.token({ email })));
  const pages = await Promise.all(tokens.map(token => h.fetch(h.origin, { headers: { "cf-access-jwt-assertion": token } }).then(r => r.text())));
  for (let i = 0; i < 2; i++) { assert.ok(pages[i].includes(emails[i])); assert.ok(!pages[i].includes(emails[1-i])); }
  assert.deepEqual(count(h), [0, 0, 0]);
  const contexts = await Promise.all(tokens.map(token => h.request("/api/telemetry/context", { token, body: start() }).then(r => r.json())));
  const batches = contexts.map(context => ({ context: context.context, sent_elapsed_ms: 0, events: [{ schema_version: 1, measurement_version: "pilot-v1", source: "client", event_id: crypto.randomUUID(), event_name: "workflow_started", session_id: context.session_id, tab_id: context.tab_id, workflow_id: crypto.randomUUID(), client_seq: 0, elapsed_ms: 0, payload: { phase: "F1" } }] }));
  const responses = await Promise.all(tokens.map((token, i) => h.request("/api/telemetry/events", { token, body: batches[i] })));
  assert.ok(responses.every(r => r.status === 200)); assert.deepEqual(count(h), [2, 2, 0]);
  for (let i = 0; i < 2; i++) assert.equal((await h.request("/api/telemetry/events", { token: tokens[i], body: batches[1-i] })).status, 400);
  assert.deepEqual(count(h), [2, 2, 0]);
  assert.equal(new Set(h.db.rows("telemetry_sessions").map(s => s.participant_id)).size, 2);
});
