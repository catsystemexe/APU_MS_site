import { readFile } from "node:fs/promises";
import { CATEGORY_IDS, type CategoryId } from "../../../app/notepad-model.ts";
import { isSupportedModel, type SupportedModelId } from "../../../app/model-config.ts";
import { PRODUCTION_EXTRACTION_MODEL, PRODUCTION_EXTRACTION_REASONING, validateExtractionNotebook, type ExtractionCandidate, type ExtractionNotebookInput } from "../../../app/f1-extraction-contract.ts";

export const EVAL_SUITES = ["atomic", "mixed", "dense", "real"] as const;
export type EvalSuite = typeof EVAL_SUITES[number];
export const PIPELINE_IDS = ["baseline", "coverage"] as const;
export type PipelineId = typeof PIPELINE_IDS[number];
export type ReasoningEffort = "low" | "medium";
export type MatchState = "EXACT" | "SEMANTIC_EQUIVALENT" | "MISS" | "REVIEW";

export type GoldFact = {
  id: string;
  category: CategoryId;
  text: string;
  canonicalText?: string;
  source: { inputIndex: number; quote: string };
  uncertain: boolean;
  negated: boolean;
  requiredMarkers: string[];
  expectedAction: ExtractionCandidate["action"];
  relatedEntryId: string | null;
};

export const RELATION_TYPES = ["context_of", "course_of", "condition_effect", "contrast_with"] as const;
export type RelationType = typeof RELATION_TYPES[number];

export type ExpectedRelation = {
  id: string;
  type: RelationType;
  sourceFactIds: string[];
  targetFactIds: string[];
  projectionFactIds: string[];
  source: { inputIndex: number; quote: string };
};

export type ForbiddenInference = { text: string; category: CategoryId | null };

export type EvalCase = {
  id: string;
  suite: EvalSuite;
  description: string;
  inputs: string[];
  startingNotebook: ExtractionNotebookInput[];
  expectedFacts: GoldFact[];
  expectedRelations?: ExpectedRelation[];
  forbiddenInferences: ForbiddenInference[];
  tags: string[];
  dimensions: {
    factCount: number;
    categoryCount: number;
    linguistic: Array<"simple" | "compound" | "contrast" | "conditional" | "negation" | "uncertainty" | "coreference">;
  };
};

export type EvalCorpus = { version: 1 | 2; cases: EvalCase[] };

export function goldCanonicalText(fact: GoldFact) {
  return fact.canonicalText ?? fact.text;
}

export type ModelProfile = {
  id: string;
  extractionModel: SupportedModelId;
  extractionReasoning: ReasoningEffort;
  groundingModel: SupportedModelId;
  groundingReasoning: ReasoningEffort;
  description: string;
};

export const MODEL_PROFILES = {
  baseline: {
    id: "baseline", extractionModel: PRODUCTION_EXTRACTION_MODEL, extractionReasoning: PRODUCTION_EXTRACTION_REASONING,
    groundingModel: PRODUCTION_EXTRACTION_MODEL, groundingReasoning: PRODUCTION_EXTRACTION_REASONING,
    description: "Production baseline: Luna/low extraction and Luna/low grounding.",
  },
  "terra-extract": {
    id: "terra-extract", extractionModel: "gpt-5.6-terra", extractionReasoning: "low",
    groundingModel: "gpt-5.6-luna", groundingReasoning: "low",
    description: "Terra/low extraction with baseline grounding.",
  },
  "terra-both": {
    id: "terra-both", extractionModel: "gpt-5.6-terra", extractionReasoning: "low",
    groundingModel: "gpt-5.6-terra", groundingReasoning: "low",
    description: "Terra/low extraction and grounding.",
  },
  "terra-medium": {
    id: "terra-medium", extractionModel: "gpt-5.6-terra", extractionReasoning: "medium",
    groundingModel: "gpt-5.6-luna", groundingReasoning: "low",
    description: "Terra/medium extraction with baseline grounding.",
  },
  "sol-reference": {
    id: "sol-reference", extractionModel: "gpt-5.6-sol", extractionReasoning: "medium",
    groundingModel: "gpt-5.6-luna", groundingReasoning: "low",
    description: "Optional Sol reference ceiling; not a default production candidate.",
  },
} as const satisfies Record<string, ModelProfile>;

