import assert from "node:assert/strict";
import test from "node:test";
import { acceptRenderedPreview, addF2Context, applyF2BuildResult, createF2BuildRequest, createF2BuildState, createF2PreviewSnapshot, F2_SKILL_DEFINITIONS, parameterizeF2Skill, parseF2BuildResult, parseF2RenderedPreview, previewStatus, switchF2Path, synchronizeF2BuildWithCanonicalNeed, toggleF2Skill } from "../app/f2-build-model.ts";

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

test("late analysis hypotheses populate an already initialized empty F2 build", () => {
  const build = createF2BuildState(need(), [], []);
  const next = synchronizeF2BuildWithCanonicalNeed(build, build.canonicalNeed, [], [hypothesis("h1"), hypothesis("h2")]);
  assert.deepEqual(next.workingHypotheses.map((item) => item.id), ["h1", "h2"]);
  assert.ok(next.workingHypotheses.length > 0, "F2 editor accordion render condition is satisfied");
});

test("updated analysis hypotheses refresh an unprocessed F2 entry layer", () => {
  const build = createF2BuildState(need(), [], [hypothesis("h1")]);
  const next = synchronizeF2BuildWithCanonicalNeed(build, build.canonicalNeed, [], [hypothesis("h1"), hypothesis("h2")]);
  assert.deepEqual(next.workingHypotheses.map((item) => item.id), ["h1", "h2"]);
});

test("legacy analysis cannot overwrite hypotheses accepted from F2 processing", () => {
  let build = createF2BuildState(need(), [], [hypothesis("h1")]);
  build = applyF2BuildResult(build, { ...result("POCHOPIT"), hypotheses: [hypothesis("m", "Modelová hypotéza")] }, "POCHOPIT", build.buildRevision);
  const processedResultId = build.processedBuilds.POCHOPIT.processedResultId;
  const next = synchronizeF2BuildWithCanonicalNeed(build, build.canonicalNeed, [], [hypothesis("h1"), hypothesis("h2")]);
  assert.equal(next, build);
  assert.deepEqual(next.workingHypotheses.map((item) => item.id), ["m"]);
  assert.equal(next.processedBuilds.POCHOPIT.processedResultId, processedResultId);
});

test("same-ID canonical text, route and target changes safely reset derived F2 state without calls", () => {
  let calls = 0;
  let build = configured("POCHOPIT", "přehled");
  build = applyF2BuildResult(build, result("POCHOPIT"), "POCHOPIT", build.buildRevision);
  const oldPreview = acceptRenderedPreview(createF2PreviewSnapshot(build), { title: "Starý", introduction: "Úvod", sections: [] });
  const changes = [
    { ...build.canonicalNeed, needText: "Jiná potřeba" },
    { ...build.canonicalNeed, initialF2Path: "POZOROVAT" },
    { ...build.canonicalNeed, f3Target: null },
  ];
  for (const changedNeed of changes) {
    const next = synchronizeF2BuildWithCanonicalNeed(build, changedNeed);
    assert.deepEqual(next.canonicalNeed, changedNeed);
    assert.equal(next.initialPath, changedNeed.initialF2Path);
    assert.equal(next.activePath, changedNeed.initialF2Path);
    assert.deepEqual(next.processedBuilds, {});
    assert.equal(previewStatus(oldPreview, next).status, "stale");
  }
  assert.equal(calls, 0);
});

test("explicit activePath routes the shared request and serializes only active path skills with parameters", () => {
  for (const path of ["POCHOPIT", "POZOROVAT", "VYTVOŘIT"]) {
    let build = configured(path); build = toggleF2Skill(build, `${path.toLowerCase()}-3`); build = parameterizeF2Skill(build, `${path.toLowerCase()}-3`, `parametr ${path}`);
    const request = createF2BuildRequest(build, [{ category: "manifestations", text: "Obtížný začátek" }]);
    assert.equal(request.kind, "f2-build"); assert.equal(request.activePath, path); assert.deepEqual(request.activeSkills.map((item) => item.id), [`${path.toLowerCase()}-1`, `${path.toLowerCase()}-3`]); assert.equal(request.skillParameters[`${path.toLowerCase()}-3`], `parametr ${path}`);
  }
});

test("all paths execute their base contract with zero skills and no implicit selection", () => {
  for (const path of ["POCHOPIT", "POZOROVAT", "VYTVOŘIT"]) {
    const request = createF2BuildRequest(createF2BuildState(need(path)), []);
    assert.deepEqual(request.activeSkills, []); assert.deepEqual(request.skillParameters, {});
  }
});

test("malformed F2 results are rejected atomically before replacing a successful build", () => {
  let build = configured("POCHOPIT"); build = applyF2BuildResult(build, result("POCHOPIT"), "POCHOPIT", build.buildRevision); const previous = structuredClone(build);
  for (const invalid of [{ ...result("POCHOPIT"), pathResult: undefined }, { ...result("POCHOPIT"), pathResult: { kind: "unknown" } }, { ...result("POCHOPIT"), hypotheses: [{ id: "broken" }] }, { ...result("POCHOPIT"), uncertainties: [{}] }]) {
    assert.throws(() => applyF2BuildResult(build, invalid, "POCHOPIT", build.buildRevision), /neplatný F2/); assert.deepEqual(build, previous);
  }
  assert.throws(() => parseF2BuildResult(result("POCHOPIT"), "POZOROVAT"), /neplatný F2/);
});

