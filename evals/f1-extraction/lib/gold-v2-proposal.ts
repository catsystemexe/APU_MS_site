import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CategoryId } from "../../../app/notepad-model.ts";
import { validateCorpus, type EvalCorpus, type ExpectedRelation, type GoldFact } from "./eval-contract.ts";
import { auditGoldCorpus } from "./gold-contract-audit.ts";
import { canonicalizeRelations, relationSignature } from "./gold-relations.ts";

export type ProposalConfidence = "mechanical" | "high" | "human-review-required";
export type ProposedFact = Pick<GoldFact, "id" | "category" | "text" | "source" | "uncertain" | "negated" | "requiredMarkers" | "expectedAction" | "relatedEntryId"> & {
  canonicalText: string;
};
export type GoldV2ProposalChange = {
  caseId: string;
  goldFactId: string;
  currentCategory: CategoryId;
  currentText: string;
  proposedCanonicalText: string;
  textStaysUnchanged: boolean;
  newFactIds: string[];
  relationIds: string[];
  helpsProjectionIds: string[];
  reason: string;
  confidence: ProposalConfidence;
  decisionStatus: "ready_to_apply" | "pending_human_review";
};
export type GoldV2CaseProposal = {
  caseId: string;
  changeGoldFactIds: string[];
  newFacts: ProposedFact[];
  relations: ExpectedRelation[];
  helpsProjections: string[];
  readyToApply: boolean;
};
export type GoldV2ProposalSummary = {
  sourceCorpusVersion: 1 | 2;
  targetCorpusVersion: 2;
  proposedCaseCount: number;
  proposedFactChanges: number;
  proposedNewFacts: number;
  proposedRelations: number;
  deduplicatedRelationCount: number;
  mechanical: number;
  high: number;
  humanReviewRequired: number;
  readyToApply: boolean;
  validationPassed: boolean;
  auditDeterministicViolations: number;
  auditUnexpectedHeuristics: number;
};
export type GoldV2Proposal = {
  kind: "f1-gold-v2-proposal";
  status: "migration_proposal" | "already_migrated";
  sourceCorpusVersion: 1 | 2;
  targetCorpusVersion: 2;
  summary: GoldV2ProposalSummary;
  policy: string[];
  changes: GoldV2ProposalChange[];
  caseProposals: GoldV2CaseProposal[];
};

const POLICY = [
  "canonicalText is the primary atomic scoring target; supported relational text may remain as surface text.",
  "Relations are canonicalized per case; directional lists are sorted and contrast sides use stable fact-ID order.",
  "Condition-dependent course is represented as context → course and course → manifestation.",
  "Helps facts are intrinsically relational and should be backed by explicit condition_effect projections.",
  "Někdy/jindy and sometimes/other-times branches do not automatically create course facts.",
  "Explicit občas, častěji, několikrát, denně, strong intensity, and duration normally produce course facts.",
];

type Spec = Omit<GoldV2ProposalChange, "currentCategory" | "currentText" | "newFactIds" | "relationIds" | "helpsProjectionIds" | "decisionStatus"> & {
  newFacts: ProposedFact[];
  relations: ExpectedRelation[];
  helpsProjections: string[];
};

const source = (quote: string) => ({ inputIndex: 0, quote });
const addFact = (id: string, category: CategoryId, canonicalText: string, quote: string, options: Partial<ProposedFact> = {}): ProposedFact => ({
  id, category, canonicalText, text: canonicalText, source: source(quote), uncertain: false, negated: false,
  requiredMarkers: [], expectedAction: "add", relatedEntryId: null, ...options,
});
const relation = (id: string, type: ExpectedRelation["type"], sourceFactIds: string[], targetFactIds: string[], quote: string, projectionFactIds: string[] = []): ExpectedRelation => ({
  id, type, sourceFactIds, targetFactIds, projectionFactIds, source: source(quote),
});

