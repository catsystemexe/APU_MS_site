import { estimateCostUsd } from "../../model-config";
import { CATEGORY_IDS, CategoryId, locateSourceQuote } from "../../notepad-model";
import { getAccessIdentity } from "../../access-auth";
import { callOpenAIResponses, createRequestUsageCollector, modelUsagePayload, usageErrorPayload, type RequestUsageCollector } from "../../openai-responses-instrumentation";
import intakeCore from "../../../apu-core/v1.6/02_OBSERVATION_AND_INTAKE.md?raw";

export const runtime = "edge";

const EXTRACTION_MODEL = "gpt-5.6-luna";
const MAX_MESSAGE_LENGTH = 12_000;
const MAX_NOTEPAD_ITEMS = 80;

const EXTRACTION_INSTRUCTIONS = `${intakeCore}

Jsi přesná a úplná extrakční vrstva Zápisníku pedagogického asistenta APU.
Neodpovídáš uživateli a neposkytuješ pedagogické rady. Pouze mapuješ explicitní údaje z právě zaslané zprávy do jedné z pěti kategorií.

Kategorie:
- manifestations — Pozorovaný projev: co pedagog přímo vidí nebo slyší; konkrétní jednání nebo reakce, nikoli hodnocení dítěte
- goals — Pedagogická potřeba: co pedagog výslovně potřebuje v dané situaci vyřešit, změnit, podpořit nebo lépe pochopit; nejde o domnělou potřebu dítěte
- context: situace, prostředí, osoby nebo spouštěče
- course — Intenzita / trend: četnost, trvání, síla, počátek nebo vývoj v čase
- helps — Zkušenosti: co už bylo v této situaci skutečně vyzkoušeno nebo pozorováno a jaký to mělo účinek; zahrnuje to, co pomáhá, nepomáhá, škodí nebo funguje jen za určitých podmínek

Pravidla:
1. Zapisuj jen to, co uživatel skutečně uvedl. Nevytvářej diagnózy, příčiny ani domněnky.
2. Zachovej nejistotu, časové omezení i míru tvrzení.
3. sourceQuote musí být přesný souvislý podřetězec nové zprávy, včetně původní diakritiky a interpunkce.
4. Jedna kandidátní položka = jeden samostatný fakt. Nerozsekávej jednu myšlenku bez potřeby.
4a. Před dokončením výstupu povinně projdi všech pět kategorií. Nevynechávej explicitní kontext, četnost, trvání, intenzitu, vývoj, pedagogickou potřebu ani dosavadní zkušenost jen proto, že zpráva současně obsahuje projev.
4b. Jedna věta nebo jedna sourceQuote může vytvořit více kandidátů v různých kategoriích, pokud skutečně obsahuje více samostatných údajů.
4c. Výčet v jedné větě nebo souvětí významově odlišných explicitních projevů rozděl na samostatné candidates ve stejné kategorii. Neztrácej ani neslučuj je jen proto, že spolu souvisejí: „unavený“, „apatický“, „málo komunikuje“, „odmítá úkoly“ a „špatně se soustředí“ jsou odlišné projevy. Naopak skutečnou parafrázi téhož projevu vrať jen jednou.
5. Pokud stejný význam už v Zápisníku je, action=duplicate a uveď jeho relatedEntryId.
5a. Duplicitu posuzuj pouze uvnitř stejné kategorie. Existující projev nikdy není důvodem odmítnout nový kontext, intenzitu a trend, pedagogickou potřebu nebo dosavadní zkušenost.
6. Pokud nový údaj mění nebo odporuje existující položce, action=conflict a uveď její relatedEntryId. Nic tiše nepřepisuj.
7. Neurčité, pouze interpretační nebo nerelevantní pasáže mají action=skip.
8. situationRelation posuzuj vůči celému Zápisníku: same = stejná situace; related = relevantní doplnění téže situace; different = pouze zjevně jiný žák nebo jiný řešený problém; uncertain = pouze skutečná obsahová nejasnost, zda jde o jiného žáka nebo jiný problém.
8a. Navazující eliptické formulace jako „děje se to“, „hlavně odpoledne“, „asi třikrát týdně“ nebo „pomáhá mu“ běžně odkazují k aktuální situaci. Samotné vynechání podmětu není důvod pro uncertain ani different; použij related.
9. U prázdného Zápisníku použij same, pokud zpráva obsahuje použitelný popis situace.
10. Při different vrať kandidáty, ale aplikace je bez potvrzení nezapíše.
11. Hodnotící nálepky jako „líný“, „drzý“, „zlobivý“, „neschopný“ nebo „manipulativní“ nejsou pozorované projevy. Samy o sobě je nezapisuj a neodvozuj z nich konkrétní chování.
12. notebookText smí pouze stručně a významově beze ztráty normalizovat obsah sourceQuote. Nesmí přidat žádný projev, okolnost, četnost, příčinu ani míru, kterou uživatel neuvedl.
13. categoryReview musí potvrdit, že jsi samostatně zkontroloval všech pět kategorií. Hodnota found znamená, že pro kategorii vracíš alespoň jeden kandidát add, duplicate, conflict nebo skip; none znamená, že zpráva pro kategorii žádný explicitní údaj neobsahuje.
14. Pedagogickou potřebu zapisuj jen tehdy, když ji pedagog sám vyjádří. Neodvozuj ji z projevu dítěte ani ji nezaměňuj za doporučení APU.
14a. Samotný popis obtíže, četnosti nebo závažnosti nikdy není pedagogickou potřebou. Z vět „žák usíná“, „těžce se soustředí“ nebo „děje se to každý den“ nesmí vzniknout goals typu „potřebuji poradit“, „chci situaci pochopit“ ani jiný obecný záměr. Pokud zpráva neobsahuje výslovný požadavek, otázku nebo formulaci cíle pedagoga, categoryReview.goals=none.
15. Do Zkušeností zapisuj pouze skutečně vyzkoušený postup, pozorovanou podmínku nebo změnu spolu s jejím pozorovaným účinkem. Nezapisuj sem nevyzkoušené návrhy APU ani obecné možnosti.
16. Pole trust v currentNotebook vyjadřuje pouze stav uživatelské kontroly: confirmed je potvrzený pracovní údaj, unconfirmed je automatický návrh. Existující unconfirmed položku nepovažuj za nezávislý důkaz její obsahové správnosti. Smíš ji použít pro návaznost situace, eliptické odkazy, deduplikaci a rozpoznání možného konfliktu; každý nový kandidát však musí být podložen newUserMessage.

Příklady úplné extrakce:
- „Žák usíná v hodině“ → manifestations: „Žák usíná“; context: „v hodině“.
- Při existujícím zápisu „Žák usíná“ a nové zprávě „Děje se to ve vyučování, každý den, zejména v odpoledních hodinách“ použij related a vrať context pro „ve vyučování“ a „zejména v odpoledních hodinách“ a course pro „každý den“. Nic dalšího neodvozuj.
- Při existujícím manifestations „Žák usíná“ a nové zprávě „Děje se to každý den“ NEVRACEJ duplicate manifestations. Vrať add course: sourceQuote „každý den“, notebookText „Každý den.“. Předmět situace už určuje Zápisník; novým faktem je četnost.
- „Ve skupině úkol odmítne, jednotlivě ho dokončí“ → manifestations, context a dosavadní zkušenost v helps, jsou-li všechny přímo doložené přesnými sourceQuote.
- „Potřebuji zjistit, co situaci spouští“ → goals: „Zjistit, co situaci spouští.“.
- „Napomenutí před třídou situaci obvykle zhorší“ → helps: „Napomenutí před třídou situaci obvykle zhoršuje.“. Jde o dosavadní zkušenost, ne o doporučení.
`.trim();

