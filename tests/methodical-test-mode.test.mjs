import assert from "node:assert/strict";
import test from "node:test";
import { getRuntimeMode } from "../app/runtime-mode.ts";
import { createMethodicalTestSession, createVersionTapActivation, isTestPanelShortcut } from "../app/methodical-test-session.ts";

test("runtime privilege requires explicit DEV, independently of NODE_ENV", t => {
  const saved = { NODE_ENV: process.env.NODE_ENV, APU_RUNTIME_MODE: process.env.APU_RUNTIME_MODE };
  t.after(() => { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  process.env.NODE_ENV = "development";
  process.env.APU_RUNTIME_MODE = "";
  for (const value of [undefined, "", "dev", "development", "PUBLIC", "preview", " DEV "]) assert.equal(getRuntimeMode(value), "PUBLIC");
  assert.equal(getRuntimeMode("DEV"), "DEV");
  process.env.NODE_ENV = "production";
  assert.equal(getRuntimeMode("DEV"), "DEV");
});

test("shortcut requires all three modifiers, accepts key case, ignores repeat/meta", () => {
  const key = { key: "T", ctrlKey: true, altKey: true, shiftKey: true, metaKey: false, repeat: false };
  assert.equal(isTestPanelShortcut(key), true);
  assert.equal(isTestPanelShortcut({ ...key, key: "t" }), true);
  for (const field of ["ctrlKey", "altKey", "shiftKey"]) assert.equal(isTestPanelShortcut({ ...key, [field]: false }), false);
  for (const field of ["metaKey", "repeat"]) assert.equal(isTestPanelShortcut({ ...key, [field]: true }), false);
  assert.equal(isTestPanelShortcut({ ...key, key: "X" }), false);
});

test("seven version taps use a rolling five-second window and reset after activation", () => {
  const tap = createVersionTapActivation();
  for (const time of [0, 800, 1600, 2400, 3200, 4000]) assert.equal(tap(time), false);
  assert.equal(tap(5000), true);
  assert.equal(tap(5001), false);
  const slow = createVersionTapActivation();
  for (const time of [0, 1000, 2000, 3000, 4000, 5000, 6000]) assert.equal(slow(time), false);
  assert.equal(slow(6001), false);
  assert.equal(slow(6002), true, "old taps expire without losing a valid rolling sequence");
});

test("integration seam keeps activation neutral and insertion monotonic, with no content fields", () => {
  const events = [];
  const session = createMethodicalTestSession("synthetic-session", event => events.push(event));
  session.panelActivated("keyboard");
  assert.equal(session.attribution().test_mode, false);
  session.panelActivated("version-taps");
  assert.equal(session.attribution().test_mode, false);
  session.scenarioInserted("pochopit-1");
  session.panelActivated("dev-button");
  session.scenarioInserted("pozorovat-2");
  assert.equal(session.attribution().test_mode, true);
  assert.deepEqual(events.map(event => event.test_mode), [false, false, true, true, true]);
  assert.deepEqual(events[2], { session_id: "synthetic-session", test_mode: true, event: "test_scenario_inserted", scenario_id: "pochopit-1" });
  for (const event of events) assert.deepEqual(Object.keys(event).sort(), ["event", "session_id", "test_mode", event.event === "test_panel_activated" ? "source" : "scenario_id"].sort());
  const precedingEvents = [{ session_id: "synthetic-session", event: "earlier" }, { session_id: "ordinary-session", event: "earlier" }];
  const excludedSessions = new Set(events.filter(event => event.test_mode).map(event => event.session_id));
  assert.equal(precedingEvents.filter(event => !excludedSessions.has(event.session_id)).length, 1);
  assert.equal(createMethodicalTestSession("new-session").attribution().test_mode, false);
});

test("absent or failing telemetry sink never changes insertion behavior", () => {
  const session = createMethodicalTestSession("synthetic", () => { throw Error("sink unavailable"); });
  assert.doesNotThrow(() => session.panelActivated("keyboard"));
  assert.doesNotThrow(() => session.scenarioInserted("pochopit-1"));
  assert.equal(session.attribution().test_mode, true);
  assert.doesNotThrow(() => createMethodicalTestSession("no-sink").scenarioInserted("pochopit-1"));
});
