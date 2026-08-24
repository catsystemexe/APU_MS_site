export const DIALOG_ACTION_TYPES = ["MAIN", "SIDE", "NAV"] as const;
export type DialogActionType = typeof DIALOG_ACTION_TYPES[number];

export const DIALOG_ACTION_TARGETS = [
  "observed_phenomenon", "teacher_need", "context", "course", "helps", "hypothesis", "phase", "output",
] as const;
export type DialogActionTarget = typeof DIALOG_ACTION_TARGETS[number];

export const CONVERSATION_PHASES = ["intake", "development", "output"] as const;
export type ConversationPhase = typeof CONVERSATION_PHASES[number];

export type DialogActionOption = { id: string; label: string };
export type DialogAction = {
  type: DialogActionType;
  target: DialogActionTarget;
  question: string;
  required: boolean;
  options: DialogActionOption[];
};

export function cleanStructuredQuestionText(question: string) {
  return question.trim().replace(/^(?:💬\s*)+/, "");
}

export function cleanDialogActionQuestion(action: DialogAction): DialogAction {
  return { ...action, question: cleanStructuredQuestionText(action.question) };
}
export type QuestControllerResult = {
  phase: ConversationPhase;
  transition_ready: boolean;
  intake_question_policy_applies: boolean;
  dialog_actions: DialogAction[];
};
export type IntakeNotebookItem = {
  category: "manifestations" | "goals" | "context" | "course" | "helps";
  text: string;
};
export type IntakeRefinementContext = {
  askedTargets: DialogActionTarget[];
  pendingSide?: Pick<DialogAction, "target" | "question">;
};

const NAV_OPTION_IDS = new Set([
  "continue_to_solution", "continue_to_output", "add_context", "return_to_intake",
]);

const SIDE_NOTEBOOK_CATEGORY: Partial<Record<DialogActionTarget, IntakeNotebookItem["category"]>> = {
  context: "context",
  course: "course",
  helps: "helps",
};

function hasCategory(notebook: IntakeNotebookItem[], category: IntakeNotebookItem["category"]) {
  return notebook.some((item) => item.category === category && item.text.trim().length > 0);
}

export function requiredIntakeTarget(notebook: IntakeNotebookItem[]): "observed_phenomenon" | "teacher_need" | null {
  if (!hasCategory(notebook, "manifestations")) return "observed_phenomenon";
  if (!hasCategory(notebook, "goals")) return "teacher_need";
  return null;
}

export function missingRequiredIntakeTargets(notebook: IntakeNotebookItem[]) {
  const missing: Array<"observed_phenomenon" | "teacher_need"> = [];
  if (!hasCategory(notebook, "manifestations")) missing.push("observed_phenomenon");
  if (!hasCategory(notebook, "goals")) missing.push("teacher_need");
  return missing;
}

function normalizeNavigationText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("cs-CZ")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function resolveTextDialogEvent(
  message: string,
  notebook: IntakeNotebookItem[],
  currentPhase: ConversationPhase,
): "continue_to_solution" | "continue_to_output" | null {
  if (currentPhase === "output") return null;
  const text = normalizeNavigationText(message);
  if (!text) return null;

  if (currentPhase === "development") {
    const action = /\b(?:prejdi|prejdeme|prejit|pojdme|pokracuj|udelej|vytvor|priprav|sepis|chci|potrebuji)\b/.test(text);
    const destination = /\b(?:faze 3|treti faze|vystup\w*|dokument|plan|protokol|scenar|doporuceni)\b/.test(text);
    return action && destination ? "continue_to_output" : null;
  }
  if (requiredIntakeTarget(notebook)) return null;

  const declinesTransition = /\b(?:neprechazej|nepokracuj|nedavej|nenavrhuj|nechci|zatim ne|jeste ne|ne ted|az pozdeji|bez doporuceni)\b/.test(text);
  const asksAboutTransition = /^(?:jak|kdy|proc|co znamena|za jakych podminek)\b.*\b(?:faze 2|druhe faze|prejit|prechod)\b/.test(text);
  if (declinesTransition || asksAboutTransition) return null;

  const explicitContinuation = /^(?:ano |jo |dobre |ok )?(?:pokracuj(?:me)?|jdeme dal|jdem dal|pojdme dal|muzeme dal|muzes pokracovat)$/.test(text);
  const action = /\b(?:prejdi|prejdeme|prejit|pojdme|pokracuj|pokracujme|posunme|jdeme|jdem|dej|navrhni|priprav|ukaz|nabidni|chci|potrebuji|muzeme|muzes)\b/.test(text);
  const destination = /\b(?:faze 2|druhe faze|navrhy podpory|navrhum podpory|doporuceni|reseni|konkretni napady|konkretni navrhy|dalsi postup)\b/.test(text);
  const directRecommendation = /\b(?:co bys doporucil|co doporucujes|jak bys postupoval|jaky postup doporucujes)\b/.test(text);
  return explicitContinuation || (action && destination) || directRecommendation ? "continue_to_solution" : null;
}