const SPECS: Spec[] = [
  {
    caseId: "atomic-uncertainty", goldFactId: "m1", proposedCanonicalText: "Možná odejde.", textStaysUnchanged: true,
    newFacts: [addFact("x1", "context", "Hlavně při hluku.", "hlavně při hluku")],
    relations: [relation("r-context-x1-m1", "context_of", ["x1"], ["m1"], "Možná odejde hlavně při hluku")], helpsProjections: [],
    reason: "Atomize the manifestation while retaining the supported context in a companion fact and explicit relation.", confidence: "mechanical",
  },
  {
    caseId: "human-gate-david", goldFactId: "m1", proposedCanonicalText: "Má výbuchy.", textStaysUnchanged: true,
    newFacts: [addFact("c1", "course", "Výbuchy se objevují občas.", "občas"), addFact("c2", "course", "Výbuchy jsou velmi silné.", "velmi silné")],
    relations: [relation("r-course-c1-m1", "course_of", ["c1"], ["m1"], "má občas velmi silné výbuchy"), relation("r-course-c2-m1", "course_of", ["c2"], ["m1"], "má občas velmi silné výbuchy")], helpsProjections: [],
    reason: "Občas and velmi silné are explicit course dimensions; the surface wording may remain when canonical scoring is atomic.", confidence: "high",
  },
  ...["x1", "x2", "x3"].map((goldFactId, index): Spec => ({
    caseId: "human-gate-david", goldFactId,
    proposedCanonicalText: ["Někdy tomu předchází konflikt s dítětem.", "Jindy tomu předchází požadavek učitelky.", "Jindy tomu předchází velký hluk."][index],
    textStaysUnchanged: true, newFacts: [],
    relations: [relation(`r-context-${goldFactId}-outbursts`, "context_of", [goldFactId], ["m1", "m2", "m3", "m4", "m5"], "Někdy tomu předchází konflikt s dítětem, jindy požadavek učitelky nebo velký hluk")], helpsProjections: [],
    reason: "Human review approved preserving někdy/jindy as part of the supported contrast meaning without creating a course fact.", confidence: "high",
  })),
  {
    caseId: "human-gate-klarka", goldFactId: "m1", proposedCanonicalText: "Reaguje velmi rozdílně.", textStaysUnchanged: true,
    newFacts: [addFact("x3", "context", "Při opravě.", "na opravu")],
    relations: [relation("r-context-x3-m1", "context_of", ["x3"], ["m1"], "reaguje velmi rozdílně na opravu")], helpsProjections: [],
    reason: "Human review approved the atomic manifestation while the correction situation remains represented independently.", confidence: "high",
  },
  {
    caseId: "human-gate-klarka", goldFactId: "m2", proposedCanonicalText: "Někdy opravu přijme.", textStaysUnchanged: true, newFacts: [],
    relations: [relation("r-contrast-m2-m3", "contrast_with", ["m2"], ["m3"], "Někdy ji přijme, jindy začne křičet")], helpsProjections: [],
    reason: "Human review approved preserving někdy as part of the contrast branch without creating a frequency/course fact.", confidence: "high",
  },
  {
    caseId: "human-gate-klarka", goldFactId: "m3", proposedCanonicalText: "Jindy začne křičet.", textStaysUnchanged: true, newFacts: [],
    relations: [relation("r-contrast-m3-m2", "contrast_with", ["m3"], ["m2"], "Někdy ji přijme, jindy začne křičet")], helpsProjections: [],
    reason: "Human review approved preserving jindy as part of the opposing contrast branch without creating a frequency/course fact.", confidence: "high",
  },
  {
    caseId: "human-gate-klarka", goldFactId: "c1", proposedCanonicalText: "Vyskytuje se častěji.", textStaysUnchanged: true,
    newFacts: [addFact("h1", "helps", "Před ostatními dětmi se reakce objevuje častěji.", "Častěji se to stává před ostatními dětmi")],
    relations: [relation("r-course-c1-reactions", "course_of", ["c1"], ["m1", "m3", "m4", "m5"], "Častěji se to stává před ostatními dětmi"), relation("r-effect-x1-c1", "condition_effect", ["x1"], ["c1"], "Častěji se to stává před ostatními dětmi", ["h1"])], helpsProjections: ["h1"],
    reason: "The course value is atomic; the relational surface statement remains legitimate through context, effect, and helps projection.", confidence: "high",
  },
  {
    caseId: "human-gate-klarka", goldFactId: "c2", proposedCanonicalText: "Objevilo se to několikrát.", textStaysUnchanged: true,
    newFacts: [addFact("h2", "helps", "Při práci o samotě se reakce objevila několikrát.", "několikrát se to objevilo i při práci o samotě")],
    relations: [relation("r-course-c2-reactions", "course_of", ["c2"], ["m1", "m3", "m4", "m5"], "několikrát se to objevilo i při práci o samotě"), relation("r-effect-x2-c2", "condition_effect", ["x2"], ["c2"], "několikrát se to objevilo i při práci o samotě", ["h2"])], helpsProjections: ["h2"],
    reason: "Několikrát is course; the situation-dependent occurrence is preserved as an explicit effect projection.", confidence: "high",
  },
  {
    caseId: "human-gate-ondra", goldFactId: "m1", proposedCanonicalText: "Někdy zvládne celou řízenou činnost bez problému.", textStaysUnchanged: true, newFacts: [],
    relations: [relation("r-contrast-m1-m2", "contrast_with", ["m1"], ["m2"], "někdy zvládne celou řízenou činnost bez problému a jindy po pár minutách odbíhá")], helpsProjections: [],
    reason: "Human review approved preserving někdy as part of the contrast branch without establishing a separate course value.", confidence: "high",
  },
  {
    caseId: "human-gate-ondra", goldFactId: "m2", proposedCanonicalText: "Jindy odbíhá.", textStaysUnchanged: true, newFacts: [],
    relations: [relation("r-course-c1-m2", "course_of", ["c1"], ["m2"], "jindy po pár minutách odbíhá"), relation("r-contrast-m2-m1", "contrast_with", ["m2"], ["m1"], "někdy zvládne celou řízenou činnost bez problému a jindy po pár minutách odbíhá")], helpsProjections: [],
    reason: "Human review approved preserving jindy in the contrast branch; the explicit duration remains isolated in course c1.", confidence: "high",
  },
  {
    caseId: "human-gate-ondra", goldFactId: "c1", proposedCanonicalText: "Po pár minutách.", textStaysUnchanged: true, newFacts: [], relations: [], helpsProjections: [],
    reason: "The course canonical meaning isolates the explicit duration while its readable text retains the related manifestation.", confidence: "high",
  },
  {
    caseId: "human-gate-ondra", goldFactId: "c2", proposedCanonicalText: "Častější je to, ale ne vždy.", textStaysUnchanged: true,
    newFacts: [addFact("h1", "helps", "Po víkendu je odbíhání častější, ale ne vždy.", "Častější je to po víkendu a před obědem, ale ne vždy", { uncertain: true, negated: true, requiredMarkers: ["ne vždy"] }), addFact("h2", "helps", "Před obědem je odbíhání častější, ale ne vždy.", "Častější je to po víkendu a před obědem, ale ne vždy", { uncertain: true, negated: true, requiredMarkers: ["ne vždy"] })],
    relations: [relation("r-course-c2-m2", "course_of", ["c2"], ["m2"], "Častější je to po víkendu a před obědem, ale ne vždy"), relation("r-effect-x1-c2", "condition_effect", ["x1"], ["c2"], "Častější je to po víkendu a před obědem, ale ne vždy", ["h1"]), relation("r-effect-x2-c2", "condition_effect", ["x2"], ["c2"], "Častější je to po víkendu a před obědem, ale ne vždy", ["h2"])], helpsProjections: ["h1", "h2"],
    reason: "Separate the course value from two contexts while preserving the explicit not-always uncertainty in each relational projection.", confidence: "high",
  },
  {
    caseId: "mixed-condition-result", goldFactId: "m1", proposedCanonicalText: "Začne protestovat.", textStaysUnchanged: true,
    newFacts: [addFact("x2", "context", "Bez přípravy.", "Bez přípravy"), addFact("x3", "context", "Po krátkém upozornění.", "po krátkém upozornění"), addFact("m2", "manifestations", "Přejde bez křiku.", "přejde bez křiku", { negated: true, requiredMarkers: ["bez křiku"] }), addFact("h2", "helps", "Bez přípravy začne při změně protestovat.", "Bez přípravy začne při změně protestovat")],
    relations: [relation("r-context-x1-m1", "context_of", ["x1"], ["m1"], "Bez přípravy začne při změně protestovat"), relation("r-effect-x2-m1", "condition_effect", ["x2"], ["m1"], "Bez přípravy začne při změně protestovat", ["h2"]), relation("r-effect-x3-m2", "condition_effect", ["x3"], ["m2"], "po krátkém upozornění přejde bez křiku", ["h1"])], helpsProjections: ["h1", "h2"],
    reason: "Atomize the protest and preserve both conditional branches, including the existing helps projection.", confidence: "high",
  },
  {
    caseId: "mixed-contrast-situations", goldFactId: "m1", proposedCanonicalText: "Úkol odmítne.", textStaysUnchanged: true,
    newFacts: [addFact("x2", "context", "Při práci jednotlivě.", "jednotlivě"), addFact("m2", "manifestations", "Úkol dokončí.", "ho dokončí"), addFact("m3", "manifestations", "Požádá o další.", "požádá o další")],
    relations: [relation("r-context-x1-m1", "context_of", ["x1"], ["m1"], "Ve skupině úkol odmítne"), relation("r-effect-x2-positive", "condition_effect", ["x2"], ["m2", "m3"], "jednotlivě ho dokončí a požádá o další", ["h1"]), relation("r-contrast-m1-positive", "contrast_with", ["m1"], ["m2", "m3"], "Ve skupině úkol odmítne, jednotlivě ho dokončí a požádá o další")], helpsProjections: ["h1"],
    reason: "Represent the group/individual contrast as atomic facts plus explicit context, effect, and contrast relations.", confidence: "high",
  },
  {
    caseId: "mixed-duplicate", goldFactId: "m1", proposedCanonicalText: "Vstává ze židle.", textStaysUnchanged: true,
    newFacts: [addFact("x1", "context", "Při ranním kruhu.", "Při ranním kruhu")],
    relations: [relation("r-context-x1-m1", "context_of", ["x1"], ["m1"], "Při ranním kruhu znovu vstává ze židle")], helpsProjections: [],
    reason: "Atomize context without changing the duplicate action or related entry identity of the manifestation.", confidence: "mechanical",
  },
  {
    caseId: "mixed-negation-and-help", goldFactId: "m1", proposedCanonicalText: "Už nekřičí.", textStaysUnchanged: true,
    newFacts: [addFact("x2", "context", "Po přesazení.", "Po přesazení")],
    relations: [relation("r-effect-x2-m1", "condition_effect", ["x2"], ["m1"], "Po přesazení už nekřičí", ["h1"])], helpsProjections: ["h1"],
    reason: "Preserve negation in the manifestation and encode the condition-dependent change through the existing helps projection.", confidence: "high",
  },
  {
    caseId: "mixed-negation-and-help", goldFactId: "h1", proposedCanonicalText: "Po přesazení už nekřičí.", textStaysUnchanged: true, newFacts: [],
    relations: [relation("r-effect-x2-h1", "condition_effect", ["x2"], ["m1"], "Po přesazení už nekřičí", ["h1"])], helpsProjections: ["h1"],
    reason: "Helps is intrinsically relational; its supported surface text remains legitimate when backed by an explicit condition-effect relation.", confidence: "high",
  },
];

