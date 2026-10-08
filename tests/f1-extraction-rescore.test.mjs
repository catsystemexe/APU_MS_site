import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { execute } from "../evals/f1-extraction/run.ts";

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
    assert.match(await readFile(join(outputRoot, "rescored", "summary.md"), "utf8"), /Det\. Recall.*Sem\. Recall.*Grounded Extras.*Unsupported.*Review/);

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
