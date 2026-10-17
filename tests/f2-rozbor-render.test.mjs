import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const panel = await readFile(new URL("../app/notepad.tsx", import.meta.url), "utf8");
const client = await readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8");

test("F2 uses the shared accepted-snapshot document instead of another live component mapping", () => {
  assert.match(panel, /function DocumentPanel/);
  assert.match(panel, /documentMode=\{workingAnalysis \? "analysis" : "output"\}/);
  assert.match(panel, /snapshot=\{props.f2ToF3Snapshot\}/);
  assert.doesNotMatch(panel, /function AnalysisPanel|function OutputPanel|CurrentRozborComponents|workingHypotheses.map|currentRozbor\[/);
});

test("primary CTA uses document terminology and the flow never invokes Preview", () => {
  assert.match(client, /AKTUALIZOVAT DOKUMENT/);
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
  assert.match(client, /applyCurrentRozborComponentUpdate\(currentRozbor, path, required, \[\]\)/);
  assert.doesNotMatch(client, /removedIds = new Set/);
});

test("one assigned path uses component generation without a route selector", () => {
  assert.match(client, /<F2BuildOperations/);
  assert.doesNotMatch(client, /F2_PATHS\.map|switchF2Path|Směr rozboru|onF2PathChange/);
  const generation = client.slice(client.indexOf("async function generateCurrentRozbor"), client.indexOf("async function renderF2Preview"));
  assert.equal(generation.includes('operation: "build"'), false);
});

test("POZOROVAT and VYTVOŘIT substantive sections remain in the canonical deterministic renderer", async () => {
  const renderer = await readFile(new URL("../app/f3-working-analysis.ts", import.meta.url), "utf8");
  for (const heading of ["Kontrasty podmínek", "Pozorovatelné indikátory", "Priority pozorování", "Pracovní přístup", "Pedagogický cíl", "Podmínky úspěchu", "Následné ověřování"]) assert.ok(renderer.includes(heading), heading);
  for (const relation of ["Podporuje:", "Oslabuje:", "Nerozliší, pokud:", "Omezení"]) assert.ok(renderer.includes(relation), relation);
});
