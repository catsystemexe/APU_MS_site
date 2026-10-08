import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { aggregateDimensionScores, aggregateScores, type RunScore } from "./scoring.ts";

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function percentage(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function buildResultArtifacts(runs: RunScore[], metadata: Record<string, unknown>) {
  const aggregate = aggregateScores(runs);
  const dimensions = aggregateDimensionScores(runs);
  const rawJsonl = runs.map((run) => JSON.stringify({
    caseId: run.caseId, profile: run.profile, pipeline: run.pipeline, repetition: run.repetition,
    candidates: run.candidates, latencyMs: run.latencyMs, inputTokens: run.inputTokens,
    outputTokens: run.outputTokens, estimatedCostUsd: run.estimatedCostUsd,
    semanticJudgeDecisions: run.semanticJudgeDecisions ?? [],
  })).join("\n") + (runs.length ? "\n" : "");
  const scoreJsonl = runs.map((run) => JSON.stringify({
    caseId: run.caseId, profile: run.profile, pipeline: run.pipeline, repetition: run.repetition,
    matches: run.matches, unsupportedCandidateIndexes: run.unsupportedCandidateIndexes,
    forbiddenInferenceHits: run.forbiddenInferenceHits, counts: run.counts, metrics: run.metrics,
  })).join("\n") + (runs.length ? "\n" : "");
  const aggregateJson = `${JSON.stringify({ metadata, aggregate, dimensions }, null, 2)}\n`;
  const headers = ["profile", "pipeline", "cases", "runs", "explicitFactRecall", "precision", "categoryAccuracy", "unsupportedFactRate", "sourceQuoteValidity", "uncertaintyPreservation", "negationPreservation", "duplicateConflictCorrectness", "reviewCount", "stability", "averageLatencyMs", "inputTokens", "outputTokens", "estimatedCostUsd"];
  const aggregateCsv = [headers.join(","), ...aggregate.map((row) => headers.map((header) => csvCell(row[header as keyof typeof row])).join(","))].join("\n") + "\n";
  const dimensionHeaders = ["profile", "pipeline", "dimension", "value", "gold", "actual", "autoPass", "unsupported", "explicitFactRecall", "precision", "unsupportedFactRate"];
  const dimensionCsv = [dimensionHeaders.join(","), ...dimensions.map((row) => dimensionHeaders.map((header) => csvCell(row[header as keyof typeof row])).join(","))].join("\n") + "\n";
  const summary = [
    "# F1 extraction evaluation",
    "",
    `Runs: ${runs.length}`,
    "",
    "Unsupported canonical facts are a high-severity metric and are reported separately from recall.",
    "REVIEW matches are not counted as automatic passes.",
    "",
    "| Profile | Pipeline | Recall | Precision | Unsupported | Category | Stability | Avg latency | Cost USD |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...aggregate.map((row) => `| ${row.profile} | ${row.pipeline} | ${percentage(row.explicitFactRecall)} | ${percentage(row.precision)} | ${percentage(row.unsupportedFactRate)} | ${percentage(row.categoryAccuracy)} | ${percentage(row.stability)} | ${row.averageLatencyMs.toFixed(0)} ms | ${row.estimatedCostUsd === null ? "n/a" : row.estimatedCostUsd.toFixed(6)} |`),
    "",
    "## Boundary dimensions",
    "",
    "Detailed suite, fact-count, category-count, and linguistic-tag rows are available in `aggregate.json` and `dimension-breakdown.csv`.",
    "",
  ].join("\n");
  return { rawJsonl, scoreJsonl, aggregateJson, aggregateCsv, dimensionCsv, summary };
}

export async function writeResultArtifacts(outputRoot: string, runId: string, runs: RunScore[], metadata: Record<string, unknown>) {
  const directory = join(outputRoot, runId);
  await mkdir(directory, { recursive: true });
  const artifacts = buildResultArtifacts(runs, metadata);
  await Promise.all([
    writeFile(join(directory, "raw-runs.jsonl"), artifacts.rawJsonl),
    writeFile(join(directory, "case-scores.jsonl"), artifacts.scoreJsonl),
    writeFile(join(directory, "aggregate.json"), artifacts.aggregateJson),
    writeFile(join(directory, "aggregate.csv"), artifacts.aggregateCsv),
    writeFile(join(directory, "dimension-breakdown.csv"), artifacts.dimensionCsv),
    writeFile(join(directory, "summary.md"), artifacts.summary),
  ]);
  return directory;
}
