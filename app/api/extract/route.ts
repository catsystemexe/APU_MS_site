import { estimateCostUsd } from "../../model-config";
import { F2_PATHS, locateSourceQuote, type F2Path } from "../../notepad-model";
import { getAccessIdentity } from "../../access-auth";
import { callOpenAIResponses, createRequestUsageCollector, modelUsagePayload, usageErrorPayload, type RequestUsageCollector } from "../../openai-responses-instrumentation";
import {
  EXTRACTION_SCHEMA,
  GROUNDING_SCHEMA,
  GROUNDING_RESCUE_INSTRUCTIONS,
  GROUNDING_RESCUE_SCHEMA,
  MAX_EXTRACTION_MESSAGE_LENGTH,
  PRODUCTION_EXTRACTION_MODEL,
  PRODUCTION_EXTRACTION_REASONING,
  PRODUCTION_GROUNDING_RESCUE_MODEL,
  PRODUCTION_GROUNDING_RESCUE_REASONING,
  applyMonotonicGroundingRescue,
  buildExtractionInstructions,
  buildGroundingInstructions,
  extractResponseText,
  normalizeExtractionCandidates,
  validateGroundingRescueVerdicts,
  validateExtractionNotebook,
  type ExtractionCandidate,
  type ExtractionNotebookInput,
  type GroundingRescueVerdict,
  type RawExtraction,
} from "../../f1-extraction-contract";
import intakeCore from "../../../apu-core/v1.6/02_OBSERVATION_AND_INTAKE.md?raw";

export const runtime = "edge";

const EXTRACTION_INSTRUCTIONS = buildExtractionInstructions(intakeCore);
const GROUNDING_INSTRUCTIONS = buildGroundingInstructions(intakeCore);
const EXTRACTION_MODEL = PRODUCTION_EXTRACTION_MODEL;

type NotebookInput = ExtractionNotebookInput;
type RawCandidate = ExtractionCandidate;
type ProviderUsage = {
  input_tokens?: number;
  input_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
  output_tokens?: number;
  output_tokens_details?: { reasoning_tokens?: number };
  total_tokens?: number;
};

function aggregateUsage(...usages: Array<ProviderUsage | undefined>): ProviderUsage | undefined {
  const available = usages.filter((usage): usage is ProviderUsage => Boolean(usage));
  if (!available.length) return undefined;
  const sum = (values: Array<number | undefined>) => {
    const present = values.filter((value): value is number => typeof value === "number");
    return present.length ? present.reduce((total, value) => total + value, 0) : undefined;
  };
  const cachedTokens = sum(available.map((usage) => usage.input_tokens_details?.cached_tokens));
  const cacheWriteTokens = sum(available.map((usage) => usage.input_tokens_details?.cache_write_tokens));
  const reasoningTokens = sum(available.map((usage) => usage.output_tokens_details?.reasoning_tokens));
  return {
    input_tokens: sum(available.map((usage) => usage.input_tokens)),
    ...((cachedTokens !== undefined || cacheWriteTokens !== undefined) ? {
      input_tokens_details: { cached_tokens: cachedTokens, cache_write_tokens: cacheWriteTokens },
    } : {}),
    output_tokens: sum(available.map((usage) => usage.output_tokens)),
    ...(reasoningTokens !== undefined ? { output_tokens_details: { reasoning_tokens: reasoningTokens } } : {}),
    total_tokens: sum(available.map((usage) => usage.total_tokens)),
  };
}

function aggregateRecordedUsage(records: ReturnType<RequestUsageCollector["records"]>) {
  return aggregateUsage(...records.map((record) => ({
    input_tokens: record.usage.input_tokens ?? undefined,
    ...((record.usage.cached_input_tokens !== null || record.usage.cache_write_tokens !== null) ? {
      input_tokens_details: {
        cached_tokens: record.usage.cached_input_tokens ?? undefined,
        cache_write_tokens: record.usage.cache_write_tokens ?? undefined,
      },
    } : {}),
    output_tokens: record.usage.output_tokens ?? undefined,
    ...(record.usage.reasoning_tokens !== null ? {
      output_tokens_details: { reasoning_tokens: record.usage.reasoning_tokens },
    } : {}),
    total_tokens: record.usage.provider_total_tokens ?? undefined,
  })));
}

function jsonError(message: string, status = 500, collector?: RequestUsageCollector) {
  return Response.json(collector ? modelUsagePayload({ error: message }, collector) : { error: message }, { status });
}

