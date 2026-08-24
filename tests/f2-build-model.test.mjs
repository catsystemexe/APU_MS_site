import assert from "node:assert/strict";
import test from "node:test";
import { acceptRenderedPreview, addF2Context, applyF2BuildResult, createF2BuildRequest, createF2BuildState, createF2PreviewSnapshot, F2_SKILL_DEFINITIONS, parameterizeF2Skill, previewStatus, switchF2Path, toggleF2Skill } from "../app/f2-build-model.ts";

const need = (path = "POCHOPIT", target = "přehled") => ({ needId: `need-${path}`, needText: `Potřeba ${path}`, initialF2Path: path, f3Target: target });
const hypothesis = (id, title = id) => ({ id, rank: 1, title, summary: `Shrnutí ${title}`, relevantNeeds: ["need-POCHOPIT"], question: null, supportingInformation: [], limitations: [], unknowns: [], questions: [] });
const uncertainties = [{ description: "Chybí kontext", whyRelevant: "Mění volbu", limits: "Volba je provizorní", relatedDecisionOrArea: "přístup" }];
const pathResult = {
  POCHOPIT: { kind: "understanding", relationships: ["vztah"], comparisons: [], expertFrame: [], synthesis: "obraz" },
  POZOROVAT: { kind: "observation", purpose: "Rozlišit hypotézy", observableIndicators: [{ indicator: "zahájení do 30 s", interpretation: "může souviset s mírou podpory" }], situations: ["známý úkol"], comparisonConditions: ["s podporou vs bez podpory"], scope: "tři různé situace", evidenceMethod: ["čas a kontext"], hypothesisLinks: ["h1 může podpořit i oslabit"], limitations: ["pozorování neurčí vnitřní stav"] },
  VYTVOŘIT: { kind: "creation", pedagogicalObjective: "podpořit samostatné zahájení úkolu", candidateApproaches: ["vizuální podpora"], variantComparison: ["kratší podpora je méně zatěžující"], workingApproach: "podmíněná vizuální opora", conditions: ["pokud dítě rozumí symbolům"], whatToVerify: ["samostatné zahájení, nejen použití karty"], relevantHypotheses: ["h1"], limitations: ["úroveň porozumění není známa"] },
};
const result = (path) => ({ hypotheses: [hypothesis("h1")], pathResult: pathResult[path], decisions: ["pracovní rozhodnutí"], uncertainties, missingInformation: ["úroveň podpory"] });
const configured = (path, target) => toggleF2Skill(createF2BuildState(need(path, target), [], [hypothesis("h1")]), `${path.toLowerCase()}-1`);

test("canonical F1 mapping initializes all paths and keeps F3 target separate", () => {
  for (const path of ["POCHOPIT", "POZOROVAT", "VYTVOŘIT"]) { const build = createF2BuildState(need(path)); assert.equal(build.initialPath, path); assert.equal(build.activePath, path); assert.equal(build.f3Target, "přehled"); }
});

test("explicit activePath routes the shared request and serializes only active path skills with parameters", () => {
  for (const path of ["POCHOPIT", "POZOROVAT", "VYTVOŘIT"]) {
    let build = configured(path); build = toggleF2Skill(build, `${path.toLowerCase()}-3`); build = parameterizeF2Skill(build, `${path.toLowerCase()}-3`, `parametr ${path}`);
    const request = createF2BuildRequest(build, [{ category: "manifestations", text: "Obtížný začátek" }]);
    assert.equal(request.kind, "f2-build"); assert.equal(request.activePath, path); assert.deepEqual(request.activeSkills.map((item) => item.id), [`${path.toLowerCase()}-1`, `${path.toLowerCase()}-3`]); assert.equal(request.skillParameters[`${path.toLowerCase()}-3`], `parametr ${path}`);
  }
});

