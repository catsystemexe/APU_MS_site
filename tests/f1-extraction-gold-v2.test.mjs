import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateCorpus, loadCorpus } from "../evals/f1-extraction/lib/eval-contract.ts";
import { auditGoldCorpus } from "../evals/f1-extraction/lib/gold-contract-audit.ts";
import { applyGoldV2Proposal, buildGoldV2Proposal } from "../evals/f1-extraction/lib/gold-v2-proposal.ts";
import { canonicalizeRelations, relationSignature } from "../evals/f1-extraction/lib/gold-relations.ts";
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

const MIGRATION_ADDED_FACT_IDS = {
  "atomic-uncertainty": ["x1"],
  "human-gate-david": ["c1", "c2"],
  "human-gate-klarka": ["x3", "h1", "h2"],
  "human-gate-ondra": ["h1", "h2"],
  "mixed-condition-result": ["x2", "x3", "m2", "h2"],
  "mixed-contrast-situations": ["x2", "m2", "m3"],
  "mixed-duplicate": ["x1"],
  "mixed-negation-and-help": ["x2"],
};

function reconstructPreMigrationCorpus(corpus) {
  const legacy = structuredClone(corpus);
  legacy.version = 1;
  for (const item of legacy.cases) {
    const added = new Set(MIGRATION_ADDED_FACT_IDS[item.id] ?? []);
    item.expectedFacts = item.expectedFacts.filter((fact) => !added.has(fact.id)).map((fact) => {
      const { canonicalText: _canonicalText, ...legacyFact } = fact;
      return legacyFact;
    });
    delete item.expectedRelations;
    item.dimensions.factCount = item.expectedFacts.length;
    item.dimensions.categoryCount = new Set(item.expectedFacts.map((fact) => fact.category)).size;
  }
  return legacy;
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
  const corpus = reconstructPreMigrationCorpus(await loadCorpus(corpusPath));
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

test("relation signatures deduplicate inverse contrasts and duplicate directional relations", () => {
  const relation = (id, type, sourceFactIds, targetFactIds, projectionFactIds = []) => ({ id, type, sourceFactIds, targetFactIds, projectionFactIds, source: { inputIndex: 0, quote: "A proti B" } });
  const forward = relation("forward", "contrast_with", ["m1"], ["m2"]);
  const inverse = relation("inverse", "contrast_with", ["m2"], ["m1"]);
  assert.equal(relationSignature(forward), relationSignature(inverse));
  assert.deepEqual(canonicalizeRelations([forward]).relations, canonicalizeRelations([inverse]).relations);
  const contrast = canonicalizeRelations([forward, inverse]);
  assert.equal(contrast.relations.length, 1);
  assert.equal(contrast.deduplicatedCount, 1);
  assert.deepEqual(contrast.relations[0].sourceFactIds, ["m1"]);
  assert.deepEqual(contrast.relations[0].targetFactIds, ["m2"]);
  const duplicateAuditCorpus = validV2Case();
  duplicateAuditCorpus.cases[0].expectedRelations.push({ id: "r5", type: "contrast_with", sourceFactIds: ["m2"], targetFactIds: ["m1"], projectionFactIds: [], source: { inputIndex: 0, quote: "odejde, v klidu zůstane" } });
  assert.ok(auditGoldCorpus(duplicateAuditCorpus).deterministicViolations.some((entry) => entry.code === "duplicate_relation"));

  const effectA = relation("effect-a", "condition_effect", ["x1"], ["c1"], ["h1"]);
  const effectB = relation("effect-b", "condition_effect", ["x1"], ["c1"], ["h1"]);
  assert.equal(canonicalizeRelations([effectA, effectB]).relations.length, 1);
  assert.throws(() => canonicalizeRelations([effectA, { ...effectB, id: "effect-a" }]), /Duplicate proposed relation id/);
});

test("relation-aware audit accepts context → course → manifestation wording", () => {
  const corpus = validV2Case();
  const item = corpus.cases[0];
  item.expectedFacts[1].text = "Při hluku odchází občas.";
  item.expectedFacts[1].canonicalText = "Odchází občas.";
  item.expectedRelations = [
    { id: "effect", type: "condition_effect", sourceFactIds: ["x1"], targetFactIds: ["c1"], projectionFactIds: ["h1"], source: { inputIndex: 0, quote: "Při hluku občas odejde" } },
    { id: "course", type: "course_of", sourceFactIds: ["c1"], targetFactIds: ["m1"], projectionFactIds: [], source: { inputIndex: 0, quote: "Při hluku občas odejde" } },
  ];
  assert.deepEqual(validateCorpus(corpus).errors, []);
  assert.equal(auditGoldCorpus(corpus).findings.some((finding) => finding.goldFactId === "c1"), false);
});

test("approved Gold v2 migration proposal is ready, qualifier-preserving, deterministic, and complete", async () => {
  const corpus = await loadCorpus(corpusPath);
  const legacy = reconstructPreMigrationCorpus(corpus);
  assert.deepEqual(validateCorpus(legacy).errors, []);
  const original = JSON.stringify(legacy);
  const first = buildGoldV2Proposal(legacy);
  const second = buildGoldV2Proposal(legacy);
  assert.deepEqual(first, second);
  assert.equal(first.status, "migration_proposal");
  assert.deepEqual(first.summary, {
    sourceCorpusVersion: 1, targetCorpusVersion: 2, proposedCaseCount: 8, proposedFactChanges: 19,
    proposedNewFacts: 17, proposedRelations: 25, deduplicatedRelationCount: 3,
    mechanical: 2, high: 17, humanReviewRequired: 0, readyToApply: true, validationPassed: true,
    auditDeterministicViolations: 0, auditUnexpectedHeuristics: 0,
  });
  const auditKeys = auditGoldCorpus(legacy).findings.map((finding) => `${finding.caseId}/${finding.goldFactId}`);
  const keys = new Set(first.changes.map((change) => `${change.caseId}/${change.goldFactId}`));
  for (const key of auditKeys) assert.ok(keys.has(key), `current audit finding has proposal: ${key}`);
  for (const key of [
    "atomic-uncertainty/m1", "human-gate-david/m1", "human-gate-klarka/c1", "human-gate-klarka/c2",
    "human-gate-ondra/c2", "mixed-condition-result/m1", "mixed-contrast-situations/m1", "mixed-duplicate/m1",
    "mixed-negation-and-help/m1", "mixed-negation-and-help/h1",
  ]) assert.ok(keys.has(key), key);
  const branches = first.changes.filter((change) => ["human-gate-klarka/m2", "human-gate-klarka/m3", "human-gate-ondra/m1"].includes(`${change.caseId}/${change.goldFactId}`));
  const caseProposal = (id) => first.caseProposals.find((item) => item.caseId === id);
  assert.ok(branches.every((change) => change.newFactIds.every((id) => caseProposal(change.caseId).newFacts.find((fact) => fact.id === id)?.category !== "course")));
  const david = caseProposal("human-gate-david");
  assert.deepEqual(david.newFacts.map((fact) => [fact.category, fact.canonicalText]), [["course", "Výbuchy se objevují občas."], ["course", "Výbuchy jsou velmi silné."]]);
  const klarka = first.changes.find((change) => change.caseId === "human-gate-klarka" && change.goldFactId === "c1");
  assert.equal(klarka.textStaysUnchanged, true);
  assert.ok(klarka.helpsProjectionIds.length > 0);
  const klarkaRelations = caseProposal("human-gate-klarka").relations;
  assert.ok(klarkaRelations.some((relation) => relation.type === "condition_effect" && relation.sourceFactIds.join() === "x1" && relation.targetFactIds.join() === "c1" && relation.projectionFactIds.join() === "h1"));
  assert.ok(klarkaRelations.some((relation) => relation.type === "course_of" && relation.sourceFactIds.join() === "c1" && relation.targetFactIds.includes("m3")));
  assert.ok(klarkaRelations.some((relation) => relation.type === "condition_effect" && relation.sourceFactIds.join() === "x2" && relation.targetFactIds.join() === "c2" && relation.projectionFactIds.join() === "h2"));
  assert.ok(klarkaRelations.some((relation) => relation.type === "course_of" && relation.sourceFactIds.join() === "c2" && relation.targetFactIds.includes("m3")));
  assert.equal(klarkaRelations.filter((relation) => relation.type === "contrast_with" && relation.sourceFactIds.includes("m2") && relation.targetFactIds.includes("m3")).length, 1);
  const klarkaContrastChanges = first.changes.filter((change) => change.caseId === "human-gate-klarka" && ["m2", "m3"].includes(change.goldFactId));
  assert.equal(klarkaContrastChanges[0].relationIds.find((id) => klarkaContrastChanges[1].relationIds.includes(id)) !== undefined, true);
  const ondra = first.changes.find((change) => change.caseId === "human-gate-ondra" && change.goldFactId === "c2");
  assert.match(ondra.proposedCanonicalText, /ne vždy/);
  const ondraRelations = caseProposal("human-gate-ondra").relations;
  assert.ok(ondraRelations.some((relation) => relation.type === "condition_effect" && relation.sourceFactIds.join() === "x1" && relation.targetFactIds.join() === "c2"));
  assert.ok(ondraRelations.some((relation) => relation.type === "condition_effect" && relation.sourceFactIds.join() === "x2" && relation.targetFactIds.join() === "c2"));
  assert.ok(ondraRelations.some((relation) => relation.type === "course_of" && relation.sourceFactIds.join() === "c2" && relation.targetFactIds.join() === "m2"));
  assert.equal(ondraRelations.filter((relation) => relation.type === "contrast_with").length, 1);
  const duplicate = caseProposal("mixed-duplicate");
  assert.ok(duplicate.newFacts.some((fact) => fact.category === "context" && fact.canonicalText === "Při ranním kruhu."));
  const negation = caseProposal("mixed-negation-and-help");
  const negationEffects = negation.relations.filter((relation) => relation.type === "condition_effect" && relation.sourceFactIds.join() === "x2" && relation.targetFactIds.join() === "m1" && relation.projectionFactIds.join() === "h1");
  assert.equal(negationEffects.length, 1);
  const negationChanges = first.changes.filter((change) => change.caseId === "mixed-negation-and-help");
  assert.equal(negationChanges[0].relationIds[0], negationChanges[1].relationIds[0]);
  assert.ok(first.changes.every((change) => ["mechanical", "high", "human-review-required"].includes(change.confidence)));
  const pending = first.changes.filter((change) => change.decisionStatus === "pending_human_review");
  assert.equal(pending.length, 0);
  const approvedCanonical = new Map([
    ["human-gate-david/x1", "Někdy tomu předchází konflikt s dítětem."],
    ["human-gate-david/x2", "Jindy tomu předchází požadavek učitelky."],
    ["human-gate-david/x3", "Jindy tomu předchází velký hluk."],
    ["human-gate-klarka/m1", "Reaguje velmi rozdílně."],
    ["human-gate-klarka/m2", "Někdy opravu přijme."],
    ["human-gate-klarka/m3", "Jindy začne křičet."],
    ["human-gate-ondra/m1", "Někdy zvládne celou řízenou činnost bez problému."],
    ["human-gate-ondra/m2", "Jindy odbíhá."],
    ["human-gate-ondra/c1", "Po pár minutách."],
  ]);
  for (const [key, canonicalText] of approvedCanonical) {
    const [caseId, goldFactId] = key.split("/");
    const change = first.changes.find((candidate) => candidate.caseId === caseId && candidate.goldFactId === goldFactId);
    assert.equal(change?.proposedCanonicalText, canonicalText, key);
    assert.equal(change?.decisionStatus, "ready_to_apply", key);
  }
  assert.equal(first.changes.some((change) => ["Opravu přijme.", "Začne křičet.", "Odbíhá."].includes(change.proposedCanonicalText)), false, "approved contrast qualifiers must not be weakened");

  const migrated = applyGoldV2Proposal(legacy, first);
  assert.equal(migrated.version, 2);
  assert.ok(migrated.cases.every((item) => item.expectedFacts.every((fact) => typeof fact.canonicalText === "string" && fact.canonicalText.length > 0)));
  assert.ok(migrated.cases.every((item) => Array.isArray(item.expectedRelations)));
  for (const item of migrated.cases) {
    assert.equal(item.dimensions.factCount, item.expectedFacts.length);
    assert.equal(item.dimensions.categoryCount, new Set(item.expectedFacts.map((fact) => fact.category)).size);
  }
  assert.deepEqual(validateCorpus(migrated).errors, []);
  const migratedAudit = auditGoldCorpus(migrated);
  assert.deepEqual(migratedAudit.deterministicViolations, []);
  assert.deepEqual(migratedAudit.heuristicFindings, []);
  assert.equal(JSON.stringify(legacy), original, "in-memory migration must not mutate its source corpus");
  assert.deepEqual(migrated, corpus, "committed corpus must equal the fully approved migration result");

  const root = await mkdtemp(join(tmpdir(), "apu-f1-gold-v2-"));
  try {
    const legacyPath = join(root, "corpus-v1.json");
    const proposalDirectory = join(root, "proposal");
    await writeFile(legacyPath, JSON.stringify(legacy));
    const result = await executeGoldV2Proposal(legacyPath, proposalDirectory);
    assert.deepEqual(result, first);
    assert.deepEqual(JSON.parse(await readFile(join(proposalDirectory, "gold-v2-proposal.json"), "utf8")), first);
    const markdown = await readFile(join(proposalDirectory, "gold-v2-proposal.md"), "utf8");
    assert.match(markdown, /### atomic-uncertainty/);
    assert.match(markdown, /Canonical relations:/);
    assert.match(markdown, /ready_to_apply/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("committed corpus is complete Gold v2 and proposal tooling returns an idempotent no-op", async () => {
  const corpus = await loadCorpus(corpusPath);
  assert.equal(corpus.version, 2);
  assert.equal(corpus.cases.length, 48);
  assert.equal(corpus.cases.reduce((total, item) => total + item.expectedFacts.length, 0), 184);
  assert.equal(corpus.cases.reduce((total, item) => total + item.expectedRelations.length, 0), 25);
  for (const item of corpus.cases) {
    assert.ok(item.expectedFacts.every((fact) => typeof fact.canonicalText === "string" && fact.canonicalText.length > 0), item.id);
    assert.ok(Array.isArray(item.expectedRelations), item.id);
    assert.equal(new Set(item.expectedRelations.map(relationSignature)).size, item.expectedRelations.length, `${item.id} relation signatures`);
    assert.equal(item.dimensions.factCount, item.expectedFacts.length, `${item.id} factCount`);
    assert.equal(item.dimensions.categoryCount, new Set(item.expectedFacts.map((fact) => fact.category)).size, `${item.id} categoryCount`);
  }
  assert.deepEqual(validateCorpus(corpus).errors, []);
  const audit = auditGoldCorpus(corpus);
  assert.deepEqual(audit.deterministicViolations, []);
  assert.deepEqual(audit.heuristicFindings, []);
  assert.deepEqual(audit.relationFindings, []);

  const ondra = corpus.cases.find((item) => item.id === "human-gate-ondra");
  assert.ok(ondra.expectedRelations.some((relation) => relation.type === "course_of" && relation.sourceFactIds.join() === "c1" && relation.targetFactIds.join() === "m2"));
  const noOp = buildGoldV2Proposal(corpus);
  assert.equal(noOp.status, "already_migrated");
  assert.deepEqual(noOp.changes, []);
  assert.deepEqual(noOp.caseProposals, []);
  assert.deepEqual(noOp.summary, {
    sourceCorpusVersion: 2, targetCorpusVersion: 2, proposedCaseCount: 0, proposedFactChanges: 0,
    proposedNewFacts: 0, proposedRelations: 0, deduplicatedRelationCount: 0,
    mechanical: 0, high: 0, humanReviewRequired: 0, readyToApply: true, validationPassed: true,
    auditDeterministicViolations: 0, auditUnexpectedHeuristics: 0,
  });
  assert.deepEqual(applyGoldV2Proposal(corpus, noOp), corpus);

  const root = await mkdtemp(join(tmpdir(), "apu-f1-gold-v2-noop-"));
  try {
    const result = await executeGoldV2Proposal(corpusPath, root);
    assert.deepEqual(result, noOp);
    assert.match(await readFile(join(root, "gold-v2-proposal.md"), "utf8"), /Status: already_migrated/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