async function verifyPrimaryGrounding(
  apiKey: string,
  requestId: string,
  message: string,
  notebook: NotebookInput[],
  candidates: RawCandidate[],
  collector: RequestUsageCollector,
) {
  if (!candidates.length) return { verdicts: null };

  try {
    const { usage_record, application_result } = await callOpenAIResponses({
      api_key: apiKey, request_id: requestId, phase: "F1", operation: "grounding", requested_model: EXTRACTION_MODEL, reasoning_effort: PRODUCTION_EXTRACTION_REASONING, requested_service_tier: "default", collector,
      payload: {
      model: EXTRACTION_MODEL,
      reasoning: { effort: PRODUCTION_EXTRACTION_REASONING },
      instructions: GROUNDING_INSTRUCTIONS,
      input: JSON.stringify({
        currentNotebook: notebook,
        newUserMessage: message,
        candidates: candidates.map((candidate, index) => ({ index, ...candidate })),
      }),
      text: {
        format: {
          type: "json_schema",
          name: "apu_notepad_grounding_verification",
          description: "Nezávislé ověření, že každý zápis je přímo podložen zprávou uživatele.",
          strict: true,
          schema: GROUNDING_SCHEMA,
        },
      },
      max_output_tokens: 1_200,
      service_tier: "default",
      store: false,
      },
      validate_application_response: (providerResponse) => {
        const text = extractResponseText(providerResponse); if (!text) throw new Error("missing structured output");
        return JSON.parse(text) as { verdicts?: unknown };
      },
    });
    if (usage_record.provider_status !== "completed" || !application_result || !Array.isArray(application_result.verdicts)) return { verdicts: null };
    return { verdicts: application_result.verdicts };
  } catch {
    return { verdicts: null };
  }
}

async function verifyGrounding(
  apiKey: string,
  requestId: string,
  message: string,
  notebook: NotebookInput[],
  candidates: RawCandidate[],
  collector: RequestUsageCollector,
) {
  if (!candidates.length) return { acceptedIndexes: new Set<number>() };
  const primary = await verifyPrimaryGrounding(apiKey, requestId, message, notebook, candidates, collector);
  const result = await applyMonotonicGroundingRescue(candidates, primary.verdicts, async (rescueCandidates) => {
    const rescue = await callOpenAIResponses<{ verdicts: GroundingRescueVerdict[] }>({
      api_key: apiKey, request_id: requestId, phase: "F1", operation: "grounding", requested_model: PRODUCTION_GROUNDING_RESCUE_MODEL, reasoning_effort: PRODUCTION_GROUNDING_RESCUE_REASONING, requested_service_tier: "default", collector,
      payload: {
        model: PRODUCTION_GROUNDING_RESCUE_MODEL,
        reasoning: { effort: PRODUCTION_GROUNDING_RESCUE_REASONING },
        instructions: GROUNDING_RESCUE_INSTRUCTIONS,
        input: JSON.stringify({
          currentNotebook: notebook,
          newUserMessage: message,
          candidates: rescueCandidates.map((candidate, index) => ({ index, ...candidate })),
        }),
        text: {
          format: {
            type: "json_schema",
            name: "apu_notepad_grounding_rescue",
            description: "Úzká monotónní záchrana explicitně zamítnutých grounding kandidátů.",
            strict: true,
            schema: GROUNDING_RESCUE_SCHEMA,
          },
        },
        max_output_tokens: Math.min(4_000, Math.max(1_200, 500 + rescueCandidates.length * 180)),
        service_tier: "default",
        store: false,
      },
      validate_application_response: (providerResponse) => {
        const text = extractResponseText(providerResponse); if (!text) throw new Error("missing structured output");
        return validateGroundingRescueVerdicts(JSON.parse(text), rescueCandidates.length);
      },
    });
    if (rescue.usage_record.provider_status !== "completed" || !rescue.application_result) throw new Error("grounding rescue failed");
    return rescue.application_result;
  });
  return { acceptedIndexes: result.acceptedIndexes };
}