function matchesProposedFact(actual: GoldFact, proposed: ProposedFact) {
  return actual.id === proposed.id
    && actual.category === proposed.category
    && actual.text === proposed.text
    && actual.canonicalText === proposed.canonicalText
    && actual.source.inputIndex === proposed.source.inputIndex
    && actual.source.quote === proposed.source.quote
    && actual.uncertain === proposed.uncertain
    && actual.negated === proposed.negated
    && JSON.stringify(actual.requiredMarkers) === JSON.stringify(proposed.requiredMarkers)
    && actual.expectedAction === proposed.expectedAction
    && actual.relatedEntryId === proposed.relatedEntryId;
}

function assertAlreadyMigrated(corpus: EvalCorpus) {
  const validation = validateCorpus(corpus);
  const audit = auditGoldCorpus(corpus);
  const errors = [...validation.errors];
  if (audit.deterministicViolations.length) errors.push(...audit.deterministicViolations.map((item) => item.reason));
  if (audit.heuristicFindings.length) errors.push(`Gold v2 audit still has heuristic findings: ${audit.heuristicFindings.map((item) => `${item.caseId}/${item.goldFactId}`).join(", ")}`);
  if (audit.relationFindings.length) errors.push(`Gold v2 audit still has relation findings: ${audit.relationFindings.map((item) => `${item.caseId}/${item.relationId}`).join(", ")}`);
  for (const caseId of new Set(SPECS.map((spec) => spec.caseId))) {
    const item = corpus.cases.find((candidate) => candidate.id === caseId);
    if (!item) { errors.push(`Migrated Gold v2 corpus is missing case ${caseId}.`); continue; }
    const facts = new Map(item.expectedFacts.map((fact) => [fact.id, fact]));
    const specs = SPECS.filter((spec) => spec.caseId === caseId);
    for (const spec of specs) {
      const fact = facts.get(spec.goldFactId);
      if (fact?.canonicalText !== spec.proposedCanonicalText) errors.push(`Migrated Gold v2 fact ${caseId}/${spec.goldFactId} does not match the approved canonical text.`);
      for (const proposed of spec.newFacts) {
        const actual = facts.get(proposed.id);
        if (!actual || !matchesProposedFact(actual, proposed)) errors.push(`Migrated Gold v2 fact ${caseId}/${proposed.id} does not match the approved proposal.`);
      }
    }
    const expectedRelations = canonicalizeRelations(specs.flatMap((spec) => spec.relations)).relations;
    const actualRelations = new Map((item.expectedRelations ?? []).map((relation) => [relationSignature(relation), relation]));
    for (const expected of expectedRelations) {
      const actual = actualRelations.get(relationSignature(expected));
      if (!actual || JSON.stringify(actual.source) !== JSON.stringify(expected.source)) errors.push(`Migrated Gold v2 relation ${caseId}/${expected.id} does not match the approved proposal.`);
    }
  }
  if (errors.length) throw new Error(`Gold v2 migration no longer applies because the version 2 corpus is not the approved normalized result:\n${errors.join("\n")}`);
  return audit;
}

