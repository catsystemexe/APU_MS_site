import { getAccessIdentity } from "../../access-auth";
import { isSupportedModel } from "../../model-config";
import { F2_PATHS, type F2Path } from "../../notepad-model";
import type { F3RenderRequest } from "../../f3-finalization-model";

export const runtime = "edge";
const strings = { type: "array", items: { type: "string" } } as const;
const material = { type: "object", additionalProperties: false, required: ["kind", "title", "introduction", "sections", "table", "cards", "usageNote"], properties: { kind: { type: "string", enum: ["material"] }, title: { type: "string" }, introduction: { type: "string" }, sections: { type: "array", items: { type: "object", additionalProperties: false, required: ["heading", "content"], properties: { heading: { type: "string" }, content: { type: "string" } } } }, table: { anyOf: [{ type: "null" }, { type: "object", additionalProperties: false, required: ["columns", "rows"], properties: { columns: strings, rows: { type: "array", items: strings } } }] }, cards: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "content"], properties: { title: { type: "string" }, content: { type: "string" } } } }, usageNote: { type: ["string", "null"] } } } as const;
const issue = { type: "object", additionalProperties: false, required: ["kind", "reason", "affectedArea", "suggestedReturnToF2"], properties: { kind: { type: "string", enum: ["boundary_issue"] }, reason: { type: "string" }, affectedArea: { type: "string" }, suggestedReturnToF2: { type: "string" } } } as const;
const schema = { anyOf: [material, issue] } as const;
const BOUNDARY = `F2 snapshot je autoritativní věcný zdroj. F3 pouze materializuje, strukturuje a přeformuluje dodaný kontrakt. Neměň pedagogický cíl, nepřidávej ani nevyřazuj hypotézy, nevol jinou analytickou interpretaci, nenahrazuj vybraný přístup, neměň účel ani evidenci pozorování a neřeš nejistotu vymyšlenou jistotou. Hypotézy lze pro adresáta zjednodušit nebo vynechat, nikdy zesílit, oslabit, sloučit či prohlásit za potvrzené. Pokud požadovaná materializace vyžaduje věcnou volbu, která ve snapshotu není (zejména praktický přístup pro VYTVOŘIT), vrať boundary_issue; nic nevymýšlej.`;
const PATH: Record<F2Path, string> = {
  POCHOPIT: "Vytvoř vysvětlení nebo přehled bez nové intervence a zachovej význam analytických tvrzení.",
  POZOROVAT: "Materializuj pouze existující pozorovací specifikaci; tabulka smí obsahovat jen dodané indikátory, situace, kontrasty, rozsah a evidenci.",
  VYTVOŘIT: "Napiš skutečný materiál podle již zvoleného cíle, pracovního přístupu, podmínek a ověřování. Pokud pracovní přístup chybí, vrať boundary_issue.",
};
function error(message: string, status = 500) { return Response.json({ error: message }, { status }); }
function valid(value: unknown): value is F3RenderRequest { if (!value || typeof value !== "object") return false; const item = value as Partial<F3RenderRequest>; const snapshot = item.sourceSnapshot; return item.kind === "f3-render" && typeof item.sourceSnapshotId === "string" && typeof item.f3Target === "string" && typeof item.f3ConfigRevision === "number" && Boolean(snapshot && F2_PATHS.includes(snapshot.activePath) && snapshot.processedBuild?.path === snapshot.activePath && snapshot.processedRevision === snapshot.buildRevision) && Boolean(item.config && ["teacher", "parent", "student", "internal"].includes(item.config.audience) && ["concise", "plain", "professional", "accessible"].includes(item.config.languageStyle) && ["brief", "standard", "detailed"].includes(item.config.lengthDetail) && ["auto", "text", "table", "cards"].includes(item.config.structureMode)); }
function outputText(response: Record<string, unknown>) { if (typeof response.output_text === "string") return response.output_text; for (const item of Array.isArray(response.output) ? response.output : []) for (const part of Array.isArray((item as { content?: unknown[] }).content) ? (item as { content: unknown[] }).content : []) if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") return (part as { text: string }).text; return null; }
export async function POST(request: Request) {
  if (!await getAccessIdentity(request.headers)) return error("Chybí platná identita Cloudflare Access.", 401);
  const apiKey = process.env.OPENAI_API_KEY; if (!apiKey) return error("APU není dokončeno: chybí serverová konfigurace.", 503);
  let body: unknown; try { body = await request.json(); } catch { return error("Neplatný formát požadavku.", 400); }
  if (!valid(body)) return error("Neplatný F3 finalizační požadavek.", 400);
  const model = isSupportedModel(body.model) ? body.model : "gpt-5.6-terra"; const path = body.sourceSnapshot.activePath;
  const upstream = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, reasoning: { effort: "low" }, store: false, instructions: `${BOUNDARY}\n\n${PATH[path]}\nCíl a formát přizpůsob pouze parametrům požadavku. Relevantní omezení zachovej stručnou poznámkou.`, input: JSON.stringify(body), text: { format: { type: "json_schema", name: `f3_${path.toLowerCase()}_final_render`, strict: true, schema } } }) });
  if (!upstream.ok) return error("Finální výstup se nepodařilo vytvořit.", 502);
  const response = await upstream.json() as Record<string, unknown>; const text = outputText(response); if (!text) return error("Model nevrátil použitelný F3 výsledek.", 502);
  try { return Response.json({ result: JSON.parse(text), meta: { action: `F3 final render — ${path}`, model: typeof response.model === "string" ? response.model : model } }); } catch { return error("Model vrátil neplatný strukturovaný F3 výsledek.", 502); }
}
