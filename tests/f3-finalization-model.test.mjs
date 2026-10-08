import assert from "node:assert/strict";
import test from "node:test";
import { createF2ToF3Snapshot, deriveRequiredCurrentRozborComponents } from "../app/f2-build-model.ts";
import { acceptF3Render, adoptF2Snapshot, createF3RenderRequest, createF3State, hasNewerF2Snapshot, markF3SourceStale, parseF3RenderResult, updateF3Config } from "../app/f3-finalization-model.ts";

const hypothesis = { id: "h1", rank: 1, title: "Hypotéza", summary: "Význam", relevantNeeds: [], question: null, supportingInformation: [], limitations: ["Pracovní nejistota"], unknowns: [], questions: [] };
const snapshot = (content = "Aktuální rozvinutí", revision = 1) => {
  const need = { needId: "n1", needText: "Porozumět zahájení", initialF2Path: "POCHOPIT", f3Target: "Vysvětlení pro učitele" };
  const config = { expansionDepth: 1, compareHypotheses: false, expertFrame: false };
  const components = deriveRequiredCurrentRozborComponents("POCHOPIT", need, [hypothesis], config).map((spec) => ({ ...spec, content }));
  return createF2ToF3Snapshot(need, [hypothesis], "POCHOPIT", { config, components }, revision);
};
const material = { kind: "material", title: "Výstup", introduction: "Úvod", sections: [{ heading: "Souvislosti", content: "Obsah" }], table: null, cards: [], usageNote: null };

test("F3 remains immutably bound until explicit current-Rozbor snapshot adoption", () => {
  const a = snapshot("První", 1);
  const b = snapshot("Druhý", 2);
  const mutableCopy = structuredClone(a);
  let state = createF3State(mutableCopy);
  mutableCopy.canonicalNeed.needText = "mutace";
  assert.equal(state.sourceSnapshot.canonicalNeed.needText, "Porozumět zahájení");
  assert.equal(hasNewerF2Snapshot(state, b), true);
  assert.equal(state.sourceSnapshotRevision, 1);
  state = adoptF2Snapshot(state, b);
  assert.equal(state.sourceSnapshotRevision, 2);
  assert.equal(state.sourceSnapshot.currentRozbor.components[0].content, "Druhý");
});

test("format controls are local, preserve substantive snapshot and stale one render", () => {
  let state = createF3State(snapshot());
  const substantive = structuredClone(state.sourceSnapshot);
  state = acceptF3Render(state, material, createF3RenderRequest(state));
  state = updateF3Config(state, { audience: "parent" });
  state = updateF3Config(state, { languageStyle: "accessible", lengthDetail: "detailed", structureMode: "text" });
  assert.deepEqual(state.sourceSnapshot, substantive);
  assert.equal(state.finalRender.content.title, "Výstup");
  assert.equal(state.finalRender.status, "stale");
  assert.equal(state.finalRender.staleReason, "configuration");
});

test("source change preserves output, requires explicit adoption, then permits regeneration", () => {
  const newer = snapshot("Novější Rozbor", 2);
  let state = createF3State(snapshot("Původní Rozbor", 1));
  state = acceptF3Render(state, material, createF3RenderRequest(state));
  state = markF3SourceStale(state, newer.sourceFingerprint);
  assert.equal(state.sourceStatus, "stale");
  assert.equal(state.finalRender.content.title, "Výstup");
  assert.equal(state.finalRender.staleReason, "source");
  assert.throws(() => createF3RenderRequest(state), /přijměte aktuální Rozbor/);
  state = adoptF2Snapshot(state, newer);
  assert.equal(state.sourceStatus, "current");
  assert.equal(state.finalRender.staleReason, "source");
  state = acceptF3Render(state, { ...material, title: "Nový" }, createF3RenderRequest(state));
  assert.equal(state.finalRender.status, "current");
  assert.equal(state.finalRender.content.title, "Nový");
});

test("failed or malformed regeneration preserves the previous successful render", () => {
  let state = createF3State(snapshot());
  const request = createF3RenderRequest(state);
  state = acceptF3Render(state, material, request);
  const previous = state;
  for (const invalid of [{}, { kind: "unknown" }, { kind: "material", title: "neúplné" }, { kind: "material", title: "A", introduction: "B", sections: [], table: null, cards: [], usageNote: null }]) {
    assert.throws(() => acceptF3Render(state, invalid, createF3RenderRequest(state)), /neplatný F3/);
    assert.equal(state, previous);
    assert.equal(state.finalRender.content.title, "Výstup");
  }
});

test("stale in-flight response is ignored after source or configuration changes", () => {
  let state = createF3State(snapshot());
  state = acceptF3Render(state, material, createF3RenderRequest(state));
  const sourceRequest = createF3RenderRequest(state);
  state = markF3SourceStale(state, snapshot("Změna").sourceFingerprint);
  state = acceptF3Render(state, { ...material, title: "Pozdní zdroj" }, sourceRequest);
  assert.equal(state.finalRender.content.title, "Výstup");
  state = adoptF2Snapshot(state, snapshot("Změna"));
  const configRequest = createF3RenderRequest(state);
  state = updateF3Config(state, { audience: "parent" });
  state = acceptF3Render(state, { ...material, title: "Pozdní konfigurace" }, configRequest);
  assert.equal(state.finalRender.content.title, "Výstup");
});

test("F3 accepts material and boundary issue variants", () => {
  assert.equal(parseF3RenderResult(material).kind, "material");
  assert.equal(parseF3RenderResult({ kind: "boundary_issue", reason: "Chybí volba", affectedArea: "přístup", suggestedReturnToF2: "Doplňte přístup" }).kind, "boundary_issue");
  assert.throws(() => parseF3RenderResult({ kind: "boundary_issue", reason: "", affectedArea: "přístup", suggestedReturnToF2: "Zpět" }), /neplatný F3/);
});