function buildAlreadyMigratedProposal(corpus: EvalCorpus): GoldV2Proposal {
  const audit = assertAlreadyMigrated(corpus);
  return {
    kind: "f1-gold-v2-proposal",
    status: "already_migrated",
    sourceCorpusVersion: 2,
    targetCorpusVersion: 2,
    summary: {
      sourceCorpusVersion: 2,
      targetCorpusVersion: 2,
      proposedCaseCount: 0,
      proposedFactChanges: 0,
      proposedNewFacts: 0,
      proposedRelations: 0,
      deduplicatedRelationCount: 0,
      mechanical: 0,
      high: 0,
      humanReviewRequired: 0,
      readyToApply: true,
      validationPassed: true,
      auditDeterministicViolations: audit.deterministicViolations.length,
      auditUnexpectedHeuristics: audit.heuristicFindings.length + audit.relationFindings.length,
    },
    policy: POLICY,
    changes: [],
    caseProposals: [],
  };
}

function assembleCaseProposal(corpus: EvalCorpus, caseId: string, specs: Spec[]) {
  const item = corpus.cases.find((candidate) => candidate.id === caseId);
  if (!item) throw new Error(`Gold v2 proposal references unknown case ${caseId}.`);
  const existingFacts = new Map(item.expectedFacts.map((fact) => [fact.id, fact]));
  const newFacts = new Map<string, ProposedFact>();
  const rawRelations: ExpectedRelation[] = [];
  const helpsProjections = new Set<string>();
  for (const spec of specs) {
    if (!existingFacts.has(spec.goldFactId)) throw new Error(`Gold v2 proposal references unknown fact ${caseId}/${spec.goldFactId}.`);
    for (const proposed of spec.newFacts) {
      if (existingFacts.has(proposed.id) || newFacts.has(proposed.id)) throw new Error(`Duplicate proposed fact id in ${caseId}: ${proposed.id}`);
      if (!item.inputs[proposed.source.inputIndex]?.includes(proposed.source.quote)) throw new Error(`Gold v2 proposed fact ${caseId}/${proposed.id} has an invalid source quote.`);
      newFacts.set(proposed.id, structuredClone(proposed));
    }
    for (const proposedRelation of spec.relations) {
      if (!item.inputs[proposedRelation.source.inputIndex]?.includes(proposedRelation.source.quote)) throw new Error(`Gold v2 proposed relation ${caseId}/${proposedRelation.id} has an invalid source quote.`);
      rawRelations.push(structuredClone(proposedRelation));
    }
    for (const id of spec.helpsProjections) helpsProjections.add(id);
  }
  const allFacts = new Map([...existingFacts, ...newFacts]);
  for (const relation of rawRelations) for (const factId of [...relation.sourceFactIds, ...relation.targetFactIds, ...relation.projectionFactIds]) {
    if (!allFacts.has(factId)) throw new Error(`Gold v2 proposed relation ${caseId}/${relation.id} references unknown fact ${factId}.`);
  }
  for (const id of helpsProjections) if (allFacts.get(id)?.category !== "helps") throw new Error(`Gold v2 helps projection ${caseId}/${id} is not a helps fact.`);
  const canonical = canonicalizeRelations(rawRelations);
  const changes: GoldV2ProposalChange[] = specs.map((spec) => {
    const fact = existingFacts.get(spec.goldFactId)!;
    return {
      caseId,
      goldFactId: spec.goldFactId,
      currentCategory: fact.category,
      currentText: fact.text,
      proposedCanonicalText: spec.proposedCanonicalText,
      textStaysUnchanged: spec.textStaysUnchanged,
      newFactIds: spec.newFacts.map((item) => item.id).sort(),
      relationIds: [...new Set(spec.relations.map((item) => canonical.signatureToId.get(relationSignature(item))!))].sort(),
      helpsProjectionIds: [...new Set(spec.helpsProjections)].sort(),
      reason: spec.reason,
      confidence: spec.confidence,
      decisionStatus: spec.confidence === "human-review-required" ? "pending_human_review" : "ready_to_apply",
    };
  });
  return {
    caseProposal: {
      caseId,
      changeGoldFactIds: changes.map((change) => change.goldFactId),
      newFacts: [...newFacts.values()],
      relations: canonical.relations,
      helpsProjections: [...helpsProjections].sort(),
      readyToApply: changes.every((change) => change.decisionStatus === "ready_to_apply"),
    } satisfies GoldV2CaseProposal,
    changes,
    deduplicatedRelationCount: canonical.deduplicatedCount,
  };
}

