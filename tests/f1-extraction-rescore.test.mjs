import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { execute } from "../evals/f1-extraction/run.ts";
import { EvalProviderCallError } from "../evals/f1-extraction/lib/pipeline.ts";

const corpusPath = new URL("../evals/f1-extraction/fixtures/corpus.json", import.meta.url).pathname;

test("rescore reads saved raw runs, preserves provider usage, and never mutates the source", async () => {
  const root = await mkdtemp(join(tmpdir(), "apu-f1-rescore-"));
  const sourceDirectory = join(root, "original");
  const outputRoot = join(root, "rescored-output");
  await mkdir(sourceDirectory, { recursive: true });
  const original = `${JSON.stringify({
    caseId: "atomic-manifestation",
    profile: "baseline",
    pipeline: "baseline",
    repetition: 1,
    candidates: [{ inputIndex: 0, category: "manifestations", sourceQuote: "kopne do židle", notebookText: "Kopne do židle.", action: "add", relatedEntryId: null, reason: null }],
    latencyMs: 321,
    inputTokens: 123,
    outputTokens: 45,
    estimatedCostUsd: 0.0067,
    semanticJudgeDecisions: [],
  })}\n`;
  const rawPath = join(sourceDirectory, "raw-runs.jsonl");
  await writeFile(rawPath, original);
  try {
    const result = await execute([
      "--rescore", sourceDirectory,
      "--corpus", corpusPath,
      "--output-dir", outputRoot,
      "--run-id", "rescored",
    ], process.cwd(), {});
    assert.equal(result.kind, "rescored");
    assert.equal(result.runs, 1);
    assert.equal(await readFile(rawPath, "utf8"), original, "the original raw run must remain byte-for-byte unchanged");

    const rescoredRaw = JSON.parse((await readFile(join(outputRoot, "rescored", "raw-runs.jsonl"), "utf8")).trim());
    assert.equal(rescoredRaw.latencyMs, 321);
    assert.equal(rescoredRaw.inputTokens, 123);
    assert.equal(rescoredRaw.outputTokens, 45);
    assert.equal(rescoredRaw.estimatedCostUsd, 0.0067);
    const score = JSON.parse((await readFile(join(outputRoot, "rescored", "case-scores.jsonl"), "utf8")).trim());
    assert.equal(score.metrics.deterministicRecall, 1);
    assert.equal(score.metrics.semanticRecall, 1);
    const summary = await readFile(join(outputRoot, "rescored", "summary.md"), "utf8");
    assert.match(summary, /Det\. Recall.*Sem\. Recall.*Grounded Extras.*Unsupported.*Review/);
    assert.match(summary, /unavailable/, "historical runs must not fabricate pre-grounding metrics");
    assert.equal(await readFile(join(outputRoot, "rescored", "stage-runs.jsonl"), "utf8"), "");

    await assert.rejects(
      execute(["--rescore", sourceDirectory, "--corpus", corpusPath, "--output-dir", outputRoot, "--run-id", "judged", "--judge-model", "gpt-5.6-luna"], process.cwd(), {}),
      /OPENAI_API_KEY is unavailable.*no provider call was made/i,
    );

    await assert.rejects(
      execute(["--rescore", sourceDirectory, "--corpus", corpusPath, "--output-dir", root, "--run-id", "original"], process.cwd(), {}),
      /must not overwrite the original result directory/,
    );
    assert.equal(await readFile(rawPath, "utf8"), original);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("judged rescore checkpoints, fails safely, and resumes only missing source runs", async () => {
  const root = await mkdtemp(join(tmpdir(), "apu-f1-judged-resume-"));
  const sourceDirectory = join(root, "source");
  const outputRoot = join(root, "output");
  await mkdir(sourceDirectory, { recursive: true });
  const candidate = { inputIndex: 0, category: "manifestations", sourceQuote: "kopne do židle", notebookText: "Do židle kope.", action: "add", relatedEntryId: null, reason: null };
  const original = [1, 2, 3].map((repetition) => JSON.stringify({
    caseId: "atomic-manifestation", profile: "baseline", pipeline: "baseline", repetition,
    candidates: [candidate], latencyMs: 100 + repetition, inputTokens: 20, outputTokens: 10, estimatedCostUsd: 0.0067,
  })).join("\n") + "\n";
  const rawPath = join(sourceDirectory, "raw-runs.jsonl");
  await writeFile(rawPath, original);
  const usage = (cost) => ({ usage: { input_tokens: 10, output_tokens: 5 }, pricing_snapshot: { estimated_cost_usd: cost } });
  let calls = 0;
  const failingProvider = { async call(input) {
    calls += 1;
    if (calls === 2) throw new EvalProviderCallError(input, "http_status=200; provider_status=incomplete; category=provider_incomplete; code=max_output_tokens; type=incomplete_details; param=max_output_tokens; message=limit reached Authorization=secret");
    return { value: { decisions: [{ kind: "alignment", goldFactId: "m1", candidateIndexes: [0], decision: "equivalent", reason: "same fact" }] }, latencyMs: 7, usage: usage(0.01) };
  } };
  const target = join(outputRoot, "judged");
  try {
    await assert.rejects(execute([
      "--rescore", sourceDirectory, "--corpus", corpusPath, "--output-dir", outputRoot, "--run-id", "judged",
      "--judge-model", "gpt-5.6-sol", "--max-calls", "3",
    ], process.cwd(), {}, { provider: failingProvider }), /case=atomic-manifestation.*repetition=2.*provider_status=incomplete.*code=max_output_tokens/);
    assert.equal(await readFile(rawPath, "utf8"), original, "source extraction results must remain immutable");
    const failedState = JSON.parse(await readFile(join(target, "run-state.json"), "utf8"));
    assert.equal(failedState.status, "failed");
    assert.equal(failedState.completedRunKeys.length, 1);
    assert.match(failedState.lastError, /code=max_output_tokens/);
    assert.doesNotMatch(failedState.lastError, /secret/);
    const partial = (await readFile(join(target, "raw-runs.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
    assert.equal(partial.length, 1);
    assert.equal(partial[0].repetition, 1);
    assert.equal(partial[0].latencyMs, 101, "original extraction accounting is preserved");
    assert.equal(partial[0].rescoreJudgeAccounting.judge.estimatedCostUsd, 0.01);

    let guardedCalls = 0;
    const guardedProvider = { async call() { guardedCalls += 1; throw new Error("must not run"); } };
    await assert.rejects(execute(["--resume-rescore", target, "--max-calls", "1"], process.cwd(), {}, { provider: guardedProvider }), /remaining semantic judge calls 2 exceed/);
    assert.equal(guardedCalls, 0);
    await assert.rejects(execute(["--resume-rescore", target, "--judge-model", "gpt-5.6-luna"], process.cwd(), {}, { provider: guardedProvider }), /cannot be combined with --judge-model/);

    let resumedCalls = 0;
    const resumedProvider = { async call() {
      resumedCalls += 1;
      return { value: { decisions: [{ kind: "alignment", goldFactId: "m1", candidateIndexes: [0], decision: "equivalent", reason: "same fact" }] }, latencyMs: 9, usage: usage(0.02) };
    } };
    const resumed = await execute(["--resume-rescore", target, "--max-calls", "2"], process.cwd(), {}, { provider: resumedProvider });
    assert.equal(resumed.runs, 3);
    assert.equal(resumedCalls, 2);
    const completed = (await readFile(join(target, "raw-runs.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
    assert.deepEqual(completed.map((run) => run.repetition), [1, 2, 3]);
    assert.deepEqual(completed.map((run) => run.rescoreJudgeAccounting.judge.estimatedCostUsd), [0.01, 0.02, 0.02]);
    assert.equal(new Set(completed.map((run) => `${run.caseId}:${run.profile}:${run.pipeline}:${run.repetition}`)).size, 3);
    assert.equal(JSON.parse(await readFile(join(target, "run-state.json"), "utf8")).status, "completed");
    assert.equal(await readFile(rawPath, "utf8"), original);

    await writeFile(rawPath, `${original}\n`);
    await assert.rejects(execute(["--resume-rescore", target, "--max-calls", "1"], process.cwd(), {}, { provider: resumedProvider }), /source raw-runs content changed/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
