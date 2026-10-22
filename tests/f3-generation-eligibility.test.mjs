import assert from "node:assert/strict";
import test from "node:test";
import { createCurrentRozborState, createF2ToF3Snapshot } from "../app/f2-build-model.ts";
import { DEFAULT_F3_CONFIG, acceptF3Render, adoptF2Snapshot, createF3RenderRequest, createF3State, f3GenerationEligibility, markF3SourceStale, resetF3Presentation, updateF3Config } from "../app/f3-finalization-model.ts";

const hypothesis = { id: "h1", rank: 1, title: "Hypotéza", summary: "Pracovní vysvětlení", relevantNeeds: [], supportingInformation: [], limitations: [], unknowns: [], question: null, questions: [] };
const snapshot = (path = "POCHOPIT", revision = 0, summary = hypothesis.summary) => createF2ToF3Snapshot({ needId: "n1", needText: "Potřeba", initialF2Path: path, f3Target: null }, [{ ...hypothesis, summary }], path, createCurrentRozborState()[path], revision);
const material = { kind: "material", title: "Přijatá podoba", introduction: "Zdrojový obsah", sections: [{ heading: "Část", content: "Pracovní obsah" }], table: null, cards: [{ title: "Karta", content: "Původní" }], usageNote: null };

test("initial default is ineligible; every meaningful setting change enables explicit generation and reversion disables it", () => {
  for (const change of [{ audience: "parent" }, { languageStyle: "professional" }, { lengthDetail: "detailed" }, { structureMode: "cards" }]) {
    const initial = createF3State(snapshot());
    assert.deepEqual(f3GenerationEligibility(initial), { enabled: false, reason: "default" });
    const changed = updateF3Config(initial, change);
    assert.deepEqual(f3GenerationEligibility(changed), { enabled: true, reason: "configuration" });
    const reverted = updateF3Config(changed, DEFAULT_F3_CONFIG);
    assert.ok(reverted.configRevision > 0);
    assert.deepEqual(f3GenerationEligibility(reverted), { enabled: false, reason: "default" });
    assert.equal(reverted.sourceSnapshot, initial.sourceSnapshot);
    assert.equal(reverted.finalRender, null);
  }
});

test("retained material carries actual request provenance; change and reversion restore freshness without losing the monotonic guard", () => {
  let state = updateF3Config(createF3State(snapshot()), { audience: "parent", structureMode: "cards" });
  const request = createF3RenderRequest(state);
  state = acceptF3Render(state, material, request);
  assert.deepEqual(state.finalRender.config, request.config);
  assert.equal(state.finalRender.sourceFingerprint, request.sourceFingerprint);
  assert.equal(state.finalRender.sourceSnapshotId, request.sourceSnapshotId);
  assert.notEqual(state.finalRender.config, request.config);
  request.config.audience = "internal";
  assert.equal(state.finalRender.config.audience, "parent");
  assert.deepEqual(f3GenerationEligibility(state), { enabled: false, reason: "current" });
  const inFlight = createF3RenderRequest(state);
  const changed = updateF3Config(state, { audience: "teacher" });
  assert.equal(changed.finalRender.status, "stale");
  assert.equal(f3GenerationEligibility(changed).enabled, true);
  const reverted = updateF3Config(changed, { audience: "parent" });
  assert.equal(reverted.finalRender.status, "current");
  assert.equal(reverted.finalRender.staleReason, null);
  assert.equal(reverted.configRevision, state.configRevision + 2);
  assert.deepEqual(f3GenerationEligibility(reverted), { enabled: false, reason: "current" });
  assert.equal(acceptF3Render(reverted, { ...material, title: "Obsolete result" }, inFlight), reverted);
  assert.equal(reverted.finalRender.content.title, material.title);
});

test("accepted new source enables regeneration only when material exists or settings differ from defaults", () => {
  const s0 = snapshot(); const s1 = snapshot("POCHOPIT", 1, "Nově přijatá hypotéza");
  const initial = createF3State(s0);
  assert.deepEqual(f3GenerationEligibility(adoptF2Snapshot(initial, s1)), { enabled: false, reason: "default" });
  const generated = acceptF3Render(initial, material, createF3RenderRequest(initial));
  const adopted = adoptF2Snapshot(generated, s1);
  assert.deepEqual(f3GenerationEligibility(adopted), { enabled: true, reason: "source" });
  assert.equal(adopted.representation, "analysis");
  assert.equal(adopted.finalRender.status, "stale");
  assert.equal(adopted.finalRender.sourceSnapshotId, s0.snapshotId);
  const cycled = updateF3Config(updateF3Config(adopted, { audience: "parent" }), DEFAULT_F3_CONFIG);
  assert.equal(cycled.finalRender.status, "stale");
  assert.equal(cycled.finalRender.staleReason, "source");
  assert.equal(f3GenerationEligibility(cycled).enabled, true);
  const refreshed = acceptF3Render(cycled, material, createF3RenderRequest(cycled));
  assert.deepEqual(f3GenerationEligibility(refreshed), { enabled: false, reason: "current" });
});

