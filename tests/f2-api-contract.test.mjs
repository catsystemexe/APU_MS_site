import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../app/api/f2/route.ts", import.meta.url), "utf8");

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

test("POCHOPIT component operation is bounded, strict, and returns direct semantic IDs", () => {
  for (const text of ["generate-rozbor-components", "validRozborGeneration", "rozborComponentSchema", "parseGeneratedRozborComponents", "F2 POCHOPIT component generation"]) assert.ok(route.includes(text), text);
  assert.match(route, /minItems: specs\.length, maxItems: specs\.length/);
  assert.match(route, /enum: \[spec\.id\]/);
  assert.match(route, /components\.map\(\(\{ id, kind, hypothesisId \}\)/);
});

test("component prompts keep expansion depths, comparison, and expert framing semantically distinct", () => {
  for (const text of ["Hloubka 1 — Základně", "Hloubka 2 — Podrobně", "Hloubka 3 — Do hloubky", "ROZVINUTÍ HYPOTÉZY", "POROVNÁNÍ", "ODBORNÝ RÁMEC", "nefabrikuj studie", "kanonická fakta uživatele mají přednost"]) assert.ok(route.includes(text), text);
});
