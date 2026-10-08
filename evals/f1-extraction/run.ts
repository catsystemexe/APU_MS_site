#!/usr/bin/env node
import { resolve, win32 } from "node:path";
import { pathToFileURL } from "node:url";
import { MODEL_PROFILES, estimateCallCount, loadCorpus, parseCliArgs, resolveProfile, selectCases } from "./lib/eval-contract.ts";
import { createOpenAIProvider, runExtractionPipeline, runSemanticJudge } from "./lib/pipeline.ts";
import { scoreCase, type RunScore } from "./lib/scoring.ts";
import { writeResultArtifacts } from "./lib/reporting.ts";

export const HELP = `F1 extraction evaluation

Usage:
  npm run eval:f1 -- --dry-run [options]
  npm run eval:f1 -- [options]

Options:
  --corpus <path>              Corpus JSON (default: evals/f1-extraction/fixtures/corpus.json)
  --suite <csv>                atomic,mixed,dense,real
  --case <csv>                 Exact case ids
  --profiles <csv>             baseline,terra-extract,terra-both,terra-medium,sol-reference
  --extraction-model <model>   Optional selected-profile override
  --extraction-reasoning <x>   low or medium override
  --grounding-model <model>    Optional selected-profile override
  --grounding-reasoning <x>    low or medium override
  --pipelines <csv>            baseline,coverage
  --repetitions <n>            1–20
  --run-id <id>                Result directory name
  --output-dir <path>          Local result root
  --max-calls <n>              Refuse a larger estimated provider sweep
  --judge-model <model|none>   Optional isolated semantic judge for REVIEW matches
  --dry-run                    Print scope and estimated calls; make no provider calls
  --help                       Show this help

OPENAI_API_KEY is read only from the process environment for non-dry runs.`;

export async function execute(argv = process.argv.slice(2), cwd = process.cwd(), environment: NodeJS.ProcessEnv = process.env) {
  const options = parseCliArgs(argv, cwd);
  if (options.help) return { kind: "help" as const, text: HELP };
  const corpus = await loadCorpus(resolve(options.corpusPath));
  const cases = selectCases(corpus, options);
  const estimate = estimateCallCount(cases, options);
  const plan = {
    runId: options.runId,
    cases: estimate.cases,
    turns: estimate.turns,
    repetitions: options.repetitions,
    profiles: options.profiles,
    resolvedProfiles: options.profiles.map((id) => resolveProfile(MODEL_PROFILES[id], options.overrides)),
    pipelines: options.pipelines,
    configurations: estimate.configurations,
    estimatedProviderCalls: estimate.providerCalls,
    semanticJudgeCalls: estimate.semanticJudgeCalls,
    outputDirectory: resolve(options.outputDir, options.runId),
  };
  if (options.maxCalls !== null && estimate.providerCalls > options.maxCalls) throw new Error(`Estimated provider calls ${estimate.providerCalls} exceed --max-calls ${options.maxCalls}.`);
  if (options.dryRun) return { kind: "dry-run" as const, plan };
  const apiKey = environment.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is unavailable. No provider call was made; use --dry-run or run from an approved local environment.");
  const provider = createOpenAIProvider(apiKey, options.runId);
  const runs: RunScore[] = [];
  for (const profileId of options.profiles) for (const pipeline of options.pipelines) for (let repetition = 1; repetition <= options.repetitions; repetition += 1) for (const item of cases) {
    const pipelineRun = await runExtractionPipeline(item, resolveProfile(MODEL_PROFILES[profileId], options.overrides), pipeline, provider);
    const score = scoreCase(item, pipelineRun.candidates);
    const semantic = options.judgeModel ? await runSemanticJudge(item, score, pipelineRun.candidates, options.judgeModel, provider) : null;
    runs.push({
      ...score, profile: profileId, pipeline, repetition, candidates: pipelineRun.candidates,
      suite: item.suite, factCount: item.dimensions.factCount, categoryCount: item.dimensions.categoryCount, linguistic: item.dimensions.linguistic,
      latencyMs: pipelineRun.latencyMs, inputTokens: pipelineRun.inputTokens,
      outputTokens: pipelineRun.outputTokens, estimatedCostUsd: pipelineRun.estimatedCostUsd,
      ...(semantic ? { semanticJudgeDecisions: semantic.decisions } : {}),
    });
  }
  const directory = await writeResultArtifacts(resolve(options.outputDir), options.runId, runs, {
    generatedAt: new Date().toISOString(), corpusPath: resolve(options.corpusPath), plan,
    semanticJudgeModel: options.judgeModel,
  });
  return { kind: "completed" as const, plan, directory, runs: runs.length };
}

export function isCliEntrypoint(moduleUrl: string, entryPath: string | undefined, windows = process.platform === "win32") {
  if (typeof entryPath !== "string") return false;
  const absoluteEntryPath = windows ? win32.resolve(entryPath) : resolve(entryPath);
  return moduleUrl === pathToFileURL(absoluteEntryPath, { windows }).href;
}

if (isCliEntrypoint(import.meta.url, process.argv[1])) {
  execute().then((result) => {
    if (result.kind === "help") console.log(result.text);
    else console.log(JSON.stringify(result, null, 2));
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : "F1 extraction evaluation failed.");
    process.exitCode = 1;
  });
}