test("source readiness, loading and explicit-adoption protection remain authoritative", () => {
  assert.deepEqual(f3GenerationEligibility(null), { enabled: false, reason: "unavailable" });
  const available = updateF3Config(createF3State(snapshot()), { audience: "parent" });
  assert.deepEqual(f3GenerationEligibility(available, true), { enabled: false, reason: "loading" });
  const stale = markF3SourceStale(available, snapshot("POCHOPIT", 1, "Upstream change").sourceFingerprint);
  assert.deepEqual(f3GenerationEligibility(stale), { enabled: false, reason: "adoption" });
  for (const path of ["POZOROVAT", "VYTVOŘIT"]) {
    const specialized = updateF3Config(createF3State(snapshot(path)), { structureMode: "cards" });
    assert.deepEqual(f3GenerationEligibility(specialized), { enabled: false, reason: "prerequisites" });
    assert.throws(() => createF3RenderRequest(specialized));
  }
});

test("boundary feedback is not a successfully materialized document; nondefault settings can retry", () => {
  const changed = updateF3Config(createF3State(snapshot()), { structureMode: "cards" });
  const boundary = acceptF3Render(changed, { kind: "boundary_issue", reason: "Vyžaduje Rozbor", affectedArea: "Potřeba", suggestedReturnToF2: "Build" }, createF3RenderRequest(changed));
  assert.deepEqual(f3GenerationEligibility(boundary), { enabled: true, reason: "configuration" });
});

test("Reset is a pure no-op at defaults and preserves source/provenance when restoring presentation", () => {
  const initial = createF3State(snapshot());
  assert.equal(resetF3Presentation(initial), initial);
  const configured = updateF3Config(initial, { audience: "parent", structureMode: "cards" });
  const generated = acceptF3Render(configured, material, createF3RenderRequest(configured));
  const before = JSON.stringify(generated);
  const reset = resetF3Presentation(generated);
  assert.equal(reset.representation, "analysis");
  assert.deepEqual(reset.config, DEFAULT_F3_CONFIG);
  assert.equal(reset.configRevision, generated.configRevision + 1);
  assert.equal(reset.sourceSnapshot, generated.sourceSnapshot);
  assert.equal(reset.sourceStatus, generated.sourceStatus);
  assert.equal(reset.observedSourceFingerprint, generated.observedSourceFingerprint);
  assert.deepEqual(reset.finalRender.content, generated.finalRender.content);
  assert.deepEqual(reset.finalRender.config, generated.finalRender.config);
  assert.equal(reset.finalRender.sourceSnapshotId, generated.finalRender.sourceSnapshotId);
  assert.equal(reset.finalRender.sourceFingerprint, generated.finalRender.sourceFingerprint);
  assert.equal(reset.finalRender.status, "stale");
  assert.equal(f3GenerationEligibility(reset).enabled, true);
  assert.equal(resetF3Presentation(reset), reset);
  assert.equal(JSON.stringify(generated), before);
  const restored = updateF3Config(reset, generated.finalRender.config);
  assert.equal(restored.finalRender.status, "current");
  assert.equal(f3GenerationEligibility(restored).enabled, false);
});

test("Reset keeps protected upstream sources stale and never adopts them", () => {
  const old = snapshot(); const newer = snapshot("POCHOPIT", 1, "Upstream revision");
  const configured = updateF3Config(createF3State(old), { audience: "parent" });
  const generated = acceptF3Render(configured, material, createF3RenderRequest(configured));
  const stale = markF3SourceStale(generated, newer.sourceFingerprint);
  const reset = resetF3Presentation(stale);
  assert.equal(reset.sourceSnapshotId, old.snapshotId);
  assert.equal(reset.sourceSnapshot, stale.sourceSnapshot);
  assert.equal(reset.observedSourceFingerprint, newer.sourceFingerprint);
  assert.equal(reset.sourceStatus, "stale");
  assert.equal(reset.finalRender.staleReason, "source");
  assert.equal(f3GenerationEligibility(reset).reason, "adoption");
});

test("Reset of material generated with default settings changes only the visible representation", () => {
  const initial = createF3State(snapshot());
  const generated = acceptF3Render(initial, material, createF3RenderRequest(initial));
  const reset = resetF3Presentation(generated);
  assert.equal(reset.representation, "analysis");
  assert.equal(reset.configRevision, generated.configRevision);
  assert.equal(reset.sourceSnapshot, generated.sourceSnapshot);
  assert.equal(reset.finalRender, generated.finalRender);
  assert.equal(reset.finalRender.status, "current");
  assert.deepEqual(f3GenerationEligibility(reset), { enabled: false, reason: "current" });
});
