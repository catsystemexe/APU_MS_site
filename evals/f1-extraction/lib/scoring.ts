import type { ExtractionCandidate } from "../../../app/f1-extraction-contract.ts";
import type { EvalCase, GoldFact, MatchState } from "./eval-contract.ts";

export type EvaluatedCandidate = ExtractionCandidate & { inputIndex: number };
export type MatchResult = {
  goldFactId: string;
  candidateIndex: number | null;
  state: MatchState;
  reason: string;
  categoryCorrect: boolean | null;
  uncertaintyPreserved: boolean | null;
  negationPreserved: boolean | null;
};

export type CaseScore = {
  caseId: string;
  matches: MatchResult[];
  unsupportedCandidateIndexes: number[];
  forbiddenInferenceHits: Array<{ candidateIndex: number; forbiddenText: string }>;
  counts: {
    gold: number;
    actual: number;
    autoPass: number;
    autoFail: number;
    review: number;
    unsupported: number;
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
  };
  metrics: {
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
  const actualQuote = normalize(candidate.sourceQuote);
  if (goldText === actualText || goldQuote === actualQuote || goldQuote === actualText || goldText === actualQuote) return 1;
  return Math.max(overlap(fact.text, candidate.notebookText), overlap(fact.source.quote, candidate.sourceQuote), overlap(fact.source.quote, candidate.notebookText));
}

function markerPreserved(fact: GoldFact, candidate: EvaluatedCandidate) {
  if (!fact.requiredMarkers.length) return true;
  const actual = normalize(`${candidate.sourceQuote} ${candidate.notebookText}`);
  return fact.requiredMarkers.every((marker) => actual.includes(normalize(marker)));
}

function rate(numerator: number, denominator: number) {
  return denominator ? numerator / denominator : 1;
}

export function scoreCase(item: EvalCase, candidates: EvaluatedCandidate[]): CaseScore {
  const eligible = candidates.filter((candidate) => candidate.action !== "skip");
  const used = new Set<number>();
  const matches: MatchResult[] = [];
  for (const fact of item.expectedFacts) {
    const ranked = eligible
      .map((candidate) => ({ candidate, index: candidates.indexOf(candidate), similarity: evidenceSimilarity(fact, candidate) }))
      .filter(({ candidate, index }) => candidate.inputIndex === fact.source.inputIndex && !used.has(index))
      .sort((a, b) => {
        const aCategory = a.candidate.category === fact.category ? 1 : 0;
        const bCategory = b.candidate.category === fact.category ? 1 : 0;
        return b.similarity - a.similarity || bCategory - aCategory;
      });
    const best = ranked[0];
    if (!best || best.similarity < 0.45) {
      matches.push({ goldFactId: fact.id, candidateIndex: null, state: "AUTO_FAIL", reason: "No sufficiently similar candidate", categoryCorrect: null, uncertaintyPreserved: null, negationPreserved: null });
      continue;
    }
    used.add(best.index);
    const categoryCorrect = best.candidate.category === fact.category;
    const actionCorrect = best.candidate.action === fact.expectedAction && best.candidate.relatedEntryId === fact.relatedEntryId;
    const markers = markerPreserved(fact, best.candidate);
    const exactText = normalize(fact.text) === normalize(best.candidate.notebookText) || normalize(fact.source.quote) === normalize(best.candidate.notebookText);
    const exactQuote = normalize(fact.source.quote) === normalize(best.candidate.sourceQuote);
    const exact = exactText && exactQuote && categoryCorrect && actionCorrect;
    matches.push({
      goldFactId: fact.id,
      candidateIndex: best.index,
      state: exact ? "AUTO_PASS" : "REVIEW",
      reason: exact ? "Exact deterministic fact/category/action match" : `Semantic similarity ${best.similarity.toFixed(2)} requires review`,
      categoryCorrect,
      uncertaintyPreserved: fact.uncertain ? markers : null,
      negationPreserved: fact.negated ? markers : null,
    });
  }
  const unsupportedCandidateIndexes = candidates.map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate, index }) => candidate.action !== "skip" && !used.has(index))
    .map(({ index }) => index);
  const forbiddenInferenceHits = candidates.flatMap((candidate, candidateIndex) => item.forbiddenInferences
    .filter((forbidden) => (forbidden.category === null || forbidden.category === candidate.category) && normalize(candidate.notebookText).includes(normalize(forbidden.text)))
    .map((forbidden) => ({ candidateIndex, forbiddenText: forbidden.text })));
  const unsupportedIndexes = new Set([...unsupportedCandidateIndexes, ...forbiddenInferenceHits.map((hit) => hit.candidateIndex)]);
  const sourceValidity = candidates.map((candidate) => item.inputs[candidate.inputIndex]?.includes(candidate.sourceQuote) ?? false);
  const actionRequiredFacts = item.expectedFacts.filter((fact) => fact.expectedAction === "duplicate" || fact.expectedAction === "conflict");
  const actionMatches = matches.filter((match) => {
    if (match.candidateIndex === null) return false;
    const fact = item.expectedFacts.find((entry) => entry.id === match.goldFactId)!;
    if (fact.expectedAction !== "duplicate" && fact.expectedAction !== "conflict") return false;
    const candidate = candidates[match.candidateIndex];
    return candidate.action === fact.expectedAction && candidate.relatedEntryId === fact.relatedEntryId;
  }).length;
  const counts = {
    gold: item.expectedFacts.length,
    actual: eligible.length,
    autoPass: matches.filter((match) => match.state === "AUTO_PASS").length,
    autoFail: matches.filter((match) => match.state === "AUTO_FAIL").length,
    review: matches.filter((match) => match.state === "REVIEW").length,
    unsupported: unsupportedIndexes.size,
    sourceCandidates: candidates.length,
    invalidSourceQuote: sourceValidity.filter((valid) => !valid).length,
    correctCategory: matches.filter((match) => match.categoryCorrect === true).length,
    categoryComparable: matches.filter((match) => match.categoryCorrect !== null).length,
    uncertaintyRequired: item.expectedFacts.filter((fact) => fact.uncertain).length,
    uncertaintyPreserved: matches.filter((match) => match.uncertaintyPreserved === true).length,
    negationRequired: item.expectedFacts.filter((fact) => fact.negated).length,
    negationPreserved: matches.filter((match) => match.negationPreserved === true).length,
    actionRequired: actionRequiredFacts.length,
    actionCorrect: actionMatches,
  };
  return {
    caseId: item.id, matches, unsupportedCandidateIndexes, forbiddenInferenceHits, counts,
    metrics: {
      explicitFactRecall: rate(counts.autoPass, counts.gold),
      precision: rate(counts.autoPass, counts.actual),
      categoryAccuracy: rate(counts.correctCategory, counts.categoryComparable),
      unsupportedFactRate: rate(counts.unsupported, counts.actual),
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
  semanticJudgeDecisions?: Array<{ goldFactId: string; decision: "equivalent" | "not_equivalent" | "uncertain"; reason: string }>;
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
    return {
      profile, pipeline, cases: new Set(group.map((run) => run.caseId)).size, runs: group.length,
      explicitFactRecall: sum((run) => run.counts.autoPass) / Math.max(1, sum((run) => run.counts.gold)),
      precision: sum((run) => run.counts.autoPass) / Math.max(1, sum((run) => run.counts.actual)),
      categoryAccuracy: sum((run) => run.counts.correctCategory) / Math.max(1, sum((run) => run.counts.categoryComparable)),
      unsupportedFactRate: sum((run) => run.counts.unsupported) / Math.max(1, sum((run) => run.counts.actual)),
      sourceQuoteValidity: (sum((run) => run.counts.sourceCandidates) - sum((run) => run.counts.invalidSourceQuote)) / Math.max(1, sum((run) => run.counts.sourceCandidates)),
      uncertaintyPreservation: sum((run) => run.counts.uncertaintyPreserved) / Math.max(1, sum((run) => run.counts.uncertaintyRequired)),
      negationPreservation: sum((run) => run.counts.negationPreserved) / Math.max(1, sum((run) => run.counts.negationRequired)),
      duplicateConflictCorrectness: sum((run) => run.counts.actionRequired) ? sum((run) => run.counts.actionCorrect) / sum((run) => run.counts.actionRequired) : 1,
      reviewCount: sum((run) => run.counts.review),
      stability: [...stabilityGroups.values()].reduce((total, caseRuns) => total + stability(caseRuns), 0) / Math.max(1, stabilityGroups.size),
      averageLatencyMs: sum((run) => run.latencyMs) / Math.max(1, group.length),
      inputTokens: sum((run) => run.inputTokens), outputTokens: sum((run) => run.outputTokens),
      estimatedCostUsd: costs.length === group.length ? costs.reduce((total, value) => total + value, 0) : null,
    };
  });
}

export function aggregateDimensionScores(runs: RunScore[]) {
  const rows: Array<{ profile: string; pipeline: string; dimension: string; value: string; gold: number; actual: number; autoPass: number; unsupported: number; explicitFactRecall: number; precision: number; unsupportedFactRate: number }> = [];
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
      const gold = group.reduce((sum, run) => sum + run.counts.gold, 0);
      const actual = group.reduce((sum, run) => sum + run.counts.actual, 0);
      const autoPass = group.reduce((sum, run) => sum + run.counts.autoPass, 0);
      const unsupported = group.reduce((sum, run) => sum + run.counts.unsupported, 0);
      rows.push({ profile, pipeline, dimension: dimension.name, value, gold, actual, autoPass, unsupported, explicitFactRecall: autoPass / Math.max(1, gold), precision: autoPass / Math.max(1, actual), unsupportedFactRate: unsupported / Math.max(1, actual) });
    }
  }
  return rows.sort((a, b) => a.profile.localeCompare(b.profile) || a.pipeline.localeCompare(b.pipeline) || a.dimension.localeCompare(b.dimension) || Number(a.value) - Number(b.value) || a.value.localeCompare(b.value));
}
