import {
  fallbackQuestController,
  missingRequiredIntakeTargets,
  requiredIntakeTarget,
  resolveDialogEvent,
  type ConversationPhase,
  type IntakeRefinementContext,
  type IntakeNotebookItem,
  validateQuestControllerResult,
} from "./dialog-action.ts";
import type { DebugMapping } from "./response-metadata.ts";
import { callOpenAIResponses, type RequestUsageCollector } from "./openai-responses-instrumentation.ts";

export const QUEST_CONTROLLER_MODEL = "gpt-5.6-luna";

export function canBypassQuestController(input: {
  phase: ConversationPhase;
  notebook: IntakeNotebookItem[];
  refinement: IntakeRefinementContext;
  applyIntakePolicy: boolean;
  hasExplicitNavigationEvent: boolean;
  hasResolvedIntakeUpdate: boolean;
}) {
  return input.phase === "intake" &&
    input.applyIntakePolicy &&
    input.hasResolvedIntakeUpdate &&
    !input.hasExplicitNavigationEvent &&
    !input.refinement.pendingSide &&
    missingRequiredIntakeTargets(input.notebook).length === 1;
}

export const QUEST_CONTROLLER_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    phase: { type: "string", enum: ["intake", "development", "output"] },
    transition_ready: { type: "boolean" },
    intake_question_policy_applies: { type: "boolean" },
    chat_navigation_event: { type: "string", enum: ["none", "continue_to_solution"] },
    dialog_actions: {
      type: "array", maxItems: 2,
      items: {
        type: "object", additionalProperties: false,
        properties: {
          type: { type: "string", enum: ["MAIN", "SIDE", "NAV"] },
          target: { type: "string", enum: ["observed_phenomenon", "teacher_need", "context", "course", "helps", "hypothesis", "phase", "output"] },
          question: { type: "string", maxLength: 600 },
          required: { type: "boolean" },
          options: {
            type: "array", maxItems: 3,
            items: {
              type: "object", additionalProperties: false,
              properties: {
                id: { type: "string", enum: ["continue_to_solution", "continue_to_output", "add_context", "return_to_intake"] },
                label: { type: "string", maxLength: 100 },
              },
              required: ["id", "label"],
            },
          },
        },
        required: ["type", "target", "question", "required", "options"],
      },
    },
  },
  required: ["phase", "transition_ready", "intake_question_policy_applies", "chat_navigation_event", "dialog_actions"],
} as const;

type ControllerResponse = {
  id?: string; model?: string; usage?: Record<string, unknown>; output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
};
function responseText(response: unknown) {
  if (!response || typeof response !== "object") return "";
  const body = response as ControllerResponse;
  if (typeof body.output_text === "string") return body.output_text;
  return body.output?.flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text").map((item) => item.text ?? "").join("") ?? "";
}
const FUNCTIONAL_ROUTING_HINTS = `Interní orientační osy pro výběr diskriminační otázky:
- P1 komunikace a jazyk; P2 aktivace, pozornost a tempo; P3 emoční regulace; P4 senzorické zpracování; P5 adaptace na změnu; P6 sociální porozumění a hra; P7 motorické plánování; P8 tělesné rytmy a sebeobsluha.
- Zóna 1 výkon/činnost; Zóna 2 regulace; Zóna 3 bezpečí/jistota; Zóna 4 očekávání/porozumění/vztah.
- Blok A emoce/regulace; B sociální chování; C kognice/porozumění/flexibilita; D komunikace; E tělo/aktivace.
Osy jsou pracovní hypotézy, ne diagnóza. V otázce nikdy nezobrazuj jejich kódy ani názvy.`;

