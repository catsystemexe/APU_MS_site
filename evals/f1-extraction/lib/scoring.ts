import type { ExtractionCandidate } from "../../../app/f1-extraction-contract.ts";
import type { EvalCase, GoldFact, MatchState } from "./eval-contract.ts";

export type EvaluatedCandidate = ExtractionCandidate & { inputIndex: number };
export type SemanticJudgeDecision = {
  kind: "alignment" | "candidate";
  goldFactId: string | null;
  candidateIndexes: number[];
  decision: "equivalent" | "not_equivalent" | "grounded_extra" | "unsupported" | "uncertain";
  reason: string;
};
export type MatchResult = {
  goldFactId: string;
  candidateIndex: number | null;
  candidateIndexes: number[];
  state: MatchState;
  reason: string;
  categoryCorrect: boolean | null;
  uncertaintyPreserved: boolean | null;
  negationPreserved: boolean | null;
};
export type CandidateClassification = {
  candidateIndex: number;
  state: "ALIGNED" | "GROUNDED_EXTRA" | "UNSUPPORTED" | "REVIEW" | "SKIPPED";
  basis: "deterministic" | "semantic";
  reason: string;
};

export type SemanticSupportRejectionReason =
  | "empty_support_group"
  | "duplicate_candidate_index"
  | "unknown_candidate"
  | "candidate_not_in_alignment"
  | "input_mismatch"
  | "invalid_source_quote"
  | "forbidden_inference"
  | "category_mismatch"
  | "action_mismatch"
  | "related_entry_mismatch"
  | "required_marker_missing";

export type SemanticSupportAdmissibility = {
  admissible: boolean;
  candidateIndexes: number[];
  rejectionReasons: SemanticSupportRejectionReason[];
};

export type CaseScore = {
  caseId: string;
  matches: MatchResult[];
  candidateClassifications: CandidateClassification[];
  groundedExtraCandidateIndexes: number[];
  unsupportedCandidateIndexes: number[];
  reviewCandidateIndexes: number[];
  forbiddenInferenceHits: Array<{ candidateIndex: number; forbiddenText: string }>;
  counts: {
    gold: number;
    actual: number;
    exact: number;
    semanticEquivalent: number;
    deterministicCovered: number;
    semanticCovered: number;
    miss: number;
    review: number;
    autoPass: number;
    autoFail: number;
    groundedExtra: number;
    unsupported: number;
    candidateReview: number;
    sourceCandidates: number;
    invalidSourceQuote: number;
    correctCategory: number;
    categoryComparable: number;
    uncertaintyRequired: number;
    uncertaintyPreserved: number;
    negationRequired: number;
    negationPreserved: number;
    actionRequired: number;
    actionCorrect: number;
    deterministicCorrectCandidates: number;
    semanticCorrectCandidates: number;
  };
  metrics: {
    deterministicRecall: number;
    semanticRecall: number;
    deterministicPrecision: number;
    semanticPrecision: number;
    trueUnsupportedRate: number;
    groundedExtraRate: number;
    missRate: number;
    explicitFactRecall: number;
    precision: number;
    categoryAccuracy: number;
    unsupportedFactRate: number;
    sourceQuoteValidity: number;
    uncertaintyPreservation: number;
    negationPreservation: number;
    duplicateConflictCorrectness: number;
  };
};

