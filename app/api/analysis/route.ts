import instructions from "../../../apu-core/v1.6/00_INSTRUCTIONS_v1.6.md?raw";
import { cleanAnalysisQuestionText, stripLegacyQuestionFromSummary, type AnalysisState } from "../../analysis-model";
import { CATEGORY_IDS, F2_PATHS, type CategoryId, type PedagogicalNeedMapping, type F1ToF2NeedContract } from "../../notepad-model";
import { estimateCostUsd } from "../../model-config";
import { getAccessIdentity } from "../../access-auth";
import { callOpenAIResponses, createRequestUsageCollector, modelUsagePayload, usageErrorPayload, type RequestUsageCollector } from "../../openai-responses-instrumentation";

export const runtime = "edge";

type NotebookItem = { category: CategoryId; id: string; text: string; trust: "confirmed" | "unconfirmed"; needMapping?: PedagogicalNeedMapping };

const question = {
  type: "object", additionalProperties: false, required: ["id", "text", "target", "status"],
  properties: { id: { type: "string" }, text: { type: "string" }, target: { type: "string", enum: CATEGORY_IDS }, status: { type: "string", enum: ["active", "skipped", "answered"] } },
} as const;
const entryQuestion = {
  type: "object", additionalProperties: false, required: ["id", "text", "target"],
  properties: { id: { type: "string" }, text: { type: "string" }, target: { type: "string", enum: CATEGORY_IDS } },
} as const;
const stringArray = { type: "array", items: { type: "string" } } as const;
const nullableQuestion = { anyOf: [{ type: "null" }, question] } as const;
const nullableEntryQuestion = { anyOf: [{ type: "null" }, entryQuestion] } as const;
const suggestedNeeds = { type: "array", maxItems: 3, items: {
  type: "object", additionalProperties: false, required: ["id", "title", "reason"],
  properties: { id: { type: "string" }, title: { type: "string" }, reason: { type: "string" } },
} } as const;
const entryChatUpdate = { type: "object", additionalProperties: false,
  required: ["kind", "summary", "nextPrompt"],
  properties: {
    kind: { type: "string", enum: ["entry"] }, summary: { type: "string" },
    nextPrompt: { anyOf: [{ type: "null" }, { type: "object", additionalProperties: false, required: ["type", "text"], properties: { type: { type: "string", enum: ["question", "navigation"] }, text: { type: "string" } } }] },
  },
} as const;
const workingChatUpdate = { type: "object", additionalProperties: false,
  required: ["kind", "summary", "notebookChanges", "hypothesisChanges", "remainingUncertainty", "nextPrompt"],
  properties: {
    kind: { type: "string", enum: ["entry", "update"] }, summary: { type: "string" }, notebookChanges: stringArray,
    hypothesisChanges: { type: "array", items: { type: "object", additionalProperties: false,
      required: ["hypothesisId", "kind", "description"], properties: { hypothesisId: { type: "string" }, kind: { type: "string", enum: ["strengthened", "weakened", "merged", "removed", "updated"] }, description: { type: "string" } } } },
    remainingUncertainty: { type: "string" }, nextPrompt: { anyOf: [{ type: "null" }, { type: "object", additionalProperties: false, required: ["type", "text"], properties: { type: { type: "string", enum: ["question", "navigation"] }, text: { type: "string" } } }] },
  },
} as const;
const ENTRY_ANALYSIS_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["hypotheses", "needs", "mainUncertainty", "chatUpdate", "transitionReady"],
  properties: {
    hypotheses: { type: "array", maxItems: 4, items: {
      type: "object", additionalProperties: false,
      required: ["id", "title", "summary", "relevantNeeds", "question"],
      properties: { id: { type: "string" }, title: { type: "string" }, summary: { type: "string" }, relevantNeeds: stringArray, question: nullableEntryQuestion },
    } },
    needs: { type: "array", maxItems: 12, items: {
      type: "object", additionalProperties: false,
      required: ["needId", "title", "direction", "relevantHypotheses", "question"],
      properties: { needId: { type: "string" }, title: { type: "string" }, relevantHypotheses: stringArray, direction: { type: "string" }, question: nullableEntryQuestion },
    } },
    mainUncertainty: { type: "string" },
    chatUpdate: entryChatUpdate,
    transitionReady: { type: "boolean" },
  },
} as const;

