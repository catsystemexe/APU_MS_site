import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { EvalCase, EvalCorpus } from "./eval-contract.ts";
import type { PipelineTurnTrace } from "./pipeline.ts";
import { scoreCase, type CaseScore, type EvaluatedCandidate, type SemanticJudgeDecision } from "./scoring.ts";
import { calculateStageMetrics, summarizeStageCalls, type JudgeCallAccounting, type StageRun } from "./stage-analysis.ts";
import { formatRunFailure } from "./diagnostics.ts";

export type SavedRawRun = {
  caseId: string;
  profile: string;
  pipeline: string;
  repetition: number;
  candidates: EvaluatedCandidate[];
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number | null;
  semanticJudgeDecisions?: SemanticJudgeDecision[];
  preGroundingCandidates?: EvaluatedCandidate[];
  preGroundingSemanticJudgeDecisions?: SemanticJudgeDecision[];
  stageTurns?: PipelineTurnTrace[];
  stageCalls?: StageRun["stageCalls"];
  rescoreJudgeCalls?: JudgeCallAccounting[];
};

function validateRawRun(value: unknown, line: number): SavedRawRun {
  if (!value || typeof value !== "object") throw new Error(`raw-runs.jsonl line ${line} is not an object`);
  const run = value as Partial<SavedRawRun>;
  const numeric = [run.repetition, run.latencyMs, run.inputTokens, run.outputTokens];
  if (typeof run.caseId !== "string" || typeof run.profile !== "string" || typeof run.pipeline !== "string" || !Array.isArray(run.candidates) || numeric.some((entry) => typeof entry !== "number" || !Number.isFinite(entry)) || (run.estimatedCostUsd !== null && (typeof run.estimatedCostUsd !== "number" || !Number.isFinite(run.estimatedCostUsd)))) {
    throw new Error(`raw-runs.jsonl line ${line} has an invalid saved-run contract`);
  }
  return run as SavedRawRun;
}

export async function resolveRawRunsPath(inputPath: string) {
  const absolute = resolve(inputPath);
  const details = await stat(absolute);
  return details.isDirectory() ? join(absolute, "raw-runs.jsonl") : absolute;
}

export async function loadSavedRawRuns(inputPath: string) {
  const rawRunsPath = await resolveRawRunsPath(inputPath);
  const source = await readFile(rawRunsPath, "utf8");
  const runs = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    try { return validateRawRun(JSON.parse(line) as unknown, index + 1); }
    catch (error) {
      if (error instanceof SyntaxError) throw new Error(`raw-runs.jsonl line ${index + 1} is not valid JSON`);
      throw error;
    }
  });
  if (!runs.length) throw new Error("raw-runs.jsonl contains no saved runs");
  return { rawRunsPath, sourceDirectory: dirname(rawRunsPath), source, runs };
}

export type RescoreJudgeResult = { decisions: SemanticJudgeDecision[]; call: JudgeCallAccounting | null };
export type RescoreJudge = (item: EvalCase, score: CaseScore, candidates: EvaluatedCandidate[], stage: JudgeCallAccounting["stage"]) => Promise<RescoreJudgeResult>;

export async function rescoreSavedRun(corpus: EvalCorpus, saved: SavedRawRun, judge?: RescoreJudge): Promise<StageRun> {
  try {
    const item = corpus.cases.find((candidate) => candidate.id === saved.caseId);
    if (!item) throw new Error(`Saved run references unknown corpus case: ${saved.caseId}`);
    const judgeCalls: JudgeCallAccounting[] = [];
    const preInitial = saved.preGroundingCandidates ? scoreCase(item, saved.preGroundingCandidates, saved.preGroundingSemanticJudgeDecisions ?? []) : null;
    const preJudged = preInitial && judge ? await judge(item, preInitial, saved.preGroundingCandidates!, "judge_pre") : null;
    if (preJudged?.call) judgeCalls.push(preJudged.call);
    const preDecisions = preJudged?.decisions ?? saved.preGroundingSemanticJudgeDecisions ?? [];
    const preScore = saved.preGroundingCandidates ? scoreCase(item, saved.preGroundingCandidates, preDecisions) : undefined;
    const initial = scoreCase(item, saved.candidates, saved.semanticJudgeDecisions ?? []);
    const postJudged = judge ? await judge(item, initial, saved.candidates, "judge_post") : null;
    if (postJudged?.call) judgeCalls.push(postJudged.call);
    const decisions = postJudged?.decisions ?? saved.semanticJudgeDecisions ?? [];
    const score = scoreCase(item, saved.candidates, decisions);
    return {
      ...score,
      profile: saved.profile,
      pipeline: saved.pipeline,
      repetition: saved.repetition,
      candidates: structuredClone(saved.candidates),
      latencyMs: saved.latencyMs,
      inputTokens: saved.inputTokens,
      outputTokens: saved.outputTokens,
      estimatedCostUsd: saved.estimatedCostUsd,
      suite: item.suite,
      factCount: item.dimensions.factCount,
      categoryCount: item.dimensions.categoryCount,
      linguistic: item.dimensions.linguistic,
      semanticJudgeDecisions: decisions,
      preGroundingCandidates: saved.preGroundingCandidates ? structuredClone(saved.preGroundingCandidates) : undefined,
      preGroundingSemanticJudgeDecisions: saved.preGroundingCandidates ? preDecisions : undefined,
      preGroundingScore: preScore,
      stageTurns: saved.stageTurns ? structuredClone(saved.stageTurns) : undefined,
      stageCalls: saved.stageCalls ? structuredClone(saved.stageCalls) : undefined,
      stageAccounting: saved.stageCalls ? summarizeStageCalls(saved.stageCalls) : undefined,
      stageMetrics: preScore && saved.stageTurns ? calculateStageMetrics(preScore, score, saved.stageTurns) : undefined,
      rescoreJudgeCalls: judgeCalls.length ? judgeCalls : saved.rescoreJudgeCalls,
      rescoreJudgeAccounting: judgeCalls.length ? summarizeStageCalls(judgeCalls) : saved.rescoreJudgeCalls ? summarizeStageCalls(saved.rescoreJudgeCalls) : undefined,
    };
  } catch (error) {
    throw new Error(formatRunFailure(saved, error));
  }
}

export async function rescoreSavedRuns(corpus: EvalCorpus, savedRuns: SavedRawRun[], judge?: RescoreJudge): Promise<StageRun[]> {
  const rescored: StageRun[] = [];
  for (const saved of savedRuns) {
    rescored.push(await rescoreSavedRun(corpus, saved, judge));
  }
  return rescored;
}
