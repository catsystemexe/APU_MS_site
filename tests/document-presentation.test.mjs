import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { documentTextBlocks, documentSectionKind } from "../app/document-presentation.ts";
import { createCurrentRozborState, createF2ToF3Snapshot, deriveRequiredCurrentRozborComponents } from "../app/f2-build-model.ts";
import { renderWorkingAnalysis, f3MaterialToText } from "../app/f3-working-analysis.ts";
import { copyF3Output } from "../app/f3-output-export.ts";
import { longHypotheses, longContext, longComponentText } from "./document-style-fixture.mjs";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../app/document-content.tsx", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  .replace(/from "(react(?:\/jsx-runtime)?|lucide-react)"/g, (_, name) => `from ${JSON.stringify(pathToFileURL(require.resolve(name)).href)}`)
  .replace(/from "(\.\/[^";]+)"/g, (_, name) => `from ${JSON.stringify(new URL(`../app/${name.slice(2)}.ts`, import.meta.url).href)}`);
const { DocumentContent } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const render = (content, style, workingAnalysis = true) => renderToStaticMarkup(React.createElement(DocumentContent, { content, documentStyle: style, workingAnalysis, documentRef: { current: null }, stale: false, sourceRevision: 4 }));
const normalize = (text) => text.replace(/\s+/g, " ").trim();
const semanticText = (html) => normalize(html.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/g, "").replace(/<span[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/span>/g, "").replace(/<[^>]+>/g, " "));

test("bounded adapter recognizes explicit bullets and retains uncertain prose literally", () => {
  assert.deepEqual(documentTextBlocks("Úvod.\n\nPodpůrné informace:\n• První informace\n• Druhá informace\n\nZávěr."), [
    { kind: "paragraph", text: "Úvod." }, { kind: "paragraph", text: "Podpůrné informace:" },
    { kind: "list", items: ["První informace", "Druhá informace"] }, { kind: "paragraph", text: "Závěr." },
  ]);
  for (const text of ["• Možné zalomení\nPokračování bez značky.", "  • Odsazený text", "- Neinterpretovat Markdown\n1. Číslovaný popis", "• ", "Řádek\ndruhý řádek"]) {
    assert.deepEqual(documentTextBlocks(text), [{ kind: "paragraph", text }]);
  }
});

test("icons use only known deterministic section associations; unknown headings are undecorated", () => {
  assert.equal(documentSectionKind("Informace ze Zápisníku"), "notebook");
  assert.equal(documentSectionKind("Pracovní hypotézy"), "hypotheses");
  assert.equal(documentSectionKind("Pracovní hypotéza 2 — Podmínky"), null);
  assert.equal(documentSectionKind("Rozšíření analýzy"), "extensions");
  assert.equal(documentSectionKind("Rozvinutí hypotézy: Podmínky"), null);
  for (const heading of ["Nový název", "Pedagogická potřeba navíc", "Pracovní hypotéza bez známého tvaru", "constructor"]) assert.equal(documentSectionKind(heading), null);
  const html = render({ kind: "material", title: "Název", introduction: "Úvod", sections: [{ heading: "Nový název", content: "Nezměněné znění" }], table: null, cards: [], usageNote: null }, "b");
  assert.ok(!html.includes("<svg"));
  assert.doesNotMatch(html, /document-section-number/);
});

