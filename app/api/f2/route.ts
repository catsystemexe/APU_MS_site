import { getAccessIdentity } from "../../access-auth";
import { isSupportedModel } from "../../model-config";
import { F2_PATHS, type F2Path } from "../../notepad-model";
import { F2_PATH_BASE_SEMANTICS, parseF2BuildResult, parseF2RenderedPreview, parseGeneratedRozborComponents, type F2BuildRequest, type F2PreviewSnapshot, type PochopitBuildConfig, type RequiredRozborComponent, type RozborComponentGenerationRequest } from "../../f2-build-model";

export const runtime = "edge";

const stringArray = { type: "array", items: { type: "string" } } as const;
const hypothesis = { type: "object", additionalProperties: false, required: ["id", "rank", "title", "summary", "relevantNeeds", "supportingInformation", "limitations", "unknowns"], properties: { id: { type: "string" }, rank: { type: "integer" }, title: { type: "string" }, summary: { type: "string" }, relevantNeeds: stringArray, supportingInformation: stringArray, limitations: stringArray, unknowns: stringArray } } as const;
const uncertainty = { type: "object", additionalProperties: false, required: ["description", "whyRelevant", "limits", "relatedDecisionOrArea"], properties: { description: { type: "string" }, whyRelevant: { type: "string" }, limits: { type: "string" }, relatedDecisionOrArea: { type: "string" } } } as const;
const common = { hypotheses: { type: "array", maxItems: 8, items: hypothesis }, decisions: stringArray, uncertainties: { type: "array", items: uncertainty }, missingInformation: stringArray } as const;
const understandingResult = { type: "object", additionalProperties: false, required: ["kind", "relationships", "comparisons", "expertFrame", "synthesis"], properties: { kind: { type: "string", enum: ["understanding"] }, relationships: stringArray, comparisons: stringArray, expertFrame: stringArray, synthesis: { type: "string" } } } as const;
const observationResult = { type: "object", additionalProperties: false, required: ["kind", "purpose", "observableIndicators", "situations", "comparisonConditions", "scope", "evidenceMethod", "hypothesisLinks", "limitations"], properties: { kind: { type: "string", enum: ["observation"] }, purpose: { type: "string" }, observableIndicators: { type: "array", items: { type: "object", additionalProperties: false, required: ["indicator", "interpretation"], properties: { indicator: { type: "string" }, interpretation: { type: "string" } } } }, situations: stringArray, comparisonConditions: stringArray, scope: { type: "string" }, evidenceMethod: stringArray, hypothesisLinks: stringArray, limitations: stringArray } } as const;
const creationResult = { type: "object", additionalProperties: false, required: ["kind", "pedagogicalObjective", "candidateApproaches", "variantComparison", "workingApproach", "conditions", "whatToVerify", "relevantHypotheses", "limitations"], properties: { kind: { type: "string", enum: ["creation"] }, pedagogicalObjective: { type: "string" }, candidateApproaches: stringArray, variantComparison: stringArray, workingApproach: { type: "string" }, conditions: stringArray, whatToVerify: stringArray, relevantHypotheses: stringArray, limitations: stringArray } } as const;
const resultSchema = (pathResult: typeof understandingResult | typeof observationResult | typeof creationResult) => ({ type: "object", additionalProperties: false, required: ["hypotheses", "pathResult", "decisions", "uncertainties", "missingInformation"], properties: { ...common, pathResult } } as const);
const BUILD_SCHEMAS = { POCHOPIT: resultSchema(understandingResult), POZOROVAT: resultSchema(observationResult), VYTVOŘIT: resultSchema(creationResult) } as const;
const PREVIEW_SCHEMA = { type: "object", additionalProperties: false, required: ["title", "introduction", "sections"], properties: { title: { type: "string" }, introduction: { type: "string" }, sections: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false, required: ["heading", "content"], properties: { heading: { type: "string" }, content: { type: "string" } } } } } } as const;

function componentSchema(spec: RequiredRozborComponent) {
  const properties: Record<string, object> = { id: { type: "string", enum: [spec.id] }, kind: { type: "string", enum: [spec.kind] }, content: { type: "string", minLength: 1 } };
  const required = ["id", "kind", "content"];
  if (spec.hypothesisId) { properties.hypothesisId = { type: "string", enum: [spec.hypothesisId] }; required.push("hypothesisId"); }
  return { type: "object", additionalProperties: false, required, properties };
}

export function rozborComponentSchema(specs: RequiredRozborComponent[]) {
  return { type: "object", additionalProperties: false, required: ["components"], properties: { components: { type: "array", minItems: specs.length, maxItems: specs.length, items: { anyOf: specs.map(componentSchema) } } } };
}

