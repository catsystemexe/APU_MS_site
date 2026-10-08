import assert from "node:assert/strict";
import test from "node:test";
import { runSemanticJudge } from "../evals/f1-extraction/lib/pipeline.ts";
import { scoreCase } from "../evals/f1-extraction/lib/scoring.ts";

function fact(id, category, text, quote, overrides = {}) {
  return { id, category, text, source: { inputIndex: 0, quote }, uncertain: false, negated: false, requiredMarkers: [], expectedAction: "add", relatedEntryId: null, ...overrides };
}

function evalCase(input, expectedFacts, forbiddenInferences = []) {
  return {
    id: "scoring-case", suite: "mixed", description: "Scoring regression", inputs: [input], startingNotebook: [], expectedFacts, forbiddenInferences, tags: [],
    dimensions: { factCount: expectedFacts.length, categoryCount: new Set(expectedFacts.map((entry) => entry.category)).size, linguistic: ["compound"] },
  };
}

function candidate(category, sourceQuote, notebookText) {
  return { inputIndex: 0, category, sourceQuote, notebookText, action: "add", relatedEntryId: null, reason: null };
}

function alignment(goldFactId, candidateIndexes, decision = "equivalent") {
  return { kind: "alignment", goldFactId, candidateIndexes, decision, reason: `judge: ${decision}` };
}

test("one gold fact can be semantically covered by two grounded fragments", () => {
  const input = "Potřebuji zjistit, co Davida spouští a jak mu pomoci.";
  const item = evalCase(input, [fact("goal", "goals", input, input)]);
  const candidates = [
    candidate("goals", "zjistit, co Davida spouští", "Zjistit, co Davida spouští."),
    candidate("goals", "jak mu pomoci", "Zjistit, jak mu pomoci."),
  ];
  const score = scoreCase(item, candidates, [alignment("goal", [0, 1])]);
  assert.equal(score.matches[0].state, "SEMANTIC_EQUIVALENT");
  assert.deepEqual(score.matches[0].candidateIndexes, [0, 1]);
  assert.equal(score.metrics.semanticRecall, 1);
  assert.equal(score.metrics.semanticPrecision, 1);
  assert.deepEqual(score.unsupportedCandidateIndexes, []);
});

test("one semantically complete candidate can cover two gold facts", () => {
  const input = "Potřebuji Davidovi zajistit klid a kratší úkoly.";
  const item = evalCase(input, [
    fact("calm", "goals", "Zajistit Davidovi klid.", input),
    fact("short", "goals", "Zajistit Davidovi kratší úkoly.", input),
  ]);
  const candidates = [candidate("goals", input, "Zajistit Davidovi klid a kratší úkoly.")];
  const score = scoreCase(item, candidates, [alignment("calm", [0]), alignment("short", [0])]);
  assert.deepEqual(score.matches.map((match) => match.state), ["SEMANTIC_EQUIVALENT", "SEMANTIC_EQUIVALENT"]);
  assert.equal(score.metrics.semanticRecall, 1);
  assert.equal(score.metrics.semanticPrecision, 1);
});

test("an unmatched explicit candidate is GROUNDED_EXTRA rather than UNSUPPORTED", () => {
  const input = "Při skupinové práci kopne do židle.";
  const item = evalCase(input, [fact("kick", "manifestations", "Kopne do židle.", "kopne do židle")]);
  const score = scoreCase(item, [
    candidate("manifestations", "kopne do židle", "Kopne do židle."),
    candidate("context", "Při skupinové práci", "Při skupinové práci."),
  ]);
  assert.deepEqual(score.groundedExtraCandidateIndexes, [1]);
  assert.deepEqual(score.unsupportedCandidateIndexes, []);
  assert.equal(score.metrics.trueUnsupportedRate, 0);
});

test("a truly invented candidate remains UNSUPPORTED", () => {
  const input = "Při skupinové práci kopne do židle.";
  const item = evalCase(input, [fact("kick", "manifestations", "Kopne do židle.", "kopne do židle")]);
  const score = scoreCase(item, [candidate("manifestations", "Při skupinové práci", "Má poruchu chování.")]);
  assert.deepEqual(score.unsupportedCandidateIndexes, [0]);
  assert.equal(score.metrics.trueUnsupportedRate, 1);
});

test("a forbidden inference remains a high-severity unsupported candidate", () => {
  const input = "Je líný.";
  const item = evalCase(input, [], [{ text: "líný", category: "manifestations" }]);
  const score = scoreCase(item, [candidate("manifestations", input, input)]);
  assert.deepEqual(score.unsupportedCandidateIndexes, [0]);
  assert.equal(score.forbiddenInferenceHits.length, 1);
});

