import { goldCanonicalText, type EvalCase } from "./eval-contract.ts";
import type { GroundingTraceVerdict, PipelineTurnTrace, StageCandidate } from "./pipeline.ts";
import { evaluateSemanticSupportGroup, scoreCase, type CandidateClassification, type CaseScore, type EvaluatedCandidate, type SemanticJudgeDecision, type SemanticSupportRejectionReason } from "./scoring.ts";

export type SemanticSupportGroup = { candidateIds: string[] };
export type StagedFactDecision = {
  goldFactId: string;
  decision: "equivalent" | "not_equivalent" | "uncertain";
  supportGroups: SemanticSupportGroup[];
  reason: string;
};
export type StagedCandidateDecision = {
  candidateId: string;
  decision: "grounded_extra" | "unsupported" | "uncertain";
  reason: string;
};
export type StagedSemanticJudgeOutput = { factDecisions: StagedFactDecision[]; candidateDecisions: StagedCandidateDecision[] };

export type StagedJudgeContext = {
  preCandidates: StageCandidate[];
  postCandidates: StageCandidate[];
  survivedCandidateIds: Set<string>;
  reviewAlignments: Array<{
    goldFact: EvalCase["expectedFacts"][number];
    candidates: Array<{ candidateId: string; candidate: EvaluatedCandidate; survivedGrounding: boolean }>;
  }>;
  unmatchedCandidates: Array<{ candidateId: string; candidate: EvaluatedCandidate; survivedGrounding: boolean }>;
};

export type SemanticGoldEvidence = {
  goldFactId: string;
  decision: "exact" | "equivalent" | "not_equivalent" | "uncertain" | "missing";
  reason: string;
  rawSupportGroups: SemanticSupportGroup[];
  supportGroups: SemanticSupportGroup[];
  rejectedSupportGroups: Array<{
    candidateIds: string[];
    code: "inadmissible_semantic_support";
    reasons: SemanticSupportRejectionReason[];
  }>;
  rejectionCode: "inadmissible_semantic_support" | null;
  postSupportGroups: SemanticSupportGroup[];
  preCovered: boolean;
  postCovered: boolean;
  groundingLoss: boolean;
  removedCandidateIds: string[];
  groundingVerdicts: GroundingTraceVerdict[];
};

export type StagedSemanticEvidence = {
  preCandidateIds: string[];
  postCandidateIds: string[];
  goldFacts: SemanticGoldEvidence[];
  candidates: Array<{
    candidateId: string;
    survivedGrounding: boolean;
    classification: CandidateClassification;
  }>;
};

function evaluated(candidate: StageCandidate): EvaluatedCandidate {
  const { candidateId, origin, ...value } = candidate;
  void candidateId;
  void origin;
  return value;
}

function assertUnique(ids: string[], label: string) {
  if (new Set(ids).size !== ids.length) throw new Error(`${label} contains duplicate stable candidate IDs.`);
}

export function buildStagedJudgeContext(item: EvalCase, turns: PipelineTurnTrace[]) {
  const preCandidates = turns.flatMap((turn) => turn.preGroundingCandidates);
  const postCandidates = turns.flatMap((turn) => turn.finalCandidates);
  const preIds = preCandidates.map((candidate) => candidate.candidateId);
  const postIds = postCandidates.map((candidate) => candidate.candidateId);
  assertUnique(preIds, "PRE candidate universe");
  assertUnique(postIds, "POST candidate universe");
  for (const turn of turns) {
    assertUnique(turn.preGroundingCandidates.map((candidate) => candidate.candidateId), `turn ${turn.inputIndex} PRE candidates`);
    assertUnique(turn.finalCandidates.map((candidate) => candidate.candidateId), `turn ${turn.inputIndex} POST candidates`);
  }
  const preIdSet = new Set(preIds);
  for (const id of postIds) if (!preIdSet.has(id)) throw new Error(`POST candidate ${id} is absent from the PRE candidate universe.`);
  const survivedCandidateIds = new Set(postIds);
  const preScore = scoreCase(item, preCandidates.map(evaluated));
  const reviewAlignments = preScore.matches.filter((match) => match.state === "REVIEW" && match.candidateIndexes.length).map((match) => ({
    goldFact: (() => {
      const fact = item.expectedFacts.find((candidate) => candidate.id === match.goldFactId)!;
      return { ...fact, text: goldCanonicalText(fact) };
    })(),
    candidates: match.candidateIndexes.map((index) => ({
      candidateId: preCandidates[index].candidateId,
      candidate: evaluated(preCandidates[index]),
      survivedGrounding: survivedCandidateIds.has(preCandidates[index].candidateId),
    })),
  }));
  const unmatchedCandidates = preScore.candidateClassifications.filter((entry) => entry.state === "REVIEW").map((entry) => ({
    candidateId: preCandidates[entry.candidateIndex].candidateId,
    candidate: evaluated(preCandidates[entry.candidateIndex]),
    survivedGrounding: survivedCandidateIds.has(preCandidates[entry.candidateIndex].candidateId),
  }));
  return { preCandidates, postCandidates, survivedCandidateIds, reviewAlignments, unmatchedCandidates } satisfies StagedJudgeContext;
}

