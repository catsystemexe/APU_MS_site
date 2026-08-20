import type { Diagnostics } from "./conversation-diagnostics";
import type { DialogAction } from "./dialog-action";

export type TranscriptMessage = {
  role: "user" | "assistant";
  content: string;
  phaseLabel?: string;
  dialogActions?: DialogAction[];
  debugText?: string;
  diagnostics?: Diagnostics;
  controllerDiagnostics?: Diagnostics;
};

function diagnosticLine(label: string, diagnostics: Diagnostics) {
  return `${label}: ${diagnostics.model} · IN ${diagnostics.inputTokens} · OUT ${diagnostics.outputTokens} · Σ ${diagnostics.inputTokens + diagnostics.outputTokens}`;
}

export function formatChatTranscript(messages: TranscriptMessage[]) {
  return messages.map((message) => {
    const lines = [message.role === "assistant" ? "APU" : "VY"];
    if (message.phaseLabel) lines.push(message.phaseLabel);
    if (message.content.trim()) lines.push(message.content.trim());

    if (message.role === "assistant") {
      for (const action of message.dialogActions ?? []) {
        lines.push(`OTÁZKA ${action.type}: ${action.question}`);
        if (action.options.length) {
          lines.push(`MOŽNOSTI: ${action.options.map((option) => option.label).join(" | ")}`);
        }
      }
    }

    if (message.debugText) lines.push(message.debugText);
    if (message.diagnostics) lines.push(diagnosticLine("MODEL", message.diagnostics));
    if (message.controllerDiagnostics) lines.push(diagnosticLine("QUEST CONTROLLER", message.controllerDiagnostics));
    return lines.join("\n");
  }).join("\n\n");
}
