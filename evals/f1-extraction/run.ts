#!/usr/bin/env node
import { access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve, win32 } from "node:path";
import { pathToFileURL } from "node:url";
import { MODEL_PROFILES, estimateCallCount, loadCorpus, parseCliArgs, resolveProfile, selectCases } from "./lib/eval-contract.ts";
import { createOpenAIProvider, recordUsage, runExtractionPipeline, runSemanticJudge, type EvalProvider } from "./lib/pipeline.ts";
import { loadSavedRawRuns, rescoreSavedRuns } from "./lib/rescore.ts";
import { scoreCase } from "./lib/scoring.ts";
import { writeResultArtifacts, writeResultArtifactsToDirectory } from "./lib/reporting.ts";
import { assertResumeArguments, initializeRunDirectory, loadRunDirectory, runKey, saveCompletedRun, saveRunState, type RunPlan } from "./lib/checkpoint.ts";
import { calculateStageMetrics, summarizeStageCalls, type JudgeCallAccounting, type StageRun } from "./lib/stage-analysis.ts";
import { formatRunFailure } from "./lib/diagnostics.ts";

export const HELP = `F1 extraction evaluation

Usage:
  npm run eval:f1 -- --dry-run [options]
  npm run eval:f1 -- [options]
  npm run eval:f1 -- --resume <run-directory>
  npm run eval:f1 -- --rescore <result-directory|raw-runs.jsonl> [options]

Options:
  --corpus <path>              Corpus JSON (default: evals/f1-extraction/fixtures/corpus.json)
  --rescore <path>             Rescore saved raw runs without rerunning extraction
  --resume <path>              Resume an interrupted run from its checkpoints
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
  --judge-model <model|none>   Optional judge for ambiguous alignments/extras
  --dry-run                    Print scope and estimated calls; make no provider calls
  --help                       Show this help

OPENAI_API_KEY is read only from the process environment for provider-backed extraction or judged rescoring. Offline rescoring needs no key.`;