const GROUNDING_INSTRUCTIONS = `${intakeCore}

Jsi nezávislá kontrolní brána automatického zápisu do pedagogického Zápisníku APU.
Posuzuješ vztah mezi právě zaslanou zprávou uživatele, aktuálním Zápisníkem a navrženými položkami. Nemáš přístup k odpovědi asistenta a nesmíš doplňovat vlastní pedagogické možnosti.

Kandidáta přijmi jen tehdy, když současně platí:
- notebookText je přímo a jednoznačně doložen obsahem newUserMessage;
- sourceQuote je skutečným dostatečným podkladem pro celý notebookText;
- kategorie odpovídá typu informace;
- u manifestations jde o pozorovatelné chování nebo reakci, ne hodnotící nálepku, diagnózu, příčinu či hypotézu;
- explicitně uvedený popis pozorovaného stavu nebo projevu, například „je apatický“, přijmi jako manifestations, pokud notebookText nepřidává význam nad sourceQuote; nesmíš z něj odvozovat únavu, nesoustředění ani odmítání úkolů;
- u goals jde o pedagogem explicitně vyjádřenou potřebu, ne potřebu dítěte odvozenou modelem;
- samotný popis problému ani používání pedagogického asistenta neznamená implicitní žádost o radu nebo pochopení; bez výslovného záměru goals zamítni;
- u helps jde o již vyzkoušený nebo pozorovaný postup, podmínku či změnu a její doložený účinek, ne o nevyzkoušený návrh;
- přeformulování nepřidává žádný nový fakt.

Aktuální Zápisník smíš použít pouze k bezpečnému rozlišení eliptického podmětu nebo zájmena („to“, „děje se to“, „pomáhá mu“). Nový projev, četnost, kontext, pedagogická potřeba nebo dosavadní zkušenost musí být vždy explicitně obsaženy v newUserMessage. Například při zápisu „Žák usíná“ je z nové zprávy „Děje se to každý den“ bezpečně doložen course „Každý den.“.
Položka currentNotebook s trust=unconfirmed není nezávislým důkazem své správnosti. Používej ji pouze pro návaznost, eliptický odkaz, deduplikaci nebo možný konflikt; nikdy jí nedoplňuj význam, který není v newUserMessage.

Příklad: z „žák je líný“ nelze přijmout „žák je pasivní“, „nesoustředí se“, „odmítá pracovat“ ani „usíná při výuce“. Vše zamítni jako nepodloženou interpretaci. Samotné „žák je líný“ rovněž není pozorovatelný projev. Naopak z explicitního „žák je apatický“ smíš přijmout pouze manifestations „Je apatický.“ se stejnou sourceQuote.
Buď konzervativní. Při pochybnosti kandidáta zamítni.
`.trim();

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["situationRelation", "situationReason", "categoryReview", "candidates"],
  properties: {
    situationRelation: { type: "string", enum: ["same", "related", "different", "uncertain"] },
    situationReason: { type: ["string", "null"] },
    categoryReview: {
      type: "object",
      additionalProperties: false,
      required: CATEGORY_IDS,
      properties: {
        manifestations: { type: "string", enum: ["found", "none"] },
        goals: { type: "string", enum: ["found", "none"] },
        context: { type: "string", enum: ["found", "none"] },
        course: { type: "string", enum: ["found", "none"] },
        helps: { type: "string", enum: ["found", "none"] },
      },
    },
    candidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "sourceQuote", "notebookText", "action", "relatedEntryId", "reason"],
        properties: {
          category: { type: "string", enum: CATEGORY_IDS },
          sourceQuote: { type: "string" },
          notebookText: { type: "string" },
          action: { type: "string", enum: ["add", "duplicate", "conflict", "skip"] },
          relatedEntryId: { type: ["string", "null"] },
          reason: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

const GROUNDING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdicts"],
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "accepted", "reason"],
        properties: {
          index: { type: "integer", minimum: 0 },
          accepted: { type: "boolean" },
          reason: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

type NotebookInput = {
  category: CategoryId;
  id: string;
  text: string;
  trust: "confirmed" | "unconfirmed";
};
type RawCandidate = {
  category: CategoryId;
  sourceQuote: string;
  notebookText: string;
  action: "add" | "duplicate" | "conflict" | "skip";
  relatedEntryId: string | null;
  reason: string | null;
};
type RawExtraction = {
  situationRelation: "same" | "related" | "different" | "uncertain";
  situationReason: string | null;
  categoryReview: Record<CategoryId, "found" | "none">;
  candidates: RawCandidate[];
};

type GroundingVerdict = { index: number; accepted: boolean; reason: string | null };

function jsonError(message: string, status = 500, collector?: RequestUsageCollector) {
  return Response.json(collector ? modelUsagePayload({ error: message }, collector) : { error: message }, { status });
}

function outputText(response: Record<string, unknown>) {
  if (typeof response.output_text === "string") return response.output_text;
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown }).content)
      ? (item as { content: unknown[] }).content
      : [];
    for (const part of content) {
      if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text;
      }
    }
  }
  return null;
}

