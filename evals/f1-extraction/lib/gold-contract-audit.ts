import type { CategoryId } from "../../../app/notepad-model.ts";
import { goldCanonicalText, validateCorpus, type EvalCase, type EvalCorpus, type GoldFact } from "./eval-contract.ts";

export type GoldContractAuditSeverity = "definite contract mismatch" | "probable mismatch" | "review required";

export type GoldContractAuditFinding = {
  caseId: string;
  goldFactId: string;
  currentCategory: CategoryId;
  currentText: string;
  canonicalText: string;
  currentSourceQuote: string;
  suspectedAdditionalDimensions: CategoryId[];
  reason: string;
  severity: GoldContractAuditSeverity;
};

export type GoldContractAuditReport = {
  contractSource: "app/f1-extraction-contract.ts";
  corpusVersion: number;
  casesAudited: number;
  factsAudited: number;
  counts: Record<GoldContractAuditSeverity, number>;
  findings: GoldContractAuditFinding[];
  heuristicFindings: GoldContractAuditFinding[];
  relationFindings: Array<{ caseId: string; relationId: string; reason: string; severity: "review required" }>;
  deterministicViolations: Array<{ caseId: string | null; relationId: string | null; code: "contract_validation" | "duplicate_relation"; reason: string }>;
  relationAware: true;
};

const severityRank: Record<GoldContractAuditSeverity, number> = {
  "review required": 1,
  "probable mismatch": 2,
  "definite contract mismatch": 3,
};

const contextPattern = /\b(?:hlavně\s+)?při\b|\bběhem\b|\b(?:ve|v)\s+(?:třídě|jídelně|šatně|skupině|vyučování|hodině)\b|\b(?:před|po)\s+(?:obědem|vyučováním|víkendu|přesazení)\b|\bbez\s+přípravy\b|\bna\s+opravu\b/u;
const strongContextPattern = /\bhlavně\s+při\s+hluku\b/u;
const coursePattern = /\b(?:občas|často|častěji|denně|týdně|několikrát)\b|\b(?:každý|každé)\s+\p{L}+\b|\bpo\s+(?:pár|jedné|dvou|třech|čtyřech|pěti|\d+)\s+minut|\bvelmi\s+siln\p{L}*/u;

