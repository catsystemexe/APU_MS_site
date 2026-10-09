import assert from "node:assert/strict";
import test from "node:test";
import { runStagedSemanticJudge } from "../evals/f1-extraction/lib/pipeline.ts";
import { deriveStagedSemanticEvaluation, replayStagedSemanticEvaluationFromEvidence, validateStagedSemanticEvidence } from "../evals/f1-extraction/lib/semantic-evidence.ts";
import { buildResultArtifacts } from "../evals/f1-extraction/lib/reporting.ts";
import { scoreCase } from "../evals/f1-extraction/lib/scoring.ts";
import { calculateStageMetrics } from "../evals/f1-extraction/lib/stage-analysis.ts";

const input = "Potřebuji zajistit klid a zajistit kratší úkoly. Při práci je ve třídě hlučno.";

function gold(id, text = "Zajistit klid a kratší úkoly.") {
  return { id, category: "goals", text, source: { inputIndex: 0, quote: input }, uncertain: false, negated: false, requiredMarkers: [], expectedAction: "add", relatedEntryId: null };
}

function evalCase(expectedFacts = [gold("goal")]) {
  return {
    id: "semantic-stage", suite: "mixed", description: "semantic stage", inputs: [input], startingNotebook: [], expectedFacts,
    forbiddenInferences: [], tags: [], dimensions: { factCount: expectedFacts.length, categoryCount: expectedFacts.length ? 1 : 0, linguistic: ["compound"] },
  };
}

function candidate(candidateId, notebookText, category = "goals") {
  return { candidateId, origin: "extraction", inputIndex: 0, category, sourceQuote: input, notebookText, action: "add", relatedEntryId: null, reason: null, start: 0, end: input.length };
}

function turn(pre, survivingIds) {
  const surviving = new Set(survivingIds);
  return [{
    inputIndex: 0,
    rawExtraction: { situationRelation: "same", situationReason: null, categoryReview: { manifestations: "none", goals: "found", context: "none", course: "none", helps: "none" }, candidates: [] },
    normalizedExtractionCandidates: pre,
    rawCoverageCandidates: null,
    normalizedCoverageCandidates: [],
    preGroundingCandidates: pre,
    groundingSubmittedCandidates: pre,
    groundingVerdicts: pre.map((entry, submittedIndex) => ({
      candidateId: entry.candidateId, submittedIndex, accepted: surviving.has(entry.candidateId), reason: surviving.has(entry.candidateId) ? null : "grounding rejected", providerVerdict: { index: submittedIndex, accepted: surviving.has(entry.candidateId), reason: surviving.has(entry.candidateId) ? null : "grounding rejected" },
    })),
    finalCandidates: pre.filter((entry) => surviving.has(entry.candidateId)),
  }];
}

function output(factDecisions, candidateIds) {
  return { factDecisions, candidateDecisions: candidateIds.map((candidateId) => ({ candidateId, decision: "uncertain", reason: "classified through fact support" })) };
}

function equivalent(goldFactId, groups) {
  return { goldFactId, decision: "equivalent", supportGroups: groups.map((candidateIds) => ({ candidateIds })), reason: "semantically sufficient" };
}

function evaluated(entry) {
  const { candidateId, origin, ...value } = entry;
  void candidateId;
  void origin;
  return value;
}

test("one semantic support candidate survives for PRE and POST coverage", () => {
  const a = candidate("candidate-a", "Zajistit klid a krátké úkoly.");
  const result = deriveStagedSemanticEvaluation(evalCase(), turn([a], [a.candidateId]), output([equivalent("goal", [[a.candidateId]])], [a.candidateId]));
  assert.equal(result.preScore.counts.semanticCovered, 1);
  assert.equal(result.postScore.counts.semanticCovered, 1);
  assert.equal(result.evidence.goldFacts[0].preCovered, true);
  assert.equal(result.evidence.goldFacts[0].postCovered, true);
});

