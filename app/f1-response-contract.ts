import type { DialogAction, QuestControllerResult } from "./dialog-action";

const SAFE_STRUCTURED_F1_FALLBACK = "Rozumím. Popsanou situaci budeme dál zpřesňovat podle vašich informací.";

function semanticText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("cs-CZ")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function actionTexts(actions: DialogAction[]) {
  return actions.flatMap((action) => [action.question, ...action.options.map((option) => option.label)]);
}

export function isStructuredF1Turn(result: QuestControllerResult) {
  return result.phase === "intake" && result.dialog_actions.length > 0;
}

export function mainProseOwnsDialogInteraction(prose: string, actions: DialogAction[]) {
  const normalizedProse = semanticText(prose);
  const repeatsAction = actionTexts(actions).some((text) => {
    const normalizedAction = semanticText(text);
    return normalizedAction.length > 0 && normalizedProse.includes(normalizedAction);
  });
  if (repeatsAction) return true;

  // In a structured F1 turn, any prose sentence presented as a question creates
  // a competing interaction even when it paraphrases rather than copies an action.
  return /(?:^|\n|[.!]\s+)[^\n?]{2,}\?/u.test(prose);
}

export function enforceStructuredF1Prose(prose: string, actions: DialogAction[]) {
  return !prose.trim() || mainProseOwnsDialogInteraction(prose, actions) ? SAFE_STRUCTURED_F1_FALLBACK : prose;
}
