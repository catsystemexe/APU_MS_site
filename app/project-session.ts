import { EMPTY_NOTEPAD } from "./notepad-model.ts";
import type { WorkspacePanel } from "./notepad.tsx";

export function shouldResetCurrentProject(
  hasProjectData: boolean,
  confirmReset: () => boolean,
) {
  return !hasProjectData || confirmReset();
}

export function createProjectResetState<Message>(welcomeMessage: Message) {
  return {
    messages: [welcomeMessage],
    notepad: EMPTY_NOTEPAD,
    responseId: null,
    phase: "intake" as const,
    activePanel: null as WorkspacePanel,
    error: null,
    failedInput: null,
    composerInput: "",
    isComposerExpanded: false,
    isLoading: false,
    exportStatus: "idle" as const,
    dictationNotice: null,
    hasDictationDraft: false,
  };
}
