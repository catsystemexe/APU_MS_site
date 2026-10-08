import { readFile } from "node:fs/promises";
import { callOpenAIResponses, createRequestUsageCollector } from "../../../app/openai-responses-instrumentation.ts";
import {
  EXTRACTION_SCHEMA,
  GROUNDING_SCHEMA,
  buildExtractionInstructions,
  buildGroundingInstructions,
  extractResponseText,
  normalizeExtractionCandidates,
  type ExtractionCandidate,
  type ExtractionNotebookInput,
  type GroundingVerdict,
  type RawExtraction,
} from "../../../app/f1-extraction-contract.ts";
import type { ModelUsageRecord, UsageOperation } from "../../../app/usage-ledger.ts";
import type { SupportedModelId } from "../../../app/model-config.ts";
import type { EvalCase, ModelProfile, PipelineId, ReasoningEffort } from "./eval-contract.ts";
import type { CaseScore, EvaluatedCandidate, SemanticJudgeDecision } from "./scoring.ts";

const intakeCorePromise = readFile(new URL("../../../apu-core/v1.6/02_OBSERVATION_AND_INTAKE.md", import.meta.url), "utf8");

export const COVERAGE_INSTRUCTIONS = `Jsi testovací kontrola pokrytí explicitních faktů pro F1 Zápisník APU.
Porovnej pouze newUserMessage s alreadyExtractedCandidates a currentNotebook.
Vrať výhradně explicitní atomické fakty z nové zprávy, které nejsou významově zastoupené v alreadyExtractedCandidates.
Nevylepšuj formulace, nedoplňuj příčiny, diagnózy, potřeby dítěte ani doporučení.
Každý sourceQuote musí být přesný souvislý podřetězec newUserMessage.
Použij stejné kategorie, pravidla duplicate/conflict a zachování nejistoty jako produkční extrakce.
Pokud nic nechybí, vrať prázdné candidates.`;

export const COVERAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["candidates"],
  properties: { candidates: EXTRACTION_SCHEMA.properties.candidates },
} as const;

const SEMANTIC_JUDGE_INSTRUCTIONS = `Jsi izolovaný sekundární hodnotitel pro eval F1 extrakce.
Nehodnotíš správnost gold dat a nesmíš je přepisovat ani vytvářet nové gold fakty.
U každého alignment posuď, zda uvedená skupina candidates společně významově pokrývá goldFact bez přidání významu. Jedna skupina může obsahovat fragmenty jednoho faktu; jeden candidate může být posouzen vůči více gold faktům.
U každého unmatched candidate posuď, zda jde o explicitní, zdrojově doložený fakt navíc (grounded_extra), nebo o nepodložený význam (unsupported).
Při pochybnosti vrať uncertain. Kategorie, action, nejistota a negace musí zůstat zachovány. Nikdy nepřekrývej neplatný sourceQuote ani explicitní forbidden inference.`;

const SEMANTIC_JUDGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["decisions"],
  properties: {
    decisions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "goldFactId", "candidateIndexes", "decision", "reason"],
        properties: {
          kind: { type: "string", enum: ["alignment", "candidate"] },
          goldFactId: { type: ["string", "null"] },
          candidateIndexes: { type: "array", items: { type: "integer", minimum: 0 } },
          decision: { type: "string", enum: ["equivalent", "not_equivalent", "grounded_extra", "unsupported", "uncertain"] },
          reason: { type: "string" },
        },
      },
    },
  },
} as const;

export type ProviderCall<T> = {
  stage: "extraction" | "coverage" | "grounding" | "judge";
  model: SupportedModelId;
  reasoning: ReasoningEffort;
  instructions: string;
  input: Record<string, unknown>;
  schema: Record<string, unknown>;
  formatName: string;
  maxOutputTokens: number;
  parse: (value: unknown) => T;
};

export type ProviderCallResult<T> = { value: T; latencyMs: number; usage: ModelUsageRecord | null };
export type EvalProvider = { call<T>(input: ProviderCall<T>): Promise<ProviderCallResult<T>> };

function parseObject(value: unknown, label: string) {
  if (!value || typeof value !== "object") throw new Error(`${label} is not an object`);
  return value as Record<string, unknown>;
}

function parseRawExtraction(value: unknown) {
  const object = parseObject(value, "extraction");
  if (!Array.isArray(object.candidates) || !object.categoryReview || typeof object.situationRelation !== "string") throw new Error("invalid extraction result");
  return object as RawExtraction;
}