export type ModelProfileId = keyof typeof MODEL_PROFILES;

export type EvalCliOptions = {
  corpusPath: string;
  rescorePath: string | null;
  resumePath: string | null;
  resumeRescorePath: string | null;
  suites: EvalSuite[];
  caseIds: string[];
  profiles: ModelProfileId[];
  pipelines: PipelineId[];
  repetitions: number;
  runId: string;
  outputDir: string;
  maxCalls: number | null;
  dryRun: boolean;
  judgeModel: SupportedModelId | null;
  overrides: {
    extractionModel: SupportedModelId | null;
    extractionReasoning: ReasoningEffort | null;
    groundingModel: SupportedModelId | null;
    groundingReasoning: ReasoningEffort | null;
  };
  help: boolean;
};

function assertString(value: unknown, label: string, errors: string[]) {
  if (typeof value !== "string" || !value.trim()) errors.push(`${label} must be a non-empty string`);
}

export function validateCorpus(value: unknown, allowEmptyRealSuite = true): { corpus: EvalCorpus | null; errors: string[] } {
  const errors: string[] = [];
  const version = value && typeof value === "object" ? (value as { version?: unknown }).version : null;
  if (!value || typeof value !== "object" || (version !== 1 && version !== 2) || !Array.isArray((value as { cases?: unknown }).cases)) {
    return { corpus: null, errors: ["corpus must be a version 1 or 2 object with a cases array"] };
  }
  const cases = (value as { cases: unknown[] }).cases;
  const seenCases = new Set<string>();
  for (const [caseIndex, raw] of cases.entries()) {
    const label = `cases[${caseIndex}]`;
    if (!raw || typeof raw !== "object") { errors.push(`${label} must be an object`); continue; }
    const item = raw as Partial<EvalCase>;
    assertString(item.id, `${label}.id`, errors);
    if (typeof item.id === "string") {
      if (seenCases.has(item.id)) errors.push(`${label}.id is duplicated: ${item.id}`);
      seenCases.add(item.id);
    }
    if (!EVAL_SUITES.includes(item.suite as EvalSuite)) errors.push(`${label}.suite is invalid`);
    assertString(item.description, `${label}.description`, errors);
    if (!Array.isArray(item.inputs) || (!item.inputs.length && !(allowEmptyRealSuite && item.suite === "real")) || item.inputs.some((input) => typeof input !== "string" || !input.trim())) errors.push(`${label}.inputs is invalid`);
    if (!validateExtractionNotebook(item.startingNotebook)) errors.push(`${label}.startingNotebook is invalid`);
    if (!Array.isArray(item.expectedFacts)) { errors.push(`${label}.expectedFacts must be an array`); continue; }
    const factIds = new Set<string>();
    for (const [factIndex, fact] of item.expectedFacts.entries()) {
      const factLabel = `${label}.expectedFacts[${factIndex}]`;
      if (!fact || typeof fact !== "object") { errors.push(`${factLabel} must be an object`); continue; }
      assertString(fact.id, `${factLabel}.id`, errors);
      if (typeof fact.id === "string") {
        if (factIds.has(fact.id)) errors.push(`${factLabel}.id is duplicated`);
        factIds.add(fact.id);
      }
      if (!CATEGORY_IDS.includes(fact.category)) errors.push(`${factLabel}.category is invalid`);
      assertString(fact.text, `${factLabel}.text`, errors);
      if (version === 2) assertString(fact.canonicalText, `${factLabel}.canonicalText`, errors);
      else if (fact.canonicalText !== undefined) assertString(fact.canonicalText, `${factLabel}.canonicalText`, errors);
      if (!fact.source || !Number.isInteger(fact.source.inputIndex) || typeof fact.source.quote !== "string" || !fact.source.quote) errors.push(`${factLabel}.source is invalid`);
      else if (!item.inputs?.[fact.source.inputIndex]?.includes(fact.source.quote)) errors.push(`${factLabel}.source quote is not present in input ${fact.source.inputIndex}`);
      if (typeof fact.uncertain !== "boolean" || typeof fact.negated !== "boolean") errors.push(`${factLabel} markers must be boolean`);
      if (!Array.isArray(fact.requiredMarkers) || fact.requiredMarkers.some((marker) => typeof marker !== "string" || !marker)) errors.push(`${factLabel}.requiredMarkers is invalid`);
      if (!["add", "duplicate", "conflict", "skip"].includes(fact.expectedAction)) errors.push(`${factLabel}.expectedAction is invalid`);
      if (fact.relatedEntryId !== null && typeof fact.relatedEntryId !== "string") errors.push(`${factLabel}.relatedEntryId is invalid`);
    }
    if (version === 2 && !Array.isArray(item.expectedRelations)) errors.push(`${label}.expectedRelations must be an array for corpus version 2`);
    if (item.expectedRelations !== undefined && !Array.isArray(item.expectedRelations)) errors.push(`${label}.expectedRelations must be an array`);
    if (Array.isArray(item.expectedRelations)) {
      const relationIds = new Set<string>();
      const factsById = new Map(item.expectedFacts.filter((fact): fact is GoldFact => Boolean(fact) && typeof fact === "object" && typeof fact.id === "string").map((fact) => [fact.id, fact]));
      for (const [relationIndex, relation] of item.expectedRelations.entries()) {
        const relationLabel = `${label}.expectedRelations[${relationIndex}]`;
        if (!relation || typeof relation !== "object") { errors.push(`${relationLabel} must be an object`); continue; }
        assertString(relation.id, `${relationLabel}.id`, errors);
        if (relationIds.has(relation.id)) errors.push(`${relationLabel}.id is duplicated`);
        if (factIds.has(relation.id)) errors.push(`${relationLabel}.id duplicates a fact id`);
        relationIds.add(relation.id);
        if (!RELATION_TYPES.includes(relation.type)) errors.push(`${relationLabel}.type is invalid`);
        for (const field of ["sourceFactIds", "targetFactIds", "projectionFactIds"] as const) {
          const ids = relation[field];
          if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || !id)) {
            errors.push(`${relationLabel}.${field} is invalid`);
            continue;
          }
          if (new Set(ids).size !== ids.length) errors.push(`${relationLabel}.${field} contains duplicate fact ids`);
          for (const id of ids) if (!factsById.has(id)) errors.push(`${relationLabel}.${field} references unknown fact: ${id}`);
        }
        if (!relation.sourceFactIds?.length) errors.push(`${relationLabel}.sourceFactIds must not be empty`);
        if (!relation.targetFactIds?.length) errors.push(`${relationLabel}.targetFactIds must not be empty`);
        if (!relation.source || !Number.isInteger(relation.source.inputIndex) || typeof relation.source.quote !== "string" || !relation.source.quote) {
          errors.push(`${relationLabel}.source is invalid`);
        } else if (!item.inputs?.[relation.source.inputIndex]?.includes(relation.source.quote)) {
          errors.push(`${relationLabel}.source quote is not present in input ${relation.source.inputIndex}`);
        }
        const referencedIds = [...(relation.sourceFactIds ?? []), ...(relation.targetFactIds ?? []), ...(relation.projectionFactIds ?? [])];
        if (relation.source && Number.isInteger(relation.source.inputIndex)) {
          for (const id of referencedIds) {
            const fact = factsById.get(id);
            if (fact && fact.source.inputIndex !== relation.source.inputIndex) errors.push(`${relationLabel} references fact ${id} from a different input turn`);
          }
        }
        const sourceFacts = (relation.sourceFactIds ?? []).map((id) => factsById.get(id)).filter((fact): fact is GoldFact => Boolean(fact));
        const projectionFacts = (relation.projectionFactIds ?? []).map((id) => factsById.get(id)).filter((fact): fact is GoldFact => Boolean(fact));
        if (relation.type === "context_of" && sourceFacts.some((fact) => fact.category !== "context")) errors.push(`${relationLabel}.sourceFactIds must all reference context facts`);
        if (relation.type === "course_of" && sourceFacts.some((fact) => fact.category !== "course")) errors.push(`${relationLabel}.sourceFactIds must all reference course facts`);
        if (relation.type === "condition_effect" && projectionFacts.some((fact) => fact.category !== "helps")) errors.push(`${relationLabel}.projectionFactIds must all reference helps facts`);
        if (relation.type === "contrast_with" && relation.sourceFactIds?.some((id) => relation.targetFactIds?.includes(id))) errors.push(`${relationLabel}.sourceFactIds and targetFactIds must be disjoint`);
      }
    }
    if (!Array.isArray(item.forbiddenInferences) || item.forbiddenInferences.some((forbidden) => !forbidden || typeof forbidden.text !== "string" || (forbidden.category !== null && !CATEGORY_IDS.includes(forbidden.category)))) errors.push(`${label}.forbiddenInferences is invalid`);
    if (!Array.isArray(item.tags) || item.tags.some((tag) => typeof tag !== "string" || !tag)) errors.push(`${label}.tags is invalid`);
    const categories = new Set(item.expectedFacts.filter((fact) => fact && typeof fact === "object").map((fact) => fact.category));
    if (!item.dimensions || item.dimensions.factCount !== item.expectedFacts.length || item.dimensions.categoryCount !== categories.size) errors.push(`${label}.dimensions do not match gold facts`);
    const allowedLinguistic = ["simple", "compound", "contrast", "conditional", "negation", "uncertainty", "coreference"];
    if (!Array.isArray(item.dimensions?.linguistic) || item.dimensions.linguistic.some((tag) => !allowedLinguistic.includes(tag))) errors.push(`${label}.dimensions.linguistic is invalid`);
  }
  return { corpus: errors.length ? null : value as EvalCorpus, errors };
}