const CONTROLLER_INSTRUCTIONS = `Jsi technický Quest Controller APU Site. Pedagogickou politiku otázek určuje výhradně přiložený APU Core.
- Vrať pouze strukturovaný výsledek podle schématu.
- dialog_actions je seřazené pole samostatně renderovaných otázek. Pokud chybí povinné minimum, MAIN je první a SIDE druhá. Po splnění minima je SIDE první a NAV poslední.
- Hodnota dialog_actions[].question je čistý datový text: nikdy do ní nevkládej emoji, prefix 💬 ani jiné vizuální označení. Ikonu dodává výhradně UI.
- phase je skutečný runtime stav. Neměň jej jen proto, že je minimum intake splněné nebo zobrazuješ NAV. transition_ready pouze říká, že lze nabídnout NAV; phase zůstává intake až do samostatné explicitní dialogové akce uživatele.
- Pokud pendingSide existuje, sémanticky posuď, zda ji currentMessage zodpověděla a zda je stále relevantní. Je-li nezodpovězená a relevantní, vrať ji beze změny jako SIDE. Je-li zodpovězená nebo již nerelevantní, vyber další SIDE podle Core.
- intake_question_policy_applies klasifikuje, zda jde podle Core o relevantní intake tah. Pokud je true, dialog_actions musí obsahovat prioritní otázku; pokud je false nebo se přechází mimo intake, vrať prázdné dialog_actions.
- SIDE target technicky klasifikuj podle obsahu: context = kdy/kde/při čem/s kým; course = četnost/délka/intenzita/trend; helps = co bylo vyzkoušeno a s jakým účinkem; hypothesis = interpretace pedagoga.
- NAV pro přechod do řešení použije option continue_to_solution s labelem „Chcete přejít k návrhům podpory?“.
- chat_navigation_event nastav na continue_to_solution pouze tehdy, když currentMessage obsahuje jednoznačný uživatelský pokyn přejít k návrhům, doporučením, řešení či pokračovat dál. Kliknutí na NAV a takový chatový pokyn jsou rovnocenné. Pouhá odpověď na SIDE, otázka o možnosti přechodu, negace, odklad nebo nejednoznačné „ano“ znamenají none.
- Target uvedený v askedRefinementTargets neopakuj. SIDE na context, course nebo helps nepokládej ani tehdy, když už příslušná kategorie obsahuje údaj v currentNotebook.
- Komunikační profil neznáš a nesmí ovlivnit strukturu rozhodnutí.
- Confirmed Zápisník je kanonický pracovní kontext; unconfirmed zápis je pouze pracovní vodítko.`;

export async function runQuestController(args: {
  apiKey: string;
  requestId: string;
  turnId: string | null;
  collector: RequestUsageCollector;
  coreInstructions: string;
  message: string;
  notebook: IntakeNotebookItem[];
  phase: ConversationPhase;
  refinement: IntakeRefinementContext;
  applyIntakePolicy: boolean;
  functionalMapping?: DebugMapping;
}) {
  const fallback = fallbackQuestController(args.notebook, args.phase, args.refinement, args.applyIntakePolicy);
  try {
    const { response, usage_record, application_result } = await callOpenAIResponses({
      api_key: args.apiKey,
      request_id: args.requestId,
      turn_id: args.turnId,
      phase: args.phase === "intake" ? "F1" : "F2",
      operation: "controller",
      requested_model: QUEST_CONTROLLER_MODEL,
      reasoning_effort: "low",
      requested_service_tier: "default",
      collector: args.collector,
      payload: {
        model: QUEST_CONTROLLER_MODEL,
        reasoning: { effort: "low" },
        service_tier: "default",
        instructions: `${args.coreInstructions}\n\n${CONTROLLER_INSTRUCTIONS}\n\n${FUNCTIONAL_ROUTING_HINTS}`,
        input: JSON.stringify({
          phase: args.phase,
          currentMessage: args.message,
          currentNotebook: args.notebook,
          askedRefinementTargets: args.refinement.askedTargets,
          pendingSide: args.refinement.pendingSide ?? null,
          applyIntakePolicy: args.applyIntakePolicy,
          lastFunctionalMapping: args.functionalMapping ?? null,
        }),
        text: { format: { type: "json_schema", name: "apu_quest_controller", strict: true, schema: QUEST_CONTROLLER_SCHEMA } },
        max_output_tokens: 1_000, store: false,
      },
      validate_application_response: (providerResponse) => {
        const parsed = JSON.parse(responseText(providerResponse)) as { chat_navigation_event?: unknown };
        const result = validateQuestControllerResult(
          parsed,
          args.notebook,
          args.phase,
          args.refinement,
          args.applyIntakePolicy,
        );
        if (result && parsed.chat_navigation_event === "continue_to_solution" && args.applyIntakePolicy &&
          args.phase === "intake" && requiredIntakeTarget(args.notebook) === null) {
          const transitioned = resolveDialogEvent("continue_to_solution", args.notebook, args.phase);
          if (transitioned) return transitioned;
        }
        if (!result) throw new Error("invalid controller response");
        return result;
      },
    });
    if (usage_record.provider_status !== "completed" || !application_result) return { result: fallback, response: null, usedFallback: true };
    return { result: application_result, response: response.body as ControllerResponse, usedFallback: false };
  } catch {
    return { result: fallback, response: null, usedFallback: true };
  }
}
