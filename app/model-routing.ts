import type { ConversationPhase } from "./dialog-action.ts";
import { isSupportedModel, type SupportedModelId } from "./model-config.ts";

export const AUTO_MODEL_SELECTION = "auto" as const;
export type ModelSelection = SupportedModelId | typeof AUTO_MODEL_SELECTION;

export type ChatExecution = {
  model: SupportedModelId;
  reasoning: "low";
  useKnowledgeBase: boolean;
  automatic: boolean;
  routingSource: "manual-override" | "phase-1" | "phase-2";
};

export function isModelSelection(value: unknown): value is ModelSelection {
  return value === AUTO_MODEL_SELECTION || isSupportedModel(value);
}

export function resolveRequestRuntime(input: {
  manualModelOverride: ModelSelection;
  phase: ConversationPhase;
}): ChatExecution {
  const useKnowledgeBase = input.phase !== "intake";
  const automaticModel = useKnowledgeBase ? "gpt-5.6-terra" : "gpt-5.6-luna";

  if (input.manualModelOverride !== AUTO_MODEL_SELECTION) {
    return {
      model: input.manualModelOverride,
      reasoning: "low",
      useKnowledgeBase,
      automatic: false,
      routingSource: "manual-override",
    };
  }

  return {
    model: automaticModel,
    reasoning: "low",
    useKnowledgeBase,
    automatic: true,
    routingSource: input.phase === "intake" ? "phase-1" : "phase-2",
  };
}