export function applyGoldV2Proposal(sourceCorpus: EvalCorpus, proposal: GoldV2Proposal): EvalCorpus {
  const migrated = structuredClone(sourceCorpus);
  migrated.version = 2;
  const changesByCase = new Map<string, Map<string, GoldV2ProposalChange>>();
  for (const change of proposal.changes) {
    const caseChanges = changesByCase.get(change.caseId) ?? new Map<string, GoldV2ProposalChange>();
    if (caseChanges.has(change.goldFactId)) throw new Error(`Duplicate fact change ${change.caseId}/${change.goldFactId}.`);
    caseChanges.set(change.goldFactId, change);
    changesByCase.set(change.caseId, caseChanges);
  }
  const proposalsByCase = new Map(proposal.caseProposals.map((item) => [item.caseId, item]));
  for (const item of migrated.cases) {
    const caseChanges = changesByCase.get(item.id) ?? new Map<string, GoldV2ProposalChange>();
    item.expectedFacts = item.expectedFacts.map((fact) => {
      const change = caseChanges.get(fact.id);
      if (change && !change.textStaysUnchanged) throw new Error(`Proposal ${item.id}/${fact.id} requires an unsupported text rewrite.`);
      return { ...fact, canonicalText: change?.proposedCanonicalText ?? fact.canonicalText ?? fact.text };
    });
    const caseProposal = proposalsByCase.get(item.id);
    if (caseProposal) item.expectedFacts.push(...structuredClone(caseProposal.newFacts));
    item.expectedRelations = caseProposal ? structuredClone(caseProposal.relations) : structuredClone(item.expectedRelations ?? []);
    item.dimensions.factCount = item.expectedFacts.length;
    item.dimensions.categoryCount = new Set(item.expectedFacts.map((fact) => fact.category)).size;
  }
  return migrated;
}

