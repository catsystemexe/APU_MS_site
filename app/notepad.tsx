"use client";

import { ChevronDown, FileText, Info, NotebookPen, Plus, ScanSearch, TriangleAlert, type LucideIcon } from "lucide-react";
import { ChangeEvent, KeyboardEvent, type RefObject, useEffect, useRef, useState } from "react";
import {
  CategoryId,
  createLocalId,
  EMPTY_NOTEPAD,
  LEGACY_NOTEPAD_STORAGE_KEY,
  migrateLegacyNotepad,
  NotepadEntry,
  NOTEPAD_STORAGE_KEY,
  NotepadState,
  parseNotepadState,
} from "./notepad-model";
import { NOTEPAD_CATEGORIES } from "./notepad-categories";
import { NOTEPAD_CATEGORY_META } from "./notepad-categories";
import { AnalysisQuestionRow } from "./analysis-question-row";
import type { AnalysisState, SuggestedNeed } from "./analysis-model";
import { toggleExpandedHypothesis } from "./analysis-accordion";
import type { ConversationPhase } from "./dialog-action";

export type WorkspacePanel = "notepad" | "analysis" | "output" | null;

type WorkspacePanelProps = {
  activePanel: WorkspacePanel;
  entries: NotepadState;
  onEntriesChange: (entries: NotepadState) => void;
  onEntryNavigate: (entry: NotepadEntry) => void;
  onEntrySeen: (entryId: string) => void;
  phase: ConversationPhase;
  analysis: AnalysisState;
  analysisStatus: "idle" | "loading" | "ready" | "error";
  analysisError: string | null;
  selectedHypothesisId: string | null;
  activeNeedId: string | null;
  onSelectHypothesis: (id: string) => void;
  onSelectNeed: (id: string) => void;
  onRetryAnalysis: () => void;
  onSkipAnalysisQuestion: (text: string) => void;
  unseenAnalysisKeys: Set<string>;
  highlightedAnalysisKeys: Set<string>;
  onAnalysisItemSeen: (key: string) => void;
  onConfirmSuggestedNeed: (need: SuggestedNeed) => void;
  onContinueToOutput: () => void;
};

function useViewportSeen(ref: RefObject<Element | null>, key: string, unseen: boolean, onSeen: (key: string) => void) {
  useEffect(() => {
    const element = ref.current;
    if (!element || !unseen || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.6) timer ??= setTimeout(() => onSeen(key), 800);
      else if (timer) { clearTimeout(timer); timer = null; }
    }, { threshold: [0.6] });
    observer.observe(element);
    return () => { if (timer) clearTimeout(timer); observer.disconnect(); };
  }, [key, onSeen, ref, unseen]);
}

type OpenWorkspacePanel = Exclude<WorkspacePanel, null>;

const WORKSPACE_PANELS: Record<OpenWorkspacePanel, {
  label: string;
  description: string;
  icon: LucideIcon;
}> = {
  notepad: {
    label: "Zápisník",
    description: "Obsahuje potvrzené informace o situaci a je hlavním zdrojem pro další práci APU.",
    icon: NotebookPen,
  },
  analysis: {
    label: "Rozbor",
    description: "Zobrazuje možné interpretace, hypotézy, jejich oporu a nejistoty odvozené z informací v Zápisníku.",
    icon: ScanSearch,
  },
  output: {
    label: "Výstup",
    description: "Slouží k vytvoření výsledného strukturovaného dokumentu z aktuálního rozboru situace.",
    icon: FileText,
  },
};

