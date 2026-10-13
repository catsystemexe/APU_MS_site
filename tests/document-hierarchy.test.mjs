import assert from "node:assert/strict";
import test from "node:test";
import { createCurrentRozborState, createF2ToF3Snapshot, deriveRequiredCurrentRozborComponents } from "../app/f2-build-model.ts";
import { renderWorkingAnalysis, f3MaterialToText } from "../app/f3-working-analysis.ts";
import { longContext, longHypotheses } from "./document-style-fixture.mjs";

const make = ({ path = "POCHOPIT", context = longContext, hypotheses = longHypotheses, expanded = false } = {}) => {
  const need = { needId: "n1", needText: "Potřebuji pochopit podmínky zapojení.", initialF2Path: path, f3Target: null };
  const config = { ...createCurrentRozborState()[path].config };
  if (expanded) for (const key of Object.keys(config)) config[key] = key === "expansionDepth" ? 2 : true;
  const components = deriveRequiredCurrentRozborComponents(path, need, hypotheses, config).map((spec) => ({ ...spec, content: structuredContent[spec.kind] ?? `Přijatý obsah ${spec.kind}: ${spec.hypothesisId ?? "všechny hypotézy"}.` }));
  const snapshot = createF2ToF3Snapshot(need, hypotheses, path, { config, components }, 3, context);
  const before = JSON.stringify(snapshot);
  const projection = renderWorkingAnalysis(snapshot);
  assert.equal(JSON.stringify(snapshot), before);
  return { snapshot, projection, text: f3MaterialToText(projection) };
};
const structuredContent = {
  "observation-comparison": { contrasts: [{ conditionA: "Tichá činnost", conditionB: "Činnost s ruchem", whatToObserve: "Délku zapojení", supportSignal: "Zapojení při nižším ruchu", weakeningSignal: "Stejné zapojení v obou podmínkách", supportsHypothesisIds: ["h1"], weakensHypothesisIds: ["h2"], doesNotDiscriminateWhen: "Chybí srovnatelná délka", limitations: ["Kontrastní situace jsou zatím jednotlivé."] }], limitations: ["Nelze oddělit vliv nabídky podpory."] },
  "observation-indicators": { purpose: "Rozlišit podmínky zapojení", indicators: [{ indicator: "Odchod od skupiny", observableAs: "Opustí místo u kruhu", situation: "Společná ranní činnost", supportSignal: "Odchod při delším čekání", weakeningSignal: "Odchod bez čekání", supportsHypothesisIds: ["h1"], weakensHypothesisIds: [], doesNotDiscriminateWhen: "Délka čekání se nemění", limitations: ["Indikátor sám nevysvětluje příčinu."] }], limitations: ["Chybí srovnání několika dnů."] },
  "observation-priorities": { priorities: [{ priority: 2, focus: "Čekání v kruhu", reason: "Dostupný rozdíl v podmínkách", hypothesisIds: ["h1"] }], limitations: ["Priorita zůstává pracovní."] },
  "creation-approaches": { candidateApproaches: [{ title: "Oznámení přechodu", description: "Předem popsat další krok", hypothesisIds: ["h2"], limitations: ["Není ověřeno porozumění nabídce."] }], workingApproach: { title: "Krátká předvídatelná činnost", rationale: "Navazuje na dostupná pozorování", hypothesisIds: ["h1"], limitations: ["Přístup je podmíněný."] } },
  "creation-objective": { objective: "Podpořit zapojení bez zvýšení zátěže", hypothesisIds: ["h1"], limitations: ["Cíl není potvrzený výsledek."] },
  "success-conditions": { conditions: [{ condition: "Dostupná opora dospělého", whyRequired: "Umožní průběžně reagovat na zátěž" }], limitations: ["Podmínky se mohou mezi dny lišit."] },
  "follow-up-verification": { checks: [{ indicator: "Doba účasti", when: "V dalších třech situacích", successSignal: "Delší účast bez zátěže", adjustmentSignal: "Zvýšená zátěž nebo kratší účast", hypothesisIds: ["h1"] }], limitations: ["Změnu nelze připsat jediné okolnosti."] },
};

