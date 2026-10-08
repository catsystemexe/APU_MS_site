import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateCorpus, loadCorpus } from "../evals/f1-extraction/lib/eval-contract.ts";
import { auditGoldCorpus } from "../evals/f1-extraction/lib/gold-contract-audit.ts";
import { buildGoldV2Proposal } from "../evals/f1-extraction/lib/gold-v2-proposal.ts";
import { executeGoldV2Proposal } from "../evals/f1-extraction/propose-gold-v2.ts";
import { scoreCase } from "../evals/f1-extraction/lib/scoring.ts";

const corpusPath = new URL("../evals/f1-extraction/fixtures/corpus.json", import.meta.url).pathname;

function fact(id, category, text, quote, overrides = {}) {
  return { id, category, text, canonicalText: text, source: { inputIndex: 0, quote }, uncertain: false, negated: false, requiredMarkers: [], expectedAction: "add", relatedEntryId: null, ...overrides };
}

function validV2Case() {
  const input = "Při hluku občas odejde, v klidu zůstane a po přesazení už nekřičí.";
  const expectedFacts = [
    fact("x1", "context", "Při hluku.", "Při hluku"),
    fact("c1", "course", "Odchází občas.", "občas"),
    fact("m1", "manifestations", "Odejde.", "odejde"),
    fact("m2", "manifestations", "Zůstane.", "zůstane"),
    fact("h1", "helps", "Po přesazení už nekřičí.", "po přesazení už nekřičí", { negated: true, requiredMarkers: ["nekřičí"] }),
  ];
  return {
    version: 2,
    cases: [{
      id: "v2", suite: "mixed", description: "v2 contract", inputs: [input], startingNotebook: [], expectedFacts,
      expectedRelations: [
        { id: "r1", type: "context_of", sourceFactIds: ["x1"], targetFactIds: ["m1"], projectionFactIds: [], source: { inputIndex: 0, quote: "Při hluku občas odejde" } },
        { id: "r2", type: "course_of", sourceFactIds: ["c1"], targetFactIds: ["m1"], projectionFactIds: [], source: { inputIndex: 0, quote: "občas odejde" } },
        { id: "r3", type: "condition_effect", sourceFactIds: ["x1"], targetFactIds: ["m1"], projectionFactIds: ["h1"], source: { inputIndex: 0, quote: "Při hluku občas odejde" } },
        { id: "r4", type: "contrast_with", sourceFactIds: ["m1"], targetFactIds: ["m2"], projectionFactIds: [], source: { inputIndex: 0, quote: "odejde, v klidu zůstane" } },
      ],
      forbiddenInferences: [], tags: [], dimensions: { factCount: 5, categoryCount: 4, linguistic: ["contrast"] },
    }],
  };
}

test("Gold Contract v2 validates canonical facts and explicit relation integrity", () => {
  const corpus = validV2Case();
  assert.deepEqual(validateCorpus(corpus), { corpus, errors: [] });

  const missingCanonical = structuredClone(corpus);
  delete missingCanonical.cases[0].expectedFacts[0].canonicalText;
  assert.match(validateCorpus(missingCanonical).errors.join("\n"), /canonicalText/);

  const missingRelations = structuredClone(corpus);
  delete missingRelations.cases[0].expectedRelations;
  assert.match(validateCorpus(missingRelations).errors.join("\n"), /expectedRelations/);

  const invalid = structuredClone(corpus);
  invalid.cases[0].expectedRelations.push({ ...invalid.cases[0].expectedRelations[0] });
  invalid.cases[0].expectedRelations[0].sourceFactIds = ["x1", "x1"];
  invalid.cases[0].expectedRelations[1].sourceFactIds = ["m1"];
  invalid.cases[0].expectedRelations[2].projectionFactIds = ["m2", "missing"];
  invalid.cases[0].expectedRelations[3].targetFactIds = ["m1"];
  invalid.cases[0].expectedRelations[3].source.quote = "not in input";
  const errors = validateCorpus(invalid).errors.join("\n");
  assert.match(errors, /contains duplicate fact ids/);
  assert.match(errors, /course facts/);
  assert.match(errors, /helps facts/);
  assert.match(errors, /unknown fact/);
  assert.match(errors, /must be disjoint/);
  assert.match(errors, /source quote is not present/);
  assert.match(errors, /id is duplicated/);
});