export function usePersistentNotepad() {
  const [entries, setEntries] = useState<NotepadState>(EMPTY_NOTEPAD);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const hydrate = window.setTimeout(() => {
      try {
        const current = window.localStorage.getItem(NOTEPAD_STORAGE_KEY);
        if (current) {
          setEntries(parseNotepadState(JSON.parse(current)) ?? EMPTY_NOTEPAD);
        } else {
          const legacy = window.localStorage.getItem(LEGACY_NOTEPAD_STORAGE_KEY);
          setEntries(legacy ? migrateLegacyNotepad(JSON.parse(legacy)) ?? EMPTY_NOTEPAD : EMPTY_NOTEPAD);
        }
      } catch {
        setEntries(EMPTY_NOTEPAD);
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(hydrate);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(NOTEPAD_STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Keep the current in-memory map when storage is unavailable.
    }
  }, [entries, hydrated]);

  return { entries, setEntries, hydrated };
}

function ItemEditor({
  entry,
  label,
  autoFocus,
  onChange,
  onRemove,
  onNavigate,
  onSeen,
}: {
  entry: NotepadEntry;
  label: string;
  autoFocus: boolean;
  onChange: (value: string) => void;
  onRemove: () => void;
  onNavigate: () => void;
  onSeen: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const itemRef = useRef<HTMLLIElement>(null);
  useViewportSeen(itemRef, entry.id, entry.visibility === "unseen", onSeen);

  useEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
    if (autoFocus) textarea.focus();
  }, [autoFocus, entry.text]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Backspace" && entry.text.length === 0) {
      event.preventDefault();
      onRemove();
    }
  }

  return (
    <li
      ref={itemRef}
      id={`notepad-entry-${entry.id}`}
      className={`notepad-item${entry.source ? " has-source" : ""}${entry.visibility === "unseen" ? " is-unseen" : ""}`}
    >
      <button
        className="notepad-bullet"
        type="button"
        onClick={onNavigate}
        disabled={!entry.source}
        aria-label={entry.source
            ? "Přejít ke zdrojové větě v chatu"
            : "Ručně zadaná položka"}
        title={entry.source
            ? "Zobrazit zdroj v chatu"
            : "Ručně zadaná položka"}
      />
      <textarea
        ref={ref}
        rows={1}
        value={entry.text}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (!entry.text.trim()) onRemove();
        }}
        aria-label={`${label} – položka`}
        placeholder="Napište položku…"
      />
    </li>
  );
}

function NotepadPanel({
  entries,
  onEntriesChange,
  onEntryNavigate,
  onEntrySeen,
}: Pick<WorkspacePanelProps, "entries" | "onEntriesChange" | "onEntryNavigate" | "onEntrySeen">) {
  const [focusedItem, setFocusedItem] = useState<string | null>(null);

  function addItem(category: CategoryId) {
    const entry: NotepadEntry = { id: createLocalId(), text: "", origin: "manual" };
    setFocusedItem(entry.id);
    onEntriesChange({ ...entries, [category]: [...entries[category], entry] });
  }

  function updateItem(category: CategoryId, index: number, value: string) {
    setFocusedItem(null);
    const next = [...entries[category]];
    next[index] = { id: next[index].id, text: value, origin: "manual" };
    onEntriesChange({ ...entries, [category]: next });
  }

  function removeItem(category: CategoryId, index: number) {
    setFocusedItem(null);
    onEntriesChange({
      ...entries,
      [category]: entries[category].filter((_, itemIndex) => itemIndex !== index),
    });
  }

  return (
    <div id="workspace-notepad" className="notepad-scroll" role="tabpanel" aria-label="Zápisník">
      <div className="situation-map" aria-label="Mapa situace">
            {NOTEPAD_CATEGORIES.map(({ id, label, icon: Icon }) => (
              <section className="notepad-category" key={id} aria-labelledby={`notepad-${id}`}>
                <div className="category-heading">
                  <h2 id={`notepad-${id}`} className="category-tab">
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                  </h2>
                </div>

                {entries[id].length ? (
                  <ul className="notepad-items">
                    {entries[id].map((entry, index) => (
                      <ItemEditor
                        key={entry.id}
                        entry={entry}
                        label={label}
                        autoFocus={focusedItem === entry.id}
                        onChange={(value) => updateItem(id, index, value)}
                        onRemove={() => removeItem(id, index)}
                        onNavigate={() => onEntryNavigate(entry)}
                        onSeen={() => onEntrySeen(entry.id)}
                      />
                    ))}
                  </ul>
                ) : null}

                <button className="add-notepad-item" type="button" onClick={() => addItem(id)}>
                  <Plus aria-hidden="true" />
                  <span>Přidat položku</span>
                </button>
              </section>
            ))}
      </div>
    </div>
  );
}