const WORKING_ANALYSIS_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["hypotheses", "needs", "suggestedNeeds", "mainUncertainty", "chatUpdate", "transitionReady"],
  properties: {
    hypotheses: { type: "array", maxItems: 5, items: {
      type: "object", additionalProperties: false,
      required: ["id", "rank", "title", "summary", "relevantNeeds", "question", "supportingInformation", "limitations", "unknowns", "questions"],
      properties: { id: { type: "string" }, rank: { type: "integer" }, title: { type: "string" }, summary: { type: "string" }, relevantNeeds: stringArray, question: nullableQuestion, supportingInformation: stringArray, limitations: stringArray, unknowns: stringArray, questions: { type: "array", items: question } },
    } },
    needs: { type: "array", maxItems: 12, items: {
      type: "object", additionalProperties: false,
      required: ["needId", "title", "sourceText", "relevantHypotheses", "direction", "question", "distinctions", "parameters", "limitations", "questions", "intendedOutput"],
      properties: { needId: { type: "string" }, title: { type: "string" }, sourceText: { type: "string" }, relevantHypotheses: stringArray, direction: { type: "string" }, question: nullableQuestion, distinctions: stringArray, parameters: stringArray, limitations: stringArray, questions: { type: "array", items: question }, intendedOutput: { type: "string" } },
    } },
    suggestedNeeds,
    mainUncertainty: { type: "string" },
    chatUpdate: workingChatUpdate,
    transitionReady: { type: "boolean" },
  },
} as const;

