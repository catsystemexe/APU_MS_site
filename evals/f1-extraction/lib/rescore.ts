import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { EvalCase, EvalCorpus } from "./eval-contract.ts";
import type { PipelineTurnTrace } from "./pipeline.ts";
import { scoreCase, type CaseScore, type EvaluatedCandidate, type SemanticJudgeDecision } from "./scoring.ts";
import { calculateStageMetrics, summarizeStageCalls, type JudgeCallAccounting, type StageRun } from "./stage-analysis.ts";
import { formatRunFailure } from "./diagnostics.ts";
import { deriveStagedSemanticEvaluation, type StagedSemanticJudgeOutput } from "./semantic-evidence.ts";

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
  semanticEvidence?: StageRun["semanticEvidence"];
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
export type RescoreJudges = {
  staged?: (item: EvalCase, turns: PipelineTurnTrace[]) => Promise<{ output: StagedSemanticJudgeOutput | null; call: JudgeCallAccounting | null }>;
  legacy?: (item: EvalCase, score: CaseScore, candidates: EvaluatedCandidate[]) => Promise<RescoreJudgeResult>;
};

export async function rescoreSavedRun(corpus: EvalCorpus, saved: SavedRawRun, judges: RescoreJudges = {}): Promise<StageRun> {
  try {
    const item = corpus.cases.find((candidate) => candidate.id === saved.caseId);
    if (!item) throw new Error(`Saved run references unknown corpus case: ${saved.caseId}`);
    const judgeCalls: JudgeCallAccounting[] = [];
    if (saved.stageTurns) {
      const judged = judges.staged ? await judges.staged(item, saved.stageTurns) : null;
      if (judged?.call) judgeCalls.push(judged.call);
      const evaluated = deriveStagedSemanticEvaluation(item, saved.stageTurns, judged?.output ?? null);
      return {
        ...evaluated.postScore,
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
        semanticJudgeDecisions: evaluated.postDecisions,
        preGroundingCandidates: saved.preGroundingCandidates ? structuredClone(saved.preGroundingCandidates) : evaluated.context.preCandidates.map((candidate) => {
          const { candidateId, origin, ...value } = candidate; void candidateId; void origin; return value;
        }),
        preGroundingSemanticJudgeDecisions: evaluated.preDecisions,
        preGroundingScore: evaluated.preScore,
        stageTurns: structuredClone(saved.stageTurns),
        stageCalls: saved.stageCalls ? structuredClone(saved.stageCalls) : undefined,
        stageAccounting: saved.stageCalls ? summarizeStageCalls(saved.stageCalls) : undefined,
        stageMetrics: calculateStageMetrics(evaluated.preScore, evaluated.postScore, saved.stageTurns),
        semanticEvidence: evaluated.evidence,
        rescoreJudgeCalls: judgeCalls.length ? judgeCalls : saved.rescoreJudgeCalls,
        rescoreJudgeAccounting: judgeCalls.length ? summarizeStageCalls(judgeCalls) : saved.rescoreJudgeCalls ? summarizeStageCalls(saved.rescoreJudgeCalls) : undefined,
      };
    }
    const initial = scoreCase(item, saved.candidates, saved.semanticJudgeDecisions ?? []);
    const postJudged = judges.legacy ? await judges.legacy(item, initial, saved.candidates) : null;
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
      preGroundingCandidates: undefined,
      preGroundingSemanticJudgeDecisions: undefined,
      preGroundingScore: undefined,
      stageTurns: undefined,
      stageCalls: saved.stageCalls ? structuredClone(saved.stageCalls) : undefined,
      stageAccounting: saved.stageCalls ? summarizeStageCalls(saved.stageCalls) : undefined,
      stageMetrics: undefined,
      semanticEvidence: undefined,
      rescoreJudgeCalls: judgeCalls.length ? judgeCalls : saved.rescoreJudgeCalls,
      rescoreJudgeAccounting: judgeCalls.length ? summarizeStageCalls(judgeCalls) : saved.rescoreJudgeCalls ? summarizeStageCalls(saved.rescoreJudgeCalls) : undefined,
    };
  } catch (error) {
    throw new Error(formatRunFailure(saved, error));
  }
}

export async function rescoreSavedRuns(corpus: EvalCorpus, savedRuns: SavedRawRun[], judges: RescoreJudges = {}): Promise<StageRun[]> {
  const rescored: StageRun[] = [];
  for (const saved of savedRuns) {
    rescored.push(await rescoreSavedRun(corpus, saved, judges));
  }
  return rescored;
}
