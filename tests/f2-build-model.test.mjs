import assert from "node:assert/strict";
import test from "node:test";
import { acceptRenderedPreview, addF2Context, applyPochopitBuildResult, createF2BuildState, createF2PreviewSnapshot, createPochopitBuildRequest, F2_SKILL_DEFINITIONS, parameterizeF2Skill, previewStatus, reconcileF2Hypotheses, switchF2Path, toggleF2Skill } from "../app/f2-build-model.ts";

const need = (path = "POCHOPIT") => ({ needId: `need-${path}`, needText: `Potřeba ${path}`, initialF2Path: path, f3Target: "přehled" });
const hypothesis = (id, title = id) => ({ id, rank: 1, title, summary: `Shrnutí ${title}`, relevantNeeds: ["need-POCHOPIT"], question: null, supportingInformation: [], limitations: [], unknowns: [], questions: [] });
const analytical = { relationships: [], comparisons: [], expertFrame: [], synthesis: "Současný obraz", decisions: ["Závěr"], uncertainties: [{ missing: "Průběh v čase", importance: "Rozliší stabilní a situační obraz.", limitation: "Omezuje závěr o stabilitě." }] };

test("canonical F1 mapping initializes all paths without changing F3 target", () => {
  for (const path of ["POCHOPIT", "POZOROVAT", "VYTVOŘIT"]) { const build = createF2BuildState(need(path)); assert.equal(build.initialPath, path); assert.equal(build.activePath, path); assert.equal(build.f3Target, "přehled"); }
});

test("POCHOPIT request contains only active composable skills and parameters", () => {
  let build = createF2BuildState(need(), [], [hypothesis("h1")]);
  build = toggleF2Skill(build, "pochopit-1"); build = toggleF2Skill(build, "pochopit-4"); build = parameterizeF2Skill(build, "pochopit-4", "Exekutivní funkce a věk");
  const request = createPochopitBuildRequest(build, [{ category: "manifestations", text: "Obtížný začátek úkolu" }]);
  assert.deepEqual(request.activeSkills.map((item) => item.id), ["pochopit-1", "pochopit-4"]);
  assert.equal(request.activeSkills[1].parameterText, "Exekutivní funkce a věk");
  assert.equal(request.canonicalNeed.needText, "Potřeba POCHOPIT");
});

test("route guard prevents POZOROVAT and VYTVOŘIT from using POCHOPIT executor", () => {
  for (const path of ["POZOROVAT", "VYTVOŘIT"]) assert.throws(() => createPochopitBuildRequest(toggleF2Skill(createF2BuildState(need(path)), `${path.toLowerCase()}-1`), []), /pouze pro cestu POCHOPIT/);
});

test("hypothesis reconciliation preserves stable IDs and tolerates added and removed hypotheses", () => {
  const result = reconcileF2Hypotheses([hypothesis("stable"), hypothesis("removed")], [hypothesis("stable", "Aktualizovaná"), hypothesis("new", "Nová")]);
  assert.deepEqual(result.map((item) => item.id), ["stable", "new"]); assert.equal(result[0].rank, 1); assert.equal(result[1].rank, 2);
});

test("model update changes only derived build state and marks the exact revision processed", () => {
  const canonical = need(); let build = toggleF2Skill(createF2BuildState(canonical, [], [hypothesis("old")]), "pochopit-5"); const revision = build.buildRevision;
  build = applyPochopitBuildResult(build, { hypotheses: [hypothesis("new")], analytical }, revision);
  assert.deepEqual(canonical, need()); assert.equal(build.canonicalNeed.needText, canonical.needText); assert.equal(build.processedRevision, revision); assert.equal(build.analytical.uncertainties[0].limitation, "Omezuje závěr o stabilitě.");
});

test("local edits are pure and create unapplied state without any model side effect", () => {
  let calls = 0; const model = () => calls++; let build = toggleF2Skill(createF2BuildState(need()), "pochopit-1"); build = parameterizeF2Skill(build, "pochopit-1", "zaměření"); build = addF2Context(build, { id: "c1", text: "Dítěti je pět let" });
  assert.equal(calls, 0); model(createPochopitBuildRequest(build, [])); assert.equal(calls, 1);
});

test("preview snapshot is isolated, becomes stale after edit, and refresh failure preserves success", () => {
  let build = toggleF2Skill(createF2BuildState(need(), [], [hypothesis("h1")]), "pochopit-1"); build = applyPochopitBuildResult(build, { hypotheses: [hypothesis("h1")], analytical }, build.buildRevision);
  const snapshot = createF2PreviewSnapshot(build); let preview = acceptRenderedPreview(snapshot, { title: "Náhled N", introduction: "Úvod", sections: [] });
  build = addF2Context(build, { id: "later", text: "Pozdější změna" });
  assert.equal(snapshot.addedContext.length, 0); preview = previewStatus(preview, build); assert.equal(preview.status, "stale"); assert.equal(preview.render.title, "Náhled N");
  const failedRefreshLeaves = preview; assert.strictEqual(failedRefreshLeaves, preview);
  build = applyPochopitBuildResult(build, { hypotheses: [hypothesis("h1")], analytical }, build.buildRevision);
  const next = createF2PreviewSnapshot(build); preview = acceptRenderedPreview(next, { title: "Náhled N+1", introduction: "Úvod", sections: [] }); assert.equal(preview.status, "current"); assert.equal(preview.sourceBuildRevision, snapshot.buildRevision + 1);
});

test("other path shells retain five independently editable skills", () => {
  for (const path of ["POCHOPIT", "POZOROVAT", "VYTVOŘIT"]) assert.equal(F2_SKILL_DEFINITIONS.filter((skill) => skill.path === path).length, 5);
  const switched = switchF2Path(createF2BuildState(need()), "VYTVOŘIT"); assert.equal(switched.initialPath, "POCHOPIT"); assert.equal(switched.activePath, "VYTVOŘIT");
});