export async function POST(request: Request) {
  const started = performance.now();
  const identity = await getAccessIdentity(request.headers);
  if (!identity) return jsonError("Chybí platná identita Cloudflare Access.", 401);

  let body: { message?: unknown; notebook?: unknown; answersNeedQuestion?: unknown; explicitNeed?: unknown; turnId?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError("Neplatný formát požadavku.", 400);
  }

  if (typeof body.message !== "string" || !body.message.trim() || body.message.length > MAX_EXTRACTION_MESSAGE_LENGTH) {
    return jsonError("Zpráva je prázdná nebo příliš dlouhá.", 400);
  }
  const notebook = validateExtractionNotebook(body.notebook);
  if (!notebook) return jsonError("Neplatný obsah Zápisníku.", 400);
  if (body.answersNeedQuestion !== undefined && typeof body.answersNeedQuestion !== "boolean") {
    return jsonError("Neplatný kontext pedagogické potřeby.", 400);
  }
  if (body.explicitNeed !== undefined && (!F2_PATHS.includes(body.explicitNeed as F2Path) || body.answersNeedQuestion !== true)) {
    return jsonError("Neplatná explicitní pedagogická potřeba.", 400);
  }
  if (body.turnId !== undefined && (typeof body.turnId !== "string" || body.turnId.length > 160)) return jsonError("Neplatný identifikátor tahu.", 400);

  if (body.explicitNeed !== undefined) {
    const matchingGoal = notebook.find((entry) => entry.category === "goals" && entry.text.trim().toLocaleLowerCase("cs-CZ") === (body.message as string).trim().toLocaleLowerCase("cs-CZ"));
    const sourceQuote = (body.message as string).trim();
    const location = locateSourceQuote(body.message as string, sourceQuote)!;
    return Response.json({
      extraction: {
        situationRelation: "related",
        situationReason: null,
        candidates: [{
          category: "goals",
          sourceQuote,
          notebookText: sourceQuote,
          action: matchingGoal ? "duplicate" : "add",
          relatedEntryId: matchingGoal?.id ?? null,
          reason: null,
          ...location,
          needMapping: { f2Path: body.explicitNeed as F2Path, f3Target: null },
        }],
      },
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return jsonError("Extrakční vrstva není nakonfigurována.", 503);

  const extractStarted = performance.now();
  const collector = createRequestUsageCollector();
  const requestId = crypto.randomUUID();
  let response: Record<string, unknown>;
  let extraction: RawExtraction;
  try {
    const result = await callOpenAIResponses<RawExtraction>({
      api_key: apiKey, request_id: requestId, turn_id: typeof body.turnId === "string" ? body.turnId : null, phase: "F1", operation: "extraction", requested_model: EXTRACTION_MODEL, reasoning_effort: PRODUCTION_EXTRACTION_REASONING, requested_service_tier: "default", collector,
      payload: {
      model: EXTRACTION_MODEL,
      reasoning: { effort: PRODUCTION_EXTRACTION_REASONING },
      instructions: EXTRACTION_INSTRUCTIONS,
      input: JSON.stringify({
        currentNotebook: notebook,
        newUserMessage: body.message,
      }),
      text: {
        format: {
          type: "json_schema",
          name: "apu_notepad_extraction",
          description: "Konzervativní extrakce explicitních faktů do APU Zápisníku.",
          strict: true,
          schema: EXTRACTION_SCHEMA,
        },
      },
      max_output_tokens: 2_000,
      service_tier: "default",
      store: false,
      },
      validate_application_response: (providerResponse) => {
        const text = extractResponseText(providerResponse); if (!text) throw new Error("missing structured output");
        return JSON.parse(text) as RawExtraction;
      },
    });
    if (result.usage_record.provider_status !== "completed" || !result.application_result) return jsonError("Extrakce do Zápisníku selhala.", 502, collector);
    response = result.response.body;
    extraction = result.application_result;
  } catch (cause) {
    const payload = usageErrorPayload(cause, collector);
    return Response.json(payload ?? modelUsagePayload({ error: "Výstup extraktoru nebyl platný JSON." }, collector), { status: 502 });
  }
  const extractDuration = Math.round(performance.now() - extractStarted);

  const locatedCandidates = normalizeExtractionCandidates(body.message as string, notebook, extraction.candidates);

  const candidatesRequiringGrounding = locatedCandidates.filter(
    (candidate) => candidate.action === "add" || candidate.action === "conflict",
  );
  const groundingStarted = performance.now();
  const grounding = await verifyGrounding(apiKey, requestId, body.message as string, notebook, candidatesRequiringGrounding, collector);
  const groundingDuration = candidatesRequiringGrounding.length ? Math.round(performance.now() - groundingStarted) : null;
  const acceptedCandidateKeys = new Set(
    [...grounding.acceptedIndexes].map((index) => candidatesRequiringGrounding[index])
      .filter(Boolean)
      .map((candidate) => `${candidate.category}\u0000${candidate.sourceQuote}\u0000${candidate.notebookText}`),
  );
  const candidates = locatedCandidates.filter((candidate) => {
    if (candidate.action === "duplicate" || candidate.action === "skip") return true;
    return acceptedCandidateKeys.has(`${candidate.category}\u0000${candidate.sourceQuote}\u0000${candidate.notebookText}`);
  });

  const usage = response.usage as ProviderUsage | undefined;
  const groundingRecords = collector.records().filter((record) => record.operation === "grounding");
  const groundingUsage = aggregateRecordedUsage(groundingRecords);
  const inputTokens = (usage?.input_tokens ?? 0) + (groundingUsage?.input_tokens ?? 0);
  const cachedInputTokens = (usage?.input_tokens_details?.cached_tokens ?? 0) +
    (groundingUsage?.input_tokens_details?.cached_tokens ?? 0);
  const cacheWriteTokens = (usage?.input_tokens_details?.cache_write_tokens ?? 0) +
    (groundingUsage?.input_tokens_details?.cache_write_tokens ?? 0);
  const outputTokens = (usage?.output_tokens ?? 0) + (groundingUsage?.output_tokens ?? 0);
  const model = typeof response.model === "string" ? response.model : EXTRACTION_MODEL;
  const canonicalCallIds = collector.records()
    .filter((record) => record.operation === "extraction" || record.operation === "grounding")
    .map((record) => record.call_id);
  const callId = canonicalCallIds[0] ?? crypto.randomUUID();
  const finalGroundingRecord = groundingRecords.at(-1);
  const groundingModel = finalGroundingRecord?.reported_model ?? finalGroundingRecord?.requested_model ?? EXTRACTION_MODEL;
  const telemetry = {
    turn_id: typeof body.turnId === "string" ? body.turnId : null,
    completed_at: new Date().toISOString(),
    latency_ms: { user_to_first_token: null, preflight_total: null, analysis_user_visible_ms: null, analysis_backend_total_ms: null, total: Math.round(performance.now() - started), main_model_ttft: null, generation: null },
    stages: [
      { name: "extract", status: "completed", duration_ms: extractDuration, api_request_id: callId, model, reasoning: PRODUCTION_EXTRACTION_REASONING, service_tier: "default", usage: { input_tokens: usage?.input_tokens ?? null, cached_input_tokens: usage?.input_tokens_details?.cached_tokens ?? null, cache_write_tokens: usage?.input_tokens_details?.cache_write_tokens ?? null, output_tokens: usage?.output_tokens ?? null, reasoning_tokens: usage?.output_tokens_details?.reasoning_tokens ?? null, total_tokens: usage?.total_tokens ?? null } },
      { name: "grounding", status: candidatesRequiringGrounding.length ? "completed" : "skipped", duration_ms: groundingDuration, model: groundingModel, reasoning: PRODUCTION_EXTRACTION_REASONING, service_tier: "default", usage: candidatesRequiringGrounding.length ? { input_tokens: groundingUsage?.input_tokens ?? null, cached_input_tokens: groundingUsage?.input_tokens_details?.cached_tokens ?? null, cache_write_tokens: groundingUsage?.input_tokens_details?.cache_write_tokens ?? null, output_tokens: groundingUsage?.output_tokens ?? null, reasoning_tokens: groundingUsage?.output_tokens_details?.reasoning_tokens ?? null, total_tokens: groundingUsage?.total_tokens ?? null } : undefined },
    ],
    context_sizes: { unit: "chars", core: intakeCore.length, runtime_instructions: null, notebook: JSON.stringify(notebook).length, previous_analysis: null, user_message: body.message.length, previous_response_context: null },
    tools: { file_search: { available: false, invoked: false, calls: 0, duration_ms: null } },
    notebook_mutation: { added: candidates.filter((candidate) => candidate.action === "add").length, updated: 0, conflicts: candidates.filter((candidate) => candidate.action === "conflict").length, rejected_by_grounding: candidatesRequiringGrounding.length - candidates.filter((candidate) => candidate.action === "add" || candidate.action === "conflict").length },
    streaming: { model: false, backend: false, transport: false, ui: false },
  };

  return Response.json(modelUsagePayload({
    extraction: {
      situationRelation: extraction.situationRelation,
      situationReason: extraction.situationReason,
      candidates,
    },
    ...(identity.role === "developer" ? { diagnostics: {
      callId,
      canonicalCallIds,
      model,
      inputTokens,
      ...((typeof usage?.input_tokens_details?.cached_tokens === "number" || typeof groundingUsage?.input_tokens_details?.cached_tokens === "number") ? { cachedInputTokens } : {}),
      ...((typeof usage?.input_tokens_details?.cache_write_tokens === "number" || typeof groundingUsage?.input_tokens_details?.cache_write_tokens === "number") ? { cacheWriteTokens } : {}),
      outputTokens,
      ...((typeof usage?.output_tokens_details?.reasoning_tokens === "number" || typeof groundingUsage?.output_tokens_details?.reasoning_tokens === "number")
        ? { reasoningTokens: (usage?.output_tokens_details?.reasoning_tokens ?? 0) + (groundingUsage?.output_tokens_details?.reasoning_tokens ?? 0) }
        : {}),
      totalTokens: inputTokens + outputTokens,
      estimatedCostUsd: estimateCostUsd({
        model,
        inputTokens,
        cachedInputTokens,
        cacheWriteTokens,
        outputTokens,
      }),
    }, telemetry } : {}),
  }, collector), { headers: { "Cache-Control": "no-store" } });
}
