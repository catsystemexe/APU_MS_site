"use client";

import { FileText, Info, NotebookPen, Plus, ScanSearch, type LucideIcon } from "lucide-react";
import { ChangeEvent, KeyboardEvent, type RefObject, useEffect, useRef, useState } from "react";
import {
  CategoryId,
  createLocalId,
  EMPTY_NOTEPAD,
  LEGACY_NOTEPAD_STORAGE_KEY,
  migrateLegacyNotepad,
  mapPedagogicalNeed,
  NotepadEntry,
  NOTEPAD_STORAGE_KEY,
  NotepadState,
  parseNotepadState,
} from "./notepad-model";
import { NOTEPAD_CATEGORIES } from "./notepad-categories";
import type { AnalysisState, SuggestedNeed } from "./analysis-model";
import type { ConversationPhase } from "./dialog-action";
import { F2BuildEditor, F2Preview } from "./f2-build-editor";
import type { F2BuildState, F2PreviewState } from "./f2-build-model";

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
  f2Build: F2BuildState | null;
  f2Preview: F2PreviewState;
  onF2PathChange: (path: F2BuildState["activePath"]) => void;
  onF2SkillToggle: (id: string) => void;
  onF2ParameterChange: (id: string, value: string) => void;
  onF2ContextAdd: (text: string) => void;
  onF2ContextRemove: (id: string) => void;
  onF2Preview: () => void;
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
    const entry: NotepadEntry = { id: createLocalId(), text: "", origin: "manual", ...(category === "goals" ? { needMapping: mapPedagogicalNeed("") } : {}) };
    setFocusedItem(entry.id);
    onEntriesChange({ ...entries, [category]: [...entries[category], entry] });
  }

  function updateItem(category: CategoryId, index: number, value: string) {
    setFocusedItem(null);
    const next = [...entries[category]];
    next[index] = { id: next[index].id, text: value, origin: "manual", ...(category === "goals" ? { needMapping: mapPedagogicalNeed(value) } : {}) };
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

function AnalysisPanel(props: Pick<WorkspacePanelProps, "phase" | "analysis" | "analysisStatus" | "analysisError" | "onRetryAnalysis" | "f2Build" | "f2Preview" | "onF2PathChange" | "onF2SkillToggle" | "onF2ParameterChange" | "onF2ContextAdd" | "onF2ContextRemove" | "onF2Preview">) {
  if (props.phase === "intake") return <div id="workspace-analysis" className="notepad-scroll workspace-panel-body" role="tabpanel" aria-label="Rozbor"><div className="workspace-empty-state"><ScanSearch aria-hidden="true" /><h2>Rozbor začne ve Fázi 2</h2><p>Otevření panelu fázi nemění. Do Rozboru přejdete až svým potvrzením.</p></div></div>;
  if (props.analysisStatus === "loading" && !props.analysis.hypotheses.length) return <div className="analysis-state"><span className="analysis-spinner" />Vytvářím Rozbor z aktuálního Zápisníku…</div>;
  if (props.analysisStatus === "error" && !props.analysis.hypotheses.length) return <div className="analysis-state"><p>{props.analysisError}</p><button type="button" onClick={props.onRetryAnalysis}>Zkusit znovu</button></div>;
  if (!props.f2Build) return <div className="analysis-state"><p>Rozbor čeká na kanonickou pedagogickou potřebu v Zápisníku.</p></div>;
  return <div id="workspace-analysis" className="notepad-scroll workspace-panel-body" role="tabpanel" aria-label="Rozbor"><F2BuildEditor build={props.f2Build} analysis={props.analysis} preview={props.f2Preview} onPathChange={props.onF2PathChange} onSkillToggle={props.onF2SkillToggle} onParameterChange={props.onF2ParameterChange} onContextAdd={props.onF2ContextAdd} onContextRemove={props.onF2ContextRemove} onPreview={props.onF2Preview} /></div>;
}

function OutputPanel({ preview }: { preview: F2PreviewState }) {
  return (
    <div id="workspace-output" className="notepad-scroll workspace-panel-body" role="tabpanel" aria-label="Výstup">
      <F2Preview preview={preview} />
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
        {activePanel === "output" && <OutputPanel preview={analysisProps.f2Preview} />}
      </div>
    </aside>
  );
}