export async function loadCorpus(path: string) {
  const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
  const result = validateCorpus(parsed);
  if (!result.corpus) throw new Error(`Invalid F1 extraction corpus:\n${result.errors.join("\n")}`);
  return result.corpus;
}

function values(value: string | undefined) {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
}

function requiredValue(argv: string[], index: number, flag: string) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

export function parseCliArgs(argv: string[], cwd = process.cwd()): EvalCliOptions {
  const defaults: EvalCliOptions = {
    corpusPath: `${cwd}/evals/f1-extraction/fixtures/corpus.json`,
    rescorePath: null, resumePath: null, resumeRescorePath: null,
    suites: ["atomic", "mixed", "dense"], caseIds: [], profiles: ["baseline"], pipelines: ["baseline"],
    repetitions: 1, runId: `f1-extraction-${new Date().toISOString().replace(/[:.]/g, "-")}`,
    outputDir: `${cwd}/evals/f1-extraction/results`, maxCalls: null, dryRun: false, judgeModel: null,
    overrides: { extractionModel: null, extractionReasoning: null, groundingModel: null, groundingReasoning: null }, help: false,
  };
  const options = { ...defaults };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--dry-run") { options.dryRun = true; continue; }
    if (flag === "--help" || flag === "-h") { options.help = true; continue; }
    const value = requiredValue(argv, index, flag); index += 1;
    if (flag === "--corpus") options.corpusPath = value;
    else if (flag === "--rescore") options.rescorePath = value;
    else if (flag === "--resume") options.resumePath = value;
    else if (flag === "--resume-rescore") options.resumeRescorePath = value;
    else if (flag === "--suite") options.suites = values(value) as EvalSuite[];
    else if (flag === "--case") options.caseIds = values(value);
    else if (flag === "--profiles") options.profiles = values(value) as ModelProfileId[];
    else if (flag === "--pipelines") options.pipelines = values(value) as PipelineId[];
    else if (flag === "--repetitions") options.repetitions = Number(value);
    else if (flag === "--run-id") options.runId = value;
    else if (flag === "--output-dir") options.outputDir = value;
    else if (flag === "--max-calls") options.maxCalls = Number(value);
    else if (flag === "--judge-model") options.judgeModel = value === "none" ? null : value as SupportedModelId;
    else if (flag === "--extraction-model") options.overrides.extractionModel = value as SupportedModelId;
    else if (flag === "--extraction-reasoning") options.overrides.extractionReasoning = value as ReasoningEffort;
    else if (flag === "--grounding-model") options.overrides.groundingModel = value as SupportedModelId;
    else if (flag === "--grounding-reasoning") options.overrides.groundingReasoning = value as ReasoningEffort;
    else throw new Error(`Unknown option: ${flag}`);
  }
  if (!options.suites.length || options.suites.some((suite) => !EVAL_SUITES.includes(suite))) throw new Error("--suite contains an unsupported suite");
  if (!options.profiles.length || options.profiles.some((profile) => !(profile in MODEL_PROFILES))) throw new Error("--profiles contains an unsupported profile");
  if (!options.pipelines.length || options.pipelines.some((pipeline) => !PIPELINE_IDS.includes(pipeline))) throw new Error("--pipelines contains an unsupported pipeline");
  if (!Number.isInteger(options.repetitions) || options.repetitions < 1 || options.repetitions > 20) throw new Error("--repetitions must be an integer from 1 to 20");
  if (options.maxCalls !== null && (!Number.isInteger(options.maxCalls) || options.maxCalls < 1)) throw new Error("--max-calls must be a positive integer");
  if (options.judgeModel !== null && !isSupportedModel(options.judgeModel)) throw new Error("--judge-model must be a current catalog model or none");
  if (options.overrides.extractionModel !== null && !isSupportedModel(options.overrides.extractionModel)) throw new Error("--extraction-model must be a current catalog model");
  if (options.overrides.groundingModel !== null && !isSupportedModel(options.overrides.groundingModel)) throw new Error("--grounding-model must be a current catalog model");
  if (options.overrides.extractionReasoning !== null && !["low", "medium"].includes(options.overrides.extractionReasoning)) throw new Error("--extraction-reasoning must be low or medium");
  if (options.overrides.groundingReasoning !== null && !["low", "medium"].includes(options.overrides.groundingReasoning)) throw new Error("--grounding-reasoning must be low or medium");
  if (options.rescorePath !== null && options.dryRun) throw new Error("--rescore cannot be combined with --dry-run");
  if (options.resumePath !== null && options.rescorePath !== null) throw new Error("--resume cannot be combined with --rescore");
  if (options.resumePath !== null && options.dryRun) throw new Error("--resume cannot be combined with --dry-run");
  if (options.resumeRescorePath !== null && (options.rescorePath !== null || options.resumePath !== null || options.dryRun)) throw new Error("--resume-rescore cannot be combined with --rescore, --resume, or --dry-run");
  if (options.rescorePath !== null && !argv.includes("--run-id")) options.runId = `rescore-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  return options;
}

export function resolveProfile(profile: ModelProfile, overrides: EvalCliOptions["overrides"]): ModelProfile {
  return {
    ...profile,
    extractionModel: overrides.extractionModel ?? profile.extractionModel,
    extractionReasoning: overrides.extractionReasoning ?? profile.extractionReasoning,
    groundingModel: overrides.groundingModel ?? profile.groundingModel,
    groundingReasoning: overrides.groundingReasoning ?? profile.groundingReasoning,
  };
}

export function selectCases(corpus: EvalCorpus, options: Pick<EvalCliOptions, "suites" | "caseIds">) {
  const selected = corpus.cases.filter((item) => options.suites.includes(item.suite) && (!options.caseIds.length || options.caseIds.includes(item.id)));
  if (options.caseIds.length) {
    const missing = options.caseIds.filter((id) => !selected.some((item) => item.id === id));
    if (missing.length) throw new Error(`Unknown or excluded case ids: ${missing.join(", ")}`);
  }
  return selected;
}

export function estimateCallCount(cases: EvalCase[], options: Pick<EvalCliOptions, "profiles" | "pipelines" | "repetitions" | "judgeModel">) {
  const turns = cases.reduce((sum, item) => sum + item.inputs.length, 0);
  const pipelineCalls = options.pipelines.reduce((sum, pipeline) => sum + (pipeline === "coverage" ? 3 : 2), 0);
  const pipelineProviderCalls = turns * options.profiles.length * options.repetitions * pipelineCalls;
  const semanticJudgeCalls = options.judgeModel ? cases.length * options.profiles.length * options.pipelines.length * options.repetitions : 0;
  return { cases: cases.length, turns, repetitions: options.repetitions, configurations: options.profiles.length * options.pipelines.length, providerCalls: pipelineProviderCalls + semanticJudgeCalls, semanticJudgeCalls };
}