export type F2OutputNavigationResolution = "stay_for_preview" | "enter_f3";

export function resolveF2OutputNavigation(
  textEvent: ReturnType<typeof resolveTextDialogEvent>,
  dialogEvent: string | undefined,
  hasAcceptedPreview: boolean,
): F2OutputNavigationResolution | null {
  if (textEvent !== "continue_to_output" && dialogEvent !== "continue_to_output") return null;
  return hasAcceptedPreview ? "enter_f3" : "stay_for_preview";
}

const CONTINUE_OPTION: DialogActionOption = {
  id: "continue_to_solution",
  label: "Můžeme se teď podívat, co z dosavadních informací vyplývá?",
};

function fallbackSideAction(notebook: IntakeNotebookItem[], askedTargets: DialogActionTarget[]): DialogAction {
  const candidates: Array<{ target: DialogActionTarget; category: IntakeNotebookItem["category"]; question: string }> = [
    { target: "context", category: "context", question: "V jakých situacích se tento projev objevuje nejčastěji a kdy je naopak menší?" },
    { target: "course", category: "course", question: "Jak často se to děje a mění se intenzita nebo průběh v čase?" },
    { target: "helps", category: "helps", question: "Co už jste v podobné situaci vyzkoušeli a co chování alespoň trochu změnilo?" },
  ];
  const candidate = candidates.find((item) => !askedTargets.includes(item.target) && !hasCategory(notebook, item.category));
  return candidate ? {
    type: "SIDE",
    target: candidate.target,
    question: candidate.question,
    required: false,
    options: [],
  } : {
    type: "SIDE",
    target: "hypothesis",
    question: "Je ještě něco důležitého, co byste chtěl k situaci doplnit?",
    required: false,
    options: [],
  };
}

function pendingSideAction(
  pendingSide: IntakeRefinementContext["pendingSide"],
  notebook: IntakeNotebookItem[],
): DialogAction | null {
  if (!pendingSide || !["context", "course", "helps", "hypothesis"].includes(pendingSide.target)) return null;
  const answeredCategory = SIDE_NOTEBOOK_CATEGORY[pendingSide.target];
  if (answeredCategory && hasCategory(notebook, answeredCategory)) return null;
  return { type: "SIDE", target: pendingSide.target, question: pendingSide.question, required: false, options: [] };
}

function mainAction(target: "observed_phenomenon" | "teacher_need"): DialogAction {
  return {
    type: "MAIN",
    target,
    question: target === "observed_phenomenon"
      ? "Co konkrétně žák v této situaci udělá nebo řekne?"
      : "Co teď v této situaci potřebujete vyřešit nebo změnit?",
    required: true,
    options: [],
  };
}

function navAction(): DialogAction {
  return {
    type: "NAV",
    target: "phase",
    question: "Můžeme se teď podívat, co z dosavadních informací vyplývá?",
    required: false,
    options: [CONTINUE_OPTION],
  };
}

