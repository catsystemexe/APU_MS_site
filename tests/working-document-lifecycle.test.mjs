import assert from "node:assert/strict";
import test from "node:test";
import { acceptBuildDocumentUpdate, acceptWorkingDocumentMetadata, workingDocumentCreationDate } from "../app/working-document-lifecycle.ts";
import { advanceAcceptedF2Source, createCurrentRozborState, deriveRequiredCurrentRozborComponents } from "../app/f2-build-model.ts";
import { createF3State, acceptF3Render, createF3RenderRequest, updateF3Config, markF3SourceStale } from "../app/f3-finalization-model.ts";
import { longContext, longHypotheses } from "./document-style-fixture.mjs";

const baseline = (path = "POCHOPIT") => {
  const need = { needId: "n1", needText: longContext.needAnalysis.sourceText, initialF2Path: path, f3Target: null };
  return advanceAcceptedF2Source(null, need, longHypotheses, path, createCurrentRozborState()[path], longContext);
};
const material = { kind: "material", title: "S0 cards", introduction: "Old accepted source", sections: [{ heading: "S0", content: "NEVER_AN_ANALYTICAL_SOURCE" }], table: null, cards: [{ title: "Retained card", content: "Old content" }], usageNote: null };

test("metadata requires a real acceptance time, remains stable and can start anew after reset", () => {
  const first = acceptWorkingDocumentMetadata(null, "2026-10-13T12:34:56.789Z");
  assert.equal(first.createdAt, "2026-10-13T12:34:56.789Z");
  assert.equal(acceptWorkingDocumentMetadata(first, "2026-10-14T12:00:00.000Z"), first);
  assert.equal(workingDocumentCreationDate(first), "13. 10. 2026");
  assert.equal(workingDocumentCreationDate(null), null);
  assert.equal(workingDocumentCreationDate({ createdAt: "unknown" }), null);
  assert.throws(() => acceptWorkingDocumentMetadata(null, "unknown"));
  const nextProject = acceptWorkingDocumentMetadata(null, "2026-10-14T12:00:00.000Z");
  assert.equal(workingDocumentCreationDate(nextProject), "14. 10. 2026");
});

for (const path of ["POCHOPIT", "POZOROVAT", "VYTVOŘIT"]) test(`${path}: Build acceptance advances/adopts, retains stale output/config and supports local removal`, () => {
  const s0 = baseline(path);
  let f3 = updateF3Config(createF3State(s0), { audience: "parent", lengthDetail: "detailed", structureMode: "cards" });
  // Specialized prerequisites remain covered separately; attach an already accepted
  // old representation without weakening those guards for this lifecycle test.
  const request = { sourceSnapshotId: f3.sourceSnapshotId, sourceFingerprint: s0.sourceFingerprint, f3ConfigRevision: f3.configRevision };
  f3 = acceptF3Render(f3, material, request);
  const before = JSON.stringify([s0, f3]);
  const config = { ...s0.currentRozbor.config, expansionDepth: 2 };
  const components = deriveRequiredCurrentRozborComponents(path, s0.canonicalNeed, s0.baselineHypotheses, config).map(spec => ({ ...spec, content: "New accepted expansion" }));
  const { snapshot: s1, f3: adopted } = acceptBuildDocumentUpdate(s0, f3, s0.canonicalNeed, s0.baselineHypotheses, path, { config, components }, longContext);
  assert.equal(s1.sourceRevision, 1);
  assert.equal(adopted.sourceSnapshotId, s1.snapshotId);
  assert.equal(adopted.sourceStatus, "current");
  assert.equal(adopted.representation, "analysis");
  assert.deepEqual(adopted.config, f3.config);
  assert.equal(adopted.configRevision, f3.configRevision);
  assert.deepEqual(adopted.finalRender.content, material);
  assert.equal(adopted.finalRender.sourceSnapshotId, s0.snapshotId);
  assert.equal(adopted.finalRender.status, "stale");
  assert.equal(adopted.finalRender.staleReason, "source");
  assert.ok(Object.isFrozen(adopted.sourceSnapshot));
  assert.equal(JSON.stringify([s0, f3]), before);
  const unchanged = acceptBuildDocumentUpdate(s1, adopted, s1.canonicalNeed, s1.baselineHypotheses, path, s1.currentRozbor, longContext);
  assert.equal(unchanged.snapshot, s1);
  assert.equal(unchanged.f3, adopted);
  const removed = acceptBuildDocumentUpdate(s1, adopted, s1.canonicalNeed, s1.baselineHypotheses, path, s0.currentRozbor, longContext);
  assert.equal(removed.snapshot.sourceRevision, 2);
  assert.equal(removed.f3.sourceSnapshotId, removed.snapshot.snapshotId);
  assert.equal(removed.f3.finalRender.status, "stale");
  if (path === "POCHOPIT") {
    const regeneration = createF3RenderRequest(adopted);
    assert.deepEqual(regeneration.sourceSnapshot, s1);
    assert.deepEqual(regeneration.config, f3.config);
    assert.doesNotMatch(JSON.stringify(regeneration), /NEVER_AN_ANALYTICAL_SOURCE/);
  }
});

test("upstream source changes still require adoption; invalid Build acceptance cannot mutate either state", () => {
  const s0 = baseline(); const state = createF3State(s0);
  const upstream = advanceAcceptedF2Source(s0, s0.canonicalNeed, s0.baselineHypotheses, "POCHOPIT", s0.currentRozbor, { ...longContext, mainUncertainty: "Changed outside Build" });
  const stale = markF3SourceStale(state, upstream.sourceFingerprint);
  assert.equal(stale.sourceSnapshotId, s0.snapshotId);
  assert.equal(stale.sourceStatus, "stale");
  assert.throws(() => createF3RenderRequest(stale), /přijměte/);
  const before = JSON.stringify([s0, state]);
  assert.throws(() => acceptBuildDocumentUpdate(s0, state, s0.canonicalNeed, [], "POCHOPIT", s0.currentRozbor, longContext));
  assert.equal(JSON.stringify([s0, state]), before);
});
