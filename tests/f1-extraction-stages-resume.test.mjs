import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { MODEL_PROFILES, loadCorpus } from "../evals/f1-extraction/lib/eval-contract.ts";
import { assertResumeArguments } from "../evals/f1-extraction/lib/checkpoint.ts";
import { formatRunFailure } from "../evals/f1-extraction/lib/diagnostics.ts";
import { EvalProviderCallError, runExtractionPipeline } from "../evals/f1-extraction/lib/pipeline.ts";
import { scoreCase } from "../evals/f1-extraction/lib/scoring.ts";
import { calculateStageMetrics } from "../evals/f1-extraction/lib/stage-analysis.ts";
import { execute } from "../evals/f1-extraction/run.ts";

const corpusPath = new URL("../evals/f1-extraction/fixtures/corpus.json", import.meta.url).pathname;

function emptyExtraction() {
  return {
    situationRelation: "same", situationReason: null,
    categoryReview: { manifestations: "none", goals: "none", context: "none", course: "none", helps: "none" },
    candidates: [],
  };
}

test("stage trace identifies an extraction hit that grounding removes", async () => {
  const corpus = await loadCorpus(corpusPath);
  const item = corpus.cases.find((entry) => entry.id === "atomic-manifestation");
  const provider = { async call(input) {
    if (input.stage === "extraction") return { value: { ...emptyExtraction(), candidates: [{
      category: "manifestations", sourceQuote: "kopne do židle", notebookText: "Kopne do židle.", action: "add", relatedEntryId: null, reason: null,
    }] }, latencyMs: 2, usage: null };
    if (input.stage === "grounding") return { value: { verdicts: [{ index: 0, accepted: false, reason: "rejected" }] }, latencyMs: 3, usage: null };
    throw new Error("unexpected stage");
  } };
  const result = await runExtractionPipeline(item, MODEL_PROFILES.baseline, "baseline", provider);
  const pre = scoreCase(item, result.preGroundingCandidates);
  const post = scoreCase(item, result.candidates);
  const metrics = calculateStageMetrics(pre, post, result.turns);
  assert.equal(result.turns[0].normalizedExtractionCandidates[0].candidateId, "turn-0-extract-0");
  assert.deepEqual(result.turns[0].groundingVerdicts[0], {
    candidateId: "turn-0-extract-0", submittedIndex: 0, accepted: false, reason: "rejected",
    providerVerdict: { index: 0, accepted: false, reason: "rejected" },
  });
  assert.deepEqual(metrics.extractionMissGoldFactIds, []);
  assert.deepEqual(metrics.groundingLossGoldFactIds, ["m1"]);
  assert.equal(metrics.groundingRetention, 0);
  assert.equal(metrics.groundingRejected, 1);
});

test("stage trace identifies extraction misses before grounding", async () => {
  const corpus = await loadCorpus(corpusPath);
  const item = corpus.cases.find((entry) => entry.id === "atomic-manifestation");
  const provider = { async call() { return { value: emptyExtraction(), latencyMs: 1, usage: null }; } };
  const result = await runExtractionPipeline(item, MODEL_PROFILES.baseline, "baseline", provider);
  const pre = scoreCase(item, result.preGroundingCandidates);
  const post = scoreCase(item, result.candidates);
  const metrics = calculateStageMetrics(pre, post, result.turns);
  assert.deepEqual(metrics.extractionMissGoldFactIds, ["m1"]);
  assert.deepEqual(metrics.groundingLossGoldFactIds, []);
  assert.equal(metrics.groundingRetention, null);
});

test("stage metrics distinguish unsupported candidates removed by grounding", async () => {
  const corpus = await loadCorpus(corpusPath);
  const item = corpus.cases.find((entry) => entry.id === "atomic-manifestation");
  const provider = { async call(input) {
    if (input.stage === "extraction") return { value: { ...emptyExtraction(), candidates: [{
      category: "manifestations", sourceQuote: "kopne do židle", notebookText: "Má diagnózu.", action: "add", relatedEntryId: null, reason: null,
    }] }, latencyMs: 1, usage: null };
    return { value: { verdicts: [{ index: 0, accepted: false, reason: "unsupported" }] }, latencyMs: 1, usage: null };
  } };
  const result = await runExtractionPipeline(item, MODEL_PROFILES.baseline, "baseline", provider);
  const pre = scoreCase(item, result.preGroundingCandidates);
  const post = scoreCase(item, result.candidates);
  const metrics = calculateStageMetrics(pre, post, result.turns);
  assert.equal(pre.counts.unsupported, 1);
  assert.equal(metrics.unsupportedRemoved, 1);
});

