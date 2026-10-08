import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CategoryId } from "../../../app/notepad-model.ts";
import type { EvalCorpus, ExpectedRelation, GoldFact } from "./eval-contract.ts";
import { auditGoldCorpus } from "./gold-contract-audit.ts";

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
  newFacts: ProposedFact[];
  relations: ExpectedRelation[];
  helpsProjections: string[];
  reason: string;
  confidence: ProposalConfidence;
};
export type GoldV2Proposal = {
  kind: "f1-gold-v2-proposal";
  sourceCorpusVersion: 1 | 2;
  targetCorpusVersion: 2;
  summary: { total: number; byConfidence: Record<ProposalConfidence, number> };
  policy: string[];
  changes: GoldV2ProposalChange[];
};

type Spec = Omit<GoldV2ProposalChange, "currentCategory" | "currentText">;

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
    proposedCanonicalText: ["Předchází tomu konflikt s dítětem.", "Předchází tomu požadavek učitelky.", "Předchází tomu velký hluk."][index],
    textStaysUnchanged: true, newFacts: [],
    relations: [relation(`r-context-${goldFactId}-outbursts`, "context_of", [goldFactId], ["m1", "m2", "m3", "m4", "m5"], ["Někdy tomu předchází konflikt s dítětem", "jindy požadavek učitelky", "velký hluk"][index])], helpsProjections: [],
    reason: "Někdy/jindy distinguishes supported alternatives but does not by itself establish a course fact.", confidence: "human-review-required",
  })),
  {
    caseId: "human-gate-klarka", goldFactId: "m1", proposedCanonicalText: "Reaguje velmi rozdílně.", textStaysUnchanged: true,
    newFacts: [addFact("x3", "context", "Při opravě.", "na opravu")],
    relations: [relation("r-context-x3-m1", "context_of", ["x3"], ["m1"], "reaguje velmi rozdílně na opravu")], helpsProjections: [],
    reason: "The correction situation is represented independently while the manifestation remains atomic.", confidence: "human-review-required",
  },
  {
    caseId: "human-gate-klarka", goldFactId: "m2", proposedCanonicalText: "Opravu přijme.", textStaysUnchanged: true, newFacts: [],
    relations: [relation("r-contrast-m2-m3", "contrast_with", ["m2"], ["m3"], "Někdy ji přijme, jindy začne křičet")], helpsProjections: [],
    reason: "Někdy marks one contrast branch; it does not automatically create a frequency/course fact.", confidence: "human-review-required",
  },
  {
    caseId: "human-gate-klarka", goldFactId: "m3", proposedCanonicalText: "Začne křičet.", textStaysUnchanged: true, newFacts: [],
    relations: [relation("r-contrast-m3-m2", "contrast_with", ["m3"], ["m2"], "Někdy ji přijme, jindy začne křičet")], helpsProjections: [],
    reason: "Jindy marks the opposing contrast branch; it does not automatically create a frequency/course fact.", confidence: "human-review-required",
  },
  {
    caseId: "human-gate-klarka", goldFactId: "c1", proposedCanonicalText: "Vyskytuje se častěji.", textStaysUnchanged: true,
    newFacts: [addFact("h1", "helps", "Před ostatními dětmi se reakce objevuje častěji.", "Častěji se to stává před ostatními dětmi")],
    relations: [relation("r-course-c1-reactions", "course_of", ["c1"], ["m1", "m3", "m4", "m5"], "Častěji se to stává před ostatními dětmi"), relation("r-effect-x1-reactions", "condition_effect", ["x1"], ["m3", "m4", "m5"], "Častěji se to stává před ostatními dětmi", ["h1"])], helpsProjections: ["h1"],
    reason: "The course value is atomic; the relational surface statement remains legitimate through context, effect, and helps projection.", confidence: "high",
  },
  {
    caseId: "human-gate-klarka", goldFactId: "c2", proposedCanonicalText: "Objevilo se to několikrát.", textStaysUnchanged: true,
    newFacts: [addFact("h2", "helps", "Při práci o samotě se reakce objevila několikrát.", "několikrát se to objevilo i při práci o samotě")],
    relations: [relation("r-course-c2-reactions", "course_of", ["c2"], ["m1", "m3", "m4", "m5"], "několikrát se to objevilo i při práci o samotě"), relation("r-effect-x2-reactions", "condition_effect", ["x2"], ["m3", "m4", "m5"], "několikrát se to objevilo i při práci o samotě", ["h2"])], helpsProjections: ["h2"],
    reason: "Několikrát is course; the situation-dependent occurrence is preserved as an explicit effect projection.", confidence: "high",
  },
  {
    caseId: "human-gate-ondra", goldFactId: "m1", proposedCanonicalText: "Zvládne celou řízenou činnost bez problému.", textStaysUnchanged: true, newFacts: [],
    relations: [relation("r-contrast-m1-m2", "contrast_with", ["m1"], ["m2"], "někdy zvládne celou řízenou činnost bez problému a jindy po pár minutách odbíhá")], helpsProjections: [],
    reason: "Někdy introduces a contrast branch, not an independently established course value.", confidence: "human-review-required",
  },
  {
    caseId: "human-gate-ondra", goldFactId: "m2", proposedCanonicalText: "Odbíhá.", textStaysUnchanged: true, newFacts: [],
    relations: [relation("r-course-c1-m2", "course_of", ["c1"], ["m2"], "jindy po pár minutách odbíhá"), relation("r-contrast-m2-m1", "contrast_with", ["m2"], ["m1"], "někdy zvládne celou řízenou činnost bez problému a jindy po pár minutách odbíhá")], helpsProjections: [],
    reason: "The explicit duration belongs to course c1; jindy only identifies the contrast branch.", confidence: "human-review-required",
  },
  {
    caseId: "human-gate-ondra", goldFactId: "c2", proposedCanonicalText: "Častější je to, ale ne vždy.", textStaysUnchanged: true,
    newFacts: [addFact("h1", "helps", "Po víkendu je odbíhání častější, ale ne vždy.", "Častější je to po víkendu a před obědem, ale ne vždy", { uncertain: true, negated: true, requiredMarkers: ["ne vždy"] }), addFact("h2", "helps", "Před obědem je odbíhání častější, ale ne vždy.", "Častější je to po víkendu a před obědem, ale ne vždy", { uncertain: true, negated: true, requiredMarkers: ["ne vždy"] })],
    relations: [relation("r-course-c2-m2", "course_of", ["c2"], ["m2"], "Častější je to po víkendu a před obědem, ale ne vždy"), relation("r-effect-x1-m2", "condition_effect", ["x1"], ["m2"], "Častější je to po víkendu a před obědem, ale ne vždy", ["h1"]), relation("r-effect-x2-m2", "condition_effect", ["x2"], ["m2"], "Častější je to po víkendu a před obědem, ale ne vždy", ["h2"])], helpsProjections: ["h1", "h2"],
    reason: "Separate the course value from two contexts while preserving the explicit not-always uncertainty in each relational projection.", confidence: "high",
  },
  {
    caseId: "mixed-condition-result", goldFactId: "m1", proposedCanonicalText: "Začne protestovat.", textStaysUnchanged: true,
    newFacts: [addFact("x2", "context", "Bez přípravy.", "Bez přípravy"), addFact("x3", "context", "Po krátkém upozornění.", "po krátkém upozornění"), addFact("m2", "manifestations", "Přejde bez křiku.", "přejde bez křiku", { negated: true, requiredMarkers: ["bez křiku"] })],
    relations: [relation("r-context-x1-m1", "context_of", ["x1"], ["m1"], "Bez přípravy začne při změně protestovat"), relation("r-effect-x2-m1", "condition_effect", ["x2"], ["m1"], "Bez přípravy začne při změně protestovat"), relation("r-effect-x3-m2", "condition_effect", ["x3"], ["m2"], "po krátkém upozornění přejde bez křiku", ["h1"])], helpsProjections: ["h1"],
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

function validateProposalChange(corpus: EvalCorpus, spec: Spec): GoldV2ProposalChange {
  const item = corpus.cases.find((candidate) => candidate.id === spec.caseId);
  if (!item) throw new Error(`Gold v2 proposal references unknown case ${spec.caseId}.`);
  const fact = item.expectedFacts.find((candidate) => candidate.id === spec.goldFactId);
  if (!fact) throw new Error(`Gold v2 proposal references unknown fact ${spec.caseId}/${spec.goldFactId}.`);
  for (const proposed of spec.newFacts) if (!item.inputs[proposed.source.inputIndex]?.includes(proposed.source.quote)) throw new Error(`Gold v2 proposed fact ${spec.caseId}/${proposed.id} has an invalid source quote.`);
  for (const proposedRelation of spec.relations) if (!item.inputs[proposedRelation.source.inputIndex]?.includes(proposedRelation.source.quote)) throw new Error(`Gold v2 proposed relation ${spec.caseId}/${proposedRelation.id} has an invalid source quote.`);
  return { ...spec, currentCategory: fact.category, currentText: fact.text };
}

export function buildGoldV2Proposal(corpus: EvalCorpus): GoldV2Proposal {
  const changes = SPECS.map((spec) => validateProposalChange(corpus, spec));
  const proposedKeys = new Set(changes.map((change) => `${change.caseId}\u0000${change.goldFactId}`));
  const uncoveredFindings = auditGoldCorpus(corpus).findings.filter((finding) => !proposedKeys.has(`${finding.caseId}\u0000${finding.goldFactId}`));
  if (uncoveredFindings.length) throw new Error(`Gold v2 proposal does not cover current audit findings: ${uncoveredFindings.map((finding) => `${finding.caseId}/${finding.goldFactId}`).join(", ")}`);
  return {
    kind: "f1-gold-v2-proposal", sourceCorpusVersion: corpus.version, targetCorpusVersion: 2,
    summary: {
      total: changes.length,
      byConfidence: {
        mechanical: changes.filter((change) => change.confidence === "mechanical").length,
        high: changes.filter((change) => change.confidence === "high").length,
        "human-review-required": changes.filter((change) => change.confidence === "human-review-required").length,
      },
    },
    policy: [
      "canonicalText is the primary atomic scoring target; supported relational text may remain as surface text.",
      "Helps facts are intrinsically relational and should be backed by explicit condition_effect projections.",
      "Někdy/jindy and sometimes/other-times branches do not automatically create course facts.",
      "Explicit občas, častěji, několikrát, denně, strong intensity, and duration normally produce course facts.",
    ],
    changes,
  };
}

export function renderGoldV2ProposalMarkdown(proposal: GoldV2Proposal) {
  const lines = ["# F1 Gold Contract v2 proposal", "", `Source corpus: v${proposal.sourceCorpusVersion}; target: v${proposal.targetCorpusVersion}.`, `Changes: ${proposal.summary.total} (mechanical ${proposal.summary.byConfidence.mechanical}, high ${proposal.summary.byConfidence.high}, human review ${proposal.summary.byConfidence["human-review-required"]}).`, "", "## Policy", "", ...proposal.policy.map((entry) => `- ${entry}`), "", "## Changes", ""];
  for (const change of proposal.changes) lines.push(
    `### ${change.caseId} / ${change.goldFactId}`,
    "",
    `- Current category: ${change.currentCategory}`,
    `- Current text: ${change.currentText}`,
    `- Proposed canonicalText: ${change.proposedCanonicalText}`,
    `- Text stays unchanged: ${change.textStaysUnchanged}`,
    `- New facts: ${change.newFacts.length ? change.newFacts.map((fact) => `${fact.id} (${fact.category}): ${fact.canonicalText}`).join("; ") : "none"}`,
    `- Relations: ${change.relations.length ? change.relations.map((item) => `${item.id} (${item.type})`).join("; ") : "none"}`,
    `- Helps projections: ${change.helpsProjections.length ? change.helpsProjections.join(", ") : "none"}`,
    `- Reason: ${change.reason}`,
    `- Confidence: ${change.confidence}`,
    "",
  );
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