function AnalysisQuestionItem({ question, unseen, highlighted, onSeen, onSkip }: {
  question: AnalysisState["hypotheses"][number]["questions"][number]; unseen: boolean; highlighted: boolean;
  onSeen: (key: string) => void; onSkip: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const key = `question:${question.id}`;
  useViewportSeen(ref, key, unseen, onSeen);
  return <div ref={ref} className="analysis-question-observer">
    <AnalysisQuestionRow text={question.text} target={question.target} onSkip={() => onSkip(question.id)} className={highlighted ? "is-highlighted" : ""} />
  </div>;
}

function AnalysisQuestions({ questions, onSkip, unseenKeys, highlightedKeys, onSeen }: {
  questions: AnalysisState["hypotheses"][number]["questions"]; onSkip: (id: string) => void;
  unseenKeys: Set<string>; highlightedKeys: Set<string>; onSeen: (key: string) => void;
}) {
  if (!questions.length) return null;
  return <div className="analysis-questions">{questions.filter((question) => question.status === "active").map((question) => <AnalysisQuestionItem
    key={question.id} question={question} unseen={unseenKeys.has(`question:${question.id}`)} highlighted={highlightedKeys.has(`question:${question.id}`)} onSeen={onSeen} onSkip={onSkip}
  />)}</div>;
}

function HypothesisRow({ hypothesis, analysis, mode, isActive, isExpanded, onToggle, unseenKeys, highlightedKeys, onSeen, onSkip }: {
  hypothesis: AnalysisState["hypotheses"][number]; analysis: AnalysisState; mode: AnalysisState["mode"]; isActive: boolean; isExpanded: boolean; onToggle: () => void;
  unseenKeys: Set<string>; highlightedKeys: Set<string>; onSeen: (key: string) => void; onSkip: (id: string) => void;
}) {
  const headerRef = useRef<HTMLElement>(null); const detailRef = useRef<HTMLDivElement>(null);
  const headerKey = `hypothesis:${hypothesis.id}:header`; const detailKey = `hypothesis:${hypothesis.id}:detail`;
  const detailId = `analysis-hypothesis-${hypothesis.id}-detail`;
  useViewportSeen(headerRef, headerKey, unseenKeys.has(headerKey), onSeen);
  useViewportSeen(detailRef, detailKey, isExpanded && unseenKeys.has(detailKey), onSeen);
  return <article ref={headerRef} className={`analysis-hypothesis${isActive ? " is-active" : ""}${highlightedKeys.has(headerKey) ? " is-highlighted" : ""}`}>
    <button className="analysis-hypothesis-heading" type="button" onClick={onToggle} aria-expanded={isExpanded} aria-controls={detailId}>
      <span className="analysis-rank">{hypothesis.rank}</span><ChevronDown className="analysis-hypothesis-chevron" aria-hidden="true" /><span className="analysis-hypothesis-copy"><strong>{hypothesis.title}</strong><small>{hypothesis.summary}</small></span>
    </button>
    {isExpanded && <div id={detailId} ref={detailRef} className={`analysis-detail${highlightedKeys.has(detailKey) ? " is-highlighted" : ""}`}>
      {mode === "entry" ? <>
        {hypothesis.relevantNeeds.length > 0 && <><h3>Relevantní pro</h3><p>{hypothesis.relevantNeeds.map((id) => analysis.needs.find((need) => need.needId === id)?.title ?? id).join(" · ")}</p></>}
        {hypothesis.question && <AnalysisQuestionItem question={hypothesis.question} unseen={unseenKeys.has(`question:${hypothesis.question.id}`)} highlighted={highlightedKeys.has(`question:${hypothesis.question.id}`)} onSeen={onSeen} onSkip={onSkip} />}
      </> : <>
        {hypothesis.supportingInformation.length > 0 && <><h3>Opora v Zápisníku</h3><ul>{hypothesis.supportingInformation.map((item) => <li key={item}>{item}</li>)}</ul></>}
        {hypothesis.limitations.length > 0 && <><h3><TriangleAlert aria-hidden="true" /> Limity a nejistoty</h3><ul>{hypothesis.limitations.map((item) => <li key={item}>{item}</li>)}</ul></>}
        {hypothesis.unknowns.length > 0 && <><h3>Neznámé informace</h3><ul>{hypothesis.unknowns.map((item) => <li key={item}>{item}</li>)}</ul></>}
        {hypothesis.question && <AnalysisQuestionItem question={hypothesis.question} unseen={unseenKeys.has(`question:${hypothesis.question.id}`)} highlighted={highlightedKeys.has(`question:${hypothesis.question.id}`)} onSeen={onSeen} onSkip={onSkip} />}
        <AnalysisQuestions questions={hypothesis.questions} onSkip={onSkip} unseenKeys={unseenKeys} highlightedKeys={highlightedKeys} onSeen={onSeen} />
      </>}
    </div>}
  </article>;
}

function NeedTab({ need, active, unseen, highlighted, onSeen, onSelect }: {
  need: AnalysisState["needs"][number]; active: boolean; unseen: boolean; highlighted: boolean; onSeen: (key: string) => void; onSelect: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null); const key = `need:${need.needId}:tab`;
  useViewportSeen(ref, key, unseen, onSeen);
  return <button ref={ref} type="button" role="tab" aria-selected={active} className={`${active ? "is-active" : ""}${highlighted ? " is-highlighted" : ""}`} onClick={onSelect}>{need.title}</button>;
}

function NeedContent({ need, analysis, mode, unseenKeys, highlightedKeys, onSeen, onSkip }: {
  need: AnalysisState["needs"][number]; analysis: AnalysisState; mode: AnalysisState["mode"]; unseenKeys: Set<string>; highlightedKeys: Set<string>;
  onSeen: (key: string) => void; onSkip: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null); const key = `need:${need.needId}:content`;
  useViewportSeen(ref, key, unseenKeys.has(key), onSeen);
  return <div ref={ref} className={`analysis-need-content${highlightedKeys.has(key) ? " is-highlighted" : ""}`} role="tabpanel">
    <h3>Směr</h3><p>{need.direction}</p>
    <h3>Relevantní hypotézy</h3><ul>{need.relevantHypotheses.map((id) => <li key={id}>{analysis.hypotheses.find((item) => item.id === id)?.title ?? id}</li>)}</ul>
    {need.question && <AnalysisQuestionItem question={need.question} unseen={unseenKeys.has(`question:${need.question.id}`)} highlighted={highlightedKeys.has(`question:${need.question.id}`)} onSeen={onSeen} onSkip={onSkip} />}
    {mode === "working" && <>
      {need.distinctions.length > 0 && <><h3>Co je potřeba rozlišit</h3><ul>{need.distinctions.map((item) => <li key={item}>{item}</li>)}</ul></>}
      {need.parameters.length > 0 && <><h3>Relevantní parametry</h3><ul>{need.parameters.map((item) => <li key={item}>{item}</li>)}</ul></>}
      {need.limitations.length > 0 && <><h3>Limity</h3><ul>{need.limitations.map((item) => <li key={item}>{item}</li>)}</ul></>}
      <AnalysisQuestions questions={need.questions} onSkip={onSkip} unseenKeys={unseenKeys} highlightedKeys={highlightedKeys} onSeen={onSeen} />
      {need.intendedOutput && <><h3>Možný typ budoucího výstupu</h3><p>{need.intendedOutput}</p></>}
    </>}
  </div>;
}

function AnalysisPanel(props: Pick<WorkspacePanelProps, "phase" | "analysis" | "analysisStatus" | "analysisError" | "selectedHypothesisId" | "activeNeedId" | "onSelectHypothesis" | "onSelectNeed" | "onRetryAnalysis" | "onSkipAnalysisQuestion" | "onConfirmSuggestedNeed" | "onContinueToOutput" | "unseenAnalysisKeys" | "highlightedAnalysisKeys" | "onAnalysisItemSeen">) {
  const [expanded, setExpanded] = useState(() => new Set(props.analysis.hypotheses.slice(0, 1).map((hypothesis) => hypothesis.id)));
  if (props.phase === "intake") return <div id="workspace-analysis" className="notepad-scroll workspace-panel-body" role="tabpanel" aria-label="Rozbor"><div className="workspace-empty-state"><ScanSearch aria-hidden="true" /><h2>Rozbor začne ve Fázi 2</h2><p>Otevření panelu fázi nemění. Do Rozboru přejdete až svým potvrzením.</p></div></div>;
  if (props.analysisStatus === "loading" && !props.analysis.hypotheses.length) return <div className="analysis-state"><span className="analysis-spinner" />Vytvářím Rozbor z aktuálního Zápisníku…</div>;
  if (props.analysisStatus === "error" && !props.analysis.hypotheses.length) return <div className="analysis-state"><p>{props.analysisError}</p><button type="button" onClick={props.onRetryAnalysis}>Zkusit znovu</button></div>;
  const activeNeed = props.analysis.needs.find((item) => item.needId === props.activeNeedId) ?? props.analysis.needs[0];
  return (
    <div id="workspace-analysis" className="notepad-scroll workspace-panel-body" role="tabpanel" aria-label="Rozbor">
      <section className="analysis-hypotheses" aria-label="Pracovní hypotézy">
        {props.analysis.hypotheses.map((hypothesis) => {
          const isActive = hypothesis.id === props.selectedHypothesisId;
          const isExpanded = expanded.has(hypothesis.id);
          return <HypothesisRow key={hypothesis.id} hypothesis={hypothesis} analysis={props.analysis} mode={props.analysis.mode} isActive={isActive} isExpanded={isExpanded}
            onToggle={() => { props.onSelectHypothesis(hypothesis.id); setExpanded((current) => toggleExpandedHypothesis(current, hypothesis.id)); }} unseenKeys={props.unseenAnalysisKeys} highlightedKeys={props.highlightedAnalysisKeys} onSeen={props.onAnalysisItemSeen} onSkip={props.onSkipAnalysisQuestion} />;
        })}
      </section>
      {props.analysis.needs.length > 0 && <section className="analysis-needs">
        <div className="analysis-need-tabs" role="tablist">{props.analysis.needs.map((need) => <NeedTab key={need.needId} need={need} active={need.needId === activeNeed?.needId} unseen={props.unseenAnalysisKeys.has(`need:${need.needId}:tab`)} highlighted={props.highlightedAnalysisKeys.has(`need:${need.needId}:tab`)} onSeen={props.onAnalysisItemSeen} onSelect={() => props.onSelectNeed(need.needId)} />)}</div>
        {activeNeed && <NeedContent need={activeNeed} analysis={props.analysis} mode={props.analysis.mode} unseenKeys={props.unseenAnalysisKeys} highlightedKeys={props.highlightedAnalysisKeys} onSeen={props.onAnalysisItemSeen} onSkip={props.onSkipAnalysisQuestion} />}
      </section>}
      {props.analysis.suggestedNeeds.length > 0 && <section className="analysis-suggestions">{props.analysis.suggestedNeeds.map((need) => <div key={need.id}><span><strong>{need.title}</strong><small>{need.reason}</small></span><button type="button" onClick={() => props.onConfirmSuggestedNeed(need)}>Přidat do Zápisníku</button></div>)}</section>}
      {props.analysis.hypotheses.length > 0 && props.analysis.needs.length > 0 && <button className="analysis-continue" type="button" onClick={props.onContinueToOutput}>Přejít k vytvoření výstupu</button>}
    </div>
  );
}

function OutputPanel() {
  return (
    <div id="workspace-output" className="notepad-scroll workspace-panel-body" role="tabpanel" aria-label="Výstup">
      <div className="workspace-empty-state">
        <FileText aria-hidden="true" />
        <h2>Výstup</h2>
        <p>Zde bude možné připravit výsledný výstup na základě Zápisníku a Rozboru.</p>
      </div>
    </div>
  );
}

function PanelHeader({
  panel,
  isDescriptionVisible,
  onDescriptionToggle,
  descriptionRef,
}: {
  panel: OpenWorkspacePanel;
  isDescriptionVisible: boolean;
  onDescriptionToggle: () => void;
  descriptionRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { label, description, icon: Icon } = WORKSPACE_PANELS[panel];

  return (
    <header className="notepad-header">
      <div className="panel-title">
        <Icon aria-hidden="true" />
        <h2>{label}</h2>
      </div>
      <div className="panel-info" ref={descriptionRef}>
        <button
          className={`notepad-help-toggle${isDescriptionVisible ? " is-active" : ""}`}
          type="button"
          aria-label={isDescriptionVisible ? `Skrýt popis vrstvy ${label}` : `Zobrazit popis vrstvy ${label}`}
          aria-expanded={isDescriptionVisible}
          aria-controls="workspace-panel-description"
          onClick={onDescriptionToggle}
        >
          <Info aria-hidden="true" />
        </button>
        {isDescriptionVisible && (
          <p id="workspace-panel-description" className="panel-description" role="note">
            {description}
          </p>
        )}
      </div>
    </header>
  );
}

export function WorkspacePanel({
  activePanel,
  entries,
  onEntriesChange,
  onEntryNavigate,
  onEntrySeen,
  ...analysisProps
}: WorkspacePanelProps) {
  const [describedPanel, setDescribedPanel] = useState<OpenWorkspacePanel | null>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const isOpen = activePanel !== null;
  const isDescriptionVisible = activePanel !== null && describedPanel === activePanel;

  useEffect(() => {
    if (!isDescriptionVisible) return;
    const closeOutside = (event: globalThis.PointerEvent) => {
      if (!descriptionRef.current?.contains(event.target as Node)) setDescribedPanel(null);
    };
    const closeWithEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setDescribedPanel(null);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [isDescriptionVisible]);

  return (
    <aside className={`notepad-panel${isOpen ? " is-open" : ""}`} aria-label="Pracovní vrstvy">
      <div id="workspace-panel-content" className="notepad-content">
        {activePanel && (
          <PanelHeader
            panel={activePanel}
            isDescriptionVisible={isDescriptionVisible}
            onDescriptionToggle={() => setDescribedPanel((current) => current === activePanel ? null : activePanel)}
            descriptionRef={descriptionRef}
          />
        )}

        {activePanel === "notepad" && (
          <NotepadPanel
            entries={entries}
            onEntriesChange={onEntriesChange}
            onEntryNavigate={onEntryNavigate}
            onEntrySeen={onEntrySeen}
          />
        )}
        {activePanel === "analysis" && <AnalysisPanel {...analysisProps} />}
        {activePanel === "output" && <OutputPanel />}
      </div>
    </aside>
  );
}