export function validateStagedJudgeOutput(value: unknown, context: StagedJudgeContext): StagedSemanticJudgeOutput {
  if (!value || typeof value !== "object") throw new Error("staged semantic judge result is not an object");
  const result = value as Partial<StagedSemanticJudgeOutput>;
  if (!Array.isArray(result.factDecisions) || !Array.isArray(result.candidateDecisions)) throw new Error("staged semantic judge result arrays are missing");
  const requestedFacts = new Map(context.reviewAlignments.map((alignment) => [alignment.goldFact.id, new Set(alignment.candidates.map((candidate) => candidate.candidateId))]));
  const requestedCandidates = new Set(context.unmatchedCandidates.map((candidate) => candidate.candidateId));
  const seenFacts = new Set<string>();
  for (const decision of result.factDecisions) {
    if (!decision || typeof decision.goldFactId !== "string" || !["equivalent", "not_equivalent", "uncertain"].includes(decision.decision) || typeof decision.reason !== "string" || !Array.isArray(decision.supportGroups)) throw new Error("invalid staged semantic fact decision");
    const allowed = requestedFacts.get(decision.goldFactId);
    if (!allowed) throw new Error(`semantic support references unrequested gold fact ${decision.goldFactId}`);
    if (seenFacts.has(decision.goldFactId)) throw new Error(`duplicate semantic decision for gold fact ${decision.goldFactId}`);
    seenFacts.add(decision.goldFactId);
    if (decision.decision === "equivalent" && !decision.supportGroups.length) throw new Error(`equivalent fact ${decision.goldFactId} has no support group`);
    if (decision.decision !== "equivalent" && decision.supportGroups.length) throw new Error(`non-equivalent fact ${decision.goldFactId} must not include support groups`);
    const groupKeys = new Set<string>();
    for (const group of decision.supportGroups) {
      if (!group || !Array.isArray(group.candidateIds) || !group.candidateIds.length || group.candidateIds.some((id) => typeof id !== "string" || !allowed.has(id))) throw new Error(`semantic support for ${decision.goldFactId} references an unknown candidate ID`);
      assertUnique(group.candidateIds, `semantic support group for ${decision.goldFactId}`);
      const key = [...group.candidateIds].sort().join("\u0000");
      if (groupKeys.has(key)) throw new Error(`duplicate semantic support group for ${decision.goldFactId}`);
      groupKeys.add(key);
    }
  }
  if (seenFacts.size !== requestedFacts.size) throw new Error("staged semantic judge omitted a required gold-fact decision");
  const seenCandidates = new Set<string>();
  for (const decision of result.candidateDecisions) {
    if (!decision || typeof decision.candidateId !== "string" || !requestedCandidates.has(decision.candidateId) || !["grounded_extra", "unsupported", "uncertain"].includes(decision.decision) || typeof decision.reason !== "string") throw new Error("invalid staged semantic candidate decision");
    if (seenCandidates.has(decision.candidateId)) throw new Error(`duplicate semantic candidate decision for ${decision.candidateId}`);
    seenCandidates.add(decision.candidateId);
  }
  if (seenCandidates.size !== requestedCandidates.size) throw new Error("staged semantic judge omitted a required candidate decision");
  return structuredClone(result as StagedSemanticJudgeOutput);
}