function jsonError(message: string, status = 500, collector?: RequestUsageCollector) { return Response.json(collector ? modelUsagePayload({ error: message }, collector) : { error: message }, { status }); }
function outputText(response: Record<string, unknown>) {
  if (typeof response.output_text === "string") return response.output_text;
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) for (const part of Array.isArray((item as { content?: unknown[] })?.content) ? (item as { content: unknown[] }).content : []) {
    if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") return (part as { text: string }).text;
  }
  return null;
}
function validNotebook(value: unknown): value is NotebookItem[] {
  return Array.isArray(value) && value.length <= 80 && value.every((entry) => entry && typeof entry === "object" &&
    typeof entry.id === "string" && entry.id.length <= 120 && typeof entry.text === "string" && entry.text.length <= 2000 &&
    CATEGORY_IDS.includes(entry.category) && ["confirmed", "unconfirmed"].includes(entry.trust) &&
    (entry.category !== "goals" || (entry.needMapping && F2_PATHS.includes(entry.needMapping.f2Path) && (entry.needMapping.f3Target === null || typeof entry.needMapping.f3Target === "string"))));
}
function validCanonicalNeed(value: unknown, notebook: NotebookItem[]): value is F1ToF2NeedContract {
  if (!value || typeof value !== "object") return false;
  const need = value as Partial<F1ToF2NeedContract>;
  const source = notebook.find((item) => item.category === "goals" && item.id === need.needId);
  const mapping = source?.needMapping;
  return Boolean(source && mapping && need.needText === source.text && need.initialF2Path === mapping.f2Path &&
    need.f3Target === mapping.f3Target);
}
function semanticKey(value: string) { return cleanAnalysisQuestionText(value).toLocaleLowerCase("cs-CZ").replace(/\s+/g, " "); }
function stableId(prefix: string) { return `${prefix}-${crypto.randomUUID()}`; }
function normalize(raw: AnalysisState, notebook: NotebookItem[], skipped: string[], previous: AnalysisState | null, mode: AnalysisState["mode"]): AnalysisState {
  const goals = notebook.filter((item) => item.category === "goals");
  const skipSet = new Set(skipped.flatMap((value) => [value, semanticKey(value)]));
  const previousById = new Map((previous?.hypotheses ?? []).map((item) => [item.id, item]));
  const previousByTitle = new Map((previous?.hypotheses ?? []).map((item) => [semanticKey(item.title), item]));
  const rawIdToStable = new Map<string, string>();
  const hypotheses = (raw.hypotheses ?? []).slice(0, mode === "entry" ? 4 : 5).map((item, index) => {
    const matched = previousById.get(item.id) ?? previousByTitle.get(semanticKey(item.title));
    const oldQuestions = new Map((matched?.questions ?? []).map((q) => [semanticKey(q.text), q]));
    const id = matched?.id ?? stableId("hypothesis"); rawIdToStable.set(item.id, id);
    const normalizeQuestion = (q: AnalysisState["hypotheses"][number]["question"]) => {
      if (!q) return null;
      const text = cleanAnalysisQuestionText(q.text);
      const questionId = oldQuestions.get(semanticKey(text))?.id ?? (q.id || stableId("question"));
      return skipSet.has(questionId) || skipSet.has(semanticKey(text)) ? null : { ...q, text, id: questionId, status: "active" as const };
    };
    return {
      ...item, id, rank: index + 1,
      relevantNeeds: (item.relevantNeeds ?? []).filter((needId) => goals.some((goal) => goal.id === needId)),
      question: normalizeQuestion(item.question ?? null),
      supportingInformation: item.supportingInformation ?? [], limitations: item.limitations ?? [], unknowns: item.unknowns ?? [],
      questions: (item.questions ?? []).map((q) => normalizeQuestion(q)).filter((q): q is NonNullable<typeof q> => q !== null),
    };
  });
  const validIds = new Set(hypotheses.map((item) => item.id));
  const rawByNeed = new Map((raw.needs ?? []).map((item) => [item.needId, item]));
  const needs = goals.map((goal) => {
    const item = rawByNeed.get(goal.id);
    const previousNeed = previous?.needs.find((need) => need.needId === goal.id);
    const oldQuestions = new Map((previousNeed?.questions ?? []).map((q) => [semanticKey(q.text), q]));
    if (!item) return { needId: goal.id, title: goal.text, sourceText: goal.text, relevantHypotheses: [...validIds], direction: "Upřesnit význam pracovních hypotéz pro tuto potřebu.", question: null, distinctions: [], parameters: [], limitations: ["Zacílení zatím není úplné."], questions: [], intendedOutput: "Podklad odpovídající této pedagogické potřebě." };
    const normalizeQuestion = (q: AnalysisState["needs"][number]["question"]) => {
      if (!q) return null;
      const text = cleanAnalysisQuestionText(q.text);
      const questionId = oldQuestions.get(semanticKey(text))?.id ?? (q.id || stableId("question"));
      return skipSet.has(questionId) || skipSet.has(semanticKey(text)) ? null : { ...q, text, id: questionId, status: "active" as const };
    };
    return {
      ...item, needId: goal.id, sourceText: goal.text,
      relevantHypotheses: item.relevantHypotheses.map((id) => rawIdToStable.get(id) ?? id).filter((id) => validIds.has(id)),
      question: normalizeQuestion(item.question ?? null),
      distinctions: item.distinctions ?? [], parameters: item.parameters ?? [], limitations: item.limitations ?? [],
      questions: (item.questions ?? []).map((q) => normalizeQuestion(q)).filter((q): q is NonNullable<typeof q> => q !== null),
      intendedOutput: item.intendedOutput ?? "Podklad odpovídající této pedagogické potřebě.",
    };
  });
  const goalTexts = new Set(goals.map((item) => item.text.trim().toLocaleLowerCase("cs-CZ")));
  const nextPrompt = raw.chatUpdate?.nextPrompt ? { ...raw.chatUpdate.nextPrompt, text: cleanAnalysisQuestionText(raw.chatUpdate.nextPrompt.text) } : null;
  const chatUpdate = {
    kind: raw.chatUpdate?.kind ?? (mode === "entry" ? "entry" : "update"),
    summary: stripLegacyQuestionFromSummary(raw.chatUpdate?.summary ?? "", nextPrompt),
    notebookChanges: raw.chatUpdate?.notebookChanges ?? [],
    hypothesisChanges: (raw.chatUpdate?.hypothesisChanges ?? []).map((change) => ({ ...change, hypothesisId: rawIdToStable.get(change.hypothesisId) ?? change.hypothesisId })),
    remainingUncertainty: raw.chatUpdate?.remainingUncertainty ?? "",
    nextPrompt,
  };
  return { hypotheses, needs, suggestedNeeds: mode === "entry" ? [] : (raw.suggestedNeeds ?? []).filter((item) => !goalTexts.has(item.title.trim().toLocaleLowerCase("cs-CZ"))).slice(0, 3), mode, mainUncertainty: raw.mainUncertainty ?? "", chatUpdate, transitionReady: Boolean(raw.transitionReady && hypotheses.length && needs.length) };
}