async function assertNewRescoreDestination(sourceDirectory: string, outputDirectory: string) {
  if (resolve(sourceDirectory) === resolve(outputDirectory)) throw new Error("Rescore output must not overwrite the original result directory.");
  try {
    await access(outputDirectory);
    throw new Error(`Rescore output already exists: ${outputDirectory}`);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
}

async function sha256(path: string) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

export async function execute(argv = process.argv.slice(2), cwd = process.cwd(), environment: NodeJS.ProcessEnv = process.env, dependencies: { provider?: EvalProvider } = {}) {
  const options = parseCliArgs(argv, cwd);
  if (options.help) return { kind: "help" as const, text: HELP };
  if (options.rescorePath !== null) {
    const corpus = await loadCorpus(resolve(options.corpusPath));
    const saved = await loadSavedRawRuns(resolve(options.rescorePath));
    const outputDirectory = resolve(options.outputDir, options.runId);
    await assertNewRescoreDestination(saved.sourceDirectory, outputDirectory);
    let provider: EvalProvider | null = null;
    if (options.judgeModel) {
      const apiKey = environment.OPENAI_API_KEY;
      if (!dependencies.provider && !apiKey) throw new Error("OPENAI_API_KEY is unavailable. Saved runs can be rescored offline without --judge-model; no provider call was made.");
      const judgeCalls = saved.runs.reduce((total, run) => total + 1 + Number(Boolean(run.preGroundingCandidates)), 0);
      if (options.maxCalls !== null && judgeCalls > options.maxCalls) throw new Error(`Estimated semantic judge calls ${judgeCalls} exceed --max-calls ${options.maxCalls}.`);
      provider = dependencies.provider ?? createOpenAIProvider(apiKey!, options.runId);
    }
    const runs = await rescoreSavedRuns(corpus, saved.runs, provider && options.judgeModel ? async (item, score, candidates) => {
      const judged = await runSemanticJudge(item, score, candidates, options.judgeModel!, provider!);
      return judged.decisions;
    } : undefined);
    const directory = await writeResultArtifacts(resolve(options.outputDir), options.runId, runs, {
      generatedAt: new Date().toISOString(), corpusPath: resolve(options.corpusPath),
      rescoredFrom: saved.rawRunsPath, semanticJudgeModel: options.judgeModel,
      originalProviderUsagePreserved: true,
    });
    return { kind: "rescored" as const, directory, runs: runs.length, source: saved.rawRunsPath };
  }
  let corpusPath: string;
  let corpus: Awaited<ReturnType<typeof loadCorpus>>;
  let cases: typeof corpus.cases;
  let profileIds: string[];
  let resolvedProfiles: ReturnType<typeof resolveProfile>[];
  let pipelines: typeof options.pipelines;
  let repetitions: number;
  let judgeModel: typeof options.judgeModel;
  let directory: string;
  let displayPlan: Record<string, unknown>;
  let persistedPlan: RunPlan;
  let state;
  let runs: StageRun[];
  const apiKey = environment.OPENAI_API_KEY;

  if (options.resumePath !== null) {
    assertResumeArguments(argv);
    const resumed = await loadRunDirectory(options.resumePath);
    persistedPlan = resumed.plan;
    corpusPath = persistedPlan.corpusPath;
    if (await sha256(corpusPath) !== persistedPlan.corpusSha256) throw new Error("Resume rejected: corpus content no longer matches run-plan.json.");
    corpus = await loadCorpus(corpusPath);
    cases = persistedPlan.caseIds.map((id) => {
      const item = corpus.cases.find((candidate) => candidate.id === id);
      if (!item) throw new Error(`Resume rejected: corpus no longer contains case ${id}.`);
      return item;
    });
    profileIds = persistedPlan.profiles;
    resolvedProfiles = persistedPlan.resolvedProfiles;
    pipelines = persistedPlan.pipelines;
    repetitions = persistedPlan.repetitions;
    judgeModel = persistedPlan.judgeModel as typeof options.judgeModel;
    directory = resumed.directory;
    displayPlan = persistedPlan.displayPlan;
    state = resumed.state;
    runs = resumed.runs;
  } else {
    corpusPath = resolve(options.corpusPath);
    corpus = await loadCorpus(corpusPath);
    cases = selectCases(corpus, options);
    const estimate = estimateCallCount(cases, options);
    profileIds = options.profiles;
    resolvedProfiles = options.profiles.map((id) => resolveProfile(MODEL_PROFILES[id], options.overrides));
    pipelines = options.pipelines;
    repetitions = options.repetitions;
    judgeModel = options.judgeModel;
    directory = resolve(options.outputDir, options.runId);
    displayPlan = {
      runId: options.runId, cases: estimate.cases, turns: estimate.turns, repetitions, profiles: profileIds,
      resolvedProfiles, pipelines, configurations: estimate.configurations, estimatedProviderCalls: estimate.providerCalls,
      semanticJudgeCalls: estimate.semanticJudgeCalls, outputDirectory: directory,
    };
    if (options.maxCalls !== null && estimate.providerCalls > options.maxCalls) throw new Error(`Estimated provider calls ${estimate.providerCalls} exceed --max-calls ${options.maxCalls}.`);
    if (options.dryRun) return { kind: "dry-run" as const, plan: displayPlan };
    if (!dependencies.provider && !apiKey) throw new Error("OPENAI_API_KEY is unavailable. No provider call was made; use --dry-run or run from an approved local environment.");
    persistedPlan = {
      version: 1, runId: options.runId, createdAt: new Date().toISOString(), corpusPath,
      corpusSha256: await sha256(corpusPath), caseIds: cases.map((item) => item.id), profiles: profileIds,
      resolvedProfiles, pipelines, repetitions, judgeModel, totalRuns: cases.length * profileIds.length * pipelines.length * repetitions,
      displayPlan,
    };
    state = await initializeRunDirectory(directory, persistedPlan);
    runs = [];
  }

  if (!dependencies.provider && !apiKey) throw new Error("OPENAI_API_KEY is unavailable. No provider call was made; use --dry-run or run from an approved local environment.");
  const provider = dependencies.provider ?? createOpenAIProvider(apiKey!, persistedPlan.runId);
  const completed = new Set(runs.map(runKey));
  const metadata = { generatedAt: new Date().toISOString(), corpusPath, plan: displayPlan, semanticJudgeModel: judgeModel };

  for (const [profileIndex, profileId] of profileIds.entries()) for (const pipeline of pipelines) for (let repetition = 1; repetition <= repetitions; repetition += 1) for (const item of cases) {
    const identity = { caseId: item.id, profile: profileId, pipeline, repetition };
    if (completed.has(runKey(identity))) continue;
    try {
      const pipelineRun = await runExtractionPipeline(item, resolvedProfiles[profileIndex], pipeline, provider);
      const preInitial = scoreCase(item, pipelineRun.preGroundingCandidates);
      const preJudge = judgeModel ? await runSemanticJudge(item, preInitial, pipelineRun.preGroundingCandidates, judgeModel, provider) : null;
      const preScore = preJudge ? scoreCase(item, pipelineRun.preGroundingCandidates, preJudge.decisions) : preInitial;
      const postInitial = scoreCase(item, pipelineRun.candidates);
      const postJudge = judgeModel ? await runSemanticJudge(item, postInitial, pipelineRun.candidates, judgeModel, provider) : null;
      const score = postJudge ? scoreCase(item, pipelineRun.candidates, postJudge.decisions) : postInitial;
      const judgeCalls: JudgeCallAccounting[] = [
        ...(preJudge ? [{ stage: "judge_pre" as const, model: judgeModel!, reasoning: "low" as const, latencyMs: preJudge.latencyMs, usage: preJudge.usage }] : []),
        ...(postJudge ? [{ stage: "judge_post" as const, model: judgeModel!, reasoning: "low" as const, latencyMs: postJudge.latencyMs, usage: postJudge.usage }] : []),
      ];
      const accounting = recordUsage([...pipelineRun.calls, ...judgeCalls]);
      const stageCalls = [...pipelineRun.calls, ...judgeCalls];
      const run: StageRun = {
        ...score, ...identity, candidates: pipelineRun.candidates,
        suite: item.suite, factCount: item.dimensions.factCount, categoryCount: item.dimensions.categoryCount, linguistic: item.dimensions.linguistic,
        ...accounting, semanticJudgeDecisions: postJudge?.decisions,
        preGroundingCandidates: pipelineRun.preGroundingCandidates, preGroundingScore: preScore,
        preGroundingSemanticJudgeDecisions: preJudge?.decisions, stageTurns: pipelineRun.turns,
        stageMetrics: calculateStageMetrics(preScore, score, pipelineRun.turns), stageCalls, stageAccounting: summarizeStageCalls(stageCalls),
      };
      runs.push(run);
      completed.add(runKey(run));
      await saveCompletedRun(directory, run, state);
      await writeResultArtifactsToDirectory(directory, runs, metadata);
    } catch (error) {
      const diagnostic = formatRunFailure(identity, error);
      await saveRunState(directory, state, "failed", diagnostic);
      throw new Error(diagnostic);
    }
  }
  if (completed.size !== persistedPlan.totalRuns) {
    const diagnostic = `Run incomplete: ${completed.size}/${persistedPlan.totalRuns} run keys completed.`;
    await saveRunState(directory, state, "failed", diagnostic);
    throw new Error(diagnostic);
  }
  await saveRunState(directory, state, "completed");
  await writeResultArtifactsToDirectory(directory, runs, metadata);
  return { kind: "completed" as const, plan: displayPlan, directory, runs: runs.length };
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
