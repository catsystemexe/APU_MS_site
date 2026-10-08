import { getAccessIdentity } from "../../access-auth";
import { isF2ToF3Snapshot } from "../../f2-build-model";
import { isSupportedModel } from "../../model-config";
import { F2_PATHS, type F2Path } from "../../notepad-model";
import type { F3RenderRequest } from "../../f3-finalization-model";
import { F3_PROVIDER_SCHEMA, parseF3ProviderResult } from "../../f3-provider-contract";
import { callOpenAIResponses, createRequestUsageCollector, modelUsagePayload, usageErrorPayload, type RequestUsageCollector } from "../../openai-responses-instrumentation";

export const runtime = "edge";
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
  const identity = await getAccessIdentity(request.headers);
  if (!identity) return error("Chybí platná identita Cloudflare Access.", 401);
  const apiKey = process.env.OPENAI_API_KEY; if (!apiKey) return error("APU není dokončeno: chybí serverová konfigurace.", 503);
  let body: unknown; try { body = await request.json(); } catch { return error("Neplatný formát požadavku.", 400); }
  if (!valid(body)) return error("Neplatný F3 finalizační požadavek.", 400);
  const model = isSupportedModel(body.model) ? body.model : "gpt-5.6-terra"; const path = body.sourceSnapshot.activePath;
  const collector = createRequestUsageCollector();
  try {
    const source = body.sourceSnapshot;
    const { response, usage_record, application_result } = await callOpenAIResponses({
      api_key: apiKey, request_id: crypto.randomUUID(), phase: "F3", operation: "f3_render", requested_model: model, reasoning_effort: "low", requested_service_tier: "default", collector,
      payload: { model, reasoning: { effort: "low" }, service_tier: "default", store: false, instructions: `${BOUNDARY}\n\n${PATH[path]}\nCíl a formát přizpůsob pouze parametrům požadavku. Relevantní omezení zachovej stručnou poznámkou. V kořenovém objektu nastav kind a právě jednu odpovídající větev material nebo boundaryIssue; druhá větev musí být null.`, input: JSON.stringify({ source: { canonicalNeed: source.canonicalNeed, activePath: source.activePath, baselineHypotheses: source.baselineHypotheses, currentRozbor: source.currentRozbor, limitations: source.limitations, f3Target: source.f3Target }, presentation: body.config }), text: { format: { type: "json_schema", name: `f3_${path.toLowerCase()}_final_render`, strict: true, schema: F3_PROVIDER_SCHEMA } } },
      validate_application_response: (providerResponse) => {
        const text = outputText(providerResponse); if (!text) throw new Error("missing structured output");
        return parseF3ProviderResult(JSON.parse(text));
      },
    });
    if (usage_record.provider_status !== "completed" || !application_result) {
      const code = usage_record.error?.code;
      const safeCode = typeof code === "string" && /^[a-z0-9_.-]{1,80}$/i.test(code) ? code : "unknown";
      return Response.json(modelUsagePayload({
        error: "Finální výstup se nepodařilo vytvořit.",
        ...(identity.role === "developer" ? { diagnostic: `F3 provider request failed: status=${usage_record.provider_status}; category=${usage_record.error?.category ?? "unknown"}; code=${safeCode}` } : {}),
      }, collector), { status: 502 });
    }
    return Response.json(modelUsagePayload({ result: application_result, meta: { action: `F3 final render — ${path}`, model: typeof response.body.model === "string" ? response.body.model : model } }, collector));
  } catch (cause) {
    const payload = usageErrorPayload(cause, collector);
    return Response.json(payload ?? modelUsagePayload({ error: "Model vrátil neplatný strukturovaný F3 výsledek." }, collector), { status: 502 });
  }
}