test("atomic-uncertainty cross-category judge support is auditable but cannot create coverage", () => {
  const atomicInput = "Možná odejde hlavně při hluku.";
  const item = {
    id: "atomic-uncertainty", suite: "atomic", description: "Uncertainty plus context", inputs: [atomicInput], startingNotebook: [],
    expectedFacts: [{ id: "m1", category: "manifestations", text: atomicInput, source: { inputIndex: 0, quote: "Možná odejde hlavně při hluku" }, uncertain: true, negated: false, requiredMarkers: ["Možná"], expectedAction: "add", relatedEntryId: null }],
    forbiddenInferences: [], tags: [], dimensions: { factCount: 1, categoryCount: 1, linguistic: ["uncertainty"] },
  };
  const manifestation = { ...candidate("turn-0-extract-0", "Možná odejde."), sourceQuote: "Možná odejde" };
  const context = { ...candidate("turn-0-extract-1", "Hlavně při hluku.", "context"), sourceQuote: "hlavně při hluku" };
  const turns = turn([manifestation, context], [manifestation.candidateId, context.candidateId]);
  const judged = output([equivalent("m1", [[manifestation.candidateId, context.candidateId]])], [manifestation.candidateId, context.candidateId]);
  const result = deriveStagedSemanticEvaluation(item, turns, judged);
  const evidence = result.evidence.goldFacts[0];
  assert.equal(result.preScore.counts.semanticCovered, 0);
  assert.equal(result.postScore.counts.semanticCovered, 0);
  assert.deepEqual(evidence.rawSupportGroups, [{ candidateIds: [manifestation.candidateId, context.candidateId] }]);
  assert.deepEqual(evidence.supportGroups, []);
  assert.deepEqual(evidence.postSupportGroups, []);
  assert.equal(evidence.preCovered, false);
  assert.equal(evidence.postCovered, false);
  assert.equal(evidence.rejectionCode, "inadmissible_semantic_support");
  assert.deepEqual(evidence.rejectedSupportGroups[0].reasons, ["category_mismatch"]);
});

test("rejected semantic support becomes a traceable grounding loss", () => {
  const a = candidate("candidate-a", "Zajistit klid a krátké úkoly.");
  const turns = turn([a], []);
  const result = deriveStagedSemanticEvaluation(evalCase(), turns, output([equivalent("goal", [[a.candidateId]])], [a.candidateId]));
  const metrics = calculateStageMetrics(result.preScore, result.postScore, turns);
  assert.equal(result.preScore.counts.semanticCovered, 1);
  assert.equal(result.postScore.counts.semanticCovered, 0);
  assert.deepEqual(metrics.groundingLossGoldFactIds, ["goal"]);
  assert.deepEqual(result.evidence.goldFacts[0].removedCandidateIds, [a.candidateId]);
  assert.equal(result.evidence.goldFacts[0].groundingVerdicts[0].reason, "grounding rejected");
});

test("fact absent before grounding is an extraction miss, not a grounding loss", () => {
  const turns = turn([], []);
  const result = deriveStagedSemanticEvaluation(evalCase(), turns, null);
  const metrics = calculateStageMetrics(result.preScore, result.postScore, turns);
  assert.deepEqual(metrics.extractionMissGoldFactIds, ["goal"]);
  assert.deepEqual(metrics.groundingLossGoldFactIds, []);
});

test("joint semantic support remains only while every required candidate survives", () => {
  const a = candidate("candidate-a", "Zajistit klid.");
  const b = candidate("candidate-b", "Zajistit kratší úkoly.");
  const judged = output([equivalent("goal", [[a.candidateId, b.candidateId]])], [a.candidateId, b.candidateId]);
  const both = deriveStagedSemanticEvaluation(evalCase(), turn([a, b], [a.candidateId, b.candidateId]), judged);
  const one = deriveStagedSemanticEvaluation(evalCase(), turn([a, b], [a.candidateId]), judged);
  assert.equal(both.postScore.counts.semanticCovered, 1);
  assert.equal(one.postScore.counts.semanticCovered, 0);
  assert.equal(one.evidence.goldFacts[0].groundingLoss, true);
});

