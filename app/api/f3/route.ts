import { getAccessIdentity } from "../../access-auth";
import { isF2ToF3Snapshot } from "../../f2-build-model";
import { isSupportedModel } from "../../model-config";
import { F2_PATHS, type F2Path } from "../../notepad-model";
import { parseF3RenderResult, type F3RenderRequest } from "../../f3-finalization-model";
import { callOpenAIResponses, createRequestUsageCollector, modelUsagePayload, usageErrorPayload, type RequestUsageCollector } from "../../openai-responses-instrumentation";

export const runtime = "edge";
const nonEmpty = { type: "string", minLength: 1 } as const;
const strings = { type: "array", items: nonEmpty } as const;
const material = { type: "object", additionalProperties: false, required: ["kind", "title", "introduction", "sections", "table", "cards", "usageNote"], properties: { kind: { type: "string", enum: ["material"] }, title: nonEmpty, introduction: nonEmpty, sections: { type: "array", minItems: 1, items: { type: "object", additionalProperties: false, required: ["heading", "content"], properties: { heading: nonEmpty, content: nonEmpty } } }, table: { anyOf: [{ type: "null" }, { type: "object", additionalProperties: false, required: ["columns", "rows"], properties: { columns: { ...strings, minItems: 1 }, rows: { type: "array", items: strings } } }] }, cards: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "content"], properties: { title: nonEmpty, content: nonEmpty } } }, usageNote: { anyOf: [{ type: "null" }, nonEmpty] } } } as const;
const issue = { type: "object", additionalProperties: false, required: ["kind", "reason", "affectedArea", "suggestedReturnToF2"], properties: { kind: { type: "string", enum: ["boundary_issue"] }, reason: nonEmpty, affectedArea: nonEmpty, suggestedReturnToF2: nonEmpty } } as const;
const schema = { anyOf: [material, issue] } as const;
const BOUNDARY = `Snapshot aktuálního Rozboru je autoritativní věcný zdroj. F3 pouze materializuje, strukturuje a přeformuluje dodaný kontrakt. Neměň pedagogický cíl, nepřidávej ani nevyřazuj hypotézy, nevol jinou analytickou interpretaci, nenahrazuj vybraný přístup, neměň účel ani evidenci pozorování a neřeš nejistotu vymyšlenou jistotou. Hypotézy lze pro adresáta zjednodušit nebo vynechat, nikdy zesílit, oslabit, sloučit či prohlásit za potvrzené. Pokud požadovaná materializace vyžaduje věcnou volbu, která ve snapshotu není (zejména praktický přístup pro VYTVOŘIT), vrať boundary_issue; nic nevymýšlej.`;
const PATH: Record<F2Path, string> = {
  POCHOPIT: "Vytvoř vysvětlení nebo přehled bez nové intervence a zachovej význam analytických tvrzení.",
  POZOROVAT: "Materializuj pouze existující pozorovací specifikaci; tabulka smí obsahovat jen dodané indikátory, situace, kontrasty, priority a vazby na hypotézy.",
  VYTVOŘIT: "Napiš skutečný materiál podle již zvoleného cíle, pracovního přístupu, podmínek a ověřování. Pokud pracovní přístup chybí, vrať boundary_issue.",
};
function error(message: string, status = 500, collector?: RequestUsageCollector) { return Response.json(collector ? modelUsagePayload({ error: message }, collector) : { error: message }, { status }); }
function valid(value: unknown): value is F3RenderRequest { if (!value || typeof value !== "object") return false; const item = value as Partial<F3RenderRequest>; const snapshot = item.sourceSnapshot; return item.kind === "f3-render" && typeof item.sourceSnapshotId === "string" && typeof item.sourceFingerprint === "string" && typeof item.f3Target === "string" && typeof item.f3ConfigRevision === "number" && Boolean(snapshot && isF2ToF3Snapshot(snapshot) && item.sourceSnapshotId === snapshot.snapshotId && item.sourceFingerprint === snapshot.sourceFingerprint && F2_PATHS.includes(snapshot.activePath)) && Boolean(item.config && ["teacher", "parent", "student", "internal"].includes(item.config.audience) && ["concise", "plain", "professional", "accessible"].includes(item.config.languageStyle) && ["brief", "standard", "detailed"].includes(item.config.lengthDetail) && ["auto", "text", "table", "cards"].includes(item.config.structureMode)); }
function outputText(response: Record<string, unknown>) { if (typeof response.output_text === "string") return response.output_text; for (const item of Array.isArray(response.output) ? response.output : []) for (const part of Array.isArray((item as { content?: unknown[] }).content) ? (item as { content: unknown[] }).content : []) if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") return (part as { text: string }).text; return null; }
export async function POST(request: Request) {
  if (!await getAccessIdentity(request.headers)) return error("Chybí platná identita Cloudflare Access.", 401);
  const apiKey = process.env.OPENAI_API_KEY; if (!apiKey) return error("APU není dokončeno: chybí serverová konfigurace.", 503);
  let body: unknown; try { body = await request.json(); } catch { return error("Neplatný formát požadavku.", 400); }
  if (!valid(body)) return error("Neplatný F3 finalizační požadavek.", 400);
  const model = isSupportedModel(body.model) ? body.model : "gpt-5.6-terra"; const path = body.sourceSnapshot.activePath;
  const collector = createRequestUsageCollector();
  try {
    const source = body.sourceSnapshot;
    const { response, usage_record, application_result } = await callOpenAIResponses({
      api_key: apiKey, request_id: crypto.randomUUID(), phase: "F3", operation: "f3_render", requested_model: model, reasoning_effort: "low", requested_service_tier: "default", collector,
      payload: { model, reasoning: { effort: "low" }, service_tier: "default", store: false, instructions: `${BOUNDARY}\n\n${PATH[path]}\nCíl a formát přizpůsob pouze parametrům požadavku. Relevantní omezení zachovej stručnou poznámkou.`, input: JSON.stringify({ source: { canonicalNeed: source.canonicalNeed, activePath: source.activePath, baselineHypotheses: source.baselineHypotheses, currentRozbor: source.currentRozbor, limitations: source.limitations, f3Target: source.f3Target }, presentation: body.config }), text: { format: { type: "json_schema", name: `f3_${path.toLowerCase()}_final_render`, strict: true, schema } } },
      validate_application_response: (providerResponse) => {
        const text = outputText(providerResponse); if (!text) throw new Error("missing structured output");
        return parseF3RenderResult(JSON.parse(text));
      },
    });
    if (usage_record.provider_status !== "completed" || !application_result) return error("Finální výstup se nepodařilo vytvořit.", 502, collector);
    return Response.json(modelUsagePayload({ result: application_result, meta: { action: `F3 final render — ${path}`, model: typeof response.body.model === "string" ? response.body.model : model } }, collector));
  } catch (cause) {
    const payload = usageErrorPayload(cause, collector);
    return Response.json(payload ?? modelUsagePayload({ error: "Model vrátil neplatný strukturovaný F3 výsledek." }, collector), { status: 502 });
  }
}
