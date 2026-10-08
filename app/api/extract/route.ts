import { estimateCostUsd } from "../../model-config";
import { F2_PATHS, locateSourceQuote, type F2Path } from "../../notepad-model";
import { getAccessIdentity } from "../../access-auth";
import { callOpenAIResponses, createRequestUsageCollector, modelUsagePayload, usageErrorPayload, type RequestUsageCollector } from "../../openai-responses-instrumentation";
import {
  EXTRACTION_SCHEMA,
  GROUNDING_SCHEMA,
  MAX_EXTRACTION_MESSAGE_LENGTH,
  PRODUCTION_EXTRACTION_MODEL,
  PRODUCTION_EXTRACTION_REASONING,
  buildExtractionInstructions,
  buildGroundingInstructions,
  extractResponseText,
  normalizeExtractionCandidates,
  validateExtractionNotebook,
  type ExtractionCandidate,
  type ExtractionNotebookInput,
  type GroundingVerdict,
  type RawExtraction,
} from "../../f1-extraction-contract";
import intakeCore from "../../../apu-core/v1.6/02_OBSERVATION_AND_INTAKE.md?raw";

export const runtime = "edge";

const EXTRACTION_INSTRUCTIONS = buildExtractionInstructions(intakeCore);
const GROUNDING_INSTRUCTIONS = buildGroundingInstructions(intakeCore);
const EXTRACTION_MODEL = PRODUCTION_EXTRACTION_MODEL;

type NotebookInput = ExtractionNotebookInput;
type RawCandidate = ExtractionCandidate;

function jsonError(message: string, status = 500, collector?: RequestUsageCollector) {
  return Response.json(collector ? modelUsagePayload({ error: message }, collector) : { error: message }, { status });
}

async function verifyGrounding(
  apiKey: string,
  requestId: string,
  message: string,
  notebook: NotebookInput[],
  candidates: RawCandidate[],
  collector: RequestUsageCollector,
) {
  if (!candidates.length) return { acceptedIndexes: new Set<number>(), response: null };

  try {
    const { response, usage_record, application_result } = await callOpenAIResponses({
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
        return JSON.parse(text) as { verdicts?: GroundingVerdict[] };
      },
    });
    if (usage_record.provider_status !== "completed" || !application_result) return { acceptedIndexes: new Set<number>(), response: response.body };
    const parsed = application_result;
    const acceptedIndexes = new Set(
      (parsed.verdicts ?? [])
        .filter((verdict) => verdict.accepted && Number.isInteger(verdict.index) && verdict.index >= 0 && verdict.index < candidates.length)
        .map((verdict) => verdict.index),
    );
    return { acceptedIndexes, response: response.body };
  } catch {
    return { acceptedIndexes: new Set<number>(), response: null };
  }
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

  const usage = response.usage as {
    input_tokens?: number;
    input_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
    output_tokens?: number;
    output_tokens_details?: { reasoning_tokens?: number };
    total_tokens?: number;
  } | undefined;
  const groundingUsage = grounding.response?.usage as typeof usage;
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
  const groundingModel = typeof grounding.response?.model === "string" ? grounding.response.model : EXTRACTION_MODEL;
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
