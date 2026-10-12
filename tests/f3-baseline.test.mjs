import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { advanceAcceptedF2Source, assertF2SnapshotSupportsMaterialization, createCurrentRozborState, createF2ToF3Snapshot, currentRozborSourceFingerprint, deriveRequiredCurrentRozborComponents, isF2ToF3Snapshot } from "../app/f2-build-model.ts";
import { acceptF3Render, adoptF2Snapshot, createF3RenderRequest, createF3State, markF3SourceStale, updateF3Config } from "../app/f3-finalization-model.ts";
import { f3MaterialToText, renderWorkingAnalysis } from "../app/f3-working-analysis.ts";
import { copyF3Output, printF3Output } from "../app/f3-output-export.ts";

const hypothesis = (id = "h1") => ({ id, rank: id === "h1" ? 1 : 2, title: `Vliv ${id}`, summary: "Možné vysvětlení, nikoli jistý závěr.", relevantNeeds: ["n1"], question: { id: `q-${id}`, text: "Jak se reakce mění?", target: "context", status: "active" }, supportingInformation: ["Kratší kruh dítě zvládá."], limitations: ["Máme jen omezený počet situací."], unknowns: ["Vliv únavy není známý."], questions: [] });
const need = (path) => ({ needId: "n1", needText: "Aktivní pedagogický cíl", initialF2Path: path, f3Target: "Požadovaný materiál" });
const context = { mainUncertainty: "Vysvětlení nelze zatím rozhodnout.", summary: "Podmínky mohou mít souběžný vliv.", needAnalysis: null, notebookContext: [{ category: "manifestations", text: "Dítě při dlouhém kruhu vstává." }] };
const baseline = (path = "POCHOPIT") => advanceAcceptedF2Source(null, need(path), [hypothesis(), hypothesis("h2")], path, createCurrentRozborState()[path], context);
const material = { kind: "material", title: "Podoba A", introduction: "Popis", sections: [{ heading: "Část", content: "GENERATED_A_NEVER_SOURCE" }], table: null, cards: [], usageNote: null };

for (const path of ["POCHOPIT", "POZOROVAT", "VYTVOŘIT"]) test(`A: ${path} minimum Build has immediate immutable working-analysis export`, async () => {
  const source = baseline(path);
  assert.equal(isF2ToF3Snapshot(source), true);
  assert.equal(source.currentRozbor.config.expansionDepth, 0);
  assert.equal(source.currentRozbor.components.length, 0);
  assert.ok(Object.values(source.currentRozbor.config).every((value) => value === 0 || value === false));
  assert.equal(Object.isFrozen(source.analysisContext.notebookContext), true);
  const state = createF3State(source);
  assert.equal(state.representation, "analysis");
  assert.equal(state.finalRender, null);
  const output = renderWorkingAnalysis(state.sourceSnapshot);
  const text = f3MaterialToText(output);
  for (const expected of ["Pracovní pedagogická analýza", "Vliv h1", "Vliv h2", hypothesis().summary, ...hypothesis().supportingInformation, ...hypothesis().limitations, ...hypothesis().unknowns, hypothesis().question.text, context.mainUncertainty, context.summary, context.notebookContext[0].text]) assert.ok(text.includes(expected), expected);
  assert.doesNotMatch(text, /POCHOPIT|POZOROVAT|VYTVOŘIT/);
  assert.notEqual(output.title, source.f3Target);
  let copied;
  const frozen = JSON.stringify(source);
  await copyF3Output(output, { writeText: async (value) => { copied = value; } });
  assert.equal(copied, text);
  assert.equal(JSON.stringify(source), frozen);
});

test("empty, malformed, or incomplete analysis cannot qualify; context changes are fingerprinted", () => {
  const path = "POCHOPIT"; const config = createCurrentRozborState()[path];
  assert.throws(() => createF2ToF3Snapshot(need(path), [], path, config, 0), /úspěšný/);
  assert.throws(() => createF2ToF3Snapshot(need(path), [{ ...hypothesis(), summary: "" }], path, config, 0));
  assert.throws(() => createF2ToF3Snapshot(need(path), [hypothesis()], path, { config: { ...config.config, expansionDepth: 1 }, components: [] }, 0), /aktuální/);
  const source = baseline();
  assert.equal(isF2ToF3Snapshot({ ...source, baselineHypotheses: [] }), false);
  assert.equal(isF2ToF3Snapshot({ ...source, analysisContext: { ...context, mainUncertainty: "Změna" } }), false);
  const changed = advanceAcceptedF2Source(source, need(path), source.baselineHypotheses, path, config, { ...context, mainUncertainty: "Nová nejistota" });
  assert.notEqual(changed.sourceFingerprint, source.sourceFingerprint);
  assert.equal(changed.sourceRevision, source.sourceRevision + 1);
});

