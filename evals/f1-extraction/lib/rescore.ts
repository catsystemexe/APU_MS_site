import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { EvalCase, EvalCorpus } from "./eval-contract.ts";
import { scoreCase, type CaseScore, type EvaluatedCandidate, type RunScore, type SemanticJudgeDecision } from "./scoring.ts";

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

export type RescoreJudge = (item: EvalCase, score: CaseScore, candidates: EvaluatedCandidate[]) => Promise<SemanticJudgeDecision[]>;

export async function rescoreSavedRuns(corpus: EvalCorpus, savedRuns: SavedRawRun[], judge?: RescoreJudge): Promise<RunScore[]> {
  const cases = new Map(corpus.cases.map((item) => [item.id, item]));
  const rescored: RunScore[] = [];
  for (const saved of savedRuns) {
    const item = cases.get(saved.caseId);
    if (!item) throw new Error(`Saved run references unknown corpus case: ${saved.caseId}`);
    const initial = scoreCase(item, saved.candidates, saved.semanticJudgeDecisions ?? []);
    const decisions = judge ? await judge(item, initial, saved.candidates) : saved.semanticJudgeDecisions ?? [];
    const score = scoreCase(item, saved.candidates, decisions);
    rescored.push({
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
    });
  }
  return rescored;
}
