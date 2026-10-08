import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseProviderRozborComponents, rozborComponentProviderSchema } from "../app/f2-component-provider-contract.ts";
import { deriveRequiredCurrentRozborComponents } from "../app/f2-build-model.ts";

const [route, providerContract, client] = await Promise.all([
  readFile(new URL("../app/api/f2/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/f2-component-provider-contract.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8"),
]);
const componentBoundary = `${route}\n${providerContract}`;

test("one F2 API explicitly routes all paths and emits path-relative telemetry", () => {
  assert.match(route, /BUILD_SCHEMAS\[activePath\]/); assert.match(route, /PATH_PROMPTS\[activePath\]/); assert.match(route, /body\.build/);
  for (const path of ["POCHOPIT", "POZOROVAT", "VYTVOŘIT"]) assert.ok(route.includes(path));
  assert.match(route, /F2 build execution — \$\{activePath\}/); assert.match(route, /F2 preview — \$\{activePath\}/);
});

test("shared prompt preserves truth hierarchy, explicit routing, dynamic hypotheses, uncertainty and F3 boundary", () => {
  for (const boundary of ["Jednotkou práce je jedna situace", "Fakta Zápisníku", "Aktivní cesta v požadavku je autoritativní", "Sdílené hypotézy zůstávají dynamické", "Nejistota nikdy automaticky neblokuje", "F2 nesmí plně materializovat finální artefakt"]) assert.ok(route.includes(boundary), boundary);
});

test("each POZOROVAT skill has distinct observation semantics and anti-confirmation/F3 guards", () => {
  for (const semantic of ["pozorovatelných indikátorů", "informativní situace", "kontrasty podmínek", "přiměřené období", "syrový záznam"]) assert.ok(route.includes(semantic), semantic);
  for (const guard of ["evidenci proti nim", "co pozorování vyřešit může", "ani hotový formulář či tabulka", "ne široký vysvětlující esej"]) assert.ok(route.includes(guard), guard);
});

test("each VYTVOŘIT skill has distinct semantics, conditional precision and F2/F3 boundary", () => {
  for (const semantic of ["cíl odlišný od formátu artefaktu", "plausibilní přístupy", "realistické varianty", "podmínky prostředí", "indikátory úspěchu realizace"]) assert.ok(route.includes(semantic), semantic);
  for (const guard of ["nejnižší toleranci", "adaptabilními rozsahy", "Pedagogický cíl není F3 artefakt", "nikoli hotový materiál"]) assert.ok(route.includes(guard), guard);
});

test("preview is snapshot-only, path-authoritative and cannot materialize F3", () => { for (const boundary of ["výhradně z neměnného F2 snapshotu", "autoritativní cestu", "nesmí vést k finální materializaci F3 dokumentu"]) assert.ok(route.includes(boundary), boundary); });
test("zero skills retain a complete base path task and model results are locally validated", () => { for (const text of ["Základní úloha aktivní cesty", "Žádné; proveď pouze základní úlohu", "parseF2BuildResult", "parseF2RenderedPreview"]) assert.ok(route.includes(text), text); assert.equal(route.includes("activeSkills.length > 0"), false); });

test("shared current-Rozbor component operation is bounded, strict, and path-aware", () => {
  for (const text of ["generate-rozbor-components", "validRozborGeneration", "rozborComponentProviderSchema", "parseGeneratedRozborComponents", "deriveRequiredCurrentRozborComponents", "componentRequest.activePath"]) assert.ok(componentBoundary.includes(text), text);
  assert.match(providerContract, /required: componentIds/);
  assert.match(providerContract, /Object\.fromEntries\(specs\.map/);
  assert.doesNotMatch(providerContract, /items:\s*\{\s*anyOf/);
  assert.match(route, /components\.map\(\(\{ id, kind, hypothesisId \}\)/);
});

test("component prompts keep expansion depths, comparison, and expert framing semantically distinct", () => {
  for (const text of ["Hloubka 1 — Základně", "Hloubka 2 — Podrobně", "Hloubka 3 — Do hloubky", "ROZVINUTÍ HYPOTÉZY", "POROVNÁNÍ", "ODBORNÝ RÁMEC", "nefabrikuj studie", "kanonická fakta uživatele mají přednost"]) assert.ok(route.includes(text), text);
});

test("POZOROVAT component schema and prompt require grounded discriminative observation", () => {
  for (const field of ["purpose", "indicators", "observableAs", "conditionA", "conditionB", "whatToObserve", "supportSignal", "weakeningSignal", "supportsHypothesisIds", "weakensHypothesisIds", "doesNotDiscriminateWhen", "priorities", "limitations"]) assert.ok(componentBoundary.includes(field), field);
  for (const guard of ["nikoli vytvořit diagnostický závěr nebo generický checklist", "pouze z konkrétního Zápisníku", "kratší versus delší situace", "možnost držet předmět versus bez ní", "přímo pozorovatelný", "nejvíce diskriminační"]) assert.ok(route.includes(guard), guard);
});

test("VYTVOŘIT component schema requires an explicit selected approach before later materialization", () => {
  for (const field of ["candidateApproaches", "workingApproach", "rationale", "objective", "conditions", "whyRequired", "checks", "successSignal", "adjustmentSignal"]) assert.ok(componentBoundary.includes(field), field);
  for (const guard of ["Povinně zvol jeden explicitní pracovní/doporučený přístup", "samotný seznam variant je neplatný", "nematerializuje finální F3 dokument"]) assert.ok(route.includes(guard), guard);
});

test("provider contract uses deterministic slots for the real six-component VYTVOŘIT request", () => {
  const hypotheses = [
    { id: "h1", rank: 1, title: "Citlivost na opravu", summary: "Reakce může souviset s prožitkem chyby.", relevantNeeds: [], question: null, supportingInformation: [], limitations: [], unknowns: [], questions: [] },
    { id: "h2", rank: 2, title: "Konflikt očekávání", summary: "Reakce může souviset s nesouladem záměru a zpětné vazby.", relevantNeeds: [], question: null, supportingInformation: [], limitations: [], unknowns: [], questions: [] },
  ];
  const need = { needId: "n-klarka", needText: "Podpořit Klárku při protichůdné reakci na korekci a zpětnou vazbu.", initialF2Path: "VYTVOŘIT", f3Target: "Praktický materiál" };
  const config = { expansionDepth: 3, candidateApproaches: true, refineObjective: true, successConditions: true, followUpVerification: true };
  const requested = deriveRequiredCurrentRozborComponents("VYTVOŘIT", need, hypotheses, config);
  assert.deepEqual(requested.map(({ id }) => id), [
    "hypothesis:h1:expansion",
    "hypothesis:h2:expansion",
    "creation-approaches:all",
    "creation-objective:all",
    "success-conditions:all",
    "follow-up-verification:all",
  ]);
  const schema = rozborComponentProviderSchema(requested, hypotheses.map(({ id }) => id));
  assert.equal(schema.type, "object");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.components.type, "object");
  assert.equal(schema.properties.components.additionalProperties, false);
  assert.deepEqual(schema.properties.components.required, requested.map(({ id }) => id));
  assert.deepEqual(Object.keys(schema.properties.components.properties), requested.map(({ id }) => id));
  assert.equal(JSON.stringify(schema).includes('"anyOf"'), false);
  let declaredProperties = 0;
  const countProperties = (value) => {
    if (!value || typeof value !== "object") return;
    if (value.type === "object") declaredProperties += Object.keys(value.properties ?? {}).length;
    for (const nested of Object.values(value)) if (nested && typeof nested === "object") Array.isArray(nested) ? nested.forEach(countProperties) : countProperties(nested);
  };
  countProperties(schema);
  assert.equal(requested.length, 6);
  assert.ok(declaredProperties <= 100);
  assert.ok(Buffer.byteLength(JSON.stringify(schema)) < 15_000);

  const providerResult = { components: {
    "hypothesis:h1:expansion": "Rozvinutí první hypotézy.",
    "hypothesis:h2:expansion": "Rozvinutí druhé hypotézy.",
    "creation-approaches:all": {
      candidateApproaches: [{ title: "Předvídatelná korekce", description: "Oddělit informaci od hodnocení.", hypothesisIds: ["h1", "h2"], limitations: [] }],
      workingApproach: { title: "Krátká neutrální zpětná vazba", rationale: "Zachová informaci a snižuje tlak.", hypothesisIds: ["h1", "h2"], limitations: [] },
    },
    "creation-objective:all": { objective: "Umožnit přijmout korekci bez ztráty zapojení.", hypothesisIds: ["h1", "h2"], limitations: [] },
    "success-conditions:all": { conditions: [{ condition: "Klidný tón a jedna konkrétní informace", whyRequired: "Omezuje nejasnost zpětné vazby." }], limitations: [] },
    "follow-up-verification:all": { checks: [{ indicator: "Návrat k činnosti", when: "Po korekci", successSignal: "Klárka pokračuje nebo si vyžádá upřesnění.", adjustmentSignal: "Reakce se opakovaně stupňuje.", hypothesisIds: ["h1", "h2"] }], limitations: [] },
  } };
  const parsed = parseProviderRozborComponents(providerResult, requested);
  assert.equal(parsed.length, 6);
  assert.deepEqual(parsed.map(({ id }) => id), requested.map(({ id }) => id));
  const missingSlot = structuredClone(providerResult); delete missingSlot.components["success-conditions:all"];
  assert.throws(() => parseProviderRozborComponents(missingSlot, requested), /úplnou sadu/);
});

test("provider-safe fixed slots preserve POCHOPIT and POZOROVAT component schemas", () => {
  const hypotheses = [{ id: "h1", rank: 1, title: "Hypotéza", summary: "Shrnutí", relevantNeeds: [], question: null, supportingInformation: [], limitations: [], unknowns: [], questions: [] }];
  const cases = [
    ["POCHOPIT", { expansionDepth: 2, compareHypotheses: true, expertFrame: true }],
    ["POZOROVAT", { expansionDepth: 2, compareHypotheses: true, keyIndicators: true, observationPriorities: true }],
  ];
  for (const [path, config] of cases) {
    const need = { needId: `n-${path}`, needText: "Potřeba", initialF2Path: path, f3Target: null };
    const requested = deriveRequiredCurrentRozborComponents(path, need, hypotheses, config);
    const schema = rozborComponentProviderSchema(requested, ["h1"]);
    assert.deepEqual(Object.keys(schema.properties.components.properties), requested.map(({ id }) => id));
    assert.equal(JSON.stringify(schema).includes('"anyOf"'), false);
  }
});

test("F2 component provider failures expose only sanitized developer diagnostics", () => {
  assert.match(route, /componentRequest && identity\.role === "developer"/);
  assert.match(route, /\^\[a-z0-9_\.-\]\{1,80\}\$/i);
  assert.match(route, /F2 component provider request failed: status=/);
  const generation = client.slice(client.indexOf("async function generateCurrentRozbor"), client.indexOf("async function renderF2Preview"));
  assert.match(generation, /isDeveloper && payload\?\.diagnostic/);
});
