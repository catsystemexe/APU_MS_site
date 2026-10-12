import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createCurrentRozborState, createF2ToF3Snapshot } from "../app/f2-build-model.ts";
import { createF3State } from "../app/f3-finalization-model.ts";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../app/f3-finalization.tsx", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  .replace(/from "(react(?:\/jsx-runtime)?)"/g, (_, name) => `from ${JSON.stringify(pathToFileURL(require.resolve(name)).href)}`)
  .replace(/from "(\.\/[^";]+)"/g, (_, name) => `from ${JSON.stringify(new URL(`../app/${name.slice(2)}.ts`, import.meta.url).href)}`);
const { F3Finalization } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const h = { id: "h1", rank: 1, title: "Pracovní možnost", summary: "Není jistý závěr", relevantNeeds: [], supportingInformation: ["Dostupná informace"], limitations: ["Podstatné omezení"], unknowns: ["Neznámá podmínka"], question: null, questions: [] };
for (const path of ["POCHOPIT", "POZOROVAT", "VYTVOŘIT"]) test(`${path} immediately renders baseline and export controls identically for normal/developer modes`, () => {
  const snapshot = createF2ToF3Snapshot({ needId: "n", needText: "Potřeba", initialF2Path: path, f3Target: "Specializovaný požadavek" }, [h], path, createCurrentRozborState()[path], 0);
  const props = { snapshot, state: createF3State(snapshot), sourceError: null, status: "idle", error: null, onRepresentation: () => {}, onConfig: () => {}, onRender: () => { throw new Error("must be explicit"); }, onAdopt: () => {}, onReturn: () => {} };
  const normal = renderToStaticMarkup(React.createElement(F3Finalization, props));
  const developer = renderToStaticMarkup(React.createElement(F3Finalization, { ...props, isDeveloper: true }));
  assert.equal(normal, developer);
  for (const expected of ["Pracovní pedagogická analýza", "Není jistý závěr", "Dostupná informace", "Podstatné omezení", "Neznámá podmínka", "Tisk / Uložit jako PDF", "Kopírovat text"]) assert.ok(normal.includes(expected), expected);
  assert.doesNotMatch(normal, /POCHOPIT|POZOROVAT|VYTVOŘIT|diagnostics/);
  const article = normal.slice(normal.indexOf('<article'), normal.indexOf('</article>'));
  assert.doesNotMatch(article, /<button|<select/);
  assert.ok(!normal.includes('<h2>Specializovaný požadavek</h2>'));
});
