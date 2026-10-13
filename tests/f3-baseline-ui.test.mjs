import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createCurrentRozborState, createF2ToF3Snapshot, deriveRequiredCurrentRozborComponents } from "../app/f2-build-model.ts";
import { createF3State, acceptF3Render, createF3RenderRequest, updateF3Config, markF3SourceStale, adoptF2Snapshot } from "../app/f3-finalization-model.ts";

const require = createRequire(import.meta.url);
const documentSource = await readFile(new URL("../app/document-content.tsx", import.meta.url), "utf8");
const documentJS = ts.transpileModule(documentSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  .replace(/from "(react(?:\/jsx-runtime)?|react-dom|lucide-react)"/g, (_, name) => `from ${JSON.stringify(pathToFileURL(require.resolve(name)).href)}`)
  .replace(/from "(\.\/[^";]+)"/g, (_, name) => `from ${JSON.stringify(new URL(`../app/${name.slice(2)}.ts`, import.meta.url).href)}`);
const documentURL = `data:text/javascript;base64,${Buffer.from(documentJS).toString("base64")}`;
const source = await readFile(new URL("../app/f3-finalization.tsx", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  .replace(/from "(react(?:\/jsx-runtime)?|react-dom|lucide-react)"/g, (_, name) => `from ${JSON.stringify(pathToFileURL(require.resolve(name)).href)}`)
  .replace(/from "(\.\/[^";]+)"/g, (_, name) => `from ${JSON.stringify(name === "./document-content" ? documentURL : new URL(`../app/${name.slice(2)}.ts`, import.meta.url).href)}`);
const { F3Finalization } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const h = { id: "h1", rank: 1, title: "Pracovní možnost", summary: "Není jistý závěr", relevantNeeds: [], supportingInformation: ["Dostupná informace"], limitations: ["Podstatné omezení"], unknowns: ["Neznámá podmínka"], question: null, questions: [] };
for (const path of ["POCHOPIT", "POZOROVAT", "VYTVOŘIT"]) test(`${path} immediately renders baseline and export controls identically for normal/developer modes`, () => {
  const snapshot = createF2ToF3Snapshot({ needId: "n", needText: "Potřeba", initialF2Path: path, f3Target: "Specializovaný požadavek" }, [h], path, createCurrentRozborState()[path], 0);
  const props = { snapshot, state: createF3State(snapshot), sourceError: null, status: "idle", error: null, onRepresentation: () => {}, onConfig: () => {}, onRender: () => { throw new Error("must be explicit"); }, onAdopt: () => {}, onReturn: () => {} };
  const normal = renderToStaticMarkup(React.createElement(F3Finalization, props));
  const developer = renderToStaticMarkup(React.createElement(F3Finalization, { ...props, isDeveloper: true }));
  assert.equal(normal, developer);
  for (const expected of ["Pracovní pedagogická analýza", "Není jistý závěr", "Dostupná informace", "Podstatné omezení", "Neznámá podmínka"]) assert.ok(normal.includes(expected), expected);
  assert.ok(normal.includes("Pracovní analýzu můžete rovnou exportovat."));
  assert.ok(normal.includes("Nastavení níže slouží jen k vytvoření další podoby Výstupu."));
  assert.ok(normal.includes('aria-label="Nastavení další podoby Výstupu"'));
  assert.doesNotMatch(normal, /POCHOPIT|POZOROVAT|VYTVOŘIT|diagnostics/);
  const article = normal.slice(normal.indexOf('<article'), normal.indexOf('</article>'));
  assert.doesNotMatch(article, /<button|<select/);
  assert.ok(!normal.includes('<h2>Specializovaný požadavek</h2>'));
});

const article = (html) => html.slice(html.indexOf("<article"), html.indexOf("</article>") + 10);
const propsFor = (snapshot, state = createF3State(snapshot)) => ({ snapshot, state, sourceError: null, status: "idle", error: null, onRepresentation: () => {}, onConfig: () => {}, onRender: () => { throw new Error("navigation must never render"); }, onAdopt: () => {}, onReturn: () => {}, onContinueToOutput: () => {} });
const render = (props) => renderToStaticMarkup(React.createElement(F3Finalization, props));
const baselineFor = (path, revision = 0, hypotheses = [h]) => createF2ToF3Snapshot({ needId: "n", needText: "Potřeba", initialF2Path: path, f3Target: "Specializovaný požadavek" }, hypotheses, path, createCurrentRozborState()[path], revision);
for (const path of ["POCHOPIT", "POZOROVAT", "VYTVOŘIT"]) test(`${path}: F2/F3 default article and export content are exactly identical`, () => {
  const snapshot = baselineFor(path);
  const props = propsFor(snapshot);
  const build = render({ ...props, documentMode: "analysis" });
  const output = render({ ...props, documentMode: "output" });
  assert.equal(article(build), article(output));
  assert.equal((build.match(/<article/g) ?? []).length, 1);
  assert.equal((output.match(/<article/g) ?? []).length, 1);
  assert.doesNotMatch(build, /document-actions|Kopírovat dokument|Tisk \/ Uložit jako PDF/); // Export controls live only in the shared header portal.
  assert.doesNotMatch(article(build), /<button|<select|F3 ·|Specializovaný požadavek/);
});

test("Build uses current accepted source while retaining stale generated F3 and its config for explicit adoption", () => {
  const old = baselineFor("POCHOPIT");
  let state = updateF3Config(createF3State(old), { audience: "parent", lengthDetail: "detailed", structureMode: "cards" });
  const generated = { kind: "material", title: "GENERATED_A", introduction: "Přijatý zdroj A", sections: [{ heading: "A", content: "GENERATED_A_NEVER_SOURCE" }], cards: [{ title: "Karta", content: "Obsah" }], table: null, usageNote: null };
  state = acceptF3Render(state, generated, createF3RenderRequest(state));
  const serialized = JSON.stringify(state);
  assert.ok(article(render({ ...propsFor(old, state), documentMode: "analysis" })).includes("Pracovní možnost"));
  assert.doesNotMatch(article(render({ ...propsFor(old, state), documentMode: "analysis" })), /GENERATED_A/);
  assert.equal(JSON.stringify(state), serialized);
  const newer = baselineFor("POCHOPIT", 1, [{ ...h, summary: "Nově přijatá hypotéza" }]);
  state = markF3SourceStale(state, newer.sourceFingerprint);
  const props = propsFor(newer, state);
  const build = article(render({ ...props, documentMode: "analysis" }));
  assert.ok(build.includes("Nově přijatá hypotéza"));
  assert.ok(!build.includes("Starší výstup"));
  const output = render({ ...props, documentMode: "output" });
  assert.ok(output.includes("GENERATED_A_NEVER_SOURCE") && output.includes("Starší výstup"));
  assert.ok(output.includes("Přijmout aktuální Rozbor"));
  assert.throws(() => createF3RenderRequest(state), /přijměte aktuální Rozbor/);
  state = adoptF2Snapshot(state, newer);
  assert.equal(state.config.audience, "parent");
  assert.equal(state.config.structureMode, "cards");
  assert.equal(state.config.lengthDetail, "detailed");
  assert.equal(article(render({ ...propsFor(newer, state), documentMode: "output" })), article(render({ ...propsFor(newer, state), documentMode: "analysis" })));
  assert.equal(state.finalRender.content.title, "GENERATED_A");
  const request = createF3RenderRequest(state);
  assert.equal(request.sourceSnapshot.sourceRevision, 1);
  assert.ok(!JSON.stringify(request).includes("GENERATED_A"));
  const oldReference = render({ ...propsFor(newer, { ...state, representation: "material" }), documentMode: "output" });
  assert.ok(oldReference.includes("dříve přijatý Rozbor (starší výstup)"));
});

for (const path of ["POCHOPIT", "POZOROVAT", "VYTVOŘIT"]) test(`${path}: accepted expansion uses identical F2/F3 sections and retains uncertainty`, () => {
  const need = { needId: "n", needText: "Potřeba", initialF2Path: path, f3Target: "Specializovaný požadavek" };
  const config = { ...createCurrentRozborState()[path].config, expansionDepth: 2 };
  const components = deriveRequiredCurrentRozborComponents(path, need, [h], config).map(spec => ({ ...spec, content: "PŘIJATÉ ROZVINUTÍ — nadále pracovní, nejisté." }));
  const snapshot = createF2ToF3Snapshot(need, [h], path, { config, components }, 1);
  const props = propsFor(snapshot);
  const build = article(render({ ...props, documentMode: "analysis" }));
  assert.equal(build, article(render({ ...props, documentMode: "output" })));
  for (const text of ["PŘIJATÉ ROZVINUTÍ", "Dostupná informace", "Podstatné omezení", "Neznámá podmínka", "revize 1"]) assert.ok(build.includes(text), text);
});


test("compact metadata header is identical in Build/A/B/default Output and omitted for unknown/generated documents", () => {
  const snapshot = baselineFor("POCHOPIT");
  const metadata = { createdAt: "2026-10-13T12:34:56.789Z" };
  const props = { ...propsFor(snapshot), documentMetadata: metadata };
  const a = article(render({ ...props, documentStyle: "a" }));
  const b = article(render({ ...props, documentStyle: "b" }));
  assert.equal(a.replaceAll("document-style-a", "document-style-b").replace('data-document-style="a"','data-document-style="b"'), b);
  assert.equal(a, article(render({ ...props, documentMode: "analysis" })));
  assert.match(a, /Vytvořeno v APU/);
  assert.match(a, /dateTime="2026-10-13T12:34:56.789Z">13. 10. 2026/);
  const header = a.slice(a.indexOf("<header"), a.indexOf("</header>"));
  assert.match(header, /<h2>Pracovní pedagogická analýza<\/h2><p class="document-subtitle">Pracovní hypotézy/);
  assert.equal((a.match(/Pracovní hypotézy a jejich omezení podle/g) ?? []).length, 1);
  assert.equal((a.match(/Vytvořeno v APU/g) ?? []).length, 1);
  assert.doesNotMatch(article(render(propsFor(snapshot))), /Vytvořeno v APU|<time/);
  const content = { kind: "material", title: "Generated", introduction: "Original intro", sections: [{heading:"Original",content:"Original"}], cards: [], table: null, usageNote: null };
  const state = acceptF3Render(props.state, content, createF3RenderRequest(props.state));
  assert.doesNotMatch(article(render({ ...props, state })), /Vytvořeno v APU|document-subtitle/);
});

test("retained stale material warns only when selected; routine Output has no redundant return control", () => {
  const old = baselineFor("POCHOPIT");
  const content = {kind:"material",title:"OLD_CARD",introduction:"Old",sections:[{heading:"Old",content:"Old"}],cards:[{title:"Old card",content:"Retained"}],table:null,usageNote:null};
  const generated = acceptF3Render(createF3State(old), content, createF3RenderRequest(createF3State(old)));
  const newer = baselineFor("POCHOPIT", 1, [{...h,summary:"Updated"}]);
  const adopted = adoptF2Snapshot(generated, newer);
  const normal = render(propsFor(newer, adopted));
  assert.doesNotMatch(normal, /Starší výstup|Dosavadní výstup|Přijmout aktuální Rozbor|Vrátit se do Rozboru|Přejít do Buildu/);
  const retained = render(propsFor(newer, {...adopted,representation:"material"}));
  assert.match(retained, /OLD_CARD|Starší výstup|dříve přijatý Rozbor/);
});

test("primary Output button uses effective config/source equality and preserves disabled-state explanations", () => {
  const snapshot = baselineFor("POCHOPIT");
  const initial = createF3State(snapshot);
  const primary = state => render(propsFor(snapshot,state)).match(/<button[^>]*title="([^"]+)"[^>]*>AKTUALIZOVAT DOKUMENT<\/button>/)?.[0];
  assert.match(primary(initial), /disabled/);
  assert.match(primary(initial), /Pro další podobu změňte/);
  const configured = updateF3Config(initial,{audience:"parent"});
  assert.doesNotMatch(primary(configured), /disabled/);
  const content = {kind:"material",title:"Parent",introduction:"Accepted",sections:[{heading:"Data",content:"Data"}],table:null,cards:[],usageNote:null};
  const generated = acceptF3Render(configured, content, createF3RenderRequest(configured));
  assert.match(primary(generated), /disabled/);
  assert.match(primary(generated), /odpovídá zdroji a nastavení/);
  const changed = updateF3Config(generated,{languageStyle:"professional"});
  assert.doesNotMatch(primary(changed), /disabled/);
  const reverted = updateF3Config(changed,{languageStyle:"plain"});
  assert.match(primary(reverted), /disabled/);
  assert.doesNotMatch(render(propsFor(snapshot,reverted)), /Formátovací nastavení změněno|Starší výstup/);
});