export async function POST(request: Request) {
  const started = performance.now();
  const identity = await getAccessIdentity(request.headers);
  if (!identity) return jsonError("Chybí platná identita Cloudflare Access.", 401);
  const apiKey = process.env.OPENAI_API_KEY;
  const vectorStoreId = process.env.APU_VECTOR_STORE_ID;
  if (!apiKey || !vectorStoreId) return jsonError("APU není dokončeno: chybí serverová konfigurace.", 503);
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return jsonError("Neplatný formát požadavku.", 400); }
  if (!validNotebook(body.notebook)) return jsonError("Neplatný obsah Zápisníku.", 400);
  const notebook = body.notebook;
  const canonicalNeed = body.canonicalNeed === null ? null : validCanonicalNeed(body.canonicalNeed, body.notebook) ? body.canonicalNeed : undefined;
  if (canonicalNeed === undefined) return jsonError("Neplatné kanonické mapování pedagogické potřeby.", 400);
  const skipped = Array.isArray(body.skippedQuestions) && body.skippedQuestions.every((item) => typeof item === "string") ? body.skippedQuestions.slice(0, 50) as string[] : [];
  const previousAnalysis = body.previousAnalysis && typeof body.previousAnalysis === "object" ? body.previousAnalysis as AnalysisState : null;
  const isEntry = !previousAnalysis;
  const focusInstruction = typeof body.focusInstruction === "string" ? body.focusInstruction.slice(0, 2000) : "";
  const turnId = typeof body.turnId === "string" && body.turnId.length <= 160 ? body.turnId : null;
  const input = { notebook: body.notebook, canonicalNeed, previousAnalysis, selectedHypothesisId: typeof body.selectedHypothesisId === "string" ? body.selectedHypothesisId : null, activeNeedId: typeof body.activeNeedId === "string" ? body.activeNeedId : null, focusInstruction, skippedQuestions: skipped };
  const analysisStarted = performance.now();
  const collector = createRequestUsageCollector();
  try {
    const { response, usage_record, application_result } = await callOpenAIResponses({
      api_key: apiKey, request_id: crypto.randomUUID(), turn_id: turnId, phase: "F2", operation: "analysis", requested_model: "gpt-5.6-terra", reasoning_effort: "low", requested_service_tier: "default", collector,
      payload: {
      model: "gpt-5.6-terra", reasoning: { effort: "low" }, store: false,
      service_tier: "default",
      tools: [{ type: "file_search", vector_store_ids: [vectorStoreId] }],
      instructions: `${instructions}\n\nVrať pouze JSON podle technického schématu. Dodrž kanonickou analytickou politiku a hranici FÁZE 2 / FÁZE 3 z Core. Rozbor odvozuj výhradně z aktuálního Zápisníku. Karta i chatUpdate jsou dva pohledy na jediný vrácený stav; chatUpdate nesmí být rozhodnější než hypotézy. ${isEntry ? "Jde o F2 Entry: vytvoř pouze 2–4 stručné hypotézy s vazbou na pedagogické potřeby a nejvýše jednou skutečnou prioritní otázkou na hypotézu. Pro každou potřebu vytvoř stručný směr, relevantní hypotézy a nejvýše jednu skutečnou otázku. Negeneruj detailní opory, limity, seznamy neznámých, parametry ani zamýšlené výstupy; nejistotu shrň jen jednou v mainUncertainty. transitionReady je pouze informativní a nesmí znamenat blokaci explicitního přechodu uživatele do FÁZE 3." : "Jde o F2 Working: rozpracuj pouze větev vybranou focusInstruction, selectedHypothesisId nebo activeNeedId. Ostatní větve zachovej stručné a nevytvářej plošně detail celého stromu."} V poli chatUpdate.summary nikdy neopakuj ani neformuluj otázku. chatUpdate.nextPrompt je jediná prioritní otázka pro chat; všechny texty otázek v hypotheses.question, needs.question a chatUpdate.nextPrompt musí být čistý text bez emoji nebo jiných prefixů. Při prvním Rozboru kind=entry, jinak kind=update. Reuse stabilní ID z previousAnalysis pro významově stejné prvky, i při změně pořadí nebo formulace. Pro každou položku kategorie goals vytvoř právě jedno needs se shodným needId a krátkým významově věrným title. Přeskočené otázky neopakuj a všechny vrácené otázky mají status active. chatUpdate stručně zachytí skutečnou změnu a nejvýše jeden nextPrompt. relevantHypotheses smí obsahovat jen vrácená ID. focusInstruction mění pouze zaměření, nikoli fakta.`,
      input: JSON.stringify(input),
      text: { format: { type: "json_schema", name: isEntry ? "apu_phase_2_entry" : "apu_phase_2_working", strict: true, schema: isEntry ? ENTRY_ANALYSIS_SCHEMA : WORKING_ANALYSIS_SCHEMA } },
      },
      validate_application_response: (providerResponse) => {
        const text = outputText(providerResponse); if (!text) throw new Error("missing structured output");
        return normalize(JSON.parse(text) as AnalysisState, notebook, skipped, previousAnalysis, isEntry ? "entry" : "working");
      },
    });
    if (usage_record.provider_status !== "completed" || !application_result) return jsonError("Rozbor se nepodařilo vytvořit.", 502, collector);
    const analysisDuration = Math.round(performance.now() - analysisStarted);
    const analysis = application_result;
    const usage = response.body.usage as { input_tokens?: number; output_tokens?: number; total_tokens?: number; input_tokens_details?: { cached_tokens?: number }; output_tokens_details?: { reasoning_tokens?: number } } | undefined;
    const inputTokens = usage?.input_tokens ?? 0; const outputTokens = usage?.output_tokens ?? 0;
    const callId = crypto.randomUUID();
    const model = typeof response.body.model === "string" ? response.body.model : "gpt-5.6-terra";
    const fileSearchCalls = Array.isArray(response.body.output) ? response.body.output.filter((item) => item && typeof item === "object" && (item as { type?: unknown }).type === "file_search_call").length : 0;
    const developerData = identity.role === "developer" ? { diagnostics: { callId, model, reasoning: "low", knowledgeBaseEnabled: true, routingSource: "phase-2", inputTokens, cachedInputTokens: usage?.input_tokens_details?.cached_tokens ?? 0, outputTokens, reasoningTokens: usage?.output_tokens_details?.reasoning_tokens ?? 0, totalTokens: usage?.total_tokens ?? inputTokens + outputTokens, estimatedCostUsd: estimateCostUsd({ model, inputTokens, cachedInputTokens: usage?.input_tokens_details?.cached_tokens ?? 0, outputTokens, fileSearchCalls }) }, telemetry: {
      turn_id: turnId, completed_at: new Date().toISOString(), path: "analysis",
      latency_ms: { user_to_first_token: null, preflight_total: null, analysis_user_visible_ms: null, analysis_backend_total_ms: analysisDuration, total: Math.round(performance.now() - started), main_model_ttft: null, generation: null },
      stages: [{ name: "analysis", status: "completed", duration_ms: analysisDuration, api_request_id: callId, model, reasoning: "low", service_tier: "default", usage: { input_tokens: usage?.input_tokens ?? null, cached_input_tokens: usage?.input_tokens_details?.cached_tokens ?? null, cache_write_tokens: null, output_tokens: usage?.output_tokens ?? null, reasoning_tokens: usage?.output_tokens_details?.reasoning_tokens ?? null, total_tokens: usage?.total_tokens ?? null } }],
      context_sizes: { unit: "chars", core: instructions.length, runtime_instructions: null, notebook: JSON.stringify(body.notebook).length, previous_analysis: previousAnalysis ? JSON.stringify(previousAnalysis).length : 0, user_message: focusInstruction.length, previous_response_context: null },
      tools: { file_search: { available: true, invoked: fileSearchCalls > 0, calls: fileSearchCalls, duration_ms: null } },
      streaming: { model: false, backend: false, transport: false, ui: false },
    } } : {};
    return Response.json(modelUsagePayload({ analysis, ...developerData }, collector));
  }
  catch (cause) {
    const payload = usageErrorPayload(cause, collector);
    return Response.json(payload ?? modelUsagePayload({ error: "Model nevrátil platný Rozbor." }, collector), { status: 502 });
  }
}
