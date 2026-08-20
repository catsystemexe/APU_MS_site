import { Check, LoaderCircle, PencilLine } from "lucide-react";

export const F1_PROCESSING_STAGES = [
  "processing_input",
  "input_processed",
  "notebook_updating",
  "notebook_updated",
  "preparing_response",
] as const;

export type F1ProcessingStage = typeof F1_PROCESSING_STAGES[number];

const STATUS_CONTENT: Record<F1ProcessingStage, { label: string; state: "processing" | "completed" | "writing" }> = {
  processing_input: { label: "Zpracovávám informace…", state: "processing" },
  input_processed: { label: "Informace zpracovány", state: "completed" },
  notebook_updating: { label: "Aktualizuji Zápisník…", state: "writing" },
  notebook_updated: { label: "Zápisník aktualizován", state: "completed" },
  preparing_response: { label: "Připravuji odpověď…", state: "processing" },
};

export function ProcessingStatus({ stage }: { stage: F1ProcessingStage }) {
  const content = STATUS_CONTENT[stage];
  const Icon = content.state === "completed" ? Check : content.state === "writing" ? PencilLine : LoaderCircle;

  return (
    <div className={`processing-status processing-status--${content.state}`} role="status">
      <Icon aria-hidden="true" />
      <span>{content.label}</span>
    </div>
  );
}
