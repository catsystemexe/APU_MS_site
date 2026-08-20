"use client";

import { Lightbulb, Signpost } from "lucide-react";
import type { DialogAction } from "./dialog-action";
import { NOTEPAD_CATEGORY_META } from "./notepad-categories";

const TARGET_META = {
  observed_phenomenon: NOTEPAD_CATEGORY_META.manifestations,
  teacher_need: NOTEPAD_CATEGORY_META.goals,
  context: NOTEPAD_CATEGORY_META.context,
  course: NOTEPAD_CATEGORY_META.course,
  helps: NOTEPAD_CATEGORY_META.helps,
  hypothesis: { label: "Pracovní hypotéza", icon: Lightbulb },
  phase: { label: "Volba dalšího kroku", icon: Signpost },
  output: { label: "Volba výstupu", icon: Signpost },
} as const;

export default function DialogActionCard({ action, active, onSelect }: {
  action: DialogAction; active: boolean; onSelect: (id: string, label: string) => void;
}) {
  const meta = TARGET_META[action.target as keyof typeof TARGET_META] ?? TARGET_META.phase;
  const Icon = meta.icon;
  const tone = action.type === "NAV"
    ? "navigation"
    : action.target === "observed_phenomenon" || action.target === "teacher_need"
      ? "primary"
      : "detail";
  const solutionOption = action.options.find((option) => option.id === "continue_to_solution");
  if (action.type === "NAV" && action.options.length === 1 && solutionOption) {
    return (
      <aside className="dialog-action dialog-action--navigation" aria-label={meta.label}>
        <button className="dialog-action-nav-card is-standalone" type="button" disabled={!active}
          onClick={() => onSelect(solutionOption.id, solutionOption.label)}>
          <span className="dialog-action-nav-icon"><Signpost aria-hidden="true" /></span>
          <span>{solutionOption.label}</span>
        </button>
      </aside>
    );
  }
  return (
    <aside className={`dialog-action dialog-action--${tone}`} aria-label={meta.label}>
      <div className="dialog-action-question">
        <span className="dialog-action-icon" title={meta.label}><Icon aria-hidden="true" /></span>
        <p>{action.question}</p>
      </div>
      {action.type === "SIDE" && (
        <div className="dialog-action-nav-wrap">
          {solutionOption && (
            <button className="dialog-action-nav-card" type="button" disabled={!active}
              onClick={() => onSelect(solutionOption.id, solutionOption.label)}>
              <span className="dialog-action-nav-icon"><Signpost aria-hidden="true" /></span>
              <span>{solutionOption.label}</span>
            </button>
          )}
        </div>
      )}
      {action.type === "NAV" && (
        <div className="dialog-action-buttons">
          {action.options.map((option) => (
            <button className={option.id === "continue_to_solution" ? "dialog-action-nav-card" : undefined}
              type="button" disabled={!active} key={option.id} onClick={() => onSelect(option.id, option.label)}>
              {option.id === "continue_to_solution" && <span className="dialog-action-nav-icon"><Signpost aria-hidden="true" /></span>}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