function legacyFactDecisions(output: StagedSemanticJudgeOutput | null, idToIndex: Map<string, number>, availableIds: Set<string>, post: boolean): SemanticJudgeDecision[] {
  return (output?.factDecisions ?? []).flatMap((decision): SemanticJudgeDecision[] => {
    const survivingGroups = decision.supportGroups.filter((group) => group.candidateIds.every((id) => availableIds.has(id)));
    if (decision.decision === "equivalent" && survivingGroups.length) return survivingGroups.map((group) => ({
      kind: "alignment" as const, goldFactId: decision.goldFactId, candidateIndexes: group.candidateIds.map((id) => idToIndex.get(id)!), decision: "equivalent" as const, reason: decision.reason,
    }));
    if (decision.decision === "not_equivalent" || (post && decision.decision === "equivalent" && decision.supportGroups.length > 0)) return [{
      kind: "alignment" as const, goldFactId: decision.goldFactId, candidateIndexes: [], decision: "not_equivalent" as const, reason: post ? "No sufficient PRE support group survived grounding." : decision.reason,
    }];
    return [];
  });
}

function legacyCandidateDecisions(output: StagedSemanticJudgeOutput | null, idToIndex: Map<string, number>): SemanticJudgeDecision[] {
  return (output?.candidateDecisions ?? []).flatMap((decision): SemanticJudgeDecision[] => {
    const index = idToIndex.get(decision.candidateId);
    return index === undefined ? [] : [{ kind: "candidate" as const, goldFactId: null, candidateIndexes: [index], decision: decision.decision, reason: decision.reason }];
  });
}

function filterPostClassifications(base: CaseScore, pre: CaseScore, preIds: string[], postIds: string[]): CaseScore {
  const preIndex = new Map(preIds.map((id, index) => [id, index]));
  const candidateClassifications = postIds.map((id, candidateIndex) => {
    const classification = pre.candidateClassifications[preIndex.get(id)!];
    return { ...classification, candidateIndex };
  });
  const groundedExtraCandidateIndexes = candidateClassifications.filter((entry) => entry.state === "GROUNDED_EXTRA").map((entry) => entry.candidateIndex);
  const unsupportedCandidateIndexes = candidateClassifications.filter((entry) => entry.state === "UNSUPPORTED").map((entry) => entry.candidateIndex);
  const reviewCandidateIndexes = candidateClassifications.filter((entry) => entry.state === "REVIEW").map((entry) => entry.candidateIndex);
  const actual = candidateClassifications.filter((entry) => entry.state !== "SKIPPED").length;
  const deterministicCorrectCandidates = candidateClassifications.filter((entry) => (entry.state === "ALIGNED" || entry.state === "GROUNDED_EXTRA") && entry.basis === "deterministic").length;
  const semanticCorrectCandidates = candidateClassifications.filter((entry) => entry.state === "ALIGNED" || entry.state === "GROUNDED_EXTRA").length;
  const counts = {
    ...base.counts, actual,
    groundedExtra: groundedExtraCandidateIndexes.length,
    unsupported: unsupportedCandidateIndexes.length,
    candidateReview: reviewCandidateIndexes.length,
    deterministicCorrectCandidates,
    semanticCorrectCandidates,
  };
  return {
    ...base, candidateClassifications, groundedExtraCandidateIndexes, unsupportedCandidateIndexes, reviewCandidateIndexes, counts,
    metrics: {
      ...base.metrics,
      deterministicPrecision: actual ? deterministicCorrectCandidates / actual : 1,
      semanticPrecision: actual ? semanticCorrectCandidates / actual : 1,
      precision: actual ? deterministicCorrectCandidates / actual : 1,
      trueUnsupportedRate: actual ? counts.unsupported / actual : 0,
      unsupportedFactRate: actual ? counts.unsupported / actual : 0,
      groundedExtraRate: actual ? counts.groundedExtra / actual : 0,
    },
  };
}

