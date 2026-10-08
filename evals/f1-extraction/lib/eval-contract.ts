import { readFile } from "node:fs/promises";
import { CATEGORY_IDS, type CategoryId } from "../../../app/notepad-model.ts";
import { isSupportedModel, type SupportedModelId } from "../../../app/model-config.ts";
import { PRODUCTION_EXTRACTION_MODEL, PRODUCTION_EXTRACTION_REASONING, validateExtractionNotebook, type ExtractionCandidate, type ExtractionNotebookInput } from "../../../app/f1-extraction-contract.ts";

export const EVAL_SUITES = ["atomic", "mixed", "dense", "real"] as const;
export type EvalSuite = typeof EVAL_SUITES[number];
export const PIPELINE_IDS = ["baseline", "coverage"] as const;
export type PipelineId = typeof PIPELINE_IDS[number];
export type ReasoningEffort = "low" | "medium";
export type MatchState = "AUTO_PASS" | "AUTO_FAIL" | "REVIEW";

export type GoldFact = {
  id: string;
  category: CategoryId;
  text: string;
  source: { inputIndex: number; quote: string };
  uncertain: boolean;
  negated: boolean;
  requiredMarkers: string[];
  expectedAction: ExtractionCandidate["action"];
  relatedEntryId: string | null;
};

export type ForbiddenInference = { text: string; category: CategoryId | null };

export type EvalCase = {
  id: string;
  suite: EvalSuite;
  description: string;
  inputs: string[];
  startingNotebook: ExtractionNotebookInput[];
  expectedFacts: GoldFact[];
  forbiddenInferences: ForbiddenInference[];
  tags: string[];
  dimensions: {
    factCount: number;
    categoryCount: number;
    linguistic: Array<"simple" | "compound" | "contrast" | "conditional" | "negation" | "uncertainty" | "coreference">;
  };
};

export type EvalCorpus = { version: 1; cases: EvalCase[] };

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
  if (!value || typeof value !== "object" || (value as { version?: unknown }).version !== 1 || !Array.isArray((value as { cases?: unknown }).cases)) {
    return { corpus: null, errors: ["corpus must be a version 1 object with a cases array"] };
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
      if (factIds.has(fact.id)) errors.push(`${factLabel}.id is duplicated`);
      factIds.add(fact.id);
      if (!CATEGORY_IDS.includes(fact.category)) errors.push(`${factLabel}.category is invalid`);
      assertString(fact.text, `${factLabel}.text`, errors);
      if (!fact.source || !Number.isInteger(fact.source.inputIndex) || typeof fact.source.quote !== "string") errors.push(`${factLabel}.source is invalid`);
      else if (!item.inputs?.[fact.source.inputIndex]?.includes(fact.source.quote)) errors.push(`${factLabel}.source quote is not present in input ${fact.source.inputIndex}`);
      if (typeof fact.uncertain !== "boolean" || typeof fact.negated !== "boolean") errors.push(`${factLabel} markers must be boolean`);
      if (!Array.isArray(fact.requiredMarkers) || fact.requiredMarkers.some((marker) => typeof marker !== "string" || !marker)) errors.push(`${factLabel}.requiredMarkers is invalid`);
      if (!["add", "duplicate", "conflict", "skip"].includes(fact.expectedAction)) errors.push(`${factLabel}.expectedAction is invalid`);
      if (fact.relatedEntryId !== null && typeof fact.relatedEntryId !== "string") errors.push(`${factLabel}.relatedEntryId is invalid`);
    }
    if (!Array.isArray(item.forbiddenInferences) || item.forbiddenInferences.some((forbidden) => !forbidden || typeof forbidden.text !== "string" || (forbidden.category !== null && !CATEGORY_IDS.includes(forbidden.category)))) errors.push(`${label}.forbiddenInferences is invalid`);
    if (!Array.isArray(item.tags) || item.tags.some((tag) => typeof tag !== "string" || !tag)) errors.push(`${label}.tags is invalid`);
    const categories = new Set(item.expectedFacts.map((fact) => fact.category));
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
