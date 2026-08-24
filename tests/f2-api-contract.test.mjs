import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../app/api/f2/route.ts", import.meta.url), "utf8");

test("F2 API gates execution to POCHOPIT and distinguishes build from preview telemetry", () => {
  assert.match(route, /body\.activePath === "POCHOPIT"/);
  assert.match(route, /f2-build-execution/);
  assert.match(route, /f2-preview-render/);
});

test("POCHOPIT prompt enforces situation-level truth hierarchy, skill composition and uncertainty", () => {
  for (const boundary of ["Jednotkou práce je jedna situace", "Fakta Zápisníku jsou kanonická", "kompozice operací", "co chybí, proč to záleží a co to omezuje", "Nevytvářej automatické otázky", "vlastní F3 logiku"]) assert.ok(route.includes(boundary), boundary);
  for (const skill of ["Rozviň mechanismy", "Porovnej podobnosti", "odliš asociaci od kauzality", "parametr uživatele musí řídit", "nedělej diagnózu"]) assert.ok(route.includes(skill), skill);
});

test("preview prompt is snapshot-only and cannot silently redesign F2 or F3", () => {
  assert.match(route, /výhradně z neměnného F2 snapshotu/);
  assert.match(route, /neměň pedagogickou potřebu, cestu ani analytické závěry/);
  assert.match(route, /ne finální F3 dokument/);
});