test("semantic equivalent judge decision raises only semantic recall", () => {
  const input = "Při hluku obvykle odejde.";
  const item = evalCase(input, [fact("leave", "manifestations", "Při hluku obvykle odchází.", input)]);
  const candidates = [candidate("manifestations", input, "Obvykle odchází, když je hluk.")];
  const deterministic = scoreCase(item, candidates);
  const semantic = scoreCase(item, candidates, [alignment("leave", [0])]);
  assert.equal(deterministic.matches[0].state, "REVIEW");
  assert.equal(semantic.matches[0].state, "SEMANTIC_EQUIVALENT");
  assert.equal(semantic.metrics.deterministicRecall, 0);
  assert.equal(semantic.metrics.semanticRecall, 1);
});

test("semantic judge receives grouped ambiguous alignments and records explicit decisions", async () => {
  const input = "Při hluku obvykle odejde.";
  const item = evalCase(input, [fact("leave", "manifestations", "Při hluku obvykle odchází.", input)]);
  const candidates = [candidate("manifestations", input, "Obvykle odchází, když je hluk.")];
  const initial = scoreCase(item, candidates);
  const provider = { async call(request) {
    assert.equal(request.stage, "judge");
    assert.equal(request.input.reviewAlignments[0].goldFact.id, "leave");
    assert.deepEqual(request.input.reviewAlignments[0].candidates.map((entry) => entry.candidateIndex), [0]);
    assert.deepEqual(request.schema.properties.decisions.items.required, ["kind", "goldFactId", "candidateIndexes", "decision", "reason"]);
    return { value: { decisions: [alignment("leave", [0])] }, latencyMs: 2, usage: null };
  } };
  const judged = await runSemanticJudge(item, initial, candidates, "gpt-5.6-luna", provider);
  assert.deepEqual(judged.decisions, [alignment("leave", [0])]);
  assert.equal(scoreCase(item, candidates, judged.decisions).metrics.semanticRecall, 1);
});

test("not-equivalent judge decision remains a miss", () => {
  const input = "Při hluku obvykle odejde.";
  const item = evalCase(input, [fact("leave", "manifestations", "Při hluku obvykle odchází.", input)]);
  const score = scoreCase(item, [candidate("manifestations", input, "Obvykle odchází, když je hluk.")], [alignment("leave", [0], "not_equivalent")]);
  assert.equal(score.matches[0].state, "MISS");
  assert.equal(score.metrics.semanticRecall, 0);
  assert.equal(score.counts.miss, 1);
});

test("an invalid sourceQuote cannot be rescued by semantic judging", () => {
  const input = "Při hluku obvykle odejde.";
  const item = evalCase(input, [fact("leave", "manifestations", "Při hluku obvykle odchází.", input)]);
  const score = scoreCase(item, [candidate("manifestations", "neexistující citace", "Obvykle odchází, když je hluk.")], [alignment("leave", [0])]);
  assert.notEqual(score.matches[0].state, "SEMANTIC_EQUIVALENT");
  assert.deepEqual(score.unsupportedCandidateIndexes, [0]);
  assert.equal(score.metrics.sourceQuoteValidity, 0);
});

test("semantic judging cannot hide lost uncertainty or negation", () => {
  const uncertainInput = "Možná odejde při hluku.";
  const uncertain = evalCase(uncertainInput, [fact("uncertain", "manifestations", uncertainInput, uncertainInput, { uncertain: true, requiredMarkers: ["možná"] })]);
  const uncertainScore = scoreCase(uncertain, [candidate("manifestations", uncertainInput, "Odchází při hluku.")], [alignment("uncertain", [0])]);
  assert.notEqual(uncertainScore.matches[0].state, "SEMANTIC_EQUIVALENT");
  assert.equal(uncertainScore.metrics.uncertaintyPreservation, 0);

  const negatedInput = "Úkol neodmítá.";
  const negated = evalCase(negatedInput, [fact("negated", "manifestations", negatedInput, negatedInput, { negated: true, requiredMarkers: ["neodmítá"] })]);
  const negatedScore = scoreCase(negated, [candidate("manifestations", negatedInput, "Úkol odmítá.")], [alignment("negated", [0])]);
  assert.notEqual(negatedScore.matches[0].state, "SEMANTIC_EQUIVALENT");
  assert.equal(negatedScore.metrics.negationPreservation, 0);
});