function validConfig(value: unknown): value is PochopitBuildConfig { if (!value || typeof value !== "object") return false; const config = value as Partial<PochopitBuildConfig>; return [0, 1, 2, 3].includes(config.expansionDepth ?? -1) && typeof config.compareHypotheses === "boolean" && typeof config.expertFrame === "boolean"; }
export function validRozborGeneration(value: unknown): value is RozborComponentGenerationRequest {
  if (!value || typeof value !== "object") return false;
  const body = value as Partial<RozborComponentGenerationRequest>;
  if (!body.canonicalNeed || typeof body.canonicalNeed.needText !== "string" || !Array.isArray(body.hypotheses) || body.hypotheses.length > 8 || !validConfig(body.config) || !Array.isArray(body.components) || !body.components.length || body.components.length > 10) return false;
  const hypothesisIds = new Set(body.hypotheses.map(({ id }) => id)); const ids = new Set<string>();
  return body.components.every((spec) => {
    if (!spec || typeof spec.id !== "string" || ids.has(spec.id) || typeof spec.fingerprint !== "string") return false; ids.add(spec.id);
    if (spec.kind === "hypothesis-expansion") return body.config!.expansionDepth > 0 && typeof spec.hypothesisId === "string" && hypothesisIds.has(spec.hypothesisId) && spec.id === `hypothesis:${spec.hypothesisId}:expansion`;
    if (spec.kind === "hypothesis-comparison") return body.config!.compareHypotheses && spec.hypothesisId === undefined && spec.id === "comparison:all";
    return spec.kind === "expert-frame" && body.config!.expertFrame && spec.hypothesisId === undefined && spec.id === "expert-frame:all";
  });
}

export function rozborComponentInstructions(request: RozborComponentGenerationRequest) {
  const depth = request.config.expansionDepth;
  const depthInstruction = depth === 1 ? "Hloubka 1 — Základně: prakticky vysvětli mechanismus a možné relevantní projevy."
    : depth === 2 ? "Hloubka 2 — Podrobně: zahrň základní význam, mechanismy, podmínky, vztahy a co dostupný kontext podporuje nebo oslabuje."
      : depth === 3 ? "Hloubka 3 — Do hloubky: zahrň podrobný význam, kritickou interpretaci, alternativní vysvětlení, limity, komplikující faktory, hraniční podmínky a důsledky pro další uvažování; nevytvářej obecný akademický přehled." : "Rozvinutí hypotéz není požadováno.";
  return `F2 je pracovní analytický Rozbor, ne finální F3 próza. Každou vyžádanou komponentu zpracuj samostatně, stručně, strukturovaně a pouze pod přesným dodaným ID. Nepřepisuj výchozí hypotézy, nevymýšlej fakta a zachovej nejistotu; kanonická fakta uživatele mají přednost před hypotézami a inferencí.\n\nROZVINUTÍ HYPOTÉZY — pouze lokální případová analýza dané hypotézy. ${depthInstruction}\n\nPOROVNÁNÍ — pouze jedna syntéza napříč hypotézami: rozdíly, průniky, slučitelnost, možné souběžné působení, napětí, vysvětlované aspekty a nerozlišitelnost z dostupných informací. Respektuj analytickou hloubku ${depth}.\n\nODBORNÝ RÁMEC — pouze explicitní relevantní pojmenované teorie, modely, konstrukty a výzkumné koncepty. Terminologii nepřidávej dekorativně; nefabrikuj studie, autory, DOI, velikosti účinku ani empirická tvrzení. Není-li konkrétní evidence spolehlivě známá, zůstaň u obecného teoretického rámce a jasně jej odliš od specifické evidence.`;
}