test("A/B/C: stable notebook categories retain item boundaries/order and only exclude exact active-need repetitions", () => {
  const records = [
    { category: "helps", text: "Pomáhá předem oznámit přechod." },
    { category: "goals", text: "  Potřebuji  pochopit\npodmínky zapojení. " },
    { category: "manifestations", text: "První původní projev.\nJeho pokračování." },
    { category: "goals", text: "Lépe rozlišit vliv hluku." },
    { category: "context", text: "Původní kontext." },
    { category: "manifestations", text: "Druhý původní projev." },
    { category: "course", text: "Původní průběh." },
    { category: "goals", text: "Potřebuji pochopit podmínky zapojení!" },
    { category: "goals", text: "potřebuji pochopit podmínky zapojení." },
  ];
  const { projection, snapshot, text } = make({ context: { ...longContext, notebookContext: records } });
  const notebook = projection.documentGroups[0];
  assert.equal(notebook.heading, "Informace ze Zápisníku");
  assert.deepEqual(notebook.sections.map(s => s.heading), ["Pedagogická potřeba", "Projevy", "Kontext", "Průběh", "Co pomáhá", "Další pedagogické potřeby"]);
  assert.deepEqual(notebook.sections[1].blocks, [{ kind: "list", items: [records[2].text, records[5].text] }]);
  assert.deepEqual(notebook.sections.at(-1).blocks[0].items, [records[3].text, records[7].text, records[8].text]);
  assert.equal((text.match(/Potřebuji pochopit podmínky zapojení\./g) ?? []).length, 1);
  assert.deepEqual(snapshot.analysisContext.notebookContext, records);
});

test("B/D/F: absent optional context and empty categories create no empty headings or extensions", () => {
  for (const context of [undefined, { ...longContext, notebookContext: [], needAnalysis: null, mainUncertainty: "" }]) {
    // Explicit undefined needs a direct constructor; the helper defaults context.
    const state = createCurrentRozborState().POCHOPIT;
    const snapshot = createF2ToF3Snapshot({ needId: "n1", needText: "Aktivní potřeba", initialF2Path: "POCHOPIT", f3Target: null }, [longHypotheses[0]], "POCHOPIT", state, 0, context);
    const projection = renderWorkingAnalysis(snapshot); const text = f3MaterialToText(projection);
    assert.deepEqual(projection.documentGroups.map(g => g.heading), ["Informace ze Zápisníku", "Pracovní hypotézy"]);
    assert.deepEqual(projection.documentGroups[0].sections.map(s => s.heading), ["Pedagogická potřeba"]);
    assert.doesNotMatch(text, /Rozšíření analýzy|Zaměření ověřování|Další pedagogické potřeby|Shrnutí Rozboru/);
    assert.ok(projection.sections.every(s => s.blocks.length && s.content.trim()));
  }
});

test("E: one/two/several hypotheses preserve original nonconsecutive ranks and optional questions", () => {
  for (const ranks of [[4], [2, 7], [1, 5, 9]]) {
    const hypotheses = ranks.map((rank, i) => ({ ...longHypotheses[i], rank, question: null, questions: [] }));
    const { projection } = make({ hypotheses });
    const sections = projection.documentGroups[1].sections.filter(s => s.role === "hypothesis");
    assert.deepEqual(sections.map(s => s.heading), hypotheses.map(h => `Pracovní hypotéza ${h.rank} — ${h.title}`));
    assert.ok(sections.every(s => !s.content.includes("Otázky ke zpřesnění")));
  }
});

test("approved exclusions are field-specific; substantive focus and hypothesis summaries stay unchanged", () => {
  const context = { ...longContext, summary: "Přecházíme k pracovnímu rozboru. PROCESS_ONLY", needAnalysis: { ...longContext.needAnalysis, intendedOutput: "GENERIC_INTENDED_OUTPUT" } };
  const { snapshot, projection, text } = make({ context });
  assert.doesNotMatch(text, /PROCESS_ONLY|GENERIC_INTENDED_OUTPUT|Shrnutí Rozboru|Zacílení pracovní analýzy|Zamýšlený výstup/);
  const focus = projection.documentGroups[1].sections[0];
  assert.equal(focus.heading, "Zaměření ověřování");
  for (const value of [context.needAnalysis.direction, ...context.needAnalysis.distinctions, ...context.needAnalysis.parameters, ...context.needAnalysis.limitations, ...context.needAnalysis.questions.map(q => q.text)]) assert.ok(focus.content.includes(value), value);
  assert.equal(snapshot.analysisContext.summary, context.summary);
  assert.equal(snapshot.analysisContext.needAnalysis.intendedOutput, context.needAnalysis.intendedOutput);
  const sameWords = make({ context, hypotheses: [{ ...longHypotheses[0], summary: context.summary }] });
  assert.ok(sameWords.text.includes(context.summary), "No semantic classifier may delete the same words from an included source field");
});

