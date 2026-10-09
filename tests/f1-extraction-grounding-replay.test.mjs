import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildGroundingInstructions } from "../app/f1-extraction-contract.ts";
import { loadCorpus } from "../evals/f1-extraction/lib/eval-contract.ts";
import {
  EVIDENCE_SCOPE_V2_INSTRUCTIONS,
  GROUNDING_REPLAY_REASON_CATEGORIES,
  executeGroundingReplay,
  loadSavedStageRuns,
  parseGroundingReplayArgs,
  validateGroundingReplayVerdicts,
} from "../evals/f1-extraction/lib/grounding-replay.ts";
import { deriveStagedSemanticEvaluation } from "../evals/f1-extraction/lib/semantic-evidence.ts";
import { calculateStageMetrics } from "../evals/f1-extraction/lib/stage-analysis.ts";
import { isCliEntrypoint } from "../evals/f1-extraction/grounding-replay.ts";

const corpusPath = new URL("../evals/f1-extraction/fixtures/corpus.json", import.meta.url).pathname;
const fixturePath = new URL("../evals/f1-extraction/fixtures/grounding-evidence-scope-v2.json", import.meta.url).pathname;

function candidate(item) {
  return {
    candidateId: "turn-0-extract-0",
    origin: "extraction",
    inputIndex: 0,
    category: "manifestations",
    sourceQuote: "kopne do židle",
    notebookText: "Kopne do židle.",
    action: "add",
    relatedEntryId: null,
    reason: null,
    start: item.inputs[0].indexOf("kopne do židle"),
    end: item.inputs[0].indexOf("kopne do židle") + "kopne do židle".length,
  };
}

function rejectedTurn(entry) {
  return [{
    inputIndex: 0,
    rawExtraction: {
      situationRelation: "same",
      situationReason: null,
      categoryReview: { manifestations: "found", goals: "none", context: "none", course: "none", helps: "none" },
      candidates: [],
    },
    normalizedExtractionCandidates: [entry],
    rawCoverageCandidates: null,
    normalizedCoverageCandidates: [],
    preGroundingCandidates: [entry],
    groundingSubmittedCandidates: [entry],
    groundingVerdicts: [{
      candidateId: entry.candidateId,
      submittedIndex: 0,
      accepted: false,
      reason: "sourceQuote was treated as the complete evidence span",
      providerVerdict: { index: 0, accepted: false, reason: "sourceQuote was treated as the complete evidence span" },
    }],
    finalCandidates: [],
  }];
}

async function writeSavedStageFixture(root) {
  const corpus = await loadCorpus(corpusPath);
  const item = corpus.cases.find((entry) => entry.id === "atomic-manifestation");
  const entry = candidate(item);
  const turns = rejectedTurn(entry);
  const evaluated = deriveStagedSemanticEvaluation(item, turns, null);
  const sourceDirectory = join(root, "judged-source");
  await mkdir(sourceDirectory);
  const row = {
    caseId: item.id,
    profile: "baseline",
    pipeline: "baseline",
    repetition: 1,
    preGroundingScore: evaluated.preScore,
    postGroundingScore: evaluated.postScore,
    totals: { latencyMs: 1, inputTokens: 0, outputTokens: 0, estimatedCostUsd: null },
    stageMetrics: calculateStageMetrics(evaluated.preScore, evaluated.postScore, turns),
    stageTurns: turns,
    stageCalls: [],
    stageAccounting: {},
    semanticEvidence: evaluated.evidence,
  };
  const stagePath = join(sourceDirectory, "stage-runs.jsonl");
  await writeFile(stagePath, `${JSON.stringify(row)}\n`);
  return { sourceDirectory, stagePath, item };
}