export const F2_SKILL_SEMANTICS: Record<string, string> = {
  "pochopit-1": "Rozviň mechanismy; při skutečně odlišných mechanismech hypotézu rozděl a při oporě přidej novou. Neprodlužuj pouze text.",
  "pochopit-2": "Porovnej podobnosti, rozdíly, shodu s evidencí a rozlišující evidenci; bez umělého vítěze.",
  "pochopit-3": "Hledej vztahy mezi projevy, kontextem, průběhem, podporami, potřebou a hypotézami; odliš asociaci od kauzality.",
  "pochopit-4": "Doplň jen konkrétně relevantní pedagogické/psychologické pojmy a propoj je se situací; parametr uživatele musí řídit zaměření.",
  "pochopit-5": "Syntetizuj opřené, plausibilní a neznámé; ponech otevřené interpretace a nedělej diagnózu.",
  "pozorovat-1": "Přelož nejasné obavy do pozorovatelných indikátorů. Vždy odliš přímo pozorovatelný jev od kvalifikované interpretace.",
  "pozorovat-2": "Vyber jen informativní situace, které mohou odhalit vzorec nebo rozlišit hypotézy; nepožaduj pozorování všude.",
  "pozorovat-3": "Navrhni relevantní kontrasty podmínek a proměnných, včetně evidence, která může současné hypotézy oslabit; nevynucuj předem dané kategorie.",
  "pozorovat-4": "Navrhni přiměřené období, četnost či výběr vzorků s dostatečnou variací a bez zbytečné zátěže.",
  "pozorovat-5": "Urči pozorovatelnou a interpretovatelnou evidenci a způsob záznamu; odděl syrový záznam od pozdější interpretace a nevynucuj jedinou metodiku.",
  "vytvořit-1": "Urči praktický pedagogický cíl odlišný od formátu artefaktu uvedeného jako F3 target.",
  "vytvořit-2": "Navrhni plausibilní přístupy nebo mechanismy ukotvené v kontextu a současných hypotézách; neprodukuj obecný seznam strategií.",
  "vytvořit-3": "Porovnej realistické varianty, výhody, náklady, omezení a rizika; při nedostatku kontextu neurčuj falešného vítěze.",
  "vytvořit-4": "Urči pouze relevantní podmínky prostředí, načasování, podpory, předpokladů, dávkování či adaptace.",
  "vytvořit-5": "Urči zvlášť indikátory úspěchu realizace a žádoucího pedagogického dopadu a zachovej zpětnou vazbu k pozorování a porozumění.",
};
const PATH_PROMPTS: Record<F2Path, string> = {
  POCHOPIT: "POCHOPIT má vysokou toleranci nejistoty a slouží odbornému porozumění. Nevytvářej bez požadavku observační protokol ani intervenci.",
  POZOROVAT: "POZOROVAT má střední toleranci nejistoty: převáděj pozorovatelná neznáma na chybějící evidenci, co sledovat a kde/jak. Rozliš, co pozorování vyřešit může, co nemůže a jaká jsou omezení designu. Propoj indikátory s podporou, oslabením, rozlišením či nevyřešením hypotéz a umožni evidenci proti nim. Výsledkem je specifikace pozorování, ne široký vysvětlující esej ani hotový formulář či tabulka.",
  VYTVOŘIT: "VYTVOŘIT má nejnižší toleranci relevantní nejistoty: u každé chybějící informace uveď proč záleží a která konkrétní část návrhu je provizorní. Pokračuj podmíněnými doporučeními, adaptabilními rozsahy a variantami bez falešné přesnosti. Pedagogický cíl není F3 artefakt. Výsledkem je zdůvodněná praktická build specifikace, nikoli hotový materiál, přesné znění položek, grafická sazba, stránky ani tisk/export.",
};
const SHARED_PROMPT = "Jednotkou práce je jedna situace jako celek. Fakta Zápisníku a kanonická pedagogická potřeba jsou zdroj pravdy; F2 interpretace jsou odvozené a nesmějí je přepsat. Aktivní cesta v požadavku je autoritativní a nesmí se odvozovat z textu, dovedností, F3 targetu ani předchozího výsledku. Sdílené hypotézy zůstávají dynamické a mohou při analytické oporě zesílit, zeslábnout, sloučit se, rozdělit, zmizet či vzniknout, ale nikdy se tiše nestávají faktem. Zachovej ID významově stejné hypotézy. Aktivní dovednosti jsou kompozice požadovaných operací, nikoli povinné pořadí; vyplňuj pole pouze podle nich. Nejistotu transparentně lokalizuj jako popis, relevanci, omezení a související rozhodnutí. Nejistota nikdy automaticky neblokuje pokračování. F3 target je oddělený časný kontrakt: F2 nesmí plně materializovat finální artefakt.";