export function fallbackQuestController(
  notebook: IntakeNotebookItem[],
  currentPhase: ConversationPhase,
  refinement: IntakeRefinementContext = { askedTargets: [] },
  applyIntakePolicy = currentPhase === "intake",
): QuestControllerResult {
  if (!applyIntakePolicy || currentPhase !== "intake") {
    return { phase: currentPhase, transition_ready: false, intake_question_policy_applies: false, dialog_actions: [] };
  }

  const missing = requiredIntakeTarget(notebook);
  const priority = missing ? mainAction(missing) : navAction();
  const askedTargets = [...new Set(refinement.askedTargets)];
  const side = pendingSideAction(refinement.pendingSide, notebook) ?? fallbackSideAction(notebook, askedTargets);
  return {
    phase: "intake",
    transition_ready: missing === null,
    intake_question_policy_applies: true,
    dialog_actions: missing ? [priority, side] : [side, priority],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseAction(value: unknown): DialogAction | null {
  if (!isRecord(value)) return null;
  if (!DIALOG_ACTION_TYPES.includes(value.type as DialogActionType)) return null;
  if (!DIALOG_ACTION_TARGETS.includes(value.target as DialogActionTarget)) return null;
  if (typeof value.question !== "string" || !value.question.trim() || value.question.length > 600) return null;
  if (typeof value.required !== "boolean" || !Array.isArray(value.options)) return null;
  const options = value.options as unknown[];
  if (!options.every((option) => isRecord(option) &&
    typeof option.id === "string" && NAV_OPTION_IDS.has(option.id) &&
    typeof option.label === "string" && option.label.trim().length > 0 && option.label.length <= 100)) return null;
  const optionIds = options.map((option) => (option as DialogActionOption).id);
  if (new Set(optionIds).size !== optionIds.length) return null;
  const action = value as DialogAction;
  if (action.type === "MAIN" && (!action.required || !["observed_phenomenon", "teacher_need"].includes(action.target) || options.length !== 0)) return null;
  if (action.type === "SIDE" && (action.required || !["context", "course", "helps", "hypothesis"].includes(action.target) || options.length !== 0)) return null;
  if (action.type === "NAV" && (action.required || !["phase", "output"].includes(action.target) || options.length < 1 || options.length > 3)) return null;
  return action;
}

export function validateQuestControllerResult(
  value: unknown,
  notebook: IntakeNotebookItem[],
  currentPhase: ConversationPhase,
  refinement: IntakeRefinementContext = { askedTargets: [] },
  applyIntakePolicy = currentPhase === "intake",
): QuestControllerResult | null {
  if (!isRecord(value) || !CONVERSATION_PHASES.includes(value.phase as ConversationPhase)) return null;
  if (typeof value.transition_ready !== "boolean") return null;
  if (typeof value.intake_question_policy_applies !== "boolean") return null;
  if (!Array.isArray(value.dialog_actions) || value.dialog_actions.length > 2) return null;
  const actions = value.dialog_actions.map(parseAction);
  if (actions.some((action) => action === null)) return null;
  const parsed = actions as DialogAction[];

  if (value.phase !== currentPhase) return null;
  if (!applyIntakePolicy || currentPhase !== "intake" || !value.intake_question_policy_applies) {
    if (value.intake_question_policy_applies) return null;
    if (parsed.length !== 0) return null;
    if (currentPhase === "output" && value.phase !== "output") return null;
    return value as QuestControllerResult;
  }

  if (parsed.length === 0) return null;
  const mains = parsed.filter((action) => action.type === "MAIN");
  const navs = parsed.filter((action) => action.type === "NAV");
  const sides = parsed.filter((action) => action.type === "SIDE");
  if (mains.length + navs.length !== 1 || sides.length !== 1 || parsed.length !== 2) return null;
  const missing = requiredIntakeTarget(notebook);
  const priority = missing ? parsed[0] : parsed[1];
  if (missing && (parsed[0].type !== "MAIN" || parsed[1].type !== "SIDE")) return null;
  if (!missing && (parsed[0].type !== "SIDE" || parsed[1].type !== "NAV")) return null;
  if (missing && (priority.type !== "MAIN" || priority.target !== missing)) return null;
  if (!missing && priority.type !== "NAV") return null;
  if (value.transition_ready !== (missing === null)) return null;
  if (priority.type === "NAV" &&
    (priority.options.length !== 1 || priority.options[0].id !== CONTINUE_OPTION.id || priority.options[0].label !== CONTINUE_OPTION.label)) return null;

  const askedTargets = [...new Set(refinement.askedTargets)];
  if (sides[0] && askedTargets.includes(sides[0].target)) return null;
  const sideCategory = sides[0] ? SIDE_NOTEBOOK_CATEGORY[sides[0].target] : undefined;
  if (sideCategory && hasCategory(notebook, sideCategory)) return null;
  return value as QuestControllerResult;
}

export function resolveDialogEvent(id: string, notebook: IntakeNotebookItem[], currentPhase: ConversationPhase): QuestControllerResult | null {
  if (!NAV_OPTION_IDS.has(id)) return null;
  const missing = requiredIntakeTarget(notebook);
  if (missing) return fallbackQuestController(notebook, currentPhase);
  if (id === "add_context" || id === "return_to_intake") {
    return {
      phase: "intake",
      transition_ready: true,
      intake_question_policy_applies: true,
      dialog_actions: [{
        type: "SIDE",
        target: "context",
        question: "Co dalšího z kontextu může být pro pochopení situace důležité?",
        required: false,
        options: [],
      }, navAction()],
    };
  }
  // F2 output intent is resolved locally against the accepted PREVIEW. The
  // controller must never advance directly to output without that snapshot.
  const phase: ConversationPhase = id === "continue_to_output" ? currentPhase : "development";
  return { phase, transition_ready: false, intake_question_policy_applies: false, dialog_actions: [] };
}
