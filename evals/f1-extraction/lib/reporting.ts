import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { aggregateDimensionScores, aggregateScores } from "./scoring.ts";
import { groundingVerdictRows, type StageRun } from "./stage-analysis.ts";

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function percentage(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function assertCoverageInvariant(preCovered: number, postCovered: number, scope: string) {
  if (postCovered > preCovered) throw new Error(`POST semantic coverage exceeds PRE semantic coverage for ${scope}.`);
}

function aggregateStages(runs: StageRun[]) {
  const groups = new Map<string, StageRun[]>();
  for (const run of runs) {
    const key = `${run.profile}\u0000${run.pipeline}`;
    groups.set(key, [...(groups.get(key) ?? []), run]);
  }
  return [...groups.entries()].map(([key, group]) => {
    const [profile, pipeline] = key.split("\u0000");
    const available = group.filter((run) => run.preGroundingScore && run.stageMetrics);
    const sum = (selector: (run: StageRun) => number) => available.reduce((total, run) => total + selector(run), 0);
    const preGold = sum((run) => run.preGroundingScore!.counts.gold);
    const preActual = sum((run) => run.preGroundingScore!.counts.actual);
    const preSemanticCovered = sum((run) => run.preGroundingScore!.counts.semanticCovered);
    const preSemanticCorrect = sum((run) => run.preGroundingScore!.counts.semanticCorrectCandidates);
    const postGold = sum((run) => run.counts.gold);
    const postActual = sum((run) => run.counts.actual);
    const postSemanticCovered = sum((run) => run.counts.semanticCovered);
    const postSemanticCorrect = sum((run) => run.counts.semanticCorrectCandidates);
    for (const run of available) assertCoverageInvariant(
      run.preGroundingScore!.counts.semanticCovered,
      run.counts.semanticCovered,
      `${run.caseId}/${run.profile}/${run.pipeline}/repetition-${run.repetition}`,
    );
    assertCoverageInvariant(preSemanticCovered, postSemanticCovered, `${profile}/${pipeline}`);
    const stageNames = new Set(available.flatMap((run) => Object.keys(run.stageAccounting ?? {})));
    const stageAccounting = Object.fromEntries([...stageNames].map((stage) => {
      const rows = available.map((run) => run.stageAccounting?.[stage]).filter((row): row is NonNullable<typeof row> => Boolean(row));
      const costs = rows.map((row) => row.estimatedCostUsd);
      return [stage, {
        calls: rows.reduce((total, row) => total + row.calls, 0),
        latencyMs: rows.reduce((total, row) => total + row.latencyMs, 0),
        inputTokens: rows.reduce((total, row) => total + row.inputTokens, 0),
        outputTokens: rows.reduce((total, row) => total + row.outputTokens, 0),
        estimatedCostUsd: costs.every((cost): cost is number => cost !== null) ? costs.reduce((total, cost) => total + cost, 0) : null,
      }];
    }));
    return {
      profile, pipeline,
      stageRunsAvailable: available.length,
      stageRunsTotal: group.length,
      preSemanticRecall: available.length ? preSemanticCovered / Math.max(1, preGold) : null,
      preSemanticPrecision: available.length ? preSemanticCorrect / Math.max(1, preActual) : null,
      postSemanticRecall: available.length ? postSemanticCovered / Math.max(1, postGold) : null,
      postSemanticPrecision: available.length ? postSemanticCorrect / Math.max(1, postActual) : null,
      extractionMisses: available.length ? sum((run) => run.stageMetrics!.extraction_miss_count) : null,
      groundingLosses: available.length ? sum((run) => run.stageMetrics!.grounding_loss_count) : null,
      extraction_miss_count: available.length ? sum((run) => run.stageMetrics!.extraction_miss_count) : null,
      grounding_loss_count: available.length ? sum((run) => run.stageMetrics!.grounding_loss_count) : null,
      groundingSubmitted: available.length ? sum((run) => run.stageMetrics!.groundingSubmitted) : null,
      groundingAccepted: available.length ? sum((run) => run.stageMetrics!.groundingAccepted) : null,
      groundingRejected: available.length ? sum((run) => run.stageMetrics!.groundingRejected) : null,
      groundedExtrasRemoved: available.length ? sum((run) => run.stageMetrics!.groundedExtrasRemoved) : null,
      unsupportedRemoved: available.length ? sum((run) => run.stageMetrics!.unsupportedRemoved) : null,
      stageAccounting,
    };
  });
}

function aggregateStageDimensions(runs: StageRun[]) {
  const available = runs.filter((run) => run.preGroundingScore && run.stageMetrics);
  const rows: Array<Record<string, string | number>> = [];
  const dimensions = [
    { name: "suite", values: (run: StageRun) => run.suite ? [run.suite] : [] },
    { name: "factCount", values: (run: StageRun) => run.factCount === undefined ? [] : [String(run.factCount)] },
    { name: "categoryCount", values: (run: StageRun) => run.categoryCount === undefined ? [] : [String(run.categoryCount)] },
    { name: "linguistic", values: (run: StageRun) => run.linguistic ?? [] },
  ];
  for (const dimension of dimensions) {
    const groups = new Map<string, StageRun[]>();
    for (const run of available) for (const value of dimension.values(run)) {
      const key = `${run.profile}\u0000${run.pipeline}\u0000${value}`;
      groups.set(key, [...(groups.get(key) ?? []), run]);
    }
    for (const [key, group] of groups) {
      const [profile, pipeline, value] = key.split("\u0000");
      const sum = (selector: (run: StageRun) => number) => group.reduce((total, run) => total + selector(run), 0);
      const gold = sum((run) => run.preGroundingScore!.counts.gold);
      const preActual = sum((run) => run.preGroundingScore!.counts.actual);
      const postActual = sum((run) => run.counts.actual);
      const preSemanticCovered = sum((run) => run.preGroundingScore!.counts.semanticCovered);
      const postSemanticCovered = sum((run) => run.counts.semanticCovered);
      assertCoverageInvariant(preSemanticCovered, postSemanticCovered, `${profile}/${pipeline}/${dimension.name}=${value}`);
      rows.push({
        profile, pipeline, dimension: dimension.name, value, gold, preActual, postActual,
        preSemanticCovered, postSemanticCovered,
        preSemanticRecall: preSemanticCovered / Math.max(1, gold),
        postSemanticRecall: postSemanticCovered / Math.max(1, gold),
        preSemanticPrecision: sum((run) => run.preGroundingScore!.counts.semanticCorrectCandidates) / Math.max(1, preActual),
        postSemanticPrecision: sum((run) => run.counts.semanticCorrectCandidates) / Math.max(1, postActual),
        extraction_miss_count: sum((run) => run.stageMetrics!.extraction_miss_count),
        grounding_loss_count: sum((run) => run.stageMetrics!.grounding_loss_count),
      });
    }
  }
  return rows.sort((a, b) => String(a.profile).localeCompare(String(b.profile)) || String(a.pipeline).localeCompare(String(b.pipeline)) || String(a.dimension).localeCompare(String(b.dimension)) || Number(a.value) - Number(b.value) || String(a.value).localeCompare(String(b.value)));
}

export function buildResultArtifacts(runs: StageRun[], metadata: Record<string, unknown>) {
  const aggregate = aggregateScores(runs);
  const dimensions = aggregateDimensionScores(runs);
  const stageAggregate = aggregateStages(runs);
  const stageDimensions = aggregateStageDimensions(runs);
  const rawJsonl = runs.map((run) => JSON.stringify({
    caseId: run.caseId, profile: run.profile, pipeline: run.pipeline, repetition: run.repetition,
    candidates: run.candidates, latencyMs: run.latencyMs, inputTokens: run.inputTokens,
    outputTokens: run.outputTokens, estimatedCostUsd: run.estimatedCostUsd,
    semanticJudgeDecisions: run.semanticJudgeDecisions ?? [],
    preGroundingCandidates: run.preGroundingCandidates,
    preGroundingSemanticJudgeDecisions: run.preGroundingSemanticJudgeDecisions,
    stageTurns: run.stageTurns,
    stageCalls: run.stageCalls,
    stageAccounting: run.stageAccounting,
    rescoreJudgeCalls: run.rescoreJudgeCalls,
    rescoreJudgeAccounting: run.rescoreJudgeAccounting,
    semanticEvidence: run.semanticEvidence,
  })).join("\n") + (runs.length ? "\n" : "");
  const scoreJsonl = runs.map((run) => JSON.stringify({
    caseId: run.caseId, profile: run.profile, pipeline: run.pipeline, repetition: run.repetition,
    matches: run.matches, candidateClassifications: run.candidateClassifications,
    groundedExtraCandidateIndexes: run.groundedExtraCandidateIndexes,
    unsupportedCandidateIndexes: run.unsupportedCandidateIndexes, reviewCandidateIndexes: run.reviewCandidateIndexes,
    forbiddenInferenceHits: run.forbiddenInferenceHits, counts: run.counts, metrics: run.metrics,
  })).join("\n") + (runs.length ? "\n" : "");
  const stageJsonl = runs.filter((run) => run.preGroundingScore && run.stageMetrics).map((run) => JSON.stringify({
    caseId: run.caseId, profile: run.profile, pipeline: run.pipeline, repetition: run.repetition,
    preGroundingScore: run.preGroundingScore, postGroundingScore: {
      matches: run.matches, candidateClassifications: run.candidateClassifications, counts: run.counts, metrics: run.metrics,
    },
    totals: { latencyMs: run.latencyMs, inputTokens: run.inputTokens, outputTokens: run.outputTokens, estimatedCostUsd: run.estimatedCostUsd },
    stageMetrics: run.stageMetrics, stageTurns: run.stageTurns, stageCalls: run.stageCalls, stageAccounting: run.stageAccounting,
    rescoreJudgeCalls: run.rescoreJudgeCalls, rescoreJudgeAccounting: run.rescoreJudgeAccounting,
    semanticEvidence: run.semanticEvidence,
  })).join("\n") + (runs.some((run) => run.preGroundingScore && run.stageMetrics) ? "\n" : "");
  const verdictRows = runs.flatMap(groundingVerdictRows);
  const verdictJsonl = verdictRows.map((row) => JSON.stringify(row)).join("\n") + (verdictRows.length ? "\n" : "");
  const aggregateJson = `${JSON.stringify({ metadata, aggregate, stageAggregate, dimensions, stageDimensions }, null, 2)}\n`;
  const headers = ["profile", "pipeline", "cases", "runs", "deterministicRecall", "semanticRecall", "preGroundingSemanticRecall", "postGroundingSemanticRecall", "deterministicPrecision", "semanticPrecision", "preGroundingSemanticPrecision", "postGroundingSemanticPrecision", "extraction_miss_count", "grounding_loss_count", "groundedExtraCount", "groundedExtraRate", "unsupportedCount", "trueUnsupportedRate", "missCount", "missRate", "reviewCount", "candidateReviewCount", "categoryAccuracy", "sourceQuoteValidity", "uncertaintyPreservation", "negationPreservation", "duplicateConflictCorrectness", "stability", "averageLatencyMs", "inputTokens", "outputTokens", "estimatedCostUsd"];
  const aggregateCsvRows = aggregate.map((row) => {
    const stage = stageAggregate.find((entry) => entry.profile === row.profile && entry.pipeline === row.pipeline)!;
    const combined: Record<string, unknown> = {
      ...row,
      preGroundingSemanticRecall: stage.preSemanticRecall,
      postGroundingSemanticRecall: stage.postSemanticRecall,
      preGroundingSemanticPrecision: stage.preSemanticPrecision,
      postGroundingSemanticPrecision: stage.postSemanticPrecision,
      extraction_miss_count: stage.extraction_miss_count,
      grounding_loss_count: stage.grounding_loss_count,
    };
    return headers.map((header) => csvCell(combined[header])).join(",");
  });
  const aggregateCsv = [headers.join(","), ...aggregateCsvRows].join("\n") + "\n";
  const dimensionHeaders = ["profile", "pipeline", "dimension", "value", "gold", "actual", "deterministicCovered", "semanticCovered", "groundedExtra", "unsupported", "deterministicRecall", "semanticRecall", "deterministicPrecision", "semanticPrecision", "groundedExtraRate", "trueUnsupportedRate", "preSemanticCovered", "postSemanticCovered", "preSemanticRecall", "postSemanticRecall", "preSemanticPrecision", "postSemanticPrecision", "extraction_miss_count", "grounding_loss_count"];
  const dimensionCsv = [dimensionHeaders.join(","), ...dimensions.map((row) => {
    const stage = stageDimensions.find((entry) => entry.profile === row.profile && entry.pipeline === row.pipeline && entry.dimension === row.dimension && entry.value === row.value);
    return dimensionHeaders.map((header) => csvCell(header in row ? row[header as keyof typeof row] : stage?.[header])).join(",");
  })].join("\n") + "\n";
  const summary = [
    "# F1 extraction evaluation",
    "",
    `Runs: ${runs.length}`,
    "",
    "Unsupported canonical facts are a high-severity metric. Grounded extras are reported separately and are not hallucinations.",
    "REVIEW alignments are not counted as semantic equivalents until an explicit judge decision exists.",
    "",
    "| Profile | Pipeline | Pre sem. recall | Post sem. recall | Extraction misses | Grounding losses | Post sem. precision | Grounded extras | Unsupported | Avg latency | Cost USD |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...aggregate.map((row) => {
      const stage = stageAggregate.find((entry) => entry.profile === row.profile && entry.pipeline === row.pipeline)!;
      return `| ${row.profile} | ${row.pipeline} | ${stage.preSemanticRecall === null ? "unavailable" : percentage(stage.preSemanticRecall)} | ${percentage(row.semanticRecall)} | ${stage.extractionMisses ?? "unavailable"} | ${stage.groundingLosses ?? "unavailable"} | ${percentage(row.semanticPrecision)} | ${row.groundedExtraCount} (${percentage(row.groundedExtraRate)}) | ${row.unsupportedCount} (${percentage(row.trueUnsupportedRate)}) | ${row.averageLatencyMs.toFixed(0)} ms | ${row.estimatedCostUsd === null ? "n/a" : row.estimatedCostUsd.toFixed(6)} |`;
    }),
    "",
    "| Profile | Pipeline | Det. Recall | Sem. Recall | Det. Precision | Sem. Precision | Grounded Extras | Unsupported | Review |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...aggregate.map((row) => `| ${row.profile} | ${row.pipeline} | ${percentage(row.deterministicRecall)} | ${percentage(row.semanticRecall)} | ${percentage(row.deterministicPrecision)} | ${percentage(row.semanticPrecision)} | ${row.groundedExtraCount} | ${row.unsupportedCount} | ${row.reviewCount} |`),
    "",
    "## Boundary dimensions",
    "",
    "Detailed suite, fact-count, category-count, and linguistic-tag rows are available in `aggregate.json` and `dimension-breakdown.csv`.",
    "",
  ].join("\n");
  return { rawJsonl, scoreJsonl, stageJsonl, verdictJsonl, aggregateJson, aggregateCsv, dimensionCsv, summary };
}