function error(message: string, status = 500) { return Response.json({ error: message }, { status }); }
function outputText(response: Record<string, unknown>) { if (typeof response.output_text === "string") return response.output_text; const output = Array.isArray(response.output) ? response.output : []; for (const item of output) for (const part of Array.isArray((item as { content?: unknown[] }).content) ? (item as { content: unknown[] }).content : []) if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") return (part as { text: string }).text; return null; }
function isPath(value: unknown): value is F2Path { return typeof value === "string" && F2_PATHS.includes(value as F2Path); }
export function validBuild(value: unknown): value is F2BuildRequest { if (!value || typeof value !== "object") return false; const body = value as Partial<F2BuildRequest>; return body.kind === "f2-build" && isPath(body.activePath) && body.canonicalNeed?.initialF2Path !== undefined && Array.isArray(body.canonicalNotebookContext) && body.canonicalNotebookContext.length <= 80 && Array.isArray(body.workingHypotheses) && Array.isArray(body.activeSkills) && body.activeSkills.every((skill) => skill.id.startsWith(`${body.activePath!.toLowerCase()}-`) && skill.id in F2_SKILL_SEMANTICS) && typeof body.buildRevision === "number" && Number.isInteger(body.buildRevision) && body.buildRevision >= 0; }
function validSnapshot(value: unknown): value is F2PreviewSnapshot { if (!value || typeof value !== "object") return false; const snapshot = value as Partial<F2PreviewSnapshot>; return typeof snapshot.snapshotId === "string" && snapshot.snapshotId.length > 0 && isPath(snapshot.activePath) && snapshot.canonicalNeed?.needText !== undefined && Number.isInteger(snapshot.buildRevision) && snapshot.processedRevision === snapshot.buildRevision && snapshot.processedBuild?.path === snapshot.activePath && typeof snapshot.processedBuild.processedResultId === "string" && snapshot.processedBuild.processedResultId.length > 0 && snapshot.processedBuild.processedRevision === snapshot.processedRevision && Array.isArray(snapshot.hypotheses) && Array.isArray(snapshot.activeSkills); }

export async function POST(request: Request) {
  if (!await getAccessIdentity(request.headers)) return error("Chybí platná identita Cloudflare Access.", 401);
  const apiKey = process.env.OPENAI_API_KEY; if (!apiKey) return error("APU není dokončeno: chybí serverová konfigurace.", 503);
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return error("Neplatný formát požadavku.", 400); }
  const operation = body.operation; const model = isSupportedModel(body.model) ? body.model : "gpt-5.6-terra";
  let schema: object; let name: string; let instructions: string; let input: unknown; let activePath: F2Path | undefined; let componentRequest: RozborComponentGenerationRequest | undefined;
  if (operation === "build" && validBuild(body.build)) {
    const build = body.build; activePath = build.activePath; schema = BUILD_SCHEMAS[activePath]; name = `f2_${activePath.toLowerCase()}_build`;
    const operations = build.activeSkills.length ? build.activeSkills.map((skill) => `- ${skill.label}: ${F2_SKILL_SEMANTICS[skill.id]}${skill.parameterText ? ` Zaměření uživatele: ${skill.parameterText}` : ""}`).join("\n") : "- Žádné; proveď pouze základní úlohu cesty a neaktivuj skrytě žádnou volitelnou operaci.";
    instructions = `${SHARED_PROMPT}\n\nZákladní úloha aktivní cesty: ${F2_PATH_BASE_SEMANTICS[activePath]}\n${PATH_PROMPTS[activePath]}\n\nVolitelné aktivní operace:\n${operations}`; input = build;
  } else if (operation === "preview" && validSnapshot(body.snapshot)) {
    activePath = body.snapshot.activePath; schema = PREVIEW_SCHEMA; name = `f2_${activePath.toLowerCase()}_preview`;
    instructions = `Vyrenderuj náhled výhradně z neměnného F2 snapshotu pro autoritativní cestu ${activePath}. Snapshot nepřehodnocuj z konverzace, neměň pedagogickou potřebu, cestu ani závěry. ${PATH_PROMPTS[activePath]} F3 target smí ovlivnit přehlednost formy, nikdy nesmí vést k finální materializaci F3 dokumentu.`; input = body.snapshot;
  } else if (operation === "generate-rozbor-components" && validRozborGeneration(body.request)) {
    componentRequest = body.request; schema = rozborComponentSchema(componentRequest.components); name = "f2_pochopit_components";
    instructions = rozborComponentInstructions(componentRequest);
    input = { canonicalNeed: componentRequest.canonicalNeed, hypotheses: componentRequest.hypotheses, config: componentRequest.config, components: componentRequest.components.map(({ id, kind, hypothesisId }) => ({ id, kind, ...(hypothesisId ? { hypothesisId } : {}) })) };
  } else return error("Neplatný nebo nepodporovaný F2 požadavek.", 400);
  const upstream = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, reasoning: { effort: "low" }, store: false, instructions, input: JSON.stringify(input), text: { format: { type: "json_schema", name, strict: true, schema } } }) });
  if (!upstream.ok) return error("Modelové zpracování F2 se nezdařilo.", 502);
  const response = await upstream.json() as Record<string, unknown>; const text = outputText(response); if (!text) return error("Model nevrátil použitelný F2 výsledek.", 502);
  try {
    const parsed = JSON.parse(text);
    if (componentRequest) return Response.json({ components: parseGeneratedRozborComponents(parsed, componentRequest.components), meta: { action: "F2 POCHOPIT component generation", model: typeof response.model === "string" ? response.model : model } });
    const result = operation === "build" ? parseF2BuildResult(parsed, activePath!) : parseF2RenderedPreview(parsed);
    return Response.json({ result, meta: { action: operation === "build" ? `F2 build execution — ${activePath}` : `F2 preview — ${activePath}`, model: typeof response.model === "string" ? response.model : model } });
  } catch { return error("Model vrátil neplatný strukturovaný F2 výsledek.", 502); }
}