function parseCandidates(value: unknown) {
  const object = parseObject(value, "candidate result");
  if (!Array.isArray(object.candidates)) throw new Error("invalid candidates result");
  return object as { candidates: ExtractionCandidate[] };
}

function parseVerdicts(value: unknown) {
  const object = parseObject(value, "grounding result");
  if (!Array.isArray(object.verdicts)) throw new Error("invalid grounding result");
  return object as { verdicts: GroundingVerdict[] };
}

function usageOperation(stage: ProviderCall<unknown>["stage"]): UsageOperation {
  return stage === "grounding" || stage === "judge" ? "grounding" : "extraction";
}

export function createOpenAIProvider(apiKey: string, requestPrefix: string): EvalProvider {
  return {
    async call<T>(input: ProviderCall<T>) {
      const collector = createRequestUsageCollector();
      const started = performance.now();
      const result = await callOpenAIResponses<T>({
        api_key: apiKey,
        request_id: `${requestPrefix}-${input.stage}-${crypto.randomUUID()}`,
        phase: "F1",
        operation: usageOperation(input.stage),
        requested_model: input.model,
        reasoning_effort: input.reasoning,
        requested_service_tier: "default",
        collector,
        payload: {
          model: input.model,
          reasoning: { effort: input.reasoning },
          instructions: input.instructions,
          input: JSON.stringify(input.input),
          text: { format: { type: "json_schema", name: input.formatName, strict: true, schema: input.schema } },
          max_output_tokens: input.maxOutputTokens,
          service_tier: "default",
          store: false,
        },
        validate_application_response: (body) => {
          const text = extractResponseText(body); if (!text) throw new Error("missing structured output");
          return input.parse(JSON.parse(text));
        },
      });
      if (result.usage_record.provider_status !== "completed" || !result.application_result) throw new Error(`${input.stage} provider call failed`);
      return { value: result.application_result, latencyMs: Math.round(performance.now() - started), usage: result.usage_record };
    },
  };
}

type PipelineRun = {
  candidates: EvaluatedCandidate[];
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number | null;
  calls: Array<{ stage: string; model: string; reasoning: string; latencyMs: number; usage: ModelUsageRecord | null }>;
};

function candidateKey(candidate: ExtractionCandidate) {
  return `${candidate.category}\u0000${candidate.sourceQuote}\u0000${candidate.notebookText}\u0000${candidate.action}\u0000${candidate.relatedEntryId ?? ""}`;
}

function mergeCandidates(primary: ExtractionCandidate[], recovered: ExtractionCandidate[]) {
  const seen = new Set(primary.map(candidateKey));
  return [...primary, ...recovered.filter((candidate) => !seen.has(candidateKey(candidate)))];
}

function recordUsage(calls: PipelineRun["calls"]) {
  const records = calls.map((call) => call.usage).filter((record): record is ModelUsageRecord => record !== null);
  const costs = records.map((record) => record.pricing_snapshot.estimated_cost_usd);
  return {
    latencyMs: calls.reduce((sum, call) => sum + call.latencyMs, 0),
    inputTokens: records.reduce((sum, record) => sum + (record.usage.input_tokens ?? 0), 0),
    outputTokens: records.reduce((sum, record) => sum + (record.usage.output_tokens ?? 0), 0),
    estimatedCostUsd: costs.every((cost): cost is number => cost !== null) ? costs.reduce((sum, cost) => sum + cost, 0) : null,
  };
}

