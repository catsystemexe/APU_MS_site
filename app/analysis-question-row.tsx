import { Info, X } from "lucide-react";
import { NOTEPAD_CATEGORY_META } from "./notepad-categories";
import type { CategoryId } from "./notepad-model";

type AnalysisQuestionRowProps = {
  text: string;
  target?: CategoryId;
  onSkip?: () => void;
  className?: string;
};

export function AnalysisQuestionRow({ text, target, onSkip, className = "" }: AnalysisQuestionRowProps) {
  const Icon = target ? (NOTEPAD_CATEGORY_META[target]?.icon ?? Info) : Info;
  return <div className={`analysis-question${onSkip ? "" : " analysis-question--static"} ${className}`.trim()}>
    <Icon aria-hidden="true" /><span>{text}</span>
    {onSkip && <button type="button" onClick={onSkip} title="Přeskočit otázku" aria-label="Přeskočit otázku"><X aria-hidden="true" /></button>}
  </div>;
}