test("an alternative sufficient support group preserves POST coverage", () => {
  const a = candidate("candidate-a", "Zajistit klid a krátké úkoly.");
  const b = candidate("candidate-b", "Zajistit klid.");
  const c = candidate("candidate-c", "Zajistit kratší úkoly.");
  const judged = output([equivalent("goal", [[a.candidateId], [b.candidateId, c.candidateId]])], [a.candidateId, b.candidateId, c.candidateId]);
  const result = deriveStagedSemanticEvaluation(evalCase(), turn([a, b, c], [b.candidateId, c.candidateId]), judged);
  assert.equal(result.preScore.counts.semanticCovered, 1);
  assert.equal(result.postScore.counts.semanticCovered, 1);
  assert.deepEqual(result.evidence.goldFacts[0].postSupportGroups, [{ candidateIds: [b.candidateId, c.candidateId] }]);
});

test("saved equivalent evidence replays surviving support and grounding loss", () => {
  const a = candidate("candidate-a", "Zajistit klid a krátké úkoly.");
  const originalTurns = turn([a], [a.candidateId]);
  const original = deriveStagedSemanticEvaluation(evalCase(), originalTurns, output([equivalent("goal", [[a.candidateId]])], [a.candidateId]));
  const surviving = replayStagedSemanticEvaluationFromEvidence(evalCase(), originalTurns, original.preScore, original.evidence);
  const removed = replayStagedSemanticEvaluationFromEvidence(evalCase(), turn([a], []), original.preScore, original.evidence);
  assert.equal(surviving.postScore.matches[0].state, "SEMANTIC_EQUIVALENT");
  assert.equal(removed.postScore.matches[0].state, "MISS");
  assert.equal(removed.postDecisions[0].decision, "not_equivalent");
});

test("saved not_equivalent evidence reproduces original POST MISS", () => {
  const a = candidate("candidate-a", "Zajistit klid, nikoli kratší úkoly.");
  const turns = turn([a], [a.candidateId]);
  const item = evalCase();
  assert.equal(scoreCase(item, [evaluated(a)]).matches[0].state, "REVIEW");
  const rejection = { goldFactId: "goal", decision: "not_equivalent", supportGroups: [], reason: "The candidate negates part of the required goal." };
  const original = deriveStagedSemanticEvaluation(item, turns, output([rejection], [a.candidateId]));
  const replayed = replayStagedSemanticEvaluationFromEvidence(item, turns, original.preScore, original.evidence);
  assert.equal(original.postScore.matches[0].state, "MISS");
  assert.equal(replayed.postScore.matches[0].state, "MISS");
  assert.deepEqual(replayed.postScore.counts, original.postScore.counts);
  assert.deepEqual(replayed.postScore.metrics, original.postScore.metrics);
  assert.deepEqual(replayed.postDecisions, [{
    kind: "alignment", goldFactId: "goal", candidateIndexes: [], decision: "not_equivalent", reason: rejection.reason,
  }]);
});

test("saved uncertain evidence remains unresolved during replay", () => {
  const a = candidate("candidate-a", "Zajistit klid a možná kratší úkoly.");
  const turns = turn([a], [a.candidateId]);
  const uncertain = { goldFactId: "goal", decision: "uncertain", supportGroups: [], reason: "Insufficient semantic confidence." };
  const original = deriveStagedSemanticEvaluation(evalCase(), turns, output([uncertain], [a.candidateId]));
  const replayed = replayStagedSemanticEvaluationFromEvidence(evalCase(), turns, original.preScore, original.evidence);
  assert.equal(original.postScore.matches[0].state, "REVIEW");
  assert.equal(replayed.postScore.matches[0].state, "REVIEW");
  assert.deepEqual(replayed.postDecisions, []);
});