test("POZOROVAT response distinguishes observable evidence, interpretation and comparison", () => {
  let build = configured("POZOROVAT", "týdenní pozorovací tabulka"); const revision = build.buildRevision; const canonical = structuredClone(build.canonicalNeed);
  build = applyF2BuildResult(build, result("POZOROVAT"), "POZOROVAT", revision);
  const observation = build.processedBuilds.POZOROVAT.pathResult; assert.equal(observation.kind, "observation"); assert.notEqual(observation.observableIndicators[0].indicator, observation.observableIndicators[0].interpretation); assert.match(observation.comparisonConditions[0], /vs/); assert.deepEqual(build.canonicalNeed, canonical); assert.equal(observation.purpose.includes("tabulka"), false);
});

test("VYTVOŘIT keeps pedagogical objective distinct from F3 artifact and localizes provisional uncertainty", () => {
  let build = configured("VYTVOŘIT", "pracovní karty"); build = applyF2BuildResult(build, result("VYTVOŘIT"), "VYTVOŘIT", build.buildRevision);
  const creation = build.processedBuilds.VYTVOŘIT.pathResult; assert.equal(creation.kind, "creation"); assert.notEqual(creation.pedagogicalObjective, build.f3Target); assert.match(creation.conditions[0], /pokud/i); assert.equal(build.processedBuilds.VYTVOŘIT.uncertainties[0].relatedDecisionOrArea, "přístup"); assert.equal(JSON.stringify(creation).includes("grafická sazba"), false);
});

test("cross-path switching preserves hypotheses and each path's local skill configuration without calls", () => {
  let calls = 0; let build = configured("POCHOPIT"); build = applyF2BuildResult(build, result("POCHOPIT"), "POCHOPIT", build.buildRevision); build = switchF2Path(build, "POZOROVAT"); build = toggleF2Skill(build, "pozorovat-2"); build = switchF2Path(build, "VYTVOŘIT");
  assert.equal(calls, 0); assert.equal(build.workingHypotheses[0].id, "h1"); assert.equal(build.skills.find((skill) => skill.id === "pozorovat-2").active, true); assert.equal(build.canonicalNeed.initialF2Path, "POCHOPIT");
  calls++; assert.equal(calls, 1);
});

test("local skill, parameter and context edits never execute a model and mark processed state stale", () => {
  let calls = 0; let build = configured("POCHOPIT"); build = applyF2BuildResult(build, result("POCHOPIT"), "POCHOPIT", build.buildRevision); const processedRevision = build.processedBuilds.POCHOPIT.processedRevision;
  build = parameterizeF2Skill(build, "pochopit-1", "zaměření"); build = addF2Context(build, { id: "c1", text: "Dítěti je pět let" }); assert.equal(calls, 0); assert.notEqual(processedRevision, build.buildRevision);
});

test("POZOROVAT and VYTVOŘIT previews use immutable explicit snapshots and remain after stale edits", () => {
  for (const path of ["POZOROVAT", "VYTVOŘIT"]) {
    let build = configured(path, path === "POZOROVAT" ? "týdenní pozorovací tabulka" : "pracovní karty"); build = applyF2BuildResult(build, result(path), path, build.buildRevision);
    const snapshot = createF2PreviewSnapshot(build); let preview = acceptRenderedPreview(snapshot, { title: `Náhled ${path}`, introduction: "Úvod", sections: [] }); build = addF2Context(build, { id: "later", text: "Pozdější změna" }); preview = previewStatus(preview, build);
    assert.equal(snapshot.activePath, path); assert.equal(snapshot.processedBuild.path, path); assert.equal(snapshot.addedContext.length, 0); assert.equal(preview.status, "stale"); assert.equal(preview.render.title, `Náhled ${path}`); assert.throws(() => createF2PreviewSnapshot(build), /Nejprve rozpracujte/);
  }
});

test("all paths retain five independently configured skills", () => { for (const path of ["POCHOPIT", "POZOROVAT", "VYTVOŘIT"]) assert.equal(F2_SKILL_DEFINITIONS.filter((skill) => skill.path === path).length, 5); });