export async function runExtractionPipeline(item: EvalCase, profile: ModelProfile, pipeline: PipelineId, provider: EvalProvider): Promise<PipelineRun> {
  const intakeCore = await intakeCorePromise;
  const extractionInstructions = buildExtractionInstructions(intakeCore);
  const groundingInstructions = buildGroundingInstructions(intakeCore);
  const notebook: ExtractionNotebookInput[] = structuredClone(item.startingNotebook);
  const allCandidates: EvaluatedCandidate[] = [];
  const calls: PipelineRun["calls"] = [];
  for (const [inputIndex, message] of item.inputs.entries()) {
    const extraction = await provider.call({
      stage: "extraction", model: profile.extractionModel, reasoning: profile.extractionReasoning,
      instructions: extractionInstructions, input: { currentNotebook: notebook, newUserMessage: message },
      schema: EXTRACTION_SCHEMA, formatName: "apu_f1_eval_extraction", maxOutputTokens: 2_000, parse: parseRawExtraction,
    });
    calls.push({ stage: "extraction", model: profile.extractionModel, reasoning: profile.extractionReasoning, latencyMs: extraction.latencyMs, usage: extraction.usage });
    let candidates = normalizeExtractionCandidates(message, notebook, extraction.value.candidates);
    if (pipeline === "coverage") {
      const coverage = await provider.call({
        stage: "coverage", model: profile.extractionModel, reasoning: profile.extractionReasoning,
        instructions: COVERAGE_INSTRUCTIONS,
        input: { currentNotebook: notebook, newUserMessage: message, alreadyExtractedCandidates: candidates },
        schema: COVERAGE_SCHEMA, formatName: "apu_f1_eval_coverage", maxOutputTokens: 1_500, parse: parseCandidates,
      });
      calls.push({ stage: "coverage", model: profile.extractionModel, reasoning: profile.extractionReasoning, latencyMs: coverage.latencyMs, usage: coverage.usage });
      candidates = normalizeExtractionCandidates(message, notebook, mergeCandidates(candidates, coverage.value.candidates));
    }
    const requiringGrounding = candidates.filter((candidate) => candidate.action === "add" || candidate.action === "conflict");
    let accepted = new Set<number>();
    if (requiringGrounding.length) {
      const grounding = await provider.call({
        stage: "grounding", model: profile.groundingModel, reasoning: profile.groundingReasoning,
        instructions: groundingInstructions,
        input: { currentNotebook: notebook, newUserMessage: message, candidates: requiringGrounding.map((candidate, index) => ({ index, ...candidate })) },
        schema: GROUNDING_SCHEMA, formatName: "apu_f1_eval_grounding", maxOutputTokens: 1_200, parse: parseVerdicts,
      });
      calls.push({ stage: "grounding", model: profile.groundingModel, reasoning: profile.groundingReasoning, latencyMs: grounding.latencyMs, usage: grounding.usage });
      accepted = new Set(grounding.value.verdicts.filter((verdict) => verdict.accepted && Number.isInteger(verdict.index) && verdict.index >= 0 && verdict.index < requiringGrounding.length).map((verdict) => verdict.index));
    }
    const acceptedKeys = new Set([...accepted].map((index) => requiringGrounding[index]).filter(Boolean).map(candidateKey));
    const finalCandidates = candidates.filter((candidate) => candidate.action === "duplicate" || candidate.action === "skip" || acceptedKeys.has(candidateKey(candidate)));
    allCandidates.push(...finalCandidates.map((candidate) => ({ ...candidate, inputIndex })));
    for (const candidate of finalCandidates) if (candidate.action === "add") notebook.push({
      id: `eval-${item.id}-${inputIndex}-${notebook.length}`, category: candidate.category, text: candidate.notebookText, trust: "unconfirmed",
    });
  }
  return { candidates: allCandidates, calls, ...recordUsage(calls) };
}

export async function runSemanticJudge(item: EvalCase, score: CaseScore, candidates: EvaluatedCandidate[], model: SupportedModelId, provider: EvalProvider) {
  const reviewAlignments = score.matches.filter((match) => match.state === "REVIEW" && match.candidateIndexes.length).map((match) => ({
    goldFact: item.expectedFacts.find((fact) => fact.id === match.goldFactId),
    candidates: match.candidateIndexes.map((candidateIndex) => ({ candidateIndex, candidate: candidates[candidateIndex] })),
  }));
  const unmatchedCandidates = score.candidateClassifications.filter((entry) => entry.state === "REVIEW").map((entry) => ({
    candidateIndex: entry.candidateIndex,
    candidate: candidates[entry.candidateIndex],
  }));
  if (!reviewAlignments.length && !unmatchedCandidates.length) return { decisions: [] as SemanticJudgeDecision[], usage: null as ModelUsageRecord | null, latencyMs: 0 };
  const judged = await provider.call({
    stage: "judge", model, reasoning: "low", instructions: SEMANTIC_JUDGE_INSTRUCTIONS,
    input: { messageInputs: item.inputs, reviewAlignments, unmatchedCandidates }, schema: SEMANTIC_JUDGE_SCHEMA,
    formatName: "apu_f1_eval_semantic_judge", maxOutputTokens: 1_200,
    parse(value) {
      const object = parseObject(value, "semantic judge result");
      if (!Array.isArray(object.decisions)) throw new Error("invalid semantic judge decisions");
      return object as { decisions: SemanticJudgeDecision[] };
    },
  });
  return { decisions: judged.value.decisions, usage: judged.usage, latencyMs: judged.latencyMs };
}