test("saved deterministic exact and missing facts replay without semantic decisions", () => {
  const exact = candidate("exact", "Zajistit klid a kratší úkoly.");
  const exactTurns = turn([exact], [exact.candidateId]);
  const exactOriginal = deriveStagedSemanticEvaluation(evalCase(), exactTurns, null);
  const exactReplay = replayStagedSemanticEvaluationFromEvidence(evalCase(), exactTurns, exactOriginal.preScore, exactOriginal.evidence);
  assert.equal(exactOriginal.evidence.goldFacts[0].decision, "exact");
  assert.equal(exactReplay.postScore.matches[0].state, "EXACT");
  assert.deepEqual(exactReplay.postDecisions, []);

  const missingTurns = turn([], []);
  const missingOriginal = deriveStagedSemanticEvaluation(evalCase(), missingTurns, null);
  const missingReplay = replayStagedSemanticEvaluationFromEvidence(evalCase(), missingTurns, missingOriginal.preScore, missingOriginal.evidence);
  assert.equal(missingOriginal.evidence.goldFacts[0].decision, "missing");
  assert.equal(missingReplay.postScore.matches[0].state, "MISS");
  assert.deepEqual(missingReplay.postDecisions, []);
});

test("replay preserves saved candidate classifications for surviving candidates", () => {
  const extra = candidate("extra", "Ve třídě bývá hlučno.", "context");
  const unsupported = candidate("unsupported", "Ve třídě je bezpečno.", "context");
  const turns = turn([extra, unsupported], [extra.candidateId, unsupported.candidateId]);
  const judged = { factDecisions: [], candidateDecisions: [
    { candidateId: extra.candidateId, decision: "grounded_extra", reason: "explicit extra" },
    { candidateId: unsupported.candidateId, decision: "unsupported", reason: "not supported" },
  ] };
  const original = deriveStagedSemanticEvaluation(evalCase([]), turns, judged);
  const replayed = replayStagedSemanticEvaluationFromEvidence(evalCase([]), turns, original.preScore, original.evidence);
  assert.deepEqual(replayed.postScore.candidateClassifications, original.postScore.candidateClassifications);
  assert.deepEqual(replayed.postScore.counts, original.postScore.counts);
  assert.deepEqual(replayed.postScore.metrics, original.postScore.metrics);
});

test("one candidate may support two gold facts on the same semantic basis", () => {
  const a = candidate("candidate-a", "Zajistit klid a krátké úkoly.");
  const item = evalCase([gold("calm", "Zajistit klid."), gold("short", "Zajistit kratší úkoly.")]);
  const judged = output([equivalent("calm", [[a.candidateId]]), equivalent("short", [[a.candidateId]])], [a.candidateId]);
  const result = deriveStagedSemanticEvaluation(item, turn([a], [a.candidateId]), judged);
  assert.equal(result.preScore.counts.semanticCovered, 2);
  assert.equal(result.postScore.counts.semanticCovered, 2);
});

test("candidate extra and unsupported classifications are filtered, not re-judged", () => {
  const extra = candidate("extra", "Ve třídě bývá hlučno.", "context");
  const unsupported = candidate("unsupported", "Ve třídě je bezpečno.", "context");
  const item = evalCase([]);
  const baseOutput = { factDecisions: [], candidateDecisions: [
    { candidateId: extra.candidateId, decision: "grounded_extra", reason: "explicit extra" },
    { candidateId: unsupported.candidateId, decision: "unsupported", reason: "not supported" },
  ] };
  const survive = deriveStagedSemanticEvaluation(item, turn([extra], [extra.candidateId]), { factDecisions: [], candidateDecisions: [baseOutput.candidateDecisions[0]] });
  const removedExtra = deriveStagedSemanticEvaluation(item, turn([extra], []), { factDecisions: [], candidateDecisions: [baseOutput.candidateDecisions[0]] });
  const removedUnsupported = deriveStagedSemanticEvaluation(item, turn([unsupported], []), { factDecisions: [], candidateDecisions: [baseOutput.candidateDecisions[1]] });
  assert.equal(survive.postScore.counts.groundedExtra, 1);
  assert.equal(calculateStageMetrics(removedExtra.preScore, removedExtra.postScore, turn([extra], [])).groundedExtrasRemoved, 1);
  assert.equal(calculateStageMetrics(removedUnsupported.preScore, removedUnsupported.postScore, turn([unsupported], [])).unsupportedRemoved, 1);
});