for (const path of ["POCHOPIT", "POZOROVAT", "VYTVOŘIT"]) for (const expanded of [false, true]) test(`${path} ${expanded ? "accepted expansion" : "baseline"}: A/B preserve every source section, question, uncertainty and copied word`, async () => {
  const need = { needId: "n1", needText: "Potřebuji pochopit podmínky zapojení.", initialF2Path: path, f3Target: null };
  const config = { ...createCurrentRozborState()[path].config, expansionDepth: expanded ? 2 : 0 };
  const components = deriveRequiredCurrentRozborComponents(path, need, longHypotheses, config).map((spec) => ({ ...spec, content: longComponentText }));
  const snapshot = createF2ToF3Snapshot(need, longHypotheses, path, { config, components }, 4, longContext);
  const before = JSON.stringify(snapshot);
  const content = renderWorkingAnalysis(snapshot);
  const original = JSON.stringify(content);
  const a = render(content, "a"); const b = render(content, "b");
  assert.equal(a.replaceAll("document-style-a", "document-style-b").replaceAll('data-document-style="a"', 'data-document-style="b"'), b);
  assert.equal(semanticText(a), semanticText(b));
  const expected = [content.title, content.introduction, ...content.documentGroups.flatMap((group) => [group.heading, ...group.sections.flatMap((section) => [section.heading, section.content.replace(/^• /gm, "")])]), "Podmínka použití", content.usageNote].join(" ");
  assert.equal(semanticText(a), normalize(expected));
  assert.equal((a.match(/<h3/g) ?? []).length, content.documentGroups.length);
  assert.equal((a.match(/<h4/g) ?? []).length, content.sections.length);
  assert.equal((a.match(/<h2/g) ?? []).length, 1);
  assert.match(a, /<ul class="document-list"><li>/);
  assert.match(a, /class="document-paragraph document-list-label">Podpůrné informace:/);
  assert.doesNotMatch(a, /document-section-number/);
  assert.deepEqual(content.documentGroups[1].sections.filter(section => section.role === "hypothesis").map(section => section.heading), longHypotheses.map(h => `Pracovní hypotéza ${h.rank} — ${h.title}`));
  assert.ok(!a.includes(longContext.summary) && !a.includes(longContext.needAnalysis.intendedOutput));
  assert.equal((semanticText(a).match(/Zdroj: přijatý Rozbor, revize 4/g) ?? []).length, 1);
  const copied = [];
  for (const style of ["a", "b"]) { render(content, style); await copyF3Output(content, { writeText: async (text) => copied.push(text) }); }
  assert.deepEqual(copied, [f3MaterialToText(content), f3MaterialToText(content)]);
  assert.equal(JSON.stringify(snapshot), before); assert.equal(JSON.stringify(content), original);
});

test("generated text/table/cards markup remains identical across A/B without default decoration", () => {
  const generated = { kind: "material", title: "Výstup", introduction: "Úvod", sections: [{ heading: "Část", content: "Původní\n• Znění" }], table: { columns: ["Pozorování"], rows: [["Data"]] }, cards: [{ title: "Karta", content: "Obsah" }], usageNote: "Původní podmínka" };
  const a = render(generated, "a", false); const b = render(generated, "b", false);
  assert.equal(a, b);
  assert.match(a, /<h3>Část<\/h3><p>Původní\n• Znění<\/p>/);
  assert.match(a, /<table>/); assert.match(a, /class="f3-cards"/);
  assert.doesNotMatch(a, /working-document|document-style-|document-list|<svg/);
});

test("style ownership is client-only and bypasses F3 config/acceptance/persistence", async () => {
  const client = await readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8");
  const finalization = await readFile(new URL("../app/f3-finalization.tsx", import.meta.url), "utf8");
  const model = await readFile(new URL("../app/f3-finalization-model.ts", import.meta.url), "utf8");
  assert.match(client, /useState<WorkingDocumentStyle>\("a"\)/);
  assert.match(client, /onDocumentStyle=\{setDocumentStyle\}/);
  assert.doesNotMatch(model, /documentStyle|WorkingDocumentStyle/);
  const picker = finalization.slice(finalization.indexOf('<fieldset className="document-style-picker"'), finalization.indexOf('</fieldset>'));
  assert.match(picker, /onDocumentStyle\?\.\("a"\)/);
  assert.match(picker, /onDocumentStyle\?\.\("b"\)/);
  assert.doesNotMatch(picker, /onConfig|onAdopt|onRender|fetch|localStorage/);
});