test("persisted stage and grounding audit artifacts retain candidate identity", async () => {
  const root = await mkdtemp(join(tmpdir(), "apu-f1-stage-artifacts-"));
  const provider = { async call(input) {
    if (input.stage === "extraction") return { value: { ...emptyExtraction(), candidates: [{
      category: "manifestations", sourceQuote: "kopne do židle", notebookText: "Kopne do židle.", action: "add", relatedEntryId: null, reason: null,
    }] }, latencyMs: 2, usage: null };
    return { value: { verdicts: [{ index: 0, accepted: false, reason: "not sufficiently grounded" }] }, latencyMs: 3, usage: null };
  } };
  try {
    const result = await execute([
      "--corpus", corpusPath, "--case", "atomic-manifestation", "--run-id", "stage-artifacts", "--output-dir", root,
    ], process.cwd(), {}, { provider });
    const stage = JSON.parse((await readFile(join(result.directory, "stage-runs.jsonl"), "utf8")).trim());
    const verdict = JSON.parse((await readFile(join(result.directory, "grounding-verdicts.jsonl"), "utf8")).trim());
    assert.equal(stage.stageTurns[0].preGroundingCandidates[0].candidateId, "turn-0-extract-0");
    assert.equal(verdict.candidateId, "turn-0-extract-0");
    assert.equal(verdict.accepted, false);
    assert.equal(verdict.correspondedToGoldFact, true);
    assert.equal(verdict.preGroundingGoldFactIds[0], "m1");
    assert.equal(stage.stageAccounting.extraction.latencyMs + stage.stageAccounting.grounding.latencyMs, 5);
    assert.equal(stage.totals.latencyMs, 5);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("checkpointed runs remain parseable and resume executes only missing work", async () => {
  const root = await mkdtemp(join(tmpdir(), "apu-f1-resume-"));
  const runId = "interrupted";
  let extractionCalls = 0;
  const failingProvider = { async call(input) {
    if (input.stage !== "extraction") throw new Error("unexpected stage");
    extractionCalls += 1;
    if (extractionCalls === 2) throw new EvalProviderCallError(input, "http_status=400; code=invalid_value; param=text.format.name; message=bad");
    return { value: emptyExtraction(), latencyMs: 1, usage: null };
  } };
  try {
    await assert.rejects(execute([
      "--corpus", corpusPath, "--case", "atomic-manifestation,atomic-context", "--run-id", runId, "--output-dir", root,
    ], process.cwd(), {}, { provider: failingProvider }), /case=atomic-context.*code=invalid_value/);
    const directory = join(root, runId);
    const stateAfterFailure = JSON.parse(await readFile(join(directory, "run-state.json"), "utf8"));
    assert.equal(stateAfterFailure.status, "failed");
    assert.equal(stateAfterFailure.completedRunKeys.length, 1);
    assert.equal((await readFile(join(directory, "raw-runs.jsonl"), "utf8")).trim().split("\n").length, 1);

    let resumedCalls = 0;
    const resumedProvider = { async call(input) {
      assert.equal(input.stage, "extraction");
      resumedCalls += 1;
      return { value: emptyExtraction(), latencyMs: 1, usage: null };
    } };
    const result = await execute(["--resume", directory], process.cwd(), {}, { provider: resumedProvider });
    assert.equal(result.runs, 2);
    assert.equal(resumedCalls, 1, "completed case must not be called again");
    const rawLines = (await readFile(join(directory, "raw-runs.jsonl"), "utf8")).trim().split("\n");
    assert.equal(rawLines.length, 2);
    assert.equal(new Set(rawLines.map((line) => JSON.parse(line).caseId)).size, 2);
    assert.equal(JSON.parse(await readFile(join(directory, "run-state.json"), "utf8")).status, "completed");
    const aggregate = await readFile(join(directory, "aggregate.json"), "utf8");
    assert.doesNotThrow(() => JSON.parse(aggregate));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("resume rejects configuration-changing flags", () => {
  assert.throws(() => assertResumeArguments(["--resume", "/run", "--profiles", "terra-extract"]), /cannot be combined with --profiles/);
  assert.doesNotThrow(() => assertResumeArguments(["--resume", "/run"]));
});

test("resume rejects a corpus changed after the original plan", async () => {
  const root = await mkdtemp(join(tmpdir(), "apu-f1-resume-hash-"));
  const copiedCorpus = join(root, "corpus.json");
  await copyFile(corpusPath, copiedCorpus);
  const provider = { async call() { return { value: emptyExtraction(), latencyMs: 1, usage: null }; } };
  try {
    const completed = await execute([
      "--corpus", copiedCorpus, "--case", "atomic-manifestation", "--run-id", "hash-check", "--output-dir", root,
    ], process.cwd(), {}, { provider });
    await writeFile(copiedCorpus, `${await readFile(copiedCorpus, "utf8")}\n`);
    await assert.rejects(execute(["--resume", completed.directory], process.cwd(), {}, { provider }), /corpus content no longer matches/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rescoring a new staged run preserves and recomputes stage metrics", async () => {
  const root = await mkdtemp(join(tmpdir(), "apu-f1-stage-rescore-"));
  const provider = { async call(input) {
    if (input.stage === "extraction") return { value: { ...emptyExtraction(), candidates: [{
      category: "manifestations", sourceQuote: "kopne do židle", notebookText: "Do židle kope.", action: "add", relatedEntryId: null, reason: null,
    }] }, latencyMs: 1, usage: null };
    return { value: { verdicts: [{ index: 0, accepted: true, reason: null }] }, latencyMs: 1, usage: null };
  } };
  try {
    const original = await execute([
      "--corpus", corpusPath, "--case", "atomic-manifestation", "--run-id", "original", "--output-dir", root,
    ], process.cwd(), {}, { provider });
    let judgeCalls = 0;
    const judgeProvider = { async call(input) {
      assert.equal(input.stage, "judge");
      judgeCalls += 1;
      return { value: { decisions: [{
        kind: "alignment", goldFactId: "m1", candidateIndexes: [0], decision: "equivalent", reason: "same explicit fact",
      }] }, latencyMs: 1, usage: null };
    } };
    const rescored = await execute([
      "--rescore", original.directory, "--corpus", corpusPath, "--run-id", "rescored", "--output-dir", root,
      "--judge-model", "gpt-5.6-luna", "--max-calls", "2",
    ], process.cwd(), {}, { provider: judgeProvider });
    const aggregate = JSON.parse(await readFile(join(rescored.directory, "aggregate.json"), "utf8"));
    assert.equal(judgeCalls, 2, "staged rescore judges pre- and post-grounding candidates");
    assert.equal(aggregate.stageAggregate[0].stageRunsAvailable, 1);
    assert.equal(aggregate.stageAggregate[0].preSemanticRecall, 1);
    assert.equal(aggregate.aggregate[0].semanticRecall, 1);
    assert.equal(aggregate.stageAggregate[0].extractionMisses, 0);
    assert.notEqual((await readFile(join(rescored.directory, "stage-runs.jsonl"), "utf8")).trim(), "");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("provider diagnostics include run identity and redact credentials", () => {
  const text = formatRunFailure(
    { caseId: "case-1", profile: "baseline", pipeline: "baseline", repetition: 2 },
    new EvalProviderCallError({ stage: "extraction", model: "gpt-5.6-luna", reasoning: "low" }, "http_status=400; code=invalid_value; param=x; Authorization=secret; Bearer abc.def; sk-projectsecret"),
  );
  assert.match(text, /case=case-1; profile=baseline; pipeline=baseline; repetition=2/);
  assert.match(text, /stage=extraction.*code=invalid_value.*param=x/);
  assert.doesNotMatch(text, /secret|abc\.def|sk-projectsecret/);
  assert.match(text, /redacted/);
});