test("hard invariant validation rejects impossible or unknown support", () => {
  const base = {
    preCandidateIds: ["a"], postCandidateIds: ["a"], candidates: [],
    goldFacts: [{ goldFactId: "g", decision: "equivalent", reason: "x", supportGroups: [{ candidateIds: ["a"] }], postSupportGroups: [{ candidateIds: ["a"] }], preCovered: false, postCovered: true, groundingLoss: false, removedCandidateIds: [], groundingVerdicts: [] }],
  };
  assert.throws(() => validateStagedSemanticEvidence(base), /not PRE-covered/);
  assert.throws(() => validateStagedSemanticEvidence({ ...base, preCandidateIds: [], postCandidateIds: ["a"], goldFacts: [], candidates: [] }), /absent from PRE evidence/);
  assert.throws(() => validateStagedSemanticEvidence({ ...base, preCandidateIds: ["a", "a"], goldFacts: [] }), /duplicate/);
  assert.throws(() => validateStagedSemanticEvidence({ ...base, goldFacts: [{ ...base.goldFacts[0], preCovered: true, supportGroups: [{ candidateIds: ["unknown"] }] }] }), /unknown candidate/);
  assert.throws(() => validateStagedSemanticEvidence({ ...base, postCandidateIds: [], goldFacts: [{ ...base.goldFacts[0], preCovered: true }] }), /did not survive/);
  assert.throws(() => validateStagedSemanticEvidence({ ...base, postCandidateIds: [], goldFacts: [{ ...base.goldFacts[0], preCovered: false, postCovered: false, postSupportGroups: [], groundingLoss: true }] }), /Grounding-loss state/);
});

test("aggregate artifacts expose paired stage dimensions and reject POST coverage above PRE", () => {
  const a = candidate("candidate-a", "Zajistit klid a krátké úkoly.");
  const turns = turn([a], [a.candidateId]);
  const evaluated = deriveStagedSemanticEvaluation(evalCase(), turns, output([equivalent("goal", [[a.candidateId]])], [a.candidateId]));
  const run = {
    ...evaluated.postScore,
    profile: "baseline", pipeline: "coverage", repetition: 1,
    candidates: [a], latencyMs: 1, inputTokens: 0, outputTokens: 0, estimatedCostUsd: null,
    suite: "mixed", factCount: 1, categoryCount: 1, linguistic: ["compound"],
    preGroundingScore: evaluated.preScore, stageTurns: turns,
    stageMetrics: calculateStageMetrics(evaluated.preScore, evaluated.postScore, turns), semanticEvidence: evaluated.evidence,
  };
  const aggregate = JSON.parse(buildResultArtifacts([run], {}).aggregateJson);
  assert.equal(aggregate.stageDimensions[0].preSemanticCovered, 1);
  assert.equal(aggregate.stageDimensions[0].postSemanticCovered, 1);
  assert.throws(() => buildResultArtifacts([{ ...run, counts: { ...run.counts, semanticCovered: 2 } }], {}), /POST semantic coverage exceeds PRE/);
});

test("staged semantic judge uses one stable-ID call and zero calls when no review exists", async () => {
  const a = candidate("candidate-a", "Zajistit klid a krátké úkoly.");
  const turns = turn([a], [a.candidateId]);
  let calls = 0;
  const provider = { async call(request) {
    calls += 1;
    assert.equal(request.input.canonicalPreCandidates[0].candidateId, a.candidateId);
    assert.equal(request.input.canonicalPreCandidates[0].survivedGrounding, true);
    assert.ok(request.maxOutputTokens >= 2_500 && request.maxOutputTokens <= 8_000);
    return { value: output([equivalent("goal", [[a.candidateId]])], [a.candidateId]), latencyMs: 1, usage: null };
  } };
  const judged = await runStagedSemanticJudge(evalCase(), turns, "gpt-5.6-sol", provider);
  assert.equal(judged.called, true);
  assert.equal(calls, 1);

  const exact = candidate("exact", "Zajistit klid a kratší úkoly.");
  const noReview = await runStagedSemanticJudge(evalCase(), turn([exact], [exact.candidateId]), "gpt-5.6-sol", provider);
  assert.equal(noReview.called, false);
  assert.equal(calls, 1);
});