export function validateStagedSemanticEvidence(evidence: StagedSemanticEvidence) {
  assertUnique(evidence.preCandidateIds, "semantic evidence PRE candidates");
  assertUnique(evidence.postCandidateIds, "semantic evidence POST candidates");
  assertUnique(evidence.goldFacts.map((fact) => fact.goldFactId), "semantic evidence gold facts");
  assertUnique(evidence.candidates.map((candidate) => candidate.candidateId), "semantic evidence candidate classifications");
  const pre = new Set(evidence.preCandidateIds);
  const post = new Set(evidence.postCandidateIds);
  for (const id of post) if (!pre.has(id)) throw new Error(`POST support candidate ${id} is absent from PRE evidence.`);
  for (const candidate of evidence.candidates) if (!pre.has(candidate.candidateId)) throw new Error(`Semantic candidate classification references unknown candidate ${candidate.candidateId}.`);
  for (const fact of evidence.goldFacts) {
    const rawSupportGroups = fact.rawSupportGroups ?? [];
    const rejectedSupportGroups = fact.rejectedSupportGroups ?? [];
    for (const group of rawSupportGroups) for (const id of group.candidateIds) if (!pre.has(id)) throw new Error(`Raw semantic support for ${fact.goldFactId} references unknown candidate ${id}.`);
    for (const group of rejectedSupportGroups) for (const id of group.candidateIds) if (!pre.has(id)) throw new Error(`Rejected semantic support for ${fact.goldFactId} references unknown candidate ${id}.`);
    for (const group of fact.supportGroups) {
      if (!group.candidateIds.length) throw new Error(`Semantic support for ${fact.goldFactId} contains an empty support group.`);
      assertUnique(group.candidateIds, `semantic support for ${fact.goldFactId}`);
      for (const id of group.candidateIds) if (!pre.has(id)) throw new Error(`Semantic support for ${fact.goldFactId} references unknown candidate ${id}.`);
    }
    const supportKeys = new Set(fact.supportGroups.map((group) => [...group.candidateIds].sort().join("\u0000")));
    for (const group of fact.postSupportGroups) for (const id of group.candidateIds) {
      if (!pre.has(id)) throw new Error(`POST support for ${fact.goldFactId} references candidate absent from PRE universe: ${id}.`);
      if (!post.has(id)) throw new Error(`POST support for ${fact.goldFactId} references candidate that did not survive grounding: ${id}.`);
    }
    for (const group of fact.postSupportGroups) if (!supportKeys.has([...group.candidateIds].sort().join("\u0000"))) throw new Error(`POST support for ${fact.goldFactId} was not admitted in PRE evidence.`);
    if (fact.rejectionCode === "inadmissible_semantic_support" && (fact.supportGroups.length > 0 || rawSupportGroups.length === 0 || rejectedSupportGroups.length === 0)) throw new Error(`Inadmissible-support state for ${fact.goldFactId} is inconsistent.`);
    if (fact.postCovered && !fact.preCovered) throw new Error(`POST-covered gold fact ${fact.goldFactId} is not PRE-covered.`);
    if (fact.postCovered && !fact.postSupportGroups.length) throw new Error(`POST-covered gold fact ${fact.goldFactId} has no surviving support group.`);
    if (!fact.postCovered && fact.postSupportGroups.length) throw new Error(`POST-uncovered gold fact ${fact.goldFactId} has a surviving support group.`);
    if (fact.groundingLoss !== (fact.preCovered && !fact.postCovered)) throw new Error(`Grounding-loss state for ${fact.goldFactId} is inconsistent with PRE/POST coverage.`);
  }
}

