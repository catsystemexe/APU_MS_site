import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { activeNeedRoutingKey, bindNeedRoutingDecision, createNeedRouter, NEED_ROUTING_INSTRUCTIONS, NEED_ROUTING_SCHEMA, parseNeedRoutingDecision } from "../app/f2-need-routing.ts";
import { DEV_TEST_SCENARIOS } from "../app/dev-test-scenarios.ts";
import { applyCandidates, EMPTY_NOTEPAD, getF1ToF2NeedContract } from "../app/notepad-model.ts";
import { createF2BuildState, createF2BuildRequest } from "../app/f2-build-model.ts";

const expectedPaths = ["POCHOPIT", "POCHOPIT", "POCHOPIT", "POZOROVAT", "POZOROVAT", "POZOROVAT", "VYTVOŘIT", "VYTVOŘIT", "VYTVOŘIT"];
const mixedNeeds = [
  ["Vytvoř pozorovací tabulku, abych získala údaje rozlišující možná vysvětlení.", "POZOROVAT"],
  ["Vytvoř vysvětlující přehled možných příčin z toho, co už víme.", "POCHOPIT"],
  ["Chci pochopit proč se to děje, ale nyní potřebuji praktický postup podpory při přechodu.", "VYTVOŘIT"],
  ["Dosud jsme sledovali reakce a zaznamenávali je. Teď chci konkrétní pedagogickou intervenci.", "VYTVOŘIT"],
  ["Připrav plán cíleného pozorování, abychom lépe pochopili, která hypotéza odpovídá novým datům.", "POZOROVAT"],
];

// These fixtures verify transport/contract integration, not live-model accuracy.
for (const [index, scenario] of DEV_TEST_SCENARIOS.entries()) {
  test(`mocked semantic decision binds canonical development need ${scenario.label} to ${expectedPaths[index]}`, async () => {
    const needText = scenario.text.slice(scenario.text.lastIndexOf("Potřebuji"));
    const applied = applyCandidates(structuredClone(EMPTY_NOTEPAD), "m1", [{ category: "goals", sourceQuote: needText, notebookText: needText, action: "add", relatedEntryId: null, reason: null, start: 0, end: needText.length }]);
    const source = getF1ToF2NeedContract(applied.state);
    const frozenSource = structuredClone(applied.state);
    let received;
    const route = createNeedRouter(async (input) => { received = input; return { path: expectedPaths[index], clarification: null }; });
    const decision = await route({ ...source, path: "FORBIDDEN_SCENARIO_OVERRIDE" });
    assert.deepEqual(received, { needText });
    const canonical = bindNeedRoutingDecision(source, decision);
    const build = createF2BuildState(canonical);
    assert.equal(createF2BuildRequest(build, []).activePath, expectedPaths[index]);
    assert.equal(build.initialPath, build.activePath);
    assert.deepEqual(applied.state, frozenSource);
  });
}
for (const [needText, path] of mixedNeeds) {
  test(`mixed-goal provider fixture preserves the semantic route ${path}: ${needText}`, async () => {
    const source = { needId: "n", needText, initialF2Path: "POCHOPIT", f3Target: null };
    const decision = await createNeedRouter(async () => ({ path, clarification: null }))(source);
    assert.equal(bindNeedRoutingDecision(source, decision).initialF2Path, path);
  });
}

test("semantic prompt distinguishes pedagogical outcome from verbs, format, and contextual observations", () => {
  for (const constraint of ["primárního zamýšleného pedagogického výsledku", "nikoli výskyt slov", "pozorovací tabulky", "vysvětlujícího přehledu", "Praktická intervence", "několik rovnocenných cílů", "Nenastavuj výchozí strategii"]) assert.ok(NEED_ROUTING_INSTRUCTIONS.includes(constraint), constraint);
  assert.deepEqual(NEED_ROUTING_SCHEMA.properties.path.anyOf[0].enum, ["POCHOPIT", "POZOROVAT", "VYTVOŘIT"]);
});

test("ambiguous goal has one question and cannot create an active Build", async () => {
  const source = { needId: "n", needText: "Potřebuji se v situaci posunout.", initialF2Path: "POCHOPIT", f3Target: null };
  const decision = await createNeedRouter(async () => ({ path: null, clarification: "Jaký výsledek by vám nyní nejvíce pomohl?" }))(source);
  assert.equal(bindNeedRoutingDecision(source, decision), null);
  assert.ok(decision.clarification);
});