function validateNotebook(value: unknown): NotebookInput[] | null {
  if (!Array.isArray(value) || value.length > MAX_NOTEPAD_ITEMS) return null;
  const valid = value.every((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const item = entry as Partial<NotebookInput>;
    return typeof item.id === "string" && item.id.length <= 120 &&
      typeof item.text === "string" && item.text.length <= 2_000 &&
      (item.trust === "confirmed" || item.trust === "unconfirmed") &&
      typeof item.category === "string" && CATEGORY_IDS.includes(item.category as CategoryId);
  });
  return valid ? value as NotebookInput[] : null;
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
      api_key: apiKey, request_id: requestId, phase: "F1", operation: "grounding", requested_model: EXTRACTION_MODEL, reasoning_effort: "low", requested_service_tier: "default", collector,
      payload: {
      model: EXTRACTION_MODEL,
      reasoning: { effort: "low" },
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
        const text = outputText(providerResponse); if (!text) throw new Error("missing structured output");
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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return jsonError("Extrakční vrstva není nakonfigurována.", 503);

  let body: { message?: unknown; notebook?: unknown; answersNeedQuestion?: unknown; turnId?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError("Neplatný formát požadavku.", 400);
  }

  if (typeof body.message !== "string" || !body.message.trim() || body.message.length > MAX_MESSAGE_LENGTH) {
    return jsonError("Zpráva je prázdná nebo příliš dlouhá.", 400);
  }
  const notebook = validateNotebook(body.notebook);
  if (!notebook) return jsonError("Neplatný obsah Zápisníku.", 400);
  if (body.answersNeedQuestion !== undefined && typeof body.answersNeedQuestion !== "boolean") {
    return jsonError("Neplatný kontext pedagogické potřeby.", 400);
  }
  if (body.turnId !== undefined && (typeof body.turnId !== "string" || body.turnId.length > 160)) return jsonError("Neplatný identifikátor tahu.", 400);

  const extractStarted = performance.now();
  const collector = createRequestUsageCollector();
  const requestId = crypto.randomUUID();
  let response: Record<string, unknown>;
  let extraction: RawExtraction;
  try {
    const result = await callOpenAIResponses<RawExtraction>({
      api_key: apiKey, request_id: requestId, turn_id: typeof body.turnId === "string" ? body.turnId : null, phase: "F1", operation: "extraction", requested_model: EXTRACTION_MODEL, reasoning_effort: "low", requested_service_tier: "default", collector,
      payload: {
      model: EXTRACTION_MODEL,
      reasoning: { effort: "low" },
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
        const text = outputText(providerResponse); if (!text) throw new Error("missing structured output");
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

  const locatedCandidates = extraction.candidates.flatMap((rawCandidate) => {
    const candidate = { ...rawCandidate };
    const location = locateSourceQuote(body.message as string, candidate.sourceQuote);
    if (!location) return [];
    const relatedExistsInCategory = candidate.relatedEntryId === null || notebook.some(
      (entry) => entry.id === candidate.relatedEntryId && entry.category === candidate.category,
    );
    if (!relatedExistsInCategory) candidate.relatedEntryId = null;
    if ((candidate.action === "duplicate" || candidate.action === "conflict") && !candidate.relatedEntryId) {
      candidate.action = "add";
      candidate.reason = "Vazba na existující řádek nepatřila do stejné kategorie; údaj se posuzuje jako nový.";
    }
    return [{ ...candidate, ...location }];
  });

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
      { name: "extract", status: "completed", duration_ms: extractDuration, api_request_id: callId, model, reasoning: "low", service_tier: "default", usage: { input_tokens: usage?.input_tokens ?? null, cached_input_tokens: usage?.input_tokens_details?.cached_tokens ?? null, cache_write_tokens: usage?.input_tokens_details?.cache_write_tokens ?? null, output_tokens: usage?.output_tokens ?? null, reasoning_tokens: usage?.output_tokens_details?.reasoning_tokens ?? null, total_tokens: usage?.total_tokens ?? null } },
      { name: "grounding", status: candidatesRequiringGrounding.length ? "completed" : "skipped", duration_ms: groundingDuration, model: groundingModel, reasoning: "low", service_tier: "default", usage: candidatesRequiringGrounding.length ? { input_tokens: groundingUsage?.input_tokens ?? null, cached_input_tokens: groundingUsage?.input_tokens_details?.cached_tokens ?? null, cache_write_tokens: groundingUsage?.input_tokens_details?.cache_write_tokens ?? null, output_tokens: groundingUsage?.output_tokens ?? null, reasoning_tokens: groundingUsage?.output_tokens_details?.reasoning_tokens ?? null, total_tokens: groundingUsage?.total_tokens ?? null } : undefined },
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