async function writeNotEquivalentStageFixture(root) {
  const corpus = await loadCorpus(corpusPath);
  const item = corpus.cases.find((entry) => entry.id === "atomic-negation");
  const sourceQuote = "odchází od stolu";
  const entry = {
    candidateId: "turn-0-extract-0",
    origin: "extraction",
    inputIndex: 0,
    category: "manifestations",
    sourceQuote,
    notebookText: "Odchází od stolu.",
    action: "add",
    relatedEntryId: null,
    reason: null,
    start: item.inputs[0].indexOf(sourceQuote),
    end: item.inputs[0].indexOf(sourceQuote) + sourceQuote.length,
  };
  const turns = rejectedTurn(entry);
  turns[0].groundingVerdicts = [{
    candidateId: entry.candidateId,
    submittedIndex: 0,
    accepted: true,
    reason: null,
    providerVerdict: { index: 0, accepted: true, reason: null },
  }];
  turns[0].finalCandidates = [entry];
  const evaluated = deriveStagedSemanticEvaluation(item, turns, {
    factDecisions: [{
      goldFactId: "m1",
      decision: "not_equivalent",
      supportGroups: [],
      reason: "The candidate reverses the saved fact's negation.",
    }],
    candidateDecisions: [{ candidateId: entry.candidateId, decision: "uncertain", reason: "classified through fact review" }],
  });
  assert.equal(evaluated.postScore.matches[0].state, "MISS");
  const sourceDirectory = join(root, "not-equivalent-source");
  await mkdir(sourceDirectory);
  await writeFile(join(sourceDirectory, "stage-runs.jsonl"), `${JSON.stringify({
    caseId: item.id,
    profile: "baseline",
    pipeline: "baseline",
    repetition: 1,
    preGroundingScore: evaluated.preScore,
    postGroundingScore: evaluated.postScore,
    totals: { latencyMs: 1, inputTokens: 0, outputTokens: 0, estimatedCostUsd: null },
    stageMetrics: calculateStageMetrics(evaluated.preScore, evaluated.postScore, turns),
    stageTurns: turns,
    stageCalls: [],
    stageAccounting: {},
    semanticEvidence: evaluated.evidence,
  })}\n`);
  return sourceDirectory;
}

test("evidence-scope fixtures cover every required allowed and rejected pattern", async () => {
  const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
  assert.equal(fixture.variant, "evidence-scope-v2");
  assert.deepEqual(fixture.cases.map((entry) => entry.id), [
    "shared-subject",
    "shared-subject-context",
    "shared-predicate",
    "pronoun-resolution",
    "context-preserving-course",
    "duration-manifestation",
    "wrong-helps-category",
    "unsupported-temporal-relation",
    "ambiguous-antecedent",
    "qualifier-removal",
  ]);
  for (const entry of fixture.cases) {
    assert.ok(entry.newUserMessage.includes(entry.sourceQuote), entry.id);
    assert.ok(GROUNDING_REPLAY_REASON_CATEGORIES.includes(entry.expectedReasonCategory), entry.id);
    const result = validateGroundingReplayVerdicts({ verdicts: [{
      index: 0,
      accepted: entry.expectedAccepted,
      reasonCategory: entry.expectedReasonCategory,
      reason: entry.id,
    }] }, 1);
    assert.equal(result.verdicts[0].accepted, entry.expectedAccepted);
  }
  assert.match(EVIDENCE_SCOPE_V2_INSTRUCTIONS, /sdílený gramatický podmět/);
  assert.match(EVIDENCE_SCOPE_V2_INSTRUCTIONS, /sdílený řídící predikát/);
  assert.match(EVIDENCE_SCOPE_V2_INSTRUCTIONS, /explicitní rozlišení zájmena/);
  assert.match(EVIDENCE_SCOPE_V2_INSTRUCTIONS, /někdy, jindy, asi nebo ne vždy/);
  assert.match(EVIDENCE_SCOPE_V2_INSTRUCTIONS, /nevytvářej časový ani kauzální vztah/);
  assert.match(EVIDENCE_SCOPE_V2_INSTRUCTIONS, /nepřeváděj context\/course na helps/);
});

test("replay verdict parser requires exactly indexes 0 through N-1", () => {
  const accepted = (index) => ({ index, accepted: true, reasonCategory: "accept_direct", reason: "direct" });
  assert.deepEqual(validateGroundingReplayVerdicts({ verdicts: [accepted(1), accepted(0)] }, 2).verdicts.map((entry) => entry.index), [0, 1]);
  assert.throws(() => validateGroundingReplayVerdicts({ verdicts: [accepted(0)] }, 2), /expected 2, received 1/);
  assert.throws(() => validateGroundingReplayVerdicts({ verdicts: [accepted(0), accepted(0)] }, 2), /duplicated/);
  assert.throws(() => validateGroundingReplayVerdicts({ verdicts: [accepted(0), accepted(2)] }, 2), /out of range/);
  assert.throws(() => validateGroundingReplayVerdicts({ verdicts: [{ ...accepted(0), accepted: false }] }, 1), /incompatible/);
});

