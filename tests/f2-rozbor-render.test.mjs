import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const panel = await readFile(new URL("../app/notepad.tsx", import.meta.url), "utf8");
const client = await readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8");

test("local expansion is rendered inside its matching hypothesis before cross-cutting blocks", () => {
  const hypothesisLoop = panel.indexOf("workingHypotheses.map");
  const expansion = panel.indexOf("f2-generated-expansion", hypothesisLoop);
  const comparison = panel.indexOf("Porovnání a souvislosti", expansion);
  const expert = panel.indexOf("Odborný rámec", comparison);
  assert.ok(hypothesisLoop >= 0 && expansion > hypothesisLoop && comparison > expansion && expert > comparison);
  assert.match(panel, /component\.hypothesisId === hypothesis\.id/);
});

test("first success changes CTA label and the new flow never invokes Preview", () => {
  assert.match(client, /AKTUALIZOVAT ROZBOR/);
  assert.match(client, /operation: "generate-rozbor-components"/);
  const generation = client.slice(client.indexOf("async function generatePochopitRozbor"), client.indexOf("async function renderF2Preview"));
  assert.equal(generation.includes('operation: "build"'), false);
  assert.equal(generation.includes('operation: "preview"'), false);
  assert.equal(generation.includes("setF2Preview"), false);
});

test("client checks current deterministic fingerprints before applying an in-flight response", () => {
  assert.match(client, /currentSignature !== requestSignature/);
  assert.match(client, /latestRozborSourceRef/);
  assert.match(client, /latestPochopitBuildRef/);
});