function normalize(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("cs-CZ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function overlapSeverity(current: GoldFact, other: GoldFact): GoldContractAuditSeverity {
  if (current.category === "helps" || current.category === "goals" || other.category === "helps" || other.category === "goals") return "review required";
  return "definite contract mismatch";
}

function lexicalSignals(fact: GoldFact) {
  const text = normalize(goldCanonicalText(fact));
  const signals: Array<{ dimension: CategoryId; reason: string; severity: GoldContractAuditSeverity }> = [];
  if (fact.category === "manifestations" && contextPattern.test(text)) signals.push({
    dimension: "context",
    reason: "Manifestation gold text retains an explicit situation/trigger phrase that the production contract normally atomizes as context.",
    severity: strongContextPattern.test(text) ? "definite contract mismatch" : "probable mismatch",
  });
  if (fact.category === "manifestations" && coursePattern.test(text)) signals.push({
    dimension: "course",
    reason: "Manifestation gold text retains explicit frequency, duration, or intensity that the production contract normally atomizes as course.",
    severity: "probable mismatch",
  });
  if (fact.category === "context" && coursePattern.test(text)) signals.push({
    dimension: "course",
    reason: "Context gold text also expresses frequency or trend and may combine a separate course fact.",
    severity: "probable mismatch",
  });
  if (fact.category === "course" && contextPattern.test(text)) signals.push({
    dimension: "context",
    reason: "Course gold text also retains an explicit situation phrase and may combine a separate context fact.",
    severity: "probable mismatch",
  });
  return signals;
}

function relationCoversDimension(item: EvalCase, factId: string, otherFactId: string | null, dimension: CategoryId) {
  const expectedType = dimension === "context" ? "context_of" : dimension === "course" ? "course_of" : null;
  if (!expectedType) return false;
  return (item.expectedRelations ?? []).some((relation) => relation.type === expectedType
    && relation.targetFactIds.includes(factId)
    && (otherFactId === null || relation.sourceFactIds.includes(otherFactId)));
}

function auditFact(item: EvalCase, fact: GoldFact): GoldContractAuditFinding | null {
  const dimensions = new Set<CategoryId>();
  const reasons = new Set<string>();
  let severity: GoldContractAuditSeverity = "review required";
  const factText = normalize(goldCanonicalText(fact));
  for (const other of item.expectedFacts) {
    if (other.id === fact.id || other.category === fact.category || other.source.inputIndex !== fact.source.inputIndex) continue;
    if (fact.category === "helps" || other.category === "helps") continue;
    const otherText = normalize(goldCanonicalText(other));
    if (otherText.length < 4 || !factText.includes(otherText)) continue;
    dimensions.add(other.category);
    reasons.add(`Gold text contains separately expected ${other.category} fact ${other.id}, indicating that the current ${fact.category} fact is not atomized by category.`);
    const candidateSeverity = overlapSeverity(fact, other);
    if (severityRank[candidateSeverity] > severityRank[severity]) severity = candidateSeverity;
  }
  for (const signal of lexicalSignals(fact)) {
    dimensions.add(signal.dimension);
    reasons.add(signal.reason);
    if (severityRank[signal.severity] > severityRank[severity]) severity = signal.severity;
  }
  if (fact.canonicalText) {
    const surfaceFact = { ...fact, canonicalText: undefined };
    for (const signal of lexicalSignals(surfaceFact)) {
      if (lexicalSignals(fact).some((canonicalSignal) => canonicalSignal.dimension === signal.dimension)) continue;
      if (relationCoversDimension(item, fact.id, null, signal.dimension)) continue;
      const companionExists = item.expectedFacts.some((candidate) => candidate.id !== fact.id && candidate.category === signal.dimension && candidate.source.inputIndex === fact.source.inputIndex);
      dimensions.add(signal.dimension);
      reasons.add(companionExists
        ? `Relation-preserving surface text contains ${signal.dimension} meaning, but no expectedRelation links its companion fact to ${fact.id}.`
        : `Relation-preserving surface text contains material ${signal.dimension} meaning without a companion fact or expectedRelation.`);
      if (severityRank["review required"] > severityRank[severity]) severity = "review required";
    }
  }
  if (!dimensions.size) return null;
  return {
    caseId: item.id,
    goldFactId: fact.id,
    currentCategory: fact.category,
    currentText: fact.text,
    canonicalText: goldCanonicalText(fact),
    currentSourceQuote: fact.source.quote,
    suspectedAdditionalDimensions: [...dimensions].sort(),
    reason: [...reasons].join(" "),
    severity,
  };
}

export function auditGoldCorpus(corpus: EvalCorpus): GoldContractAuditReport {
  const findings = corpus.cases.flatMap((item) => item.expectedFacts.flatMap((fact) => {
    const finding = auditFact(item, fact);
    return finding ? [finding] : [];
  })).sort((left, right) => left.caseId.localeCompare(right.caseId) || left.goldFactId.localeCompare(right.goldFactId));
  const validation = validateCorpus(corpus);
  const deterministicViolations: GoldContractAuditReport["deterministicViolations"] = validation.errors.map((reason) => {
    const caseIndex = Number(reason.match(/^cases\[(\d+)\]/)?.[1]);
    return { caseId: Number.isInteger(caseIndex) ? corpus.cases[caseIndex]?.id ?? null : null, relationId: null, code: "contract_validation", reason };
  });
  for (const item of corpus.cases) {
    const signatures = new Map<string, string>();
    for (const relation of item.expectedRelations ?? []) {
      if (!relation || typeof relation !== "object" || !Array.isArray(relation.sourceFactIds) || !Array.isArray(relation.targetFactIds) || !Array.isArray(relation.projectionFactIds)) continue;
      const sourceIds = [...relation.sourceFactIds].sort().join(",");
      const targetIds = [...relation.targetFactIds].sort().join(",");
      const sides = relation.type === "contrast_with" ? [sourceIds, targetIds].sort() : [sourceIds, targetIds];
      const signature = [relation.type, ...sides, [...relation.projectionFactIds].sort().join(",")].join("|");
      const previous = signatures.get(signature);
      if (previous) deterministicViolations.push({ caseId: item.id, relationId: relation.id, code: "duplicate_relation", reason: `Relation ${relation.id} duplicates ${previous}.` });
      else signatures.set(signature, relation.id);
    }
  }
  const relationFindings = corpus.cases.flatMap((item) => (item.expectedRelations ?? []).flatMap((relation) => relation && typeof relation === "object" && relation.type === "condition_effect" && Array.isArray(relation.projectionFactIds) && relation.projectionFactIds.length === 0
    ? [{ caseId: item.id, relationId: relation.id, reason: "Condition/effect relation has no helps projection; review whether the explicit observed relationship requires one.", severity: "review required" as const }]
    : []));
  return {
    contractSource: "app/f1-extraction-contract.ts",
    corpusVersion: corpus.version,
    casesAudited: corpus.cases.length,
    factsAudited: corpus.cases.reduce((total, item) => total + item.expectedFacts.length, 0),
    counts: {
      "definite contract mismatch": findings.filter((finding) => finding.severity === "definite contract mismatch").length,
      "probable mismatch": findings.filter((finding) => finding.severity === "probable mismatch").length,
      "review required": findings.filter((finding) => finding.severity === "review required").length,
    },
    relationAware: true,
    findings,
    heuristicFindings: findings,
    relationFindings,
    deterministicViolations,
  };
}