test("Gold Contract v2 rejects cross-turn relation references", () => {
  const corpus = validV2Case();
  corpus.cases[0].inputs.push("Druhý vstup.");
  corpus.cases[0].expectedFacts[0].source = { inputIndex: 1, quote: "Druhý vstup" };
  assert.match(validateCorpus(corpus).errors.join("\n"), /different input turn/);
});

test("v2 scoring uses canonicalText while retaining surface text and reports relation recall unavailable", () => {
  const corpus = validV2Case();
  const item = corpus.cases[0];
  item.expectedFacts = [fact("m1", "manifestations", "Při hluku odejde.", "odejde", { canonicalText: "Odejde." })];
  item.expectedRelations = [];
  item.dimensions = { factCount: 1, categoryCount: 1, linguistic: ["simple"] };
  const candidate = { inputIndex: 0, category: "manifestations", sourceQuote: "odejde", notebookText: "Odejde.", action: "add", relatedEntryId: null, reason: null };
  const score = scoreCase(item, [candidate]);
  assert.equal(score.matches[0].state, "EXACT");
  assert.equal(score.metrics.relationRecall, null);
});

test("richer same-category relational wording can match canonical meaning, while unsupported meaning cannot", () => {
  const input = "Při hluku odejde.";
  const item = {
    id: "rich", suite: "mixed", description: "rich candidate", inputs: [input], startingNotebook: [],
    expectedFacts: [fact("m1", "manifestations", "Při hluku odejde.", input, { canonicalText: "Odejde." })], expectedRelations: [],
    forbiddenInferences: [], tags: [], dimensions: { factCount: 1, categoryCount: 1, linguistic: ["conditional"] },
  };
  const rich = { inputIndex: 0, category: "manifestations", sourceQuote: input, notebookText: "Při hluku odejde.", action: "add", relatedEntryId: null, reason: null };
  const admitted = scoreCase(item, [rich]);
  assert.equal(admitted.matches[0].state, "EXACT");

  const unsupported = { ...rich, notebookText: "Má autismus." };
  const rejected = scoreCase(item, [unsupported], [{ kind: "alignment", goldFactId: "m1", candidateIndexes: [0], decision: "equivalent", reason: "incorrect judge" }]);
  assert.notEqual(rejected.matches[0].state, "SEMANTIC_EQUIVALENT");
  assert.deepEqual(rejected.unsupportedCandidateIndexes, [0]);
});

test("v1 scoring falls back to text and remains compatible", async () => {
  const corpus = await loadCorpus(corpusPath);
  assert.equal(corpus.version, 1);
  const item = corpus.cases.find((entry) => entry.id === "atomic-manifestation");
  const fact = item.expectedFacts[0];
  assert.equal("canonicalText" in fact, false);
  const candidate = { inputIndex: 0, category: fact.category, sourceQuote: fact.source.quote, notebookText: fact.text, action: fact.expectedAction, relatedEntryId: fact.relatedEntryId, reason: null };
  assert.equal(scoreCase(item, [candidate]).matches[0].state, "EXACT");
});

test("v2 audit evaluates canonical text and respects explicit relations", () => {
  const corpus = validV2Case();
  corpus.cases[0].expectedFacts[2].text = "Při hluku odejde.";
  corpus.cases[0].expectedFacts[2].canonicalText = "Odejde.";
  const report = auditGoldCorpus(corpus);
  assert.equal(report.relationAware, true);
  assert.equal(report.findings.some((entry) => entry.goldFactId === "m1" && entry.suspectedAdditionalDimensions.includes("context")), false);
});