export function buildGoldV2Proposal(corpus: EvalCorpus): GoldV2Proposal {
  if (corpus.version === 2) return buildAlreadyMigratedProposal(corpus);
  const caseIds = [...new Set(SPECS.map((spec) => spec.caseId))];
  const assemblies = caseIds.map((caseId) => assembleCaseProposal(corpus, caseId, SPECS.filter((spec) => spec.caseId === caseId)));
  const changes = assemblies.flatMap((item) => item.changes);
  const caseProposals = assemblies.map((item) => item.caseProposal);
  const proposedKeys = new Set(changes.map((change) => `${change.caseId}\u0000${change.goldFactId}`));
  const uncoveredFindings = auditGoldCorpus(corpus).findings.filter((finding) => !proposedKeys.has(`${finding.caseId}\u0000${finding.goldFactId}`));
  if (uncoveredFindings.length) throw new Error(`Gold v2 proposal does not cover current audit findings: ${uncoveredFindings.map((finding) => `${finding.caseId}/${finding.goldFactId}`).join(", ")}`);
  const confidenceCount = (confidence: ProposalConfidence) => changes.filter((change) => change.confidence === confidence).length;
  const pendingKeys = new Set(changes.filter((change) => change.decisionStatus === "pending_human_review").map((change) => `${change.caseId}\u0000${change.goldFactId}`));
  const pendingRelationIds = new Set(changes.filter((change) => change.decisionStatus === "pending_human_review").flatMap((change) => change.relationIds.map((id) => `${change.caseId}\u0000${id}`)));
  const baseSummary: GoldV2ProposalSummary = {
    sourceCorpusVersion: corpus.version,
    targetCorpusVersion: 2,
    proposedCaseCount: caseProposals.length,
    proposedFactChanges: changes.length,
    proposedNewFacts: caseProposals.reduce((total, item) => total + item.newFacts.length, 0),
    proposedRelations: caseProposals.reduce((total, item) => total + item.relations.length, 0),
    deduplicatedRelationCount: assemblies.reduce((total, item) => total + item.deduplicatedRelationCount, 0),
    mechanical: confidenceCount("mechanical"),
    high: confidenceCount("high"),
    humanReviewRequired: confidenceCount("human-review-required"),
    readyToApply: false,
    validationPassed: false,
    auditDeterministicViolations: 0,
    auditUnexpectedHeuristics: 0,
  };
  const proposal: GoldV2Proposal = {
    kind: "f1-gold-v2-proposal",
    status: "migration_proposal",
    sourceCorpusVersion: corpus.version,
    targetCorpusVersion: 2,
    summary: baseSummary,
    policy: POLICY,
    changes,
    caseProposals,
  };
  const migrated = applyGoldV2Proposal(corpus, proposal);
  const validation = validateCorpus(migrated);
  const audit = auditGoldCorpus(migrated);
  const unexpectedFactFindings = audit.heuristicFindings.filter((finding) => !pendingKeys.has(`${finding.caseId}\u0000${finding.goldFactId}`));
  const unexpectedRelationFindings = audit.relationFindings.filter((finding) => !pendingRelationIds.has(`${finding.caseId}\u0000${finding.relationId}`));
  const unexpectedHeuristics = unexpectedFactFindings.length + unexpectedRelationFindings.length;
  proposal.summary = {
    ...baseSummary,
    readyToApply: baseSummary.humanReviewRequired === 0,
    validationPassed: validation.errors.length === 0 && audit.deterministicViolations.length === 0 && unexpectedHeuristics === 0,
    auditDeterministicViolations: audit.deterministicViolations.length,
    auditUnexpectedHeuristics: unexpectedHeuristics,
  };
  if (validation.errors.length) throw new Error(`Generated Gold v2 corpus is invalid:\n${validation.errors.join("\n")}`);
  if (audit.deterministicViolations.length) throw new Error(`Generated Gold v2 corpus has deterministic audit violations:\n${audit.deterministicViolations.map((item) => item.reason).join("\n")}`);
  if (unexpectedHeuristics) throw new Error(`Generated Gold v2 corpus introduced unexpected audit heuristics: ${[...unexpectedFactFindings.map((item) => `${item.caseId}/${item.goldFactId}`), ...unexpectedRelationFindings.map((item) => `${item.caseId}/${item.relationId}`)].join(", ")}`);
  return proposal;
}