test("saved-stage loader requires judged semantic evidence and stable unique runs", async () => {
  const root = await mkdtemp(join(tmpdir(), "apu-grounding-replay-loader-"));
  try {
    const fixture = await writeSavedStageFixture(root);
    const loaded = await loadSavedStageRuns(fixture.sourceDirectory);
    assert.equal(loaded.runs.length, 1);
    assert.equal(loaded.runs[0].semanticEvidence.preCandidateIds[0], "turn-0-extract-0");
    const invalidDirectory = join(root, "invalid");
    await mkdir(invalidDirectory);
    await writeFile(join(invalidDirectory, "stage-runs.jsonl"), `${JSON.stringify({ caseId: "x" })}\n`);
    await assert.rejects(loadSavedStageRuns(invalidDirectory), /judged staged-run contract/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("saved source validation reproduces a surviving not_equivalent POST miss before any provider call", async () => {
  const root = await mkdtemp(join(tmpdir(), "apu-grounding-replay-not-equivalent-"));
  try {
    const sourceDirectory = await writeNotEquivalentStageFixture(root);
    await assert.rejects(executeGroundingReplay([
      "--source", sourceDirectory,
      "--profile", "baseline",
      "--variant", "evidence-scope-v2",
      "--run-id", "not-equivalent",
      "--output-dir", root,
      "--max-calls", "1",
      "--corpus", corpusPath,
    ], process.cwd(), {}), /OPENAI_API_KEY is unavailable.*no provider call/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("grounding replay reuses saved semantic evidence, restores a fact, and preserves its source", async () => {
  const root = await mkdtemp(join(tmpdir(), "apu-grounding-replay-"));
  try {
    const fixture = await writeSavedStageFixture(root);
    const before = createHash("sha256").update(await readFile(fixture.stagePath)).digest("hex");
    const calls = [];
    const provider = { async call(request) {
      calls.push(request);
      assert.equal(request.stage, "grounding");
      assert.equal(request.model, "gpt-5.6-luna");
      assert.equal(request.reasoning, "low");
      assert.equal(request.input.newUserMessage, fixture.item.inputs[0]);
      assert.equal(request.input.candidates[0].sourceQuote, "kopne do židle");
      assert.match(request.instructions, /sourceQuote je lokální kotva faktu/);
      return {
        value: request.parse({ verdicts: [{ index: 0, accepted: true, reasonCategory: "accept_direct", reason: "directly entailed by the full message" }] }),
        latencyMs: 2,
        usage: null,
      };
    } };
    const result = await executeGroundingReplay([
      "--source", fixture.sourceDirectory,
      "--profile", "baseline",
      "--variant", "evidence-scope-v2",
      "--run-id", "evidence-scope-replay",
      "--output-dir", root,
      "--max-calls", "1",
      "--corpus", corpusPath,
    ], process.cwd(), {}, { provider, now: () => "2026-10-09T12:00:00.000Z" });
    assert.equal(calls.length, 1, "only one grounding call is made");
    assert.equal(result.groundingCalls, 1);
    assert.equal(createHash("sha256").update(await readFile(fixture.stagePath)).digest("hex"), before, "source stage artifact must remain immutable");
    const plan = JSON.parse(await readFile(join(result.directory, "replay-plan.json"), "utf8"));
    assert.equal(plan.sourceStageRunsSha256, before);
    assert.deepEqual({ extraction: plan.extractionCalls, coverage: plan.coverageCalls, judge: plan.judgeCalls }, { extraction: 0, coverage: 0, judge: 0 });
    assert.equal(JSON.parse(await readFile(join(result.directory, "run-state.json"), "utf8")).status, "completed");
    const verdict = JSON.parse((await readFile(join(result.directory, "grounding-replay-verdicts.jsonl"), "utf8")).trim());
    assert.equal(verdict.originalAccepted, false);
    assert.equal(verdict.replayAccepted, true);
    assert.equal(verdict.semanticClassification, "ALIGNED");
    assert.deepEqual(verdict.associatedGoldFactIds, ["m1"]);
    assert.equal(verdict.restoresGoldFact, true);
    assert.deepEqual(verdict.restoredGoldFactIds, ["m1"]);
    const aggregate = JSON.parse(await readFile(join(result.directory, "aggregate.json"), "utf8"));
    assert.equal(aggregate.metadata.savedSemanticEvidenceReused, true);
    assert.equal(aggregate.comparison.overall.preSemanticRecall, 1, "PRE scoring remains unchanged");
    assert.equal(aggregate.comparison.overall.currentPostSemanticRecall, 0);
    assert.equal(aggregate.comparison.overall.replayPostSemanticRecall, 1);
    assert.equal(aggregate.comparison.overall.currentGroundingLosses, 1);
    assert.equal(aggregate.comparison.overall.replayGroundingLosses, 0);
    assert.equal(aggregate.comparison.overall.rejectedGoldSupportingCandidates, 1);
    assert.equal(aggregate.comparison.overall.restoredCandidates, 1);
    assert.equal(aggregate.comparison.overall.newlyAcceptedUnsupported, 0);
    assert.deepEqual(aggregate.comparison.bySuite.map((row) => row.suite), ["atomic", "mixed", "dense"]);
    for (const name of ["case-scores.jsonl", "aggregate.json", "dimension-breakdown.csv", "summary.md"]) await readFile(join(result.directory, name));
    await assert.rejects(executeGroundingReplay([
      "--source", fixture.sourceDirectory, "--profile", "baseline", "--variant", "evidence-scope-v2",
      "--run-id", "evidence-scope-replay", "--output-dir", root, "--max-calls", "1", "--corpus", corpusPath,
    ], process.cwd(), {}, { provider }), /output already exists/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("incomplete provider verdicts fail the replay instead of becoming implicit rejection", async () => {
  const root = await mkdtemp(join(tmpdir(), "apu-grounding-replay-incomplete-"));
  try {
    const fixture = await writeSavedStageFixture(root);
    const provider = { async call(request) {
      return { value: request.parse({ verdicts: [] }), latencyMs: 1, usage: null };
    } };
    const outputDirectory = join(root, "incomplete");
    await assert.rejects(executeGroundingReplay([
      "--source", fixture.sourceDirectory, "--profile", "baseline", "--variant", "evidence-scope-v2",
      "--run-id", "incomplete", "--output-dir", root, "--max-calls", "1", "--corpus", corpusPath,
    ], process.cwd(), {}, { provider }), /verdict completeness failed/);
    const state = JSON.parse(await readFile(join(outputDirectory, "run-state.json"), "utf8"));
    assert.equal(state.status, "failed");
    assert.match(state.lastError, /expected 1, received 0/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("replay CLI guards scope, call budget, credentials, and Windows entrypoint normalization", async () => {
  const parsed = parseGroundingReplayArgs([
    "--source", "source", "--profile", "baseline", "--variant", "evidence-scope-v2",
    "--run-id", "run", "--output-dir", "results", "--max-calls", "48",
  ], "/repo");
  assert.equal(parsed.maxCalls, 48);
  assert.throws(() => parseGroundingReplayArgs([
    "--source", "source", "--profile", "terra-extract", "--variant", "evidence-scope-v2",
    "--run-id", "run", "--output-dir", "results", "--max-calls", "48",
  ], "/repo"), /only --profile baseline/);
  assert.equal(isCliEntrypoint("file:///C:/repo/evals/f1-extraction/grounding-replay.ts", String.raw`C:\repo\evals\f1-extraction\grounding-replay.ts`, true), true);

  const root = await mkdtemp(join(tmpdir(), "apu-grounding-replay-guard-"));
  try {
    const fixture = await writeSavedStageFixture(root);
    const base = [
      "--source", fixture.sourceDirectory, "--profile", "baseline", "--variant", "evidence-scope-v2",
      "--run-id", "guarded", "--output-dir", root, "--corpus", corpusPath,
    ];
    await assert.rejects(executeGroundingReplay([...base, "--max-calls", "1"], process.cwd(), {}), /OPENAI_API_KEY is unavailable.*no provider call/i);
    await assert.rejects(executeGroundingReplay([...base, "--max-calls", "0"], process.cwd(), {}, { provider: { call() { throw new Error("must not call"); } } }), /positive integer/);
    await assert.rejects(executeGroundingReplay([
      "--source", fixture.sourceDirectory, "--profile", "baseline", "--variant", "evidence-scope-v2",
      "--run-id", "inside-source", "--output-dir", fixture.sourceDirectory, "--max-calls", "1", "--corpus", corpusPath,
    ], process.cwd(), {}, { provider: { call() { throw new Error("must not call"); } } }), /write inside the source result directory/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("experimental grounding contract is isolated from production grounding", () => {
  const production = buildGroundingInstructions("CORE");
  assert.match(production, /sourceQuote je skutečným dostatečným podkladem pro celý notebookText/);
  assert.doesNotMatch(production, /sourceQuote je lokální kotva faktu/);
  assert.match(EVIDENCE_SCOPE_V2_INSTRUCTIONS, /sourceQuote je lokální kotva faktu/);
});
