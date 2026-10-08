import assert from "node:assert/strict";
import test from "node:test";
import { loadCorpus } from "../evals/f1-extraction/lib/eval-contract.ts";
import { auditGoldCorpus } from "../evals/f1-extraction/lib/gold-contract-audit.ts";

const corpusPath = new URL("../evals/f1-extraction/fixtures/corpus.json", import.meta.url).pathname;

test("gold-contract audit examines all 48 fixtures and detects atomic-uncertainty", async () => {
  const report = auditGoldCorpus(await loadCorpus(corpusPath));
  assert.equal(report.casesAudited, 48);
  assert.equal(report.factsAudited, 167);
  const finding = report.findings.find((entry) => entry.caseId === "atomic-uncertainty" && entry.goldFactId === "m1");
  assert.ok(finding);
  assert.equal(finding.currentCategory, "manifestations");
  assert.deepEqual(finding.suspectedAdditionalDimensions, ["context"]);
  assert.ok(["definite contract mismatch", "probable mismatch"].includes(finding.severity));
});

test("gold-contract audit does not flag an already atomized manifestation/context example", async () => {
  const report = auditGoldCorpus(await loadCorpus(corpusPath));
  assert.equal(report.findings.some((entry) => entry.caseId === "atomic-manifestation-context"), false);
});
