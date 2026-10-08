import type { CategoryId } from "../../../app/notepad-model.ts";
import type { EvalCase, EvalCorpus, GoldFact } from "./eval-contract.ts";

export type GoldContractAuditSeverity = "definite contract mismatch" | "probable mismatch" | "review required";

export type GoldContractAuditFinding = {
  caseId: string;
  goldFactId: string;
  currentCategory: CategoryId;
  currentText: string;
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
};

const severityRank: Record<GoldContractAuditSeverity, number> = {
  "review required": 1,
  "probable mismatch": 2,
  "definite contract mismatch": 3,
};

const contextPattern = /\b(?:hlavně\s+)?při\b|\bběhem\b|\b(?:ve|v)\s+(?:třídě|jídelně|šatně|skupině|vyučování|hodině)\b|\b(?:před|po)\s+(?:obědem|vyučováním|víkendu|přesazení)\b|\bbez\s+přípravy\b|\bna\s+opravu\b/u;
const strongContextPattern = /\bhlavně\s+při\s+hluku\b/u;
const coursePattern = /\b(?:občas|někdy|jindy|často|častěji|denně|týdně|několikrát)\b|\b(?:každý|každé)\s+\p{L}+\b|\bpo\s+(?:pár|jedné|dvou|třech|čtyřech|pěti|\d+)\s+minut|\bvelmi\s+siln\p{L}*/u;

function normalize(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("cs-CZ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function overlapSeverity(current: GoldFact, other: GoldFact): GoldContractAuditSeverity {
  if (current.category === "helps" || current.category === "goals" || other.category === "helps" || other.category === "goals") return "review required";
  return "definite contract mismatch";
}

function lexicalSignals(fact: GoldFact) {
  const text = normalize(fact.text);
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

function auditFact(item: EvalCase, fact: GoldFact): GoldContractAuditFinding | null {
  const dimensions = new Set<CategoryId>();
  const reasons = new Set<string>();
  let severity: GoldContractAuditSeverity = "review required";
  const factText = normalize(fact.text);
  for (const other of item.expectedFacts) {
    if (other.id === fact.id || other.category === fact.category || other.source.inputIndex !== fact.source.inputIndex) continue;
    const otherText = normalize(other.text);
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
  if (!dimensions.size) return null;
  return {
    caseId: item.id,
    goldFactId: fact.id,
    currentCategory: fact.category,
    currentText: fact.text,
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
    findings,
  };
}