test("blank optional list values create no empty subordinate labels and do not change the snapshot", () => {
  const hypotheses = [{ ...longHypotheses[0], supportingInformation: ["", "  "], limitations: [], unknowns: [], question: null, questions: [] }];
  const { projection, snapshot } = make({ hypotheses });
  const hypothesis = projection.documentGroups[1].sections.find(section => section.role === "hypothesis");
  assert.doesNotMatch(hypothesis.content, /Podpůrné informace:|Omezení:|Neznámé:|Otázky ke zpřesnění:/);
  assert.deepEqual(snapshot.baselineHypotheses[0].supportingInformation, ["", "  "]);
});

for (const path of ["POCHOPIT", "POZOROVAT", "VYTVOŘIT"]) test(`G: ${path} preserves every supported accepted component and relation in the extensions group`, () => {
  const { snapshot, projection, text } = make({ path, expanded: true });
  assert.deepEqual(projection.documentGroups.map(g => g.heading), ["Informace ze Zápisníku", "Pracovní hypotézy", "Rozšíření analýzy"]);
  const extensions = projection.documentGroups[2].sections;
  assert.equal(extensions.length, snapshot.currentRozbor.components.length);
  const leafText = (value, key = "") => typeof value === "string" ? (/hypothesisIds$/i.test(key) ? [] : [value]) : Array.isArray(value) ? value.flatMap(v => leafText(v, key)) : value && typeof value === "object" ? Object.entries(value).flatMap(([k,v]) => /hypothesisIds$/i.test(k) ? [] : leafText(v,k)) : [];
  for (const [index, component] of snapshot.currentRozbor.components.entries()) {
    for (const value of leafText(component.content)) assert.ok(extensions[index].content.includes(value), `${component.kind}: ${value}`);
    assert.equal(extensions[index].role, "extension");
  }
  assert.ok(text.indexOf("Nejistota a omezení") < text.indexOf("Rozšíření analýzy"));
  assert.equal(projection.sections[0], projection.documentGroups[0].sections[0], "flat compatibility index references the same projection sections");
  const general = projection.documentGroups[1].sections.find(s => s.role === "uncertainty");
  assert.deepEqual(general.blocks[0].items, [longContext.mainUncertainty]);
  for (const limitation of snapshot.limitations) assert.ok(text.includes(limitation), limitation);
});

test("distinct uncertainties are retained; exact aggregated local limitations are not duplicated in the general area", () => {
  const context = { ...longContext, mainUncertainty: "Pozorování neumožňují určit příčinu." };
  const hypotheses = [{ ...longHypotheses[0], limitations: ["Pozorování neumožňují určit příčinu!"], unknowns: ["Vliv rušivých podnětů není známý."] }];
  const { projection, text } = make({ context, hypotheses });
  assert.deepEqual(projection.documentGroups[1].sections.at(-1).blocks[0].items, [context.mainUncertainty]);
  assert.ok(text.includes(hypotheses[0].limitations[0]) && text.includes(context.mainUncertainty));
  assert.equal((text.match(/Vliv rušivých podnětů není známý\./g) ?? []).length, 1);
});

test("aggregated limitations are only deduplicated when the exact value is actually projected elsewhere", () => {
  const need = { needId: "n1", needText: longContext.needAnalysis.sourceText, initialF2Path: "VYTVOŘIT", f3Target: null };
  const config = { ...createCurrentRozborState().VYTVOŘIT.config, refineObjective: true };
  const [spec] = deriveRequiredCurrentRozborComponents("VYTVOŘIT", need, longHypotheses, config);
  const extra = "Přijaté obecné omezení mimo běžná pole komponenty.";
  const component = { ...spec, content: { ...structuredContent["creation-objective"], additionalContext: { limitations: [extra] } } };
  const snapshot = createF2ToF3Snapshot(need, longHypotheses, "VYTVOŘIT", { config, components: [component] }, 2, longContext);
  assert.ok(snapshot.limitations.includes(extra));
  const projection = renderWorkingAnalysis(snapshot);
  assert.ok(projection.documentGroups[1].sections.at(-1).content.includes(extra));
  assert.ok(f3MaterialToText(projection).includes(extra));
});