export function renderGoldV2ProposalMarkdown(proposal: GoldV2Proposal) {
  const summary = proposal.summary;
  const lines = [
    "# F1 Gold Contract v2 proposal", "",
    `Status: ${proposal.status}.`,
    `Source corpus: v${summary.sourceCorpusVersion}; target: v${summary.targetCorpusVersion}.`,
    `Cases: ${summary.proposedCaseCount}; fact changes: ${summary.proposedFactChanges}; new facts: ${summary.proposedNewFacts}; canonical relations: ${summary.proposedRelations}; deduplicated relations: ${summary.deduplicatedRelationCount}.`,
    `Confidence: mechanical ${summary.mechanical}, high ${summary.high}, human review ${summary.humanReviewRequired}.`,
    `Ready to apply: ${summary.readyToApply}; validation passed: ${summary.validationPassed}; deterministic audit violations: ${summary.auditDeterministicViolations}; unexpected heuristics: ${summary.auditUnexpectedHeuristics}.`,
    "", "## Policy", "", ...proposal.policy.map((entry) => `- ${entry}`), "", "## Case proposals", "",
  ];
  for (const caseProposal of proposal.caseProposals) {
    const changes = proposal.changes.filter((change) => change.caseId === caseProposal.caseId);
    lines.push(`### ${caseProposal.caseId}`, "", `- Ready to apply: ${caseProposal.readyToApply}`, `- Helps projections: ${caseProposal.helpsProjections.length ? caseProposal.helpsProjections.join(", ") : "none"}`, "", "New facts:", "");
    lines.push(...(caseProposal.newFacts.length ? caseProposal.newFacts.map((fact) => `- ${fact.id} (${fact.category}): ${fact.canonicalText}`) : ["- none"]), "", "Canonical relations:", "");
    lines.push(...(caseProposal.relations.length ? caseProposal.relations.map((item) => {
      const sharedBy = changes.filter((change) => change.relationIds.includes(item.id)).map((change) => change.goldFactId).join(", ");
      return `- ${item.id}: ${item.type} [${item.sourceFactIds.join(", ")}] → [${item.targetFactIds.join(", ")}] projections [${item.projectionFactIds.join(", ") || "none"}] (referenced by: ${sharedBy})`;
    }) : ["- none"]), "", "Fact changes:", "");
    for (const change of changes) lines.push(
      `- ${change.goldFactId} (${change.currentCategory}) → canonicalText: ${change.proposedCanonicalText}`,
      `  - Current text remains: ${change.textStaysUnchanged}`,
      `  - New fact refs: ${change.newFactIds.join(", ") || "none"}`,
      `  - Relation refs: ${change.relationIds.join(", ") || "none"}`,
      `  - Helps projection refs: ${change.helpsProjectionIds.join(", ") || "none"}`,
      `  - Confidence: ${change.confidence}; decision: ${change.decisionStatus}`,
      `  - Reason: ${change.reason}`,
    );
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

export async function writeGoldV2Proposal(outputDirectory: string, proposal: GoldV2Proposal) {
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(join(outputDirectory, "gold-v2-proposal.json"), `${JSON.stringify(proposal, null, 2)}\n`),
    writeFile(join(outputDirectory, "gold-v2-proposal.md"), renderGoldV2ProposalMarkdown(proposal)),
  ]);
  return outputDirectory;
}
