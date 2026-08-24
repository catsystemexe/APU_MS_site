import { getAccessIdentity } from "../../access-auth";
import { isSupportedModel } from "../../model-config";
import type { F2PreviewSnapshot, PochopitBuildRequest } from "../../f2-build-model";

export const runtime = "edge";

const stringArray = { type: "array", items: { type: "string" } } as const;
const hypothesis = { type: "object", additionalProperties: false, required: ["id", "rank", "title", "summary", "relevantNeeds", "supportingInformation", "limitations", "unknowns"], properties: {
  id: { type: "string" }, rank: { type: "integer" }, title: { type: "string" }, summary: { type: "string" }, relevantNeeds: stringArray,
  supportingInformation: stringArray, limitations: stringArray, unknowns: stringArray,
} } as const;
const uncertainty = { type: "object", additionalProperties: false, required: ["missing", "importance", "limitation"], properties: { missing: { type: "string" }, importance: { type: "string" }, limitation: { type: "string" } } } as const;
const analytical = { type: "object", additionalProperties: false, required: ["relationships", "comparisons", "expertFrame", "synthesis", "decisions", "uncertainties"], properties: {
  relationships: stringArray, comparisons: stringArray, expertFrame: stringArray, synthesis: { type: "string" }, decisions: stringArray, uncertainties: { type: "array", items: uncertainty },
} } as const;
const BUILD_SCHEMA = { type: "object", additionalProperties: false, required: ["hypotheses", "analytical"], properties: { hypotheses: { type: "array", maxItems: 8, items: hypothesis }, analytical } } as const;
const PREVIEW_SCHEMA = { type: "object", additionalProperties: false, required: ["title", "introduction", "sections"], properties: { title: { type: "string" }, introduction: { type: "string" }, sections: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false, required: ["heading", "content"], properties: { heading: { type: "string" }, content: { type: "string" } } } } } } as const;

const SKILL_SEMANTICS: Record<string, string> = {
  "pochopit-1": "Rozviň mechanismy; při skutečně odlišných mechanismech hypotézu rozděl a při oporě přidej novou. Neprodlužuj pouze text.",
  "pochopit-2": "Porovnej podobnosti, rozdíly, shodu s evidencí a rozlišující evidenci; bez umělého vítěze.",
  "pochopit-3": "Hledej vztahy mezi projevy, kontextem, průběhem, podporami, potřebou a hypotézami; odliš asociaci od kauzality.",
  "pochopit-4": "Doplň jen konkrétně relevantní pedagogické/psychologické pojmy a propoj je se situací; parametr uživatele musí řídit zaměření.",
  "pochopit-5": "Syntetizuj opřené, plausibilní a neznámé; ponech otevřené interpretace a nedělej diagnózu.",
};
function error(message: string, status = 500) { return Response.json({ error: message }, { status }); }
function outputText(response: Record<string, unknown>) { if (typeof response.output_text === "string") return response.output_text; const output = Array.isArray(response.output) ? response.output : []; for (const item of output) for (const part of Array.isArray((item as { content?: unknown[] }).content) ? (item as { content: unknown[] }).content : []) if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") return (part as { text: string }).text; return null; }
function validBuild(value: unknown): value is PochopitBuildRequest { if (!value || typeof value !== "object") return false; const body = value as Partial<PochopitBuildRequest>; return body.kind === "pochopit-build" && body.activePath === "POCHOPIT" && body.canonicalNeed?.initialF2Path !== undefined && Array.isArray(body.situation) && body.situation.length <= 80 && Array.isArray(body.workingHypotheses) && Array.isArray(body.activeSkills) && body.activeSkills.length > 0 && body.activeSkills.every((skill) => skill.id in SKILL_SEMANTICS) && typeof body.buildRevision === "number"; }
function validSnapshot(value: unknown): value is F2PreviewSnapshot { if (!value || typeof value !== "object") return false; const snapshot = value as Partial<F2PreviewSnapshot>; return snapshot.activePath === "POCHOPIT" && snapshot.canonicalNeed?.needText !== undefined && snapshot.processedRevision === snapshot.buildRevision && Array.isArray(snapshot.hypotheses) && Array.isArray(snapshot.activeSkills); }

export async function POST(request: Request) {
  if (!await getAccessIdentity(request.headers)) return error("Chybí platná identita Cloudflare Access.", 401);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return error("APU není dokončeno: chybí serverová konfigurace.", 503);
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return error("Neplatný formát požadavku.", 400); }
  const operation = body.operation;
  const model = isSupportedModel(body.model) ? body.model : "gpt-5.6-terra";
  let schema: typeof BUILD_SCHEMA | typeof PREVIEW_SCHEMA; let name: string; let instructions: string; let input: unknown;
  if (operation === "build" && validBuild(body.build)) {
    schema = BUILD_SCHEMA; name = "f2_pochopit_build"; const build = body.build;
    instructions = `Pracuješ v APU F2 POCHOPIT. Jednotkou práce je jedna situace jako celek a sdílené dynamické hypotézy. Fakta Zápisníku jsou kanonická; F2 interpretace jsou pouze odvozené a nesmějí fakta ani pedagogickou potřebu přepsat. Aktivní dovednosti jsou kompozice operací, nikoli pořadí. Hypotézy mohou zesílit, zeslábnout, sloučit se, rozdělit, zmizet či vzniknout. Zachovej ID významově stejné hypotézy; nové dostanou nové jedinečné ID. Pracuj pouze podle aktivních dovedností a nevynucuj obsah neaktivních polí. Přiznej nejistotu bez blokování užitečné analýzy: každá nejistota rozliší co chybí, proč to záleží a co to omezuje. Nevytvářej automatické otázky, diagnózu, intervenční plán ani vlastní F3 logiku.\nAktivní operace:\n${build.activeSkills.map((skill) => `- ${skill.label}: ${SKILL_SEMANTICS[skill.id]}${skill.parameterText ? ` Zaměření uživatele: ${skill.parameterText}` : ""}`).join("\n")}`;
    input = build;
  } else if (operation === "preview" && validSnapshot(body.snapshot)) {
    schema = PREVIEW_SCHEMA; name = "f2_pochopit_preview";
    instructions = "Vyrenderuj provizorní odborný náhled výhradně z neměnného F2 snapshotu. Snapshot nepřehodnocuj z konverzace, neměň pedagogickou potřebu, cestu ani analytické závěry a nezaváděj intervenční směr. F3 target smí ovlivnit přehlednost formy, nikdy expertní logiku. Jde o výstup F2 a časný kontrakt pro F3, ne finální F3 dokument. Pokud snapshot obsahuje rozpor, transparentně ho uveď místo tiché opravy.";
    input = body.snapshot;
  } else return error("Neplatný nebo nepodporovaný F2 požadavek.", 400);
  const upstream = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, reasoning: { effort: "low" }, store: false, instructions, input: JSON.stringify(input), text: { format: { type: "json_schema", name, strict: true, schema } } }) });
  if (!upstream.ok) return error("Modelové zpracování F2 se nezdařilo.", 502);
  const response = await upstream.json() as Record<string, unknown>; const text = outputText(response);
  if (!text) return error("Model nevrátil použitelný F2 výsledek.", 502);
  try { return Response.json({ result: JSON.parse(text), meta: { action: operation === "build" ? "f2-build-execution" : "f2-preview-render", model: typeof response.model === "string" ? response.model : model } }); } catch { return error("Model vrátil neplatný strukturovaný F2 výsledek.", 502); }
}
