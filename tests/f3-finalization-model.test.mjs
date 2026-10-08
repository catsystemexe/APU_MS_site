import assert from "node:assert/strict";
import test from "node:test";
import { createF2ToF3Snapshot, DEFAULT_POZOROVAT_BUILD_CONFIG, DEFAULT_VYTVORIT_BUILD_CONFIG, deriveRequiredCurrentRozborComponents } from "../app/f2-build-model.ts";
import { acceptF3Render, adoptF2Snapshot, createF3RenderRequest, createF3State, hasNewerF2Snapshot, markF3SourceStale, parseF3RenderResult, updateF3Config } from "../app/f3-finalization-model.ts";

const hypothesis = (title = "Hypotéza") => ({ id: "h1", rank: 1, title, summary: "Význam", relevantNeeds: [], question: null, supportingInformation: [], limitations: ["pracovní vysvětlení"], unknowns: [], questions: [] });
const observationContent = {
  purpose: "Rozlišit pracovní hypotézy.",
  indicators: [{ indicator: "čas do odchodu", observableAs: "počet minut", situation: "ranní kruh", supportSignal: "čas se prodlouží", weakeningSignal: "čas se nezmění", supportsHypothesisIds: ["h1"], weakensHypothesisIds: [], doesNotDiscriminateWhen: "podmínky jsou stejné", limitations: ["jedno pozorování nestačí"] }],
  limitations: ["nejde o diagnózu"],
};
const creationContent = {
  candidateApproaches: [{ title: "Aktivní role", description: "Krátká předem známá role.", hypothesisIds: ["h1"], limitations: ["preference není ověřena"] }],
  workingApproach: { title: "Krátký kruh s aktivní rolí", rationale: "Navazuje na aktuální Rozbor.", hypothesisIds: ["h1"], limitations: ["vyžaduje ověření"] },
};

function snapshot(revision = 1, path = "POCHOPIT") {
  const need = { needId: "n1", needText: `Porozumět zahájení ${revision}`, initialF2Path: path, f3Target: path === "POZOROVAT" ? "pozorovací plán" : path === "VYTVOŘIT" ? "praktický postup" : null };
  const hypotheses = [hypothesis(`Hypotéza ${revision}`)];
  const config = path === "POZOROVAT" ? { ...DEFAULT_POZOROVAT_BUILD_CONFIG, keyIndicators: true }
    : path === "VYTVOŘIT" ? { ...DEFAULT_VYTVORIT_BUILD_CONFIG, candidateApproaches: true }
      : { expansionDepth: 0, compareHypotheses: false, expertFrame: false };
  const required = deriveRequiredCurrentRozborComponents(path, need, hypotheses, config);
  const components = required.map((spec) => ({ ...spec, content: spec.kind === "observation-indicators" ? observationContent : creationContent }));
  return createF2ToF3Snapshot(path, need, hypotheses, config, components);
}

const material = { kind: "material", title: "Výstup", introduction: "Úvod", sections: [{ heading: "Postup", content: "Obsah" }], table: null, cards: [], usageNote: "Zachovat omezení." };
const boundary = { kind: "boundary_issue", reason: "Chybí věcné rozhodnutí", affectedArea: "přístup", suggestedReturnToF2: "Doplňte přístup" };

test("F3 remains immutably bound to one current-Rozbor snapshot until explicit adoption", () => {
  const a = snapshot(1);
  const sameSource = snapshot(1);
  const b = snapshot(2);
  let state = createF3State(a);
  a.canonicalNeed.needText = "mutace";
  assert.equal(state.sourceSnapshot.canonicalNeed.needText, "Porozumět zahájení 1");
  assert.equal(hasNewerF2Snapshot(state, sameSource), false);
  assert.equal(hasNewerF2Snapshot(state, b), true);
  state = adoptF2Snapshot(state, b);
  assert.equal(state.sourceSnapshotRevision, b.sourceRevision);
  assert.equal(state.sourceOutdated, false);
});

test("format controls stale only the render and preserve substantive source", () => {
  let state = createF3State(snapshot());
  const substantive = structuredClone(state.sourceSnapshot);
  state = acceptF3Render(state, material, createF3RenderRequest(state));
  state = updateF3Config(state, { audience: "parent", languageStyle: "accessible", lengthDetail: "detailed", structureMode: "text" });
  assert.deepEqual(state.sourceSnapshot, substantive);
  assert.equal(state.finalRender.content.title, "Výstup");
  assert.equal(state.finalRender.status, "stale");
  assert.equal(state.finalRender.staleReason, "configuration");
});

test("source change preserves prior Output, marks it stale, and requires explicit adoption", () => {
  const newer = snapshot(2, "POZOROVAT");
  let state = createF3State(snapshot(1));
  state = acceptF3Render(state, material, createF3RenderRequest(state));
  state = markF3SourceStale(state, newer.sourceFingerprint);
  assert.equal(state.finalRender.content.title, "Výstup");
  assert.equal(state.finalRender.status, "stale");
  assert.equal(state.finalRender.staleReason, "source");
  assert.equal(state.sourceOutdated, true);
  state = adoptF2Snapshot(state, newer);
  assert.equal(state.sourceSnapshot.activePath, "POZOROVAT");
  assert.equal(state.finalRender.content.title, "Výstup");
  assert.equal(state.sourceOutdated, false);
  state = acceptF3Render(state, { ...material, title: "Nový" }, createF3RenderRequest(state));
  assert.equal(state.finalRender.status, "current");
  assert.equal(state.finalRender.content.title, "Nový");
});

test("failed or malformed regeneration preserves the previous successful render", () => {
  let state = createF3State(snapshot());
  const request = createF3RenderRequest(state);
  state = acceptF3Render(state, material, request);
  for (const invalid of [{}, { kind: "unknown" }, { kind: "material", title: "neúplné" }, { kind: "boundary_issue", reason: "neúplné" }]) assert.throws(() => acceptF3Render(state, invalid, request), /neplatný F3/);
  assert.equal(state.finalRender.content.title, "Výstup");
});

test("stale in-flight responses are ignored after source or configuration changes", () => {
  let state = createF3State(snapshot());
  const initialRequest = createF3RenderRequest(state);
  state = acceptF3Render(state, material, initialRequest);
  state = markF3SourceStale(state, snapshot(2).sourceFingerprint);
  state = acceptF3Render(state, { ...material, title: "Pozdní zdroj" }, initialRequest);
  assert.equal(state.finalRender.content.title, "Výstup");

  const newer = snapshot(2);
  state = adoptF2Snapshot(state, newer);
  const adoptedRequest = createF3RenderRequest(state);
  state = updateF3Config(state, { audience: "parent" });
  state = acceptF3Render(state, { ...material, title: "Pozdní konfigurace" }, adoptedRequest);
  assert.equal(state.finalRender.content.title, "Výstup");
});

test("F3 accepts valid material and boundary issues and rejects malformed results", () => {
  assert.deepEqual(parseF3RenderResult(material), material);
  assert.deepEqual(parseF3RenderResult(boundary), boundary);
  let state = createF3State(snapshot(1, "VYTVOŘIT"));
  state = acceptF3Render(state, boundary, createF3RenderRequest(state));
  assert.equal(state.finalRender.content.kind, "boundary_issue");
  assert.throws(() => parseF3RenderResult({ kind: "material", title: "neúplné" }), /neplatný F3/);
});
