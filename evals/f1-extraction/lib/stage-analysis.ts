import type { PipelineCall, PipelineTurnTrace, StageCandidate } from "./pipeline.ts";
import type { CaseScore, EvaluatedCandidate, RunScore, SemanticJudgeDecision } from "./scoring.ts";
import type { ModelUsageRecord } from "../../../app/usage-ledger.ts";

export type JudgeCallAccounting = {
  stage: "judge_pre" | "judge_post";
  model: string;
  reasoning: "low";
  latencyMs: number;
  usage: ModelUsageRecord | null;
};

export type StageMetrics = {
  extractionMissGoldFactIds: string[];
  groundingLossGoldFactIds: string[];
  groundingSubmitted: number;
  groundingAccepted: number;
  groundingRejected: number;
  groundingRetention: number | null;
  groundingRejectionRate: number | null;
  goldFactRetentionRate: number | null;
  groundedExtrasRemoved: number;
  unsupportedRemoved: number;
  extraction_miss_count: number;
  grounding_loss_count: number;
};

export type StageRun = RunScore & {
  preGroundingCandidates?: EvaluatedCandidate[];
  preGroundingScore?: CaseScore;
  preGroundingSemanticJudgeDecisions?: SemanticJudgeDecision[];
  stageTurns?: PipelineTurnTrace[];
  stageMetrics?: StageMetrics;
  stageCalls?: Array<PipelineCall | JudgeCallAccounting>;
  stageAccounting?: Record<string, { calls: number; latencyMs: number; inputTokens: number; outputTokens: number; estimatedCostUsd: number | null }>;
  rescoreJudgeCalls?: JudgeCallAccounting[];
  rescoreJudgeAccounting?: Record<string, { calls: number; latencyMs: number; inputTokens: number; outputTokens: number; estimatedCostUsd: number | null }>;
};

export function summarizeStageCalls(calls: NonNullable<StageRun["stageCalls"]>) {
  const groups = new Map<string, typeof calls>();
  for (const call of calls) groups.set(call.stage, [...(groups.get(call.stage) ?? []), call]);
  return Object.fromEntries([...groups.entries()].map(([stage, stageCalls]) => {
    const records = stageCalls.map((call) => call.usage).filter((usage): usage is ModelUsageRecord => usage !== null);
    const costs = records.map((usage) => usage.pricing_snapshot.estimated_cost_usd);
    return [stage, {
      calls: stageCalls.length,
      latencyMs: stageCalls.reduce((total, call) => total + call.latencyMs, 0),
      inputTokens: records.reduce((total, usage) => total + (usage.usage.input_tokens ?? 0), 0),
      outputTokens: records.reduce((total, usage) => total + (usage.usage.output_tokens ?? 0), 0),
      estimatedCostUsd: costs.every((cost): cost is number => cost !== null) ? costs.reduce((total, cost) => total + cost, 0) : null,
    }];
  }));
}

function coveredFacts(score: CaseScore) {
  return new Set(score.matches.filter((match) => match.state === "EXACT" || match.state === "SEMANTIC_EQUIVALENT").map((match) => match.goldFactId));
}

export function calculateStageMetrics(pre: CaseScore, post: CaseScore, turns: PipelineTurnTrace[]): StageMetrics {
  const preCovered = coveredFacts(pre);
  const postCovered = coveredFacts(post);
  const submitted = turns.flatMap((turn) => turn.groundingVerdicts);
  const finalIds = new Set(turns.flatMap((turn) => turn.finalCandidates).map((candidate) => candidate.candidateId));
  const preCandidates = turns.flatMap((turn) => turn.preGroundingCandidates);
  const removedClassifications = pre.candidateClassifications.filter((classification) => {
    const candidate = preCandidates[classification.candidateIndex] as StageCandidate | undefined;
    return candidate && !finalIds.has(candidate.candidateId);
  });
  const retainedCovered = [...preCovered].filter((id) => postCovered.has(id)).length;
  const extractionMissGoldFactIds = pre.matches.filter((match) => !preCovered.has(match.goldFactId)).map((match) => match.goldFactId);
  const groundingLossGoldFactIds = [...preCovered].filter((id) => !postCovered.has(id));
  const accepted = submitted.filter((verdict) => verdict.accepted).length;
  const rejected = submitted.length - accepted;
  return {
    extractionMissGoldFactIds,
    groundingLossGoldFactIds,
    groundingSubmitted: submitted.length,
    groundingAccepted: accepted,
    groundingRejected: rejected,
    groundingRetention: submitted.length ? accepted / submitted.length : null,
    groundingRejectionRate: submitted.length ? rejected / submitted.length : null,
    goldFactRetentionRate: preCovered.size ? retainedCovered / preCovered.size : null,
    groundedExtrasRemoved: removedClassifications.filter((entry) => entry.state === "GROUNDED_EXTRA").length,
    unsupportedRemoved: removedClassifications.filter((entry) => entry.state === "UNSUPPORTED").length,
    extraction_miss_count: extractionMissGoldFactIds.length,
    grounding_loss_count: groundingLossGoldFactIds.length,
  };
}

export function groundingVerdictRows(run: StageRun) {
  if (!run.stageTurns || !run.preGroundingScore) return [];
  const preCandidates = run.stageTurns.flatMap((turn) => turn.preGroundingCandidates);
  const classificationById = new Map(preCandidates.map((candidate, index) => [candidate.candidateId, run.preGroundingScore!.candidateClassifications[index] ?? null]));
  const factIdsByCandidateId = new Map<string, string[]>();
  for (const match of run.preGroundingScore.matches) for (const index of match.candidateIndexes) {
    const id = preCandidates[index]?.candidateId;
    if (id) factIdsByCandidateId.set(id, [...(factIdsByCandidateId.get(id) ?? []), match.goldFactId]);
  }
  return run.stageTurns.flatMap((turn) => turn.groundingVerdicts.map((verdict) => {
    const preGroundingGoldFactIds = factIdsByCandidateId.get(verdict.candidateId) ?? [];
    const evaluatorClassification = classificationById.get(verdict.candidateId);
    return {
      caseId: run.caseId,
      profile: run.profile,
      pipeline: run.pipeline,
      repetition: run.repetition,
      inputIndex: turn.inputIndex,
      ...verdict,
      correspondedToGoldFact: preGroundingGoldFactIds.length > 0,
      preGroundingGoldFactIds,
      evaluatorClassification,
    };
  }));
}