function normalize(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("cs-CZ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function tokens(value: string) {
  return new Set(normalize(value).split(/\s+/).filter((token) => token.length > 1));
}

function overlap(a: string, b: string) {
  const left = tokens(a); const right = tokens(b);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / Math.max(left.size, right.size);
}

function evidenceSimilarity(fact: GoldFact, candidate: EvaluatedCandidate) {
  const goldText = normalize(fact.text);
  const goldQuote = normalize(fact.source.quote);
  const actualText = normalize(candidate.notebookText);
  if (goldText === actualText || goldQuote === actualText) return 1;
  return Math.max(overlap(fact.text, candidate.notebookText), overlap(fact.source.quote, candidate.notebookText));
}

function exactMatch(fact: GoldFact, candidate: EvaluatedCandidate) {
  const exactText = normalize(fact.text) === normalize(candidate.notebookText) || normalize(fact.source.quote) === normalize(candidate.notebookText);
  const exactQuote = normalize(fact.source.quote) === normalize(candidate.sourceQuote);
  return exactText && exactQuote && candidate.category === fact.category && candidate.action === fact.expectedAction && candidate.relatedEntryId === fact.relatedEntryId;
}

function markersPreserved(fact: GoldFact, indexes: number[], candidates: EvaluatedCandidate[]) {
  if (!fact.requiredMarkers.length) return true;
  const actual = normalize(indexes.map((index) => candidates[index]?.notebookText ?? "").join(" "));
  return fact.requiredMarkers.every((marker) => actual.includes(normalize(marker)));
}

function rate(numerator: number, denominator: number) {
  return denominator ? numerator / denominator : 1;
}

function incidenceRate(numerator: number, denominator: number) {
  return denominator ? numerator / denominator : 0;
}

function isSourceValid(item: EvalCase, candidate: EvaluatedCandidate) {
  return candidate.sourceQuote.length > 0 && (item.inputs[candidate.inputIndex]?.includes(candidate.sourceQuote) ?? false);
}

function isDeterministicallyGrounded(candidate: EvaluatedCandidate) {
  const quote = normalize(candidate.sourceQuote);
  const text = normalize(candidate.notebookText);
  if (!quote || !text) return false;
  if (quote === text || quote.includes(text)) return true;
  const quoteTokens = tokens(candidate.sourceQuote);
  const textTokens = tokens(candidate.notebookText);
  return textTokens.size > 0 && [...textTokens].every((token) => quoteTokens.has(token));
}

export function evaluateSemanticSupportGroup(
  item: EvalCase,
  fact: GoldFact,
  candidates: EvaluatedCandidate[],
  candidateIndexes: number[],
  allowedCandidateIndexes?: Iterable<number>,
): SemanticSupportAdmissibility {
  const rejectionReasons = new Set<SemanticSupportRejectionReason>();
  const uniqueIndexes = [...new Set(candidateIndexes)];
  const allowed = allowedCandidateIndexes ? new Set(allowedCandidateIndexes) : null;
  if (!candidateIndexes.length) rejectionReasons.add("empty_support_group");
  if (uniqueIndexes.length !== candidateIndexes.length) rejectionReasons.add("duplicate_candidate_index");
  const groupCandidates = uniqueIndexes.flatMap((index) => {
    if (!Number.isInteger(index) || !candidates[index]) {
      rejectionReasons.add("unknown_candidate");
      return [];
    }
    if (allowed && !allowed.has(index)) rejectionReasons.add("candidate_not_in_alignment");
    return [{ index, candidate: candidates[index] }];
  });
  for (const { candidate } of groupCandidates) {
    if (candidate.inputIndex !== fact.source.inputIndex) rejectionReasons.add("input_mismatch");
    if (!isSourceValid(item, candidate)) rejectionReasons.add("invalid_source_quote");
    if (item.forbiddenInferences.some((forbidden) => (forbidden.category === null || forbidden.category === candidate.category) && normalize(candidate.notebookText).includes(normalize(forbidden.text)))) rejectionReasons.add("forbidden_inference");
    if (candidate.category !== fact.category) rejectionReasons.add("category_mismatch");
    if (candidate.action !== fact.expectedAction) rejectionReasons.add("action_mismatch");
    if (candidate.relatedEntryId !== fact.relatedEntryId) rejectionReasons.add("related_entry_mismatch");
  }
  if (groupCandidates.length === uniqueIndexes.length && !markersPreserved(fact, uniqueIndexes, candidates)) rejectionReasons.add("required_marker_missing");
  return { admissible: rejectionReasons.size === 0, candidateIndexes: uniqueIndexes, rejectionReasons: [...rejectionReasons] };
}

export function scoreCase(item: EvalCase, candidates: EvaluatedCandidate[], semanticDecisions: SemanticJudgeDecision[] = []): CaseScore {
  const eligibleEntries = candidates.map((candidate, index) => ({ candidate, index })).filter(({ candidate }) => candidate.action !== "skip");
  const sourceValidity = candidates.map((candidate) => isSourceValid(item, candidate));
  const forbiddenInferenceHits = candidates.flatMap((candidate, candidateIndex) => item.forbiddenInferences
    .filter((forbidden) => (forbidden.category === null || forbidden.category === candidate.category) && normalize(candidate.notebookText).includes(normalize(forbidden.text)))
    .map((forbidden) => ({ candidateIndex, forbiddenText: forbidden.text })));
  const forbiddenIndexes = new Set(forbiddenInferenceHits.map((hit) => hit.candidateIndex));
  const matches: MatchResult[] = [];

  for (const fact of item.expectedFacts) {
    const ranked = eligibleEntries
      .filter(({ candidate }) => candidate.inputIndex === fact.source.inputIndex)
      .map(({ candidate, index }) => ({ candidate, index, similarity: evidenceSimilarity(fact, candidate) }))
      .filter(({ similarity }) => similarity >= 0.35)
      .sort((a, b) => b.similarity - a.similarity || Number(b.candidate.category === fact.category) - Number(a.candidate.category === fact.category));
    const exact = ranked.filter(({ candidate }) => exactMatch(fact, candidate));
    let candidateIndexes = (exact.length ? exact : ranked).map(({ index }) => index);
    let state: MatchState = exact.length ? "EXACT" : candidateIndexes.length ? "REVIEW" : "MISS";
    let reason = exact.length ? "Exact deterministic fact/category/action match" : candidateIndexes.length ? "Plausible grouped alignment requires semantic review" : "No sufficiently similar candidate";

    if (state === "REVIEW") {
      const decisions = semanticDecisions.filter((decision) => decision.kind === "alignment" && decision.goldFactId === fact.id);
      const equivalentGroups = decisions.filter((decision) => decision.decision === "equivalent").map((decision) => {
        const support = evaluateSemanticSupportGroup(item, fact, candidates, decision.candidateIndexes, candidateIndexes);
        return support.admissible ? { indexes: support.candidateIndexes, reason: decision.reason } : null;
      }).filter((group): group is { indexes: number[]; reason: string } => group !== null);
      if (equivalentGroups.length) {
        candidateIndexes = [...new Set(equivalentGroups.flatMap((group) => group.indexes))];
        state = "SEMANTIC_EQUIVALENT";
        reason = equivalentGroups.map((group) => group.reason).join(" | ");
      }
      if (state === "REVIEW" && decisions.some((decision) => decision.decision === "not_equivalent")) {
        state = "MISS";
        reason = decisions.find((decision) => decision.decision === "not_equivalent")!.reason;
      }
    }

    const categoryCorrect = candidateIndexes.length ? candidateIndexes.every((index) => candidates[index].category === fact.category) : null;
    const markerStatus = candidateIndexes.length ? markersPreserved(fact, candidateIndexes, candidates) : false;
    matches.push({
      goldFactId: fact.id,
      candidateIndex: candidateIndexes[0] ?? null,
      candidateIndexes,
      state,
      reason,
      categoryCorrect,
      uncertaintyPreserved: fact.uncertain ? markerStatus : null,
      negationPreserved: fact.negated ? markerStatus : null,
    });
  }

  const deterministicAlignedIndexes = new Set(matches.filter((match) => match.state === "EXACT").flatMap((match) => match.candidateIndexes));
  const semanticAlignedIndexes = new Set(matches.filter((match) => match.state === "EXACT" || match.state === "SEMANTIC_EQUIVALENT").flatMap((match) => match.candidateIndexes));
  const reviewIndexes = new Set(matches.filter((match) => match.state === "REVIEW").flatMap((match) => match.candidateIndexes));
  const candidateDecisions = semanticDecisions.filter((decision) => decision.kind === "candidate" && decision.goldFactId === null && decision.candidateIndexes.length === 1);
  const candidateClassifications: CandidateClassification[] = candidates.map((candidate, candidateIndex) => {
    if (candidate.action === "skip") return { candidateIndex, state: "SKIPPED", basis: "deterministic", reason: "Candidate action is skip" };
    if (!sourceValidity[candidateIndex]) return { candidateIndex, state: "UNSUPPORTED", basis: "deterministic", reason: "sourceQuote is not an exact input substring" };
    if (forbiddenIndexes.has(candidateIndex)) return { candidateIndex, state: "UNSUPPORTED", basis: "deterministic", reason: "Forbidden inference matched" };
    if (semanticAlignedIndexes.has(candidateIndex)) return {
      candidateIndex, state: "ALIGNED", basis: deterministicAlignedIndexes.has(candidateIndex) ? "deterministic" : "semantic",
      reason: deterministicAlignedIndexes.has(candidateIndex) ? "Participates in an exact alignment" : "Participates in a judged semantic alignment",
    };
    const judged = candidateDecisions.find((decision) => decision.candidateIndexes[0] === candidateIndex);
    if (judged?.decision === "unsupported") return { candidateIndex, state: "UNSUPPORTED", basis: "semantic", reason: judged.reason };
    if (judged?.decision === "grounded_extra") return { candidateIndex, state: "GROUNDED_EXTRA", basis: "semantic", reason: judged.reason };
    if (reviewIndexes.has(candidateIndex) || judged?.decision === "uncertain") return { candidateIndex, state: "REVIEW", basis: judged ? "semantic" : "deterministic", reason: judged?.reason ?? "Candidate participates in an unresolved alignment" };
    if (isDeterministicallyGrounded(candidate)) return { candidateIndex, state: "GROUNDED_EXTRA", basis: "deterministic", reason: "Candidate meaning is contained in its valid sourceQuote" };
    if (overlap(candidate.sourceQuote, candidate.notebookText) < 0.2) return { candidateIndex, state: "UNSUPPORTED", basis: "deterministic", reason: "Candidate text has no material support in its sourceQuote" };
    return { candidateIndex, state: "REVIEW", basis: "deterministic", reason: "Grounding is plausible but not deterministically provable" };
  });

  const groundedExtraCandidateIndexes = candidateClassifications.filter((entry) => entry.state === "GROUNDED_EXTRA").map((entry) => entry.candidateIndex);
  const unsupportedCandidateIndexes = candidateClassifications.filter((entry) => entry.state === "UNSUPPORTED").map((entry) => entry.candidateIndex);
  const reviewCandidateIndexes = candidateClassifications.filter((entry) => entry.state === "REVIEW").map((entry) => entry.candidateIndex);
  const actionRequiredFacts = item.expectedFacts.filter((fact) => fact.expectedAction === "duplicate" || fact.expectedAction === "conflict");
  const coveredMatches = matches.filter((match) => match.state === "EXACT" || match.state === "SEMANTIC_EQUIVALENT");
  const actionMatches = coveredMatches.filter((match) => {
    const fact = item.expectedFacts.find((entry) => entry.id === match.goldFactId)!;
    return (fact.expectedAction === "duplicate" || fact.expectedAction === "conflict")
      && match.candidateIndexes.length > 0
      && match.candidateIndexes.every((index) => candidates[index].action === fact.expectedAction && candidates[index].relatedEntryId === fact.relatedEntryId);
  }).length;
  const deterministicCorrectIndexes = new Set([
    ...deterministicAlignedIndexes,
    ...candidateClassifications.filter((entry) => entry.state === "GROUNDED_EXTRA" && entry.basis === "deterministic").map((entry) => entry.candidateIndex),
  ]);
  const semanticCorrectIndexes = new Set([...semanticAlignedIndexes, ...groundedExtraCandidateIndexes]);
  const counts = {
    gold: item.expectedFacts.length,
    actual: eligibleEntries.length,
    exact: matches.filter((match) => match.state === "EXACT").length,
    semanticEquivalent: matches.filter((match) => match.state === "SEMANTIC_EQUIVALENT").length,
    deterministicCovered: matches.filter((match) => match.state === "EXACT").length,
    semanticCovered: coveredMatches.length,
    miss: matches.filter((match) => match.state === "MISS").length,
    review: matches.filter((match) => match.state === "REVIEW").length,
    autoPass: matches.filter((match) => match.state === "EXACT").length,
    autoFail: matches.filter((match) => match.state === "MISS").length,
    groundedExtra: groundedExtraCandidateIndexes.length,
    unsupported: unsupportedCandidateIndexes.length,
    candidateReview: reviewCandidateIndexes.length,
    sourceCandidates: candidates.length,
    invalidSourceQuote: sourceValidity.filter((valid) => !valid).length,
    correctCategory: matches.filter((match) => match.categoryCorrect === true).length,
    categoryComparable: matches.filter((match) => match.categoryCorrect !== null).length,
    uncertaintyRequired: item.expectedFacts.filter((fact) => fact.uncertain).length,
    uncertaintyPreserved: coveredMatches.filter((match) => match.uncertaintyPreserved === true).length,
    negationRequired: item.expectedFacts.filter((fact) => fact.negated).length,
    negationPreserved: coveredMatches.filter((match) => match.negationPreserved === true).length,
    actionRequired: actionRequiredFacts.length,
    actionCorrect: actionMatches,
    deterministicCorrectCandidates: deterministicCorrectIndexes.size,
    semanticCorrectCandidates: semanticCorrectIndexes.size,
  };
  const deterministicRecall = rate(counts.deterministicCovered, counts.gold);
  const semanticRecall = rate(counts.semanticCovered, counts.gold);
  const deterministicPrecision = rate(counts.deterministicCorrectCandidates, counts.actual);
  const semanticPrecision = rate(counts.semanticCorrectCandidates, counts.actual);
  const trueUnsupportedRate = incidenceRate(counts.unsupported, counts.actual);
  return {
    caseId: item.id, matches, candidateClassifications, groundedExtraCandidateIndexes, unsupportedCandidateIndexes, reviewCandidateIndexes, forbiddenInferenceHits, counts,
    metrics: {
      deterministicRecall, semanticRecall, deterministicPrecision, semanticPrecision, trueUnsupportedRate,
      groundedExtraRate: incidenceRate(counts.groundedExtra, counts.actual),
      missRate: incidenceRate(counts.miss, counts.gold),
      explicitFactRecall: deterministicRecall,
      precision: deterministicPrecision,
      categoryAccuracy: rate(counts.correctCategory, counts.categoryComparable),
      unsupportedFactRate: trueUnsupportedRate,
      sourceQuoteValidity: rate(counts.sourceCandidates - counts.invalidSourceQuote, counts.sourceCandidates),
      uncertaintyPreservation: rate(counts.uncertaintyPreserved, counts.uncertaintyRequired),
      negationPreservation: rate(counts.negationPreserved, counts.negationRequired),
      duplicateConflictCorrectness: rate(counts.actionCorrect, counts.actionRequired),
    },
  };
}

export type RunScore = CaseScore & {
  profile: string;
  pipeline: string;
  repetition: number;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number | null;
  candidates: EvaluatedCandidate[];
  suite?: string;
  factCount?: number;
  categoryCount?: number;
  linguistic?: string[];
  semanticJudgeDecisions?: SemanticJudgeDecision[];
};

export function candidateKey(candidate: EvaluatedCandidate) {
  return `${candidate.inputIndex}\u0000${candidate.category}\u0000${candidate.action}\u0000${normalize(candidate.notebookText)}`;
}

export function stability(runs: RunScore[]) {
  if (runs.length < 2) return 1;
  let total = 0; let pairs = 0;
  for (let left = 0; left < runs.length; left += 1) for (let right = left + 1; right < runs.length; right += 1) {
    const a = new Set(runs[left].candidates.map(candidateKey));
    const b = new Set(runs[right].candidates.map(candidateKey));
    const union = new Set([...a, ...b]);
    const intersection = [...a].filter((key) => b.has(key)).length;
    total += union.size ? intersection / union.size : 1; pairs += 1;
  }
  return pairs ? total / pairs : 1;
}

export function aggregateScores(runs: RunScore[]) {
  const groups = new Map<string, RunScore[]>();
  for (const run of runs) {
    const key = `${run.profile}\u0000${run.pipeline}`;
    groups.set(key, [...(groups.get(key) ?? []), run]);
  }
  return [...groups.entries()].map(([key, group]) => {
    const [profile, pipeline] = key.split("\u0000");
    const sum = (selector: (run: RunScore) => number) => group.reduce((total, run) => total + selector(run), 0);
    const costs = group.map((run) => run.estimatedCostUsd).filter((value): value is number => value !== null);
    const stabilityGroups = new Map<string, RunScore[]>();
    for (const run of group) stabilityGroups.set(run.caseId, [...(stabilityGroups.get(run.caseId) ?? []), run]);
    const deterministicRecall = sum((run) => run.counts.deterministicCovered) / Math.max(1, sum((run) => run.counts.gold));
    const semanticRecall = sum((run) => run.counts.semanticCovered) / Math.max(1, sum((run) => run.counts.gold));
    const deterministicPrecision = sum((run) => run.counts.deterministicCorrectCandidates) / Math.max(1, sum((run) => run.counts.actual));
    const semanticPrecision = sum((run) => run.counts.semanticCorrectCandidates) / Math.max(1, sum((run) => run.counts.actual));
    const trueUnsupportedRate = sum((run) => run.counts.unsupported) / Math.max(1, sum((run) => run.counts.actual));
    return {
      profile, pipeline, cases: new Set(group.map((run) => run.caseId)).size, runs: group.length,
      deterministicRecall, semanticRecall, deterministicPrecision, semanticPrecision,
      explicitFactRecall: deterministicRecall, precision: deterministicPrecision,
      groundedExtraCount: sum((run) => run.counts.groundedExtra),
      groundedExtraRate: sum((run) => run.counts.groundedExtra) / Math.max(1, sum((run) => run.counts.actual)),
      unsupportedCount: sum((run) => run.counts.unsupported),
      trueUnsupportedRate, unsupportedFactRate: trueUnsupportedRate,
      missCount: sum((run) => run.counts.miss),
      missRate: sum((run) => run.counts.miss) / Math.max(1, sum((run) => run.counts.gold)),
      reviewCount: sum((run) => run.counts.review), candidateReviewCount: sum((run) => run.counts.candidateReview),
      categoryAccuracy: sum((run) => run.counts.correctCategory) / Math.max(1, sum((run) => run.counts.categoryComparable)),
      sourceQuoteValidity: (sum((run) => run.counts.sourceCandidates) - sum((run) => run.counts.invalidSourceQuote)) / Math.max(1, sum((run) => run.counts.sourceCandidates)),
      uncertaintyPreservation: sum((run) => run.counts.uncertaintyPreserved) / Math.max(1, sum((run) => run.counts.uncertaintyRequired)),
      negationPreservation: sum((run) => run.counts.negationPreserved) / Math.max(1, sum((run) => run.counts.negationRequired)),
      duplicateConflictCorrectness: sum((run) => run.counts.actionRequired) ? sum((run) => run.counts.actionCorrect) / sum((run) => run.counts.actionRequired) : 1,
      stability: [...stabilityGroups.values()].reduce((total, caseRuns) => total + stability(caseRuns), 0) / Math.max(1, stabilityGroups.size),
      averageLatencyMs: sum((run) => run.latencyMs) / Math.max(1, group.length),
      inputTokens: sum((run) => run.inputTokens), outputTokens: sum((run) => run.outputTokens),
      estimatedCostUsd: costs.length === group.length ? costs.reduce((total, value) => total + value, 0) : null,
    };
  });
}

export function aggregateDimensionScores(runs: RunScore[]) {
  const rows: Array<Record<string, string | number>> = [];
  const dimensions = [
    { name: "suite", values: (run: RunScore) => run.suite ? [run.suite] : [] },
    { name: "factCount", values: (run: RunScore) => run.factCount === undefined ? [] : [String(run.factCount)] },
    { name: "categoryCount", values: (run: RunScore) => run.categoryCount === undefined ? [] : [String(run.categoryCount)] },
    { name: "linguistic", values: (run: RunScore) => run.linguistic ?? [] },
  ];
  for (const dimension of dimensions) {
    const groups = new Map<string, RunScore[]>();
    for (const run of runs) for (const value of dimension.values(run)) {
      const key = `${run.profile}\u0000${run.pipeline}\u0000${value}`;
      groups.set(key, [...(groups.get(key) ?? []), run]);
    }
    for (const [key, group] of groups) {
      const [profile, pipeline, value] = key.split("\u0000");
      const sum = (selector: (run: RunScore) => number) => group.reduce((total, run) => total + selector(run), 0);
      const gold = sum((run) => run.counts.gold);
      const actual = sum((run) => run.counts.actual);
      const deterministicCovered = sum((run) => run.counts.deterministicCovered);
      const semanticCovered = sum((run) => run.counts.semanticCovered);
      const groundedExtra = sum((run) => run.counts.groundedExtra);
      const unsupported = sum((run) => run.counts.unsupported);
      rows.push({
        profile, pipeline, dimension: dimension.name, value, gold, actual, deterministicCovered, semanticCovered, groundedExtra, unsupported,
        deterministicRecall: deterministicCovered / Math.max(1, gold), semanticRecall: semanticCovered / Math.max(1, gold),
        deterministicPrecision: sum((run) => run.counts.deterministicCorrectCandidates) / Math.max(1, actual),
        semanticPrecision: sum((run) => run.counts.semanticCorrectCandidates) / Math.max(1, actual),
        groundedExtraRate: groundedExtra / Math.max(1, actual), trueUnsupportedRate: unsupported / Math.max(1, actual),
      });
    }
  }
  return rows.sort((a, b) => String(a.profile).localeCompare(String(b.profile)) || String(a.pipeline).localeCompare(String(b.pipeline)) || String(a.dimension).localeCompare(String(b.dimension)) || Number(a.value) - Number(b.value) || String(a.value).localeCompare(String(b.value)));
}
