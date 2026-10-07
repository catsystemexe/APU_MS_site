import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const panel = await readFile(new URL("../app/notepad.tsx", import.meta.url), "utf8");
const client = await readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8");

test("local expansion is rendered inside its matching hypothesis before cross-cutting blocks", () => {
  const hypothesisLoop = panel.indexOf("workingHypotheses.map");
  const expansion = panel.indexOf("f2-generated-expansion", hypothesisLoop);
  const crossCuttingRender = panel.indexOf("<CurrentRozborComponents", expansion);
  const componentRenderer = panel.indexOf("function CurrentRozborComponents");
  const comparison = panel.indexOf("Porovnání a souvislosti", componentRenderer);
  const expert = panel.indexOf("Odborný rámec", comparison);
  assert.ok(hypothesisLoop >= 0 && expansion > hypothesisLoop && crossCuttingRender > expansion && comparison > componentRenderer && expert > comparison);
  assert.match(panel, /component\.hypothesisId === hypothesis\.id/);
});

test("first success changes CTA label and the new flow never invokes Preview", () => {
  assert.match(client, /AKTUALIZOVAT ROZBOR/);
  assert.match(client, /operation: "generate-rozbor-components"/);
  const generation = client.slice(client.indexOf("async function generateCurrentRozbor"), client.indexOf("async function renderF2Preview"));
  assert.equal(generation.includes('operation: "build"'), false);
  assert.equal(generation.includes('operation: "preview"'), false);
  assert.equal(generation.includes("setF2Preview"), false);
});

test("client checks current deterministic fingerprints before applying an in-flight response", () => {
  assert.match(client, /currentSignature !== updateSignature/);
  assert.match(client, /latestRozborSourceRef/);
  assert.match(client, /latestCurrentRozborRef/);
});

test("incremental CTA is reconciliation-derived and removals are deferred to explicit update", () => {
  assert.match(client, /isCurrentRozborUpdatePending/);
  assert.match(client, /!currentRozborReconciliation\.isRozborCurrent/);
  assert.match(client, /applyCurrentRozborComponentUpdate\(current, path, required, \[\]\)/);
  assert.doesNotMatch(client, /removedIds = new Set/);
});

test("all three current paths are selectable without using legacy processed build execution", () => {
  for (const path of ["POCHOPIT", "POZOROVAT", "VYTVOŘIT"]) assert.ok(client.includes(path), path);
  assert.match(client, /F2_PATHS\.map/);
  assert.match(client, /switchF2Path\(current, path\)/);
  const generation = client.slice(client.indexOf("async function generateCurrentRozbor"), client.indexOf("async function renderF2Preview"));
  assert.equal(generation.includes('operation: "build"'), false);
});

test("POZOROVAT and VYTVOŘIT current components expose their required semantic sections", () => {
  for (const heading of ["Kontrasty podmínek", "Klíčové pozorovatelné indikátory", "Priority pozorování", "Pracovní / doporučený přístup", "Praktický / pedagogický cíl", "Podmínky úspěchu", "Co následně ověřovat"]) assert.ok(panel.includes(heading), heading);
  for (const relation of ["Podporuje:", "Oslabuje:", "Nerozliší, pokud:", "Limity / nejistota:"]) assert.ok(panel.includes(relation), relation);
});