export function deriveStagedSemanticEvaluation(item: EvalCase, turns: PipelineTurnTrace[], output: StagedSemanticJudgeOutput | null) {
  const context = buildStagedJudgeContext(item, turns);
  const validatedOutput = output ? validateStagedJudgeOutput(output, context) : null;
  const preIds = context.preCandidates.map((candidate) => candidate.candidateId);
  const postIds = context.postCandidates.map((candidate) => candidate.candidateId);
  const preIndex = new Map(preIds.map((id, index) => [id, index]));
  const postIndex = new Map(postIds.map((id, index) => [id, index]));
  const preSet = new Set(preIds);
  const postSet = new Set(postIds);
  const allowedIndexesByFact = new Map(context.reviewAlignments.map((alignment) => [alignment.goldFact.id, alignment.candidates.map((candidate) => preIndex.get(candidate.candidateId)!)]));
  const rejectedGroupsByFact = new Map<string, SemanticGoldEvidence["rejectedSupportGroups"]>();
  const admissibleOutput = validatedOutput ? {
    ...validatedOutput,
    factDecisions: validatedOutput.factDecisions.map((decision) => {
      if (decision.decision !== "equivalent") return decision;
      const fact = item.expectedFacts.find((candidate) => candidate.id === decision.goldFactId)!;
      const admissibleGroups: SemanticSupportGroup[] = [];
      const rejectedGroups: SemanticGoldEvidence["rejectedSupportGroups"] = [];
      for (const group of decision.supportGroups) {
        const indexes = group.candidateIds.map((id) => preIndex.get(id)!);
        const validity = evaluateSemanticSupportGroup(item, fact, context.preCandidates.map(evaluated), indexes, allowedIndexesByFact.get(fact.id));
        if (validity.admissible) admissibleGroups.push(structuredClone(group));
        else rejectedGroups.push({ candidateIds: [...group.candidateIds], code: "inadmissible_semantic_support", reasons: validity.rejectionReasons });
      }
      rejectedGroupsByFact.set(decision.goldFactId, rejectedGroups);
      return { ...decision, supportGroups: admissibleGroups };
    }),
  } : null;
  const preDecisions = [...legacyFactDecisions(admissibleOutput, preIndex, preSet, false), ...legacyCandidateDecisions(admissibleOutput, preIndex)];
  const preScore = scoreCase(item, context.preCandidates.map(evaluated), preDecisions);
  const postDecisions = [...legacyFactDecisions(admissibleOutput, postIndex, postSet, true), ...legacyCandidateDecisions(admissibleOutput, postIndex)];
  const postBase = scoreCase(item, context.postCandidates.map(evaluated), postDecisions);
  const postScore = filterPostClassifications(postBase, preScore, preIds, postIds);
  const rawOutputByFact = new Map((validatedOutput?.factDecisions ?? []).map((decision) => [decision.goldFactId, decision]));
  const admissibleOutputByFact = new Map((admissibleOutput?.factDecisions ?? []).map((decision) => [decision.goldFactId, decision]));
  const verdictById = new Map(turns.flatMap((turn) => turn.groundingVerdicts).map((verdict) => [verdict.candidateId, verdict]));
  const goldFacts: SemanticGoldEvidence[] = item.expectedFacts.map((fact) => {
    const preMatch = preScore.matches.find((match) => match.goldFactId === fact.id)!;
    const postMatch = postScore.matches.find((match) => match.goldFactId === fact.id)!;
    const judged = rawOutputByFact.get(fact.id);
    const admissible = admissibleOutputByFact.get(fact.id);
    const rawSupportGroups = judged?.decision === "equivalent" ? structuredClone(judged.supportGroups) : [];
    const supportGroups = preMatch.state === "EXACT"
      ? preMatch.candidateIndexes.map((index) => ({ candidateIds: [preIds[index]] }))
      : admissible?.decision === "equivalent" ? structuredClone(admissible.supportGroups) : [];
    const rejectedSupportGroups = rejectedGroupsByFact.get(fact.id) ?? [];
    const postSupportGroups = supportGroups.filter((group) => group.candidateIds.every((id) => postSet.has(id)));
    const preCovered = preMatch.state === "EXACT" || preMatch.state === "SEMANTIC_EQUIVALENT";
    const postCovered = postMatch.state === "EXACT" || postMatch.state === "SEMANTIC_EQUIVALENT";
    const groundingLoss = preCovered && !postCovered;
    const removedCandidateIds = groundingLoss ? [...new Set(supportGroups.flatMap((group) => group.candidateIds.filter((id) => !postSet.has(id))))] : [];
    return {
      goldFactId: fact.id,
      decision: preMatch.state === "EXACT" ? "exact" : judged?.decision ?? "missing",
      reason: preMatch.state === "EXACT" ? preMatch.reason : judged?.reason ?? preMatch.reason,
      rawSupportGroups,
      supportGroups,
      rejectedSupportGroups,
      rejectionCode: judged?.decision === "equivalent" && rawSupportGroups.length > 0 && supportGroups.length === 0 ? "inadmissible_semantic_support" : null,
      postSupportGroups,
      preCovered,
      postCovered,
      groundingLoss,
      removedCandidateIds,
      groundingVerdicts: removedCandidateIds.flatMap((id) => verdictById.has(id) ? [verdictById.get(id)!] : []),
    };
  });
  const evidence: StagedSemanticEvidence = {
    preCandidateIds: preIds,
    postCandidateIds: postIds,
    goldFacts,
    candidates: preIds.map((candidateId, index) => ({ candidateId, survivedGrounding: postSet.has(candidateId), classification: preScore.candidateClassifications[index] })),
  };
  validateStagedSemanticEvidence(evidence);
  return { context, preScore, postScore, preDecisions, postDecisions, evidence };
}