async function atomicWrite(path: string, contents: string) {
  const temporary = `${path}.tmp-${process.pid}-${crypto.randomUUID()}`;
  await writeFile(temporary, contents);
  await rename(temporary, path);
}

export async function writeResultArtifactsToDirectory(directory: string, runs: StageRun[], metadata: Record<string, unknown>) {
  await mkdir(directory, { recursive: true });
  const artifacts = buildResultArtifacts(runs, metadata);
  await Promise.all([
    atomicWrite(join(directory, "raw-runs.jsonl"), artifacts.rawJsonl),
    atomicWrite(join(directory, "case-scores.jsonl"), artifacts.scoreJsonl),
    atomicWrite(join(directory, "stage-runs.jsonl"), artifacts.stageJsonl),
    atomicWrite(join(directory, "grounding-verdicts.jsonl"), artifacts.verdictJsonl),
    atomicWrite(join(directory, "aggregate.json"), artifacts.aggregateJson),
    atomicWrite(join(directory, "aggregate.csv"), artifacts.aggregateCsv),
    atomicWrite(join(directory, "dimension-breakdown.csv"), artifacts.dimensionCsv),
    atomicWrite(join(directory, "summary.md"), artifacts.summary),
  ]);
  return directory;
}

export async function writeResultArtifacts(outputRoot: string, runId: string, runs: StageRun[], metadata: Record<string, unknown>) {
  return writeResultArtifactsToDirectory(join(outputRoot, runId), runs, metadata);
}