test("malformed PREVIEW refresh is rejected while the previous preview remains available", () => {
  let build = configured("POCHOPIT"); build = applyF2BuildResult(build, result("POCHOPIT"), "POCHOPIT", build.buildRevision); const snapshot = createF2PreviewSnapshot(build); const previous = acceptRenderedPreview(snapshot, { title: "Platný", introduction: "Úvod", sections: [] });
  assert.throws(() => parseF2RenderedPreview({ title: "Rozbitý", sections: [{ heading: 1 }] }), /neplatný PREVIEW/); assert.equal(previous.render.title, "Platný");
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

test("repeated accepted processing at one configuration revision gets distinct result and snapshot identities", () => {
  let build = configured("POCHOPIT");
  const configurationRevision = build.buildRevision;
  build = applyF2BuildResult(build, result("POCHOPIT"), "POCHOPIT", configurationRevision);
  const firstResultId = build.processedBuilds.POCHOPIT.processedResultId;
  const firstSnapshot = createF2PreviewSnapshot(build);
  build = applyF2BuildResult(build, { ...result("POCHOPIT"), decisions: ["nové rozhodnutí"] }, "POCHOPIT", configurationRevision);
  const secondResultId = build.processedBuilds.POCHOPIT.processedResultId;
  const secondSnapshot = createF2PreviewSnapshot(build);
  assert.equal(build.buildRevision, configurationRevision);
  assert.notEqual(firstResultId, secondResultId);
  assert.notEqual(firstSnapshot.snapshotId, secondSnapshot.snapshotId);
  assert.equal(previewStatus(acceptRenderedPreview(firstSnapshot, { title: "A", introduction: "", sections: [] }), build).status, "stale");
});

test("POZOROVAT and VYTVOŘIT previews use immutable explicit snapshots and remain after stale edits", () => {
  for (const path of ["POZOROVAT", "VYTVOŘIT"]) {
    let build = configured(path, path === "POZOROVAT" ? "týdenní pozorovací tabulka" : "pracovní karty"); build = applyF2BuildResult(build, result(path), path, build.buildRevision);
    const snapshot = createF2PreviewSnapshot(build); let preview = acceptRenderedPreview(snapshot, { title: `Náhled ${path}`, introduction: "Úvod", sections: [] }); build = addF2Context(build, { id: "later", text: "Pozdější změna" }); preview = previewStatus(preview, build);
    assert.equal(snapshot.activePath, path); assert.equal(snapshot.processedBuild.path, path); assert.equal(snapshot.addedContext.length, 0); assert.equal(preview.status, "stale"); assert.equal(preview.render.title, `Náhled ${path}`); assert.throws(() => createF2PreviewSnapshot(build), /Nejprve rozpracujte/);
  }
});

test("all paths retain five independently configured skills", () => { for (const path of ["POCHOPIT", "POZOROVAT", "VYTVOŘIT"]) assert.equal(F2_SKILL_DEFINITIONS.filter((skill) => skill.path === path).length, 5); });

// Batch 2: focused POCHOPIT component-state contract.
import {
  DEFAULT_POCHOPIT_BUILD_CONFIG,
  DEFAULT_POZOROVAT_BUILD_CONFIG,
  DEFAULT_VYTVORIT_BUILD_CONFIG,
  applyCurrentRozborComponentUpdate,
  createF2ToF3Snapshot,
  createRozborBaselineFingerprint,
  createCurrentRozborGenerationRequest,
  createCurrentRozborState,
  currentRozborSourceFingerprint,
  deriveRequiredRozborComponents,
  deriveRequiredCurrentRozborComponents,
  reconcileRozborComponents,
  createPochopitBuildState,
  updatePochopitBuildConfig,
  applyGeneratedRozborComponents,
  applyRozborComponentUpdate,
  createRozborGenerationRequest,
  parseGeneratedRozborComponents,
  isF2ToF3Snapshot,
  updateCurrentRozborConfig,
} from "../app/f2-build-model.ts";

const pochopitNeed = need("POCHOPIT");
const pochopitConfig = (change = {}) => ({ ...DEFAULT_POCHOPIT_BUILD_CONFIG, ...change });
const generated = (spec, content = `Obsah ${spec.id}`) => ({ ...spec, content });

test("POCHOPIT default config requires no generated components", () => {
  assert.deepEqual(deriveRequiredRozborComponents(pochopitNeed, [hypothesis("h1")], pochopitConfig()), []);
});

test("expansion depth requires one deterministic local component per hypothesis", () => {
  const hypotheses = [hypothesis("h1"), hypothesis("h2")];
  const first = deriveRequiredRozborComponents(pochopitNeed, hypotheses, pochopitConfig({ expansionDepth: 1 }));
  const second = deriveRequiredRozborComponents(pochopitNeed, hypotheses, pochopitConfig({ expansionDepth: 1 }));
  assert.deepEqual(first.map(({ id }) => id), ["hypothesis:h1:expansion", "hypothesis:h2:expansion"]);
  assert.deepEqual(second, first);
});

test("every expansion depth transition changes local fingerprints in both directions", () => {
  const fingerprints = [1, 2, 3].map((expansionDepth) => deriveRequiredRozborComponents(
    pochopitNeed, [hypothesis("h1")], pochopitConfig({ expansionDepth }),
  )[0].fingerprint);
  assert.notEqual(fingerprints[0], fingerprints[1]);
  assert.notEqual(fingerprints[1], fingerprints[2]);
  assert.notEqual(fingerprints[2], fingerprints[1]);
});

test("comparison toggles add and remove comparison:all", () => {
  const on = deriveRequiredRozborComponents(pochopitNeed, [hypothesis("h1")], pochopitConfig({ compareHypotheses: true }));
  assert.deepEqual(on.map(({ id }) => id), ["comparison:all"]);
  const component = generated(on[0]);
  const off = reconcileRozborComponents(
    deriveRequiredRozborComponents(pochopitNeed, [hypothesis("h1")], pochopitConfig()),
    [component],
  );
  assert.deepEqual(off.remove, [component]);
});

test("expert-frame toggles add and remove expert-frame:all", () => {
  const on = deriveRequiredRozborComponents(pochopitNeed, [hypothesis("h1")], pochopitConfig({ expertFrame: true }));
  assert.deepEqual(on.map(({ id }) => id), ["expert-frame:all"]);
  const component = generated(on[0]);
  const off = reconcileRozborComponents(
    deriveRequiredRozborComponents(pochopitNeed, [hypothesis("h1")], pochopitConfig()),
    [component],
  );
  assert.deepEqual(off.remove, [component]);
});

test("one hypothesis edit stales its expansion and comparison but preserves independent components", () => {
  const baseline = [hypothesis("h1", "První"), hypothesis("h2", "Druhá")];
  const config = pochopitConfig({ expansionDepth: 1, compareHypotheses: true, expertFrame: true });
  const originalSpecs = deriveRequiredRozborComponents(pochopitNeed, baseline, config);
  const components = originalSpecs.map((spec) => generated(spec));
  const changed = [hypothesis("h1", "Změněná"), baseline[1]];
  const nextSpecs = deriveRequiredRozborComponents(pochopitNeed, changed, config);
  const result = reconcileRozborComponents(nextSpecs, components);
  assert.deepEqual(result.staleComponentIds.sort(), ["comparison:all", "expert-frame:all", "hypothesis:h1:expansion"].sort());
  assert.deepEqual(result.keep.map(({ id }) => id), ["hypothesis:h2:expansion"]);
  assert.equal(result.keep[0], components[1]);
});

test("removing a hypothesis removes its local expansion", () => {
  const config = pochopitConfig({ expansionDepth: 1 });
  const original = deriveRequiredRozborComponents(pochopitNeed, [hypothesis("h1"), hypothesis("h2")], config).map(generated);
  const required = deriveRequiredRozborComponents(pochopitNeed, [hypothesis("h1")], config);
  assert.deepEqual(reconcileRozborComponents(required, original).remove.map(({ id }) => id), ["hypothesis:h2:expansion"]);
});

test("matching component is kept by exact object identity and yields current derived state", () => {
  const spec = deriveRequiredRozborComponents(pochopitNeed, [hypothesis("h1")], pochopitConfig({ expansionDepth: 1 }))[0];
  const component = generated(spec);
  const result = reconcileRozborComponents([spec], [component]);
  assert.equal(result.keep[0], component);
  assert.deepEqual(result.pendingComponentIds, []);
  assert.deepEqual(result.staleComponentIds, []);
  assert.equal(result.hasGeneratedRozbor, true);
  assert.equal(result.isRozborCurrent, true);
});

test("missing required components are pending and an empty generated set is not current", () => {
  const required = deriveRequiredRozborComponents(pochopitNeed, [hypothesis("h1")], pochopitConfig({ expansionDepth: 1 }));
  const result = reconcileRozborComponents(required, []);
  assert.deepEqual(result.pendingComponentIds, ["hypothesis:h1:expansion"]);
  assert.equal(result.hasGeneratedRozbor, false);
  assert.equal(result.isRozborCurrent, false);
});

test("hypothesis ordering affects whole-baseline and comparison fingerprints, not local IDs", () => {
  const firstOrder = [hypothesis("h1"), hypothesis("h2")];
  const secondOrder = [firstOrder[1], firstOrder[0]];
  const config = pochopitConfig({ expansionDepth: 1, compareHypotheses: true });
  const first = deriveRequiredRozborComponents(pochopitNeed, firstOrder, config);
  const second = deriveRequiredRozborComponents(pochopitNeed, secondOrder, config);
  assert.notEqual(createRozborBaselineFingerprint(pochopitNeed, firstOrder), createRozborBaselineFingerprint(pochopitNeed, secondOrder));
  assert.notEqual(first.find(({ id }) => id === "comparison:all").fingerprint, second.find(({ id }) => id === "comparison:all").fingerprint);
  assert.deepEqual(new Set(first.filter(({ kind }) => kind === "hypothesis-expansion").map(({ id }) => id)), new Set(second.filter(({ kind }) => kind === "hypothesis-expansion").map(({ id }) => id)));
});

test("unrelated operation toggles do not invalidate expansions", () => {
  const hypotheses = [hypothesis("h1")];
  const base = deriveRequiredRozborComponents(pochopitNeed, hypotheses, pochopitConfig({ expansionDepth: 2 }))[0];
  const compare = deriveRequiredRozborComponents(pochopitNeed, hypotheses, pochopitConfig({ expansionDepth: 2, compareHypotheses: true }))[0];
  const expert = deriveRequiredRozborComponents(pochopitNeed, hypotheses, pochopitConfig({ expansionDepth: 2, expertFrame: true }))[0];
  assert.equal(base.fingerprint, compare.fingerprint);
  assert.equal(base.fingerprint, expert.fingerprint);
});

test("POCHOPIT expansion control maps level selection and selected-level deselection to config", () => {
  let state = createPochopitBuildState();
  state = updatePochopitBuildConfig(state, { expansionDepth: 1 });
  assert.equal(state.config.expansionDepth, 1);
  state = updatePochopitBuildConfig(state, { expansionDepth: 0 });
  assert.equal(state.config.expansionDepth, 0);
  state = updatePochopitBuildConfig(state, { expansionDepth: 1 });
  state = updatePochopitBuildConfig(state, { expansionDepth: 2 });
  assert.equal(state.config.expansionDepth, 2);
  state = updatePochopitBuildConfig(state, { expansionDepth: 3 });
  assert.equal(state.config.expansionDepth, 3);
});

test("POCHOPIT comparison and expert cards toggle their config fields independently", () => {
  let state = createPochopitBuildState();
  state = updatePochopitBuildConfig(state, { compareHypotheses: true });
  assert.equal(state.config.compareHypotheses, true);
  state = updatePochopitBuildConfig(state, { compareHypotheses: false, expertFrame: true });
  assert.equal(state.config.compareHypotheses, false);
  assert.equal(state.config.expertFrame, true);
  state = updatePochopitBuildConfig(state, { expertFrame: false });
  assert.equal(state.config.expertFrame, false);
});

test("first component request contains only missing active specs for every operation combination", () => {
  const hypotheses = [hypothesis("h1"), hypothesis("h2")];
  assert.deepEqual(createRozborGenerationRequest(pochopitNeed, hypotheses, pochopitConfig({ expansionDepth: 1 }), []).components.map(({ id }) => id), ["hypothesis:h1:expansion", "hypothesis:h2:expansion"]);
  assert.deepEqual(createRozborGenerationRequest(pochopitNeed, hypotheses, pochopitConfig({ compareHypotheses: true }), []).components.map(({ id }) => id), ["comparison:all"]);
  assert.deepEqual(createRozborGenerationRequest(pochopitNeed, hypotheses, pochopitConfig({ expertFrame: true }), []).components.map(({ id }) => id), ["expert-frame:all"]);
  assert.deepEqual(createRozborGenerationRequest(pochopitNeed, hypotheses, pochopitConfig({ expansionDepth: 3, compareHypotheses: true, expertFrame: true }), []).components.map(({ id }) => id), ["hypothesis:h1:expansion", "hypothesis:h2:expansion", "comparison:all", "expert-frame:all"]);
  assert.equal(createRozborGenerationRequest(pochopitNeed, hypotheses, pochopitConfig(), []), null);
});

test("component response rejects unknown, duplicate, missing, and mismatched IDs", () => {
  const requested = deriveRequiredRozborComponents(pochopitNeed, [hypothesis("h1")], pochopitConfig({ expansionDepth: 1, compareHypotheses: true }));
  const valid = requested.map(({ id, kind, hypothesisId }) => ({ id, kind, ...(hypothesisId ? { hypothesisId } : {}), content: "Obsah" }));
  assert.equal(parseGeneratedRozborComponents({ components: valid }, requested).length, 2);
  assert.throws(() => parseGeneratedRozborComponents({ components: [{ ...valid[0], id: "unknown" }, valid[1]] }, requested), /nevyžádanou/);
  assert.throws(() => parseGeneratedRozborComponents({ components: [valid[0], valid[0]] }, requested), /duplicitní/);
  assert.throws(() => parseGeneratedRozborComponents({ components: [valid[0]] }, requested), /úplnou/);
  assert.throws(() => parseGeneratedRozborComponents({ components: [{ ...valid[0], kind: "expert-frame" }, valid[1]] }, requested), /nevyžádanou/);
});

test("applying generated components preserves baseline inputs and uses required fingerprints", () => {
  const baseline = [hypothesis("h1")]; const before = structuredClone(baseline);
  const requested = deriveRequiredRozborComponents(pochopitNeed, baseline, pochopitConfig({ expansionDepth: 2 }));
  const state = applyGeneratedRozborComponents({ config: pochopitConfig({ expansionDepth: 2 }), components: [] }, requested, [{ id: requested[0].id, kind: requested[0].kind, hypothesisId: "h1", content: "Lokální rozvinutí" }]);
  assert.deepEqual(baseline, before);
  assert.equal(state.components[0].fingerprint, requested[0].fingerprint);
  assert.equal("fingerprint" in state.components[0], true);
  assert.equal(createRozborGenerationRequest(pochopitNeed, baseline, state.config, state.components), null);
});

test("depth updates request only stale expansions and comparison while retaining expert", () => {
  const baseline = [hypothesis("h1"), hypothesis("h2")];
  for (const [from, to] of [[1, 2], [2, 3], [3, 2]]) {
    const oldConfig = pochopitConfig({ expansionDepth: from, compareHypotheses: true, expertFrame: true });
    const nextConfig = pochopitConfig({ expansionDepth: to, compareHypotheses: true, expertFrame: true });
    const existing = deriveRequiredRozborComponents(pochopitNeed, baseline, oldConfig).map(generated);
    const request = createRozborGenerationRequest(pochopitNeed, baseline, nextConfig, existing);
    assert.deepEqual(request.components.map(({ id }) => id), ["hypothesis:h1:expansion", "hypothesis:h2:expansion", "comparison:all"]);
    const expert = existing.find(({ id }) => id === "expert-frame:all");
    const response = request.components.map(({ id, kind, hypothesisId }) => ({ id, kind, ...(hypothesisId ? { hypothesisId } : {}), content: `Nový ${id}` }));
    const updated = applyRozborComponentUpdate({ config: nextConfig, components: existing }, deriveRequiredRozborComponents(pochopitNeed, baseline, nextConfig), response);
    assert.equal(updated.components.find(({ id }) => id === "expert-frame:all"), expert);
  }
});

test("operation toggles generate only newly missing components and removals need no request", () => {
  const baseline = [hypothesis("h1")];
  const expansionConfig = pochopitConfig({ expansionDepth: 1 });
  const expansion = deriveRequiredRozborComponents(pochopitNeed, baseline, expansionConfig).map(generated);
  assert.deepEqual(createRozborGenerationRequest(pochopitNeed, baseline, { ...expansionConfig, compareHypotheses: true }, expansion).components.map(({ id }) => id), ["comparison:all"]);
  assert.deepEqual(createRozborGenerationRequest(pochopitNeed, baseline, { ...expansionConfig, expertFrame: true }, expansion).components.map(({ id }) => id), ["expert-frame:all"]);
  const withCrossCutting = deriveRequiredRozborComponents(pochopitNeed, baseline, pochopitConfig({ compareHypotheses: true, expertFrame: true })).map(generated);
  assert.equal(createRozborGenerationRequest(pochopitNeed, baseline, pochopitConfig(), withCrossCutting), null);
  const removed = applyRozborComponentUpdate({ config: pochopitConfig(), components: withCrossCutting }, [], []);
  assert.deepEqual(removed.components, []);
});

test("baseline additions, edits, and removals produce dependency-correct selective plans", () => {
  const h1 = hypothesis("h1", "První"); const h2 = hypothesis("h2", "Druhá");
  const config = pochopitConfig({ expansionDepth: 2, compareHypotheses: true, expertFrame: true });
  const existing = deriveRequiredRozborComponents(pochopitNeed, [h1, h2], config).map(generated);
  const changed = createRozborGenerationRequest(pochopitNeed, [hypothesis("h1", "Změněná"), h2], config, existing);
  assert.deepEqual(changed.components.map(({ id }) => id), ["hypothesis:h1:expansion", "comparison:all", "expert-frame:all"]);
  const removedRequired = deriveRequiredRozborComponents(pochopitNeed, [h2], config);
  const removedPlan = reconcileRozborComponents(removedRequired, existing);
  assert.deepEqual(removedPlan.remove.map(({ id }) => id), ["hypothesis:h1:expansion"]);
  assert.deepEqual(removedPlan.keep.map(({ id }) => id), ["hypothesis:h2:expansion"]);
  assert.deepEqual(createRozborGenerationRequest(pochopitNeed, [h2], config, existing).components.map(({ id }) => id), ["comparison:all", "expert-frame:all"]);
  const added = createRozborGenerationRequest(pochopitNeed, [h1, h2, hypothesis("h3", "Třetí")], config, existing);
  assert.deepEqual(added.components.map(({ id }) => id), ["hypothesis:h3:expansion", "comparison:all", "expert-frame:all"]);
});

test("atomic update removes obsolete components and replaces stale semantic IDs without duplicates", () => {
  const baseline = [hypothesis("h1"), hypothesis("h2")];
  const oldConfig = pochopitConfig({ expansionDepth: 1, expertFrame: true });
  const nextConfig = pochopitConfig({ expansionDepth: 2 });
  const existing = deriveRequiredRozborComponents(pochopitNeed, baseline, oldConfig).map(generated);
  const required = deriveRequiredRozborComponents(pochopitNeed, baseline, nextConfig);
  const request = createRozborGenerationRequest(pochopitNeed, baseline, nextConfig, existing);
  const response = request.components.map(({ id, kind, hypothesisId }) => ({ id, kind, ...(hypothesisId ? { hypothesisId } : {}), content: `Replacement ${id}` }));
  const updated = applyRozborComponentUpdate({ config: nextConfig, components: existing }, required, response);
  assert.deepEqual(updated.components.map(({ id }) => id), ["hypothesis:h1:expansion", "hypothesis:h2:expansion"]);
  assert.equal(new Set(updated.components.map(({ id }) => id)).size, updated.components.length);
  assert.deepEqual(existing.map(({ id }) => id), ["hypothesis:h1:expansion", "hypothesis:h2:expansion", "expert-frame:all"]);
  assert.throws(() => applyRozborComponentUpdate({ config: nextConfig, components: existing }, required, response.slice(1)), /úplnou/);
  assert.deepEqual(existing.map(({ id }) => id), ["hypothesis:h1:expansion", "hypothesis:h2:expansion", "expert-frame:all"], "a failed response leaves the complete previous set untouched");
});

// Batch 1A-1C: shared path-aware current-Rozbor contract.
const pozorovatNeed = need("POZOROVAT");
const vytvoritNeed = need("VYTVOŘIT");
const pozorovatConfig = (change = {}) => ({ ...DEFAULT_POZOROVAT_BUILD_CONFIG, ...change });
const vytvoritConfig = (change = {}) => ({ ...DEFAULT_VYTVORIT_BUILD_CONFIG, ...change });

const observationContent = {
  "observation-comparison": {
    contrasts: [{ conditionA: "kratší kruh", conditionB: "delší kruh", whatToObserve: "čas do odchodu", supportSignal: "v kratším kruhu zůstává déle", weakeningSignal: "délka kruhu výsledek nemění", supportsHypothesisIds: ["h1"], weakensHypothesisIds: [], doesNotDiscriminateWhen: "délka kruhu je stejná", limitations: ["jedno pozorování nestačí"] }],
    limitations: ["kontrast neprokazuje příčinu"],
  },
  "observation-indicators": {
    purpose: "Rozlišit vliv délky činnosti a podpory.",
    indicators: [{ indicator: "čas do prvního odchodu", observableAs: "počet minut od začátku", situation: "ranní kruh", supportSignal: "čas se s kratším kruhem prodlouží", weakeningSignal: "čas zůstává stejný napříč délkami", supportsHypothesisIds: ["h1"], weakensHypothesisIds: [], doesNotDiscriminateWhen: "podmínky se nezmění", limitations: ["čas nepopisuje vnitřní stav"] }],
    limitations: ["indikátor není diagnóza"],
  },
  "observation-priorities": {
    priorities: [{ priority: 1, focus: "kratší versus delší kruh", reason: "zdroj již naznačuje rozdíl", hypothesisIds: ["h1"] }],
    limitations: ["pořadí je pracovní"],
  },
};

const creationContent = {
  "creation-approaches": {
    candidateApproaches: [{ title: "Předvídatelná aktivní role", description: "Dítě předem dostane krátkou roli v kruhu.", hypothesisIds: ["h1"], limitations: ["neznáme preferovanou roli"] }],
    workingApproach: { title: "Krátký kruh s aktivní rolí", rationale: "Odpovídá rozdílům popsaným ve zdroji.", hypothesisIds: ["h1"], limitations: ["volba je pracovní a vyžaduje ověření"] },
  },
  "creation-objective": { objective: "Prodloužit smysluplné zapojení bez nátlaku.", hypothesisIds: ["h1"], limitations: ["výchozí délka kolísá"] },
  "success-conditions": { conditions: [{ condition: "předem sdělená krátká struktura", whyRequired: "snižuje nepředvídatelnost" }], limitations: ["podmínky je třeba individualizovat"] },
  "follow-up-verification": { checks: [{ indicator: "doba zapojení", when: "během tří ranních kruhů", successSignal: "delší účast bez zvýšení protestu", adjustmentSignal: "protest nebo kratší účast", hypothesisIds: ["h1"] }], limitations: ["změnu nelze připsat jediné podpoře"] },
};

test("one shared current-Rozbor state keeps independent path configuration without model work", () => {
  let calls = 0;
  let state = createCurrentRozborState();
  state = updateCurrentRozborConfig(state, "POZOROVAT", { keyIndicators: true });
  state = updateCurrentRozborConfig(state, "VYTVOŘIT", { candidateApproaches: true });
  assert.equal(calls, 0);
  assert.equal(state.POZOROVAT.config.keyIndicators, true);
  assert.equal(state.VYTVOŘIT.config.candidateApproaches, true);
  assert.deepEqual(state.POCHOPIT.config, DEFAULT_POCHOPIT_BUILD_CONFIG);
});

test("POZOROVAT derives stable operation components and selective dependency fingerprints", () => {
  const hypotheses = [hypothesis("h1", "První"), hypothesis("h2", "Druhá")];
  const config = pozorovatConfig({ expansionDepth: 2, compareHypotheses: true, keyIndicators: true, observationPriorities: true });
  const required = deriveRequiredCurrentRozborComponents("POZOROVAT", pozorovatNeed, hypotheses, config);
  assert.deepEqual(required.map(({ id }) => id), ["hypothesis:h1:expansion", "hypothesis:h2:expansion", "observation-comparison:all", "observation-indicators:all", "observation-priorities:all"]);
  const existing = required.map(generated);
  const changed = createCurrentRozborGenerationRequest("POZOROVAT", pozorovatNeed, [hypothesis("h1", "Změněná"), hypotheses[1]], config, existing);
  assert.deepEqual(changed.components.map(({ id }) => id), ["hypothesis:h1:expansion", "observation-comparison:all", "observation-indicators:all", "observation-priorities:all"]);
  assert.equal(changed.activePath, "POZOROVAT");
});

test("POZOROVAT structured results reject incomplete, unlinked, or unsolicited shapes", () => {
  const config = pozorovatConfig({ compareHypotheses: true, keyIndicators: true, observationPriorities: true });
  const requested = deriveRequiredCurrentRozborComponents("POZOROVAT", pozorovatNeed, [hypothesis("h1")], config);
  const valid = requested.map((spec) => ({ ...spec, content: observationContent[spec.kind] }));
  assert.equal(parseGeneratedRozborComponents({ components: valid }, requested).length, 3);
  const missingCondition = structuredClone(valid); delete missingCondition[0].content.contrasts[0].conditionB;
  assert.throws(() => parseGeneratedRozborComponents({ components: missingCondition }, requested), /kontrast/);
  const unlinked = structuredClone(valid); unlinked[1].content.indicators[0].supportsHypothesisIds = [];
  assert.throws(() => parseGeneratedRozborComponents({ components: unlinked }, requested), /indikátor/);
  assert.throws(() => parseGeneratedRozborComponents({ components: [...valid, { ...valid[0], id: "unsolicited" }] }, requested), /nevyžádanou|úplnou/);
});

test("POZOROVAT pure removal is local and mixed invalid responses preserve the previous complete state", () => {
  const config = pozorovatConfig({ compareHypotheses: true, keyIndicators: true, observationPriorities: true });
  const hypotheses = [hypothesis("h1")];
  const required = deriveRequiredCurrentRozborComponents("POZOROVAT", pozorovatNeed, hypotheses, config);
  const valid = required.map((spec) => ({ ...spec, content: observationContent[spec.kind] }));
  let state = createCurrentRozborState();
  state = updateCurrentRozborConfig(state, "POZOROVAT", config);
  state = applyCurrentRozborComponentUpdate(state, "POZOROVAT", required, valid);
  const before = structuredClone(state);
  const withoutPriority = pozorovatConfig({ compareHypotheses: true, keyIndicators: true });
  const nextRequired = deriveRequiredCurrentRozborComponents("POZOROVAT", pozorovatNeed, hypotheses, withoutPriority);
  assert.equal(createCurrentRozborGenerationRequest("POZOROVAT", pozorovatNeed, hypotheses, withoutPriority, state.POZOROVAT.components), null);
  const removed = applyCurrentRozborComponentUpdate(state, "POZOROVAT", nextRequired, []);
  assert.equal(removed.POZOROVAT.components.some(({ kind }) => kind === "observation-priorities"), false);
  const changedRequired = deriveRequiredCurrentRozborComponents("POZOROVAT", pozorovatNeed, [hypothesis("h1", "Změněná")], config);
  const changedValid = changedRequired.map((spec) => ({ ...spec, content: observationContent[spec.kind] }));
  assert.throws(() => applyCurrentRozborComponentUpdate(state, "POZOROVAT", changedRequired, changedValid.slice(1)), /úplnou/);
  assert.deepEqual(state, before);
});

test("VYTVOŘIT requires a selected working approach and represents objective, conditions, and follow-up checks", () => {
  const config = vytvoritConfig({ expansionDepth: 1, candidateApproaches: true, refineObjective: true, successConditions: true, followUpVerification: true });
  const requested = deriveRequiredCurrentRozborComponents("VYTVOŘIT", vytvoritNeed, [hypothesis("h1")], config);
  assert.deepEqual(requested.map(({ id }) => id), ["hypothesis:h1:expansion", "creation-approaches:all", "creation-objective:all", "success-conditions:all", "follow-up-verification:all"]);
  const valid = requested.map((spec) => ({ ...spec, content: spec.kind === "hypothesis-expansion" ? "Rozvinutí" : creationContent[spec.kind] }));
  const parsed = parseGeneratedRozborComponents({ components: valid }, requested);
  assert.equal(parsed.find(({ kind }) => kind === "creation-approaches").content.workingApproach.title, "Krátký kruh s aktivní rolí");
  const noSelection = structuredClone(valid); delete noSelection.find(({ kind }) => kind === "creation-approaches").content.workingApproach;
  assert.throws(() => parseGeneratedRozborComponents({ components: noSelection }, requested), /zvolený pracovní přístup/);
  const noLimit = structuredClone(valid); noLimit.find(({ kind }) => kind === "creation-objective").content.limitations = [];
  assert.throws(() => parseGeneratedRozborComponents({ components: noLimit }, requested), /praktický cíl/);
});

function readyF3Source(path) {
  const sourceNeed = need(path, path === "POCHOPIT" ? "vysvětlení" : path === "POZOROVAT" ? "pozorovací plán" : "praktický postup");
  const hypotheses = [hypothesis("h1")];
  const config = path === "POCHOPIT"
    ? pochopitConfig({ expansionDepth: 1, compareHypotheses: true })
    : path === "POZOROVAT"
      ? pozorovatConfig({ compareHypotheses: true, keyIndicators: true, observationPriorities: true })
      : vytvoritConfig({ candidateApproaches: true, refineObjective: true, successConditions: true, followUpVerification: true });
  const required = deriveRequiredCurrentRozborComponents(path, sourceNeed, hypotheses, config);
  const components = required.map((spec) => ({
    ...spec,
    content: spec.kind === "hypothesis-expansion" || spec.kind === "hypothesis-comparison" || spec.kind === "expert-frame"
      ? `Obsah ${spec.id}`
      : path === "POZOROVAT" ? observationContent[spec.kind] : creationContent[spec.kind],
  }));
  return { sourceNeed, hypotheses, state: { config, components } };
}

test("current Rozbor creates an immutable direct F3 snapshot for every path", () => {
  for (const path of ["POCHOPIT", "POZOROVAT", "VYTVOŘIT"]) {
    const source = readyF3Source(path);
    const snapshot = createF2ToF3Snapshot(source.sourceNeed, source.hypotheses, path, source.state, 7);
    assert.equal(snapshot.kind, "f2-to-f3");
    assert.equal(snapshot.activePath, path);
    assert.equal(snapshot.currentRozbor.components.length, source.state.components.length);
    assert.equal(snapshot.sourceRevision, 7);
    assert.equal(isF2ToF3Snapshot(snapshot), true);
    assert.equal(isF2ToF3Snapshot(JSON.parse(JSON.stringify(snapshot))), true);
    assert.equal(Object.isFrozen(snapshot), true);
    assert.equal(Object.isFrozen(snapshot.currentRozbor.components[0]), true);
    const originalNeed = snapshot.canonicalNeed.needText;
    source.sourceNeed.needText = "Pozdější změna";
    source.state.components[0].content = "Pozdější změna";
    assert.equal(snapshot.canonicalNeed.needText, originalNeed);
    assert.notEqual(snapshot.currentRozbor.components[0].content, "Pozdější změna");
  }
});

test("snapshot identity is stable for equal current sources and changes with current Rozbor substance", () => {
  const first = readyF3Source("POCHOPIT");
  const a = createF2ToF3Snapshot(first.sourceNeed, first.hypotheses, "POCHOPIT", first.state, 1);
  const b = createF2ToF3Snapshot(structuredClone(first.sourceNeed), structuredClone(first.hypotheses), "POCHOPIT", structuredClone(first.state), 2);
  assert.equal(a.snapshotId, b.snapshotId);
  assert.equal(a.sourceFingerprint, b.sourceFingerprint);
  const changedState = structuredClone(first.state);
  changedState.components[0].content = "Jiný aktuální obsah";
  const changedFingerprint = currentRozborSourceFingerprint(first.sourceNeed, first.hypotheses, "POCHOPIT", changedState);
  assert.notEqual(changedFingerprint, a.sourceFingerprint);
});

test("incomplete or stale current Rozbor cannot masquerade as a valid F3 handoff", () => {
  const creation = readyF3Source("VYTVOŘIT");
  const withoutApproach = { ...creation.state, components: creation.state.components.filter(({ kind }) => kind !== "creation-approaches") };
  assert.throws(() => createF2ToF3Snapshot(creation.sourceNeed, creation.hypotheses, "VYTVOŘIT", withoutApproach, 1), /aktuální|pracovní přístup/);
  const observation = readyF3Source("POZOROVAT");
  const changedHypotheses = [hypothesis("h1", "Změněná hypotéza")];
  assert.throws(() => createF2ToF3Snapshot(observation.sourceNeed, changedHypotheses, "POZOROVAT", observation.state, 1), /není aktuální/);
  const emptyPochopit = { config: pochopitConfig(), components: [] };
  assert.throws(() => createF2ToF3Snapshot(need("POCHOPIT"), [hypothesis("h1")], "POCHOPIT", emptyPochopit, 1), /Nejprve vytvořte/);
});