test("helps projection may share evidence with a manifestation and audit separates violations from heuristics", () => {
  const corpus = validV2Case();
  corpus.cases[0].expectedFacts[4].source = { inputIndex: 0, quote: "odejde" };
  corpus.cases[0].expectedFacts[4].text = "Odejde.";
  corpus.cases[0].expectedFacts[4].canonicalText = "Odejde.";
  corpus.cases[0].expectedFacts[4].negated = false;
  corpus.cases[0].expectedFacts[4].requiredMarkers = [];
  assert.deepEqual(validateCorpus(corpus).errors, []);
  const report = auditGoldCorpus(corpus);
  assert.deepEqual(report.deterministicViolations, []);
  assert.equal(report.heuristicFindings, report.findings);

  delete corpus.cases[0].expectedFacts[0].canonicalText;
  assert.ok(auditGoldCorpus(corpus).deterministicViolations.some((entry) => entry.reason.includes("canonicalText")));
});

test("Gold v2 proposal is deterministic, complete for required cases, and writes JSON plus Markdown", async () => {
  const corpus = await loadCorpus(corpusPath);
  const first = buildGoldV2Proposal(corpus);
  const second = buildGoldV2Proposal(corpus);
  assert.deepEqual(first, second);
  assert.deepEqual(first.summary, { total: 18, byConfidence: { mechanical: 2, high: 8, "human-review-required": 8 } });
  const auditKeys = auditGoldCorpus(corpus).findings.map((finding) => `${finding.caseId}/${finding.goldFactId}`);
  const keys = new Set(first.changes.map((change) => `${change.caseId}/${change.goldFactId}`));
  for (const key of auditKeys) assert.ok(keys.has(key), `current audit finding has proposal: ${key}`);
  for (const key of [
    "atomic-uncertainty/m1", "human-gate-david/m1", "human-gate-klarka/c1", "human-gate-klarka/c2",
    "human-gate-ondra/c2", "mixed-condition-result/m1", "mixed-contrast-situations/m1", "mixed-duplicate/m1",
    "mixed-negation-and-help/m1", "mixed-negation-and-help/h1",
  ]) assert.ok(keys.has(key), key);
  const branches = first.changes.filter((change) => ["human-gate-klarka/m2", "human-gate-klarka/m3", "human-gate-ondra/m1"].includes(`${change.caseId}/${change.goldFactId}`));
  assert.ok(branches.every((change) => change.newFacts.every((fact) => fact.category !== "course")));
  const david = first.changes.find((change) => change.caseId === "human-gate-david" && change.goldFactId === "m1");
  assert.deepEqual(david.newFacts.map((fact) => [fact.category, fact.canonicalText]), [["course", "Výbuchy se objevují občas."], ["course", "Výbuchy jsou velmi silné."]]);
  const klarka = first.changes.find((change) => change.caseId === "human-gate-klarka" && change.goldFactId === "c1");
  assert.equal(klarka.textStaysUnchanged, true);
  assert.ok(klarka.relations.some((relation) => relation.type === "condition_effect"));
  assert.ok(klarka.helpsProjections.length > 0);
  const ondra = first.changes.find((change) => change.caseId === "human-gate-ondra" && change.goldFactId === "c2");
  assert.match(ondra.proposedCanonicalText, /ne vždy/);
  assert.ok(ondra.relations.filter((relation) => relation.type === "condition_effect").length === 2);
  const duplicate = first.changes.find((change) => change.caseId === "mixed-duplicate" && change.goldFactId === "m1");
  assert.ok(duplicate.newFacts.some((fact) => fact.category === "context" && fact.canonicalText === "Při ranním kruhu."));
  const negation = first.changes.find((change) => change.caseId === "mixed-negation-and-help" && change.goldFactId === "h1");
  assert.ok(negation.relations.some((relation) => relation.type === "condition_effect"));
  assert.ok(first.changes.every((change) => ["mechanical", "high", "human-review-required"].includes(change.confidence)));

  const root = await mkdtemp(join(tmpdir(), "apu-f1-gold-v2-"));
  try {
    const result = await executeGoldV2Proposal(corpusPath, root);
    assert.deepEqual(result, first);
    assert.deepEqual(JSON.parse(await readFile(join(root, "gold-v2-proposal.json"), "utf8")), first);
    assert.match(await readFile(join(root, "gold-v2-proposal.md"), "utf8"), /atomic-uncertainty \/ m1/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