test("B/F: pending selections preserve accepted source; successful expansion advances revision and requires adoption", () => {
  const source = baseline();
  let f3 = createF3State(source);
  f3 = acceptF3Render(f3, material, createF3RenderRequest(f3));
  const draft = { config: { ...source.currentRozbor.config, expansionDepth: 2 }, components: [] };
  assert.equal(f3.sourceSnapshot.sourceFingerprint, source.sourceFingerprint);
  assert.notEqual(currentRozborSourceFingerprint(source.canonicalNeed, source.baselineHypotheses, "POCHOPIT", draft, context), source.sourceFingerprint);
  const components = deriveRequiredCurrentRozborComponents("POCHOPIT", source.canonicalNeed, source.baselineHypotheses, draft.config).map((spec) => ({ ...spec, content: `Přijaté rozvinutí ${spec.hypothesisId}` }));
  const next = advanceAcceptedF2Source(source, source.canonicalNeed, source.baselineHypotheses, "POCHOPIT", { ...draft, components }, context);
  assert.equal(next.sourceRevision, source.sourceRevision + 1);
  assert.equal(advanceAcceptedF2Source(next, next.canonicalNeed, next.baselineHypotheses, "POCHOPIT", next.currentRozbor, context), next);
  f3 = markF3SourceStale(f3, next.sourceFingerprint);
  assert.equal(f3.finalRender.content.sections[0].content, "GENERATED_A_NEVER_SOURCE");
  assert.throws(() => createF3RenderRequest(f3), /přijměte/);
  f3 = adoptF2Snapshot(f3, next);
  assert.equal(f3.representation, "analysis");
  assert.equal(f3.finalRender.status, "stale");
  assert.ok(f3MaterialToText(renderWorkingAnalysis(f3.sourceSnapshot)).includes("Přijaté rozvinutí h1"));
  const request = createF3RenderRequest(f3);
  assert.equal(request.sourceSnapshot.sourceRevision, next.sourceRevision);
  f3 = acceptF3Render(f3, { ...material, title: "Podoba nové revize" }, request);
  assert.equal(f3.finalRender.status, "current");
});

test("C: representations A and B independently consume the same accepted immutable snapshot", () => {
  let f3 = createF3State(baseline());
  const original = JSON.stringify(f3.sourceSnapshot);
  const a = createF3RenderRequest(f3);
  f3 = acceptF3Render(f3, material, a);
  f3 = updateF3Config(f3, { structureMode: "cards", audience: "parent" });
  const b = createF3RenderRequest(f3);
  assert.deepEqual(b.sourceSnapshot, a.sourceSnapshot);
  assert.ok(!JSON.stringify(b).includes("GENERATED_A_NEVER_SOURCE"));
  assert.equal(JSON.stringify(f3.sourceSnapshot), original);
  assert.deepEqual(renderWorkingAnalysis(f3.sourceSnapshot), renderWorkingAnalysis(a.sourceSnapshot));
});

for (const [path, pattern] of [["VYTVOŘIT", /pracovní přístup/], ["POZOROVAT", /pozorovací specifikaci/]]) test(`D/E: ${path} working-analysis export permitted, specialized materialization blocked`, () => {
  const source = baseline(path);
  assert.ok(renderWorkingAnalysis(source).sections.length);
  assert.throws(() => assertF2SnapshotSupportsMaterialization(source), pattern);
  assert.throws(() => createF3RenderRequest(createF3State(source)), pattern);
  const expandedConfig = { ...source.currentRozbor.config, expansionDepth: 1 };
  const specs = deriveRequiredCurrentRozborComponents(path, source.canonicalNeed, source.baselineHypotheses, expandedConfig);
  const expanded = advanceAcceptedF2Source(source, source.canonicalNeed, source.baselineHypotheses, path, { config: expandedConfig, components: specs.map((s) => ({ ...s, content: "Přijatá lokální analýza." })) }, context);
  assert.equal(isF2ToF3Snapshot(expanded), true);
  assert.throws(() => assertF2SnapshotSupportsMaterialization(expanded), pattern);
});

test("print/PDF isolates readable DOM, uses the browser once, and cleans up after print or failure", () => {
  let printed = 0; let clone; const listeners = new Map(); const classes = new Set();
  const document = { querySelector: () => clone ?? null, createElement: () => ({ appendChild: (node) => { assert.equal(node.text, "ONLY_READABLE_OUTPUT"); }, remove: () => { clone = null; } }), body: { appendChild: (node) => { clone = node; }, classList: { add: (value) => classes.add(value), remove: (value) => classes.delete(value) } } };
  const browser = { document, addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: (name) => listeners.delete(name), print: () => { printed++; assert.equal(clone.className, "f3-print-document"); assert.ok(classes.has("f3-printing")); } };
  const output = { cloneNode: (deep) => { assert.equal(deep, true); return { text: "ONLY_READABLE_OUTPUT" }; } };
  printF3Output(output, browser);
  printF3Output(output, browser);
  assert.equal(printed, 1);
  listeners.get("afterprint")();
  assert.equal(clone, null); assert.equal(classes.size, 0);
  browser.print = () => { throw new Error("print unavailable"); };
  assert.throws(() => printF3Output(output, browser), /unavailable/);
  assert.equal(clone, null); assert.equal(classes.size, 0);
});

test("clipboard failures are explicit and copied stale content retains its warning", async () => {
  await assert.rejects(copyF3Output(material, undefined), /dostupné/);
  let copied;
  await copyF3Output(material, { writeText: async (text) => { copied = text; } }, true);
  assert.match(copied, /^Starší výstup/);
});

test("client accepts only completed analysis/Build, ignores draft config for F3, and never auto-navigates", async () => {
  const client = await readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8");
  const ownership = client.slice(client.indexOf("// F3 observes"), client.indexOf("const hasActiveRozborOperation"));
  assert.match(ownership, /acceptedF2Source.currentRozbor/);
  assert.doesNotMatch(ownership, /activeRozbor.config|f2Build.buildRevision/);
  const initialize = client.slice(client.indexOf("if (currentF2ToF3Source.snapshot) setF3State"), client.indexOf("const dictationTranscriptRef"));
  assert.doesNotMatch(initialize, /setPhase|fetch\(/);
  assert.match(client, /advanceAcceptedF2Source/);
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /@media print/);
  assert.match(css, /body\.f3-printing > :not\(\.f3-print-document\) \{ display: none !important/);
});