test("invalid, hybrid and silently defaulted responses are rejected", () => {
  for (const value of [null, {}, { path: "HYBRID", clarification: null }, { path: ["POCHOPIT", "POZOROVAT"], clarification: null }, { path: null, clarification: null }, { path: "POCHOPIT", clarification: "Co chcete?" }, { path: null, clarification: "Zvolte POCHOPIT" }, { path: "POCHOPIT", clarification: null, extra: true }]) assert.throws(() => parseNeedRoutingDecision(value));
});

test("unchanged need shares in-flight calls and cached decisions; edits reroute and failures retry", async () => {
  let calls = 0;
  let fail = false;
  const route = createNeedRouter(async () => { calls++; if (fail) throw new Error("provider unavailable"); return { path: "POZOROVAT", clarification: null }; });
  const need = { needId: "n", needText: "Získat rozlišující evidenci" };
  assert.equal(route(need), route(need));
  await route(need);
  await route({ ...need, initialF2Path: "VYTVOŘIT", difficulty: 3 });
  assert.equal(calls, 1);
  await route({ ...need, needText: "Navrhnout pedagogickou podporu" });
  assert.equal(calls, 2);
  fail = true;
  const changed = { ...need, needText: "Jiný cíl" };
  await assert.rejects(route(changed));
  fail = false;
  await route(changed);
  assert.equal(calls, 4);
  assert.notEqual(activeNeedRoutingKey(need), activeNeedRoutingKey(changed));
});

test("runtime gates Build on semantic assignment, rejects obsolete routes, and never stores routing", async () => {
  const [client, route, notebook, ledger, collection] = await Promise.all(["app/apu-client.tsx", "app/api/need-route/route.ts", "app/notepad.tsx", "app/usage-ledger.ts", "app/model-usage-collection.ts"].map((path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")));
  assert.match(client, /needRoute\?\.key === sourceNeedKey/);
  assert.match(client, /storedF2Build\.activePath === canonicalF2Need\.initialF2Path/);
  assert.match(client, /latestSourceNeedKeyRef\.current !== key/);
  assert.match(client, /if \(!canonicalF2Need\) \{ setF2Build\(null\)/);
  assert.match(client, /unresolved-active-need/);
  assert.match(client, /submitNeedClarification/);
  for (const source of [client, notebook]) assert.doesNotMatch(source, /switchF2Path|onF2PathChange|Směr rozboru/);
  assert.match(route, /getAccessIdentity\(request.headers\)/);
  assert.match(route, /store: false/);
  assert.match(route, /parseNeedRoutingDecision\(JSON.parse\(output\)\)/);
  assert.doesNotMatch(route, /file_search|localStorage|database|D1|KV/);
  assert.ok(ledger.includes('"need_routing"'));
  assert.ok(collection.includes('"need_routing"'));
});

test("component generation and F2→F3 snapshots reject incompatible ownership", async () => {
  const { createCurrentRozborGenerationRequest, createF2ToF3Snapshot, deriveRequiredCurrentRozborComponents, isF2ToF3Snapshot, DEFAULT_POCHOPIT_BUILD_CONFIG } = await import("../app/f2-build-model.ts");
  const { createF3State, createF3RenderRequest } = await import("../app/f3-finalization-model.ts");
  const canonical = { needId: "n", needText: "Vysvětlit situaci", initialF2Path: "POCHOPIT", f3Target: null };
  const config = { ...DEFAULT_POCHOPIT_BUILD_CONFIG, compareHypotheses: true };
  const hypotheses = [{ id: "h1", rank: 1, title: "Možný vliv", summary: "Pracovní vysvětlení", relevantNeeds: [], supportingInformation: [], limitations: [], unknowns: [], question: null, questions: [] }];
  const specs = deriveRequiredCurrentRozborComponents("POCHOPIT", canonical, hypotheses, config);
  const state = { config, components: specs.map((spec) => ({ ...spec, content: "Syntéza s přetrvávající nejistotou.", generatedAt: "2026-10-12T00:00:00Z" })) };
  const snapshot = createF2ToF3Snapshot(canonical, hypotheses, "POCHOPIT", state, 0);
  assert.equal(isF2ToF3Snapshot(snapshot), true);
  assert.equal(createF3RenderRequest(createF3State(snapshot)).sourceSnapshot.activePath, "POCHOPIT");
  for (const path of ["POZOROVAT", "VYTVOŘIT"]) {
    assert.throws(() => createCurrentRozborGenerationRequest(path, canonical, [], config, []), /Strategie/);
    assert.throws(() => createF2ToF3Snapshot(canonical, hypotheses, path, state, 0), /Strategie/);
    assert.equal(isF2ToF3Snapshot({ ...snapshot, activePath: path }), false);
    assert.equal(isF2ToF3Snapshot({ ...snapshot, canonicalNeed: { ...canonical, initialF2Path: path } }), false);
  }
});