export function replayStagedSemanticEvaluationFromEvidence(
  item: EvalCase,
  turns: PipelineTurnTrace[],
  savedPreScore: CaseScore,
  savedEvidence: StagedSemanticEvidence,
) {
  validateStagedSemanticEvidence(savedEvidence);
  const context = buildStagedJudgeContext(item, turns);
  const preIds = context.preCandidates.map((candidate) => candidate.candidateId);
  if (JSON.stringify(preIds) !== JSON.stringify(savedEvidence.preCandidateIds)) {
    throw new Error("Grounding replay PRE candidate identities/order differ from saved semantic evidence.");
  }
  if (savedPreScore.candidateClassifications.length !== preIds.length || savedEvidence.candidates.length !== preIds.length) {
    throw new Error("Grounding replay saved PRE scoring does not cover the complete candidate universe.");
  }
  for (const [index, candidateId] of preIds.entries()) {
    const evidenceCandidate = savedEvidence.candidates[index];
    if (evidenceCandidate.candidateId !== candidateId || JSON.stringify(evidenceCandidate.classification) !== JSON.stringify(savedPreScore.candidateClassifications[index])) {
      throw new Error(`Grounding replay saved semantic classification mismatch for ${candidateId}.`);
    }
  }
  const postIds = context.postCandidates.map((candidate) => candidate.candidateId);
  const postSet = new Set(postIds);
  const postIndex = new Map(postIds.map((id, index) => [id, index]));
  const postDecisions: SemanticJudgeDecision[] = savedEvidence.goldFacts.flatMap((fact): SemanticJudgeDecision[] => {
    if (fact.decision === "not_equivalent") return [{
      kind: "alignment",
      goldFactId: fact.goldFactId,
      candidateIndexes: [],
      decision: "not_equivalent",
      reason: fact.reason,
    }];
    if (fact.decision !== "equivalent" || fact.supportGroups.length === 0) return [];
    const surviving = fact.supportGroups.filter((group) => group.candidateIds.every((id) => postSet.has(id)));
    if (surviving.length) return surviving.map((group) => ({
      kind: "alignment",
      goldFactId: fact.goldFactId,
      candidateIndexes: group.candidateIds.map((id) => postIndex.get(id)!),
      decision: "equivalent",
      reason: fact.reason,
    }));
    return [{
      kind: "alignment",
      goldFactId: fact.goldFactId,
      candidateIndexes: [],
      decision: "not_equivalent",
      reason: "No sufficient saved PRE support group survived replay grounding.",
    }];
  });
  const postBase = scoreCase(item, context.postCandidates.map(evaluated), postDecisions);
  const postScore = filterPostClassifications(postBase, savedPreScore, preIds, postIds);
  const verdictById = new Map(turns.flatMap((turn) => turn.groundingVerdicts).map((verdict) => [verdict.candidateId, verdict]));
  const scoreByFact = new Map(postScore.matches.map((match) => [match.goldFactId, match]));
  const goldFacts: SemanticGoldEvidence[] = savedEvidence.goldFacts.map((fact) => {
    const postSupportGroups = fact.supportGroups.filter((group) => group.candidateIds.every((id) => postSet.has(id)));
    const postMatch = scoreByFact.get(fact.goldFactId);
    const postCovered = postMatch?.state === "EXACT" || postMatch?.state === "SEMANTIC_EQUIVALENT";
    const groundingLoss = fact.preCovered && !postCovered;
    const removedCandidateIds = groundingLoss
      ? [...new Set(fact.supportGroups.flatMap((group) => group.candidateIds.filter((id) => !postSet.has(id))))]
      : [];
    return {
      ...structuredClone(fact),
      postSupportGroups,
      postCovered,
      groundingLoss,
      removedCandidateIds,
      groundingVerdicts: removedCandidateIds.flatMap((id) => verdictById.has(id) ? [verdictById.get(id)!] : []),
    };
  });
  const evidence: StagedSemanticEvidence = {
    preCandidateIds: [...preIds],
    postCandidateIds: [...postIds],
    goldFacts,
    candidates: savedEvidence.candidates.map((candidate) => ({
      ...structuredClone(candidate),
      survivedGrounding: postSet.has(candidate.candidateId),
    })),
  };
  validateStagedSemanticEvidence(evidence);
  return { context, preScore: structuredClone(savedPreScore), postScore, postDecisions, evidence };
}
