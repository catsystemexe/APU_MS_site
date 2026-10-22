"use client";

import { FileText, Info, NotebookPen, Plus, ScanSearch, type LucideIcon } from "lucide-react";
import { ChangeEvent, KeyboardEvent, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import {
  CategoryId,
  createLocalId,
  EMPTY_NOTEPAD,
  mapPedagogicalNeed,
  NotepadEntry,
  NotepadState,
} from "./notepad-model";
import { createNotebookStorage, notebookOwnerId, type NotebookOwner } from "./notebook-storage";
import { NOTEPAD_CATEGORIES } from "./notepad-categories";
import type { AnalysisState, SuggestedNeed } from "./analysis-model";
import type { ConversationPhase } from "./dialog-action";
import type { CurrentRozborState, F2BuildState, F2PreviewState, F2ToF3Snapshot } from "./f2-build-model";
import { F3Finalization } from "./f3-finalization";
import type { F3Config, F3Representation, F3State } from "./f3-finalization-model";
import type { WorkingDocumentMetadata } from "./working-document-lifecycle";
import type { WorkingDocumentStyle } from "./document-presentation";

type DesktopPanelNavigation = { view: "notepad" | "document"; documentPanel: "analysis" | "output"; documentAvailable: boolean; onView: (view: "notepad" | "document") => void };

export type WorkspacePanel = "notepad" | "analysis" | "output" | null;

type WorkspacePanelProps = {
  desktopNavigation?: DesktopPanelNavigation;
  notebookReadOnly?: boolean;
  documentStyle: WorkingDocumentStyle;
  onDocumentReset: () => void;
  documentMetadata: WorkingDocumentMetadata | null;
  documentUpdating: boolean;
  onDocumentStyle: (style: WorkingDocumentStyle) => void;
  f3ControlsTarget?: HTMLElement | null;
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
  currentRozbor: CurrentRozborState;
  f2Preview: F2PreviewState;
  f2ToF3Snapshot: F2ToF3Snapshot | null;
  f2ToF3SourceError: string | null;
  f2BuildStatus: "idle" | "loading" | "error";
  f2BuildError: string | null;
  f2PreviewStatus: "idle" | "loading" | "error";
  f2PreviewError: string | null;
  onF2SkillToggle: (id: string) => void;
  onF2ParameterChange: (id: string, value: string) => void;
  onF2ContextAdd: (text: string) => void;
  onF2ContextRemove: (id: string) => void;
  onF2Execute: () => void;
  onF2Preview: () => void;
  f3State: F3State | null;
  f3Status: "idle" | "loading" | "error";
  f3Error: string | null;
  onF3Representation: (representation: F3Representation) => void;
  onF3Config: (change: Partial<F3Config>) => void;
  onF3Render: () => void;
  onF3Adopt: () => void;
  onF3Return: () => void;
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

export function usePersistentNotepad(owner: NotebookOwner) {
  const binding = `${notebookOwnerId(owner)}:${owner.isDeveloper}`;
  const active = useRef<{ binding: string; entries: NotepadState; storage: ReturnType<typeof createNotebookStorage> | null; closed: boolean } | null>(null);
  const [state, setState] = useState<{ binding: string; entries: NotepadState } | null>(null);
  useEffect(() => {
    let storage: ReturnType<typeof createNotebookStorage> | null = null;
    try { storage = createNotebookStorage(owner, { local: window.localStorage, session: window.sessionStorage }); }
    catch { /* Storage-disabled browsers can work in memory. */ }
    const current = { binding, entries: storage?.read() ?? structuredClone(EMPTY_NOTEPAD), storage, closed: false };
    active.current = current;
    setState({ binding, entries: current.entries });
    return () => { current.closed = true; current.storage?.close(); if (active.current === current) active.current = null; };
    // Binding consists solely of the normalized server identity and policy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binding]);
  const setEntries = useCallback((update: NotepadState | ((current: NotepadState) => NotepadState)) => {
    const current = active.current;
    if (!current || current.closed || current.binding !== binding) return;
    current.entries = typeof update === "function" ? update(current.entries) : update;
    // Synchronous persistence makes an immediate refresh after New Project safe.
    current.storage?.write(current.entries);
    setState({ binding, entries: current.entries });
  }, [binding]);
  const invalidate = useCallback((logout: boolean) => {
    const current = active.current;
    if (!current || current.binding !== binding) return;
    current.closed = true;
    current.storage?.invalidate(logout);
    current.entries = structuredClone(EMPTY_NOTEPAD);
    setState({ binding, entries: current.entries });
  }, [binding]);
  return { entries: state?.binding === binding ? state.entries : EMPTY_NOTEPAD, setEntries,
    hydrated: state?.binding === binding, invalidate };
}

function ItemEditor({
  entry,
  label,
  autoFocus,
  readOnly,
  onChange,
  onRemove,
  onNavigate,
  onSeen,
}: {
  entry: NotepadEntry;
  label: string;
  autoFocus: boolean;
  readOnly: boolean;
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
      {readOnly ? <p className="notepad-entry-text">{entry.text}</p> : <textarea
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
      />}
    </li>
  );
}

function NotepadPanel({
  entries,
  onEntriesChange,
  onEntryNavigate,
  onEntrySeen,
  readOnly = false,
  hidden = false,
}: { readOnly?: boolean; hidden?: boolean } & Pick<WorkspacePanelProps, "entries" | "onEntriesChange" | "onEntryNavigate" | "onEntrySeen">) {
  const [focusedItem, setFocusedItem] = useState<string | null>(null);

  function addItem(category: CategoryId) {
    if (readOnly) return;
    const entry: NotepadEntry = { id: createLocalId(), text: "", origin: "manual", ...(category === "goals" ? { needMapping: mapPedagogicalNeed("") } : {}) };
    setFocusedItem(entry.id);
    onEntriesChange({ ...entries, [category]: [...entries[category], entry] });
  }

  function updateItem(category: CategoryId, index: number, value: string) {
    if (readOnly) return;
    setFocusedItem(null);
    const next = [...entries[category]];
    next[index] = { id: next[index].id, text: value, origin: "manual", ...(category === "goals" ? { needMapping: mapPedagogicalNeed(value) } : {}) };
    onEntriesChange({ ...entries, [category]: next });
  }

  function removeItem(category: CategoryId, index: number) {
    if (readOnly) return;
    setFocusedItem(null);
    onEntriesChange({
      ...entries,
      [category]: entries[category].filter((_, itemIndex) => itemIndex !== index),
    });
  }

  return (
    <div id="workspace-notepad" hidden={hidden} className="notepad-scroll" role="tabpanel" aria-label="Zápisník">
      {readOnly && <p className="notepad-source-status">Zápisník je zdrojem aktuální analýzy. Úpravy budou dostupné v řízeném režimu.</p>}
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
                        readOnly={readOnly}
                        onChange={(value) => updateItem(id, index, value)}
                        onRemove={() => removeItem(id, index)}
                        onNavigate={() => onEntryNavigate(entry)}
                        onSeen={() => onEntrySeen(entry.id)}
                      />
                    ))}
                  </ul>
                ) : null}

                {!readOnly && <button className="add-notepad-item" type="button" onClick={() => addItem(id)}>
                  <Plus aria-hidden="true" />
                  <span>Přidat položku</span>
                </button>}
              </section>
            ))}
      </div>
    </div>
  );
}

function DocumentPanel(props: Pick<WorkspacePanelProps,
  "activePanel" | "phase" | "analysisStatus" | "analysisError" | "onRetryAnalysis" |
  "f2ToF3Snapshot" | "f2ToF3SourceError" | "f3ControlsTarget" | "onContinueToOutput" |
  "f3State" | "f3Status" | "f3Error" | "onF3Representation" | "onF3Config" | "onF3Render" | "onF3Adopt" | "onF3Return" | "documentStyle" | "onDocumentStyle" | "documentMetadata" | "documentUpdating" | "onDocumentReset"
> & { documentActionsTarget: HTMLElement | null; hidden?: boolean }) {
  const workingAnalysis = props.activePanel === "analysis";
  let unavailable = null;
  if (workingAnalysis && !props.f2ToF3Snapshot) {
    if (props.phase === "intake") unavailable = <div className="workspace-empty-state"><ScanSearch aria-hidden="true" /><h2>Rozbor začne ve Fázi 2</h2><p>Otevření panelu fázi nemění. Do Rozboru přejdete až svým potvrzením.</p></div>;
    else if (props.analysisStatus === "loading") unavailable = <div className="analysis-state"><span className="analysis-spinner" />Vytvářím Rozbor z aktuálního Zápisníku…</div>;
    else if (props.analysisStatus === "error") unavailable = <div className="analysis-state"><p>{props.analysisError}</p><button type="button" onClick={props.onRetryAnalysis}>Zkusit znovu</button></div>;
    else unavailable = <div className="analysis-state"><p>{props.f2ToF3SourceError ?? "Rozbor čeká na kanonickou pedagogickou potřebu v Zápisníku."}</p></div>;
  }
  return <div className="document-workspace-content" hidden={props.hidden}>
  <div id="workspace-document" aria-busy={props.documentUpdating} className="notepad-scroll workspace-panel-body" role="region" aria-label="Dokument">
    <F3Finalization documentMode={workingAnalysis ? "analysis" : "output"} documentActionsTarget={props.documentActionsTarget} unavailable={unavailable} controlsTarget={props.f3ControlsTarget} snapshot={props.f2ToF3Snapshot} sourceError={props.f2ToF3SourceError} state={props.f3State} status={props.f3Status} error={props.f3Error} onRepresentation={props.onF3Representation} onConfig={props.onF3Config} onRender={props.onF3Render} onAdopt={props.onF3Adopt} onReturn={props.onF3Return} onContinueToOutput={props.onContinueToOutput} documentStyle={props.documentStyle} onDocumentStyle={props.onDocumentStyle} documentMetadata={props.documentMetadata} documentUpdating={props.documentUpdating} onReset={props.onDocumentReset} />
  </div>
  {props.documentUpdating && <div className="document-update-overlay" role="status" aria-live="polite"><span className="document-update-spinner" aria-hidden="true" /><span>AKTUALIZUJI DOKUMENT</span></div>}
  </div>;
}

function PanelHeader({
  panel,
  isDescriptionVisible,
  onDescriptionToggle,
  descriptionRef,
  documentWorkspace,
  onDocumentActionsTarget,
  navigation,
}: {
  navigation?: DesktopPanelNavigation;
  onDocumentActionsTarget: (target: HTMLDivElement | null) => void;
  documentWorkspace: boolean;
  panel: OpenWorkspacePanel;
  isDescriptionVisible: boolean;
  onDescriptionToggle: () => void;
  descriptionRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { label, description, icon: Icon } = documentWorkspace ? { label: "Dokument", description: "Pracovní analýza z přijatého Rozboru nebo zvolená podoba Výstupu. Změny zdroje se přijímají explicitně.", icon: FileText } : WORKSPACE_PANELS[panel];

  return (
    <header className="notepad-header">
      {navigation ? <nav className="workspace-view-tabs" aria-label="Pravý pracovní panel">
        <button type="button" aria-pressed={navigation.view === "notepad"} aria-controls="workspace-notepad" onClick={() => navigation.onView("notepad")}>Zápisník</button>
        <button type="button" disabled={!navigation.documentAvailable} aria-pressed={navigation.view === "document"} aria-controls="workspace-document" onClick={() => { if (navigation.documentAvailable) navigation.onView("document"); }}>Dokument</button>
      </nav> : <div className="panel-title">
        <Icon aria-hidden="true" />
        <h2>{label}</h2>
      </div>}
      <div className="panel-header-actions">
        {panel !== "notepad" && <div className="document-actions-target" ref={onDocumentActionsTarget} />}
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
      </div>
    </header>
  );
}

export function WorkspacePanel({
  desktopNavigation,
  notebookReadOnly = false,
  activePanel,
  entries,
  onEntriesChange,
  onEntryNavigate,
  onEntrySeen,
  ...analysisProps
}: WorkspacePanelProps) {
  const [describedPanel, setDescribedPanel] = useState<OpenWorkspacePanel | null>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const [documentActionsTarget, setDocumentActionsTarget] = useState<HTMLDivElement | null>(null);
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
            navigation={desktopNavigation}
            documentWorkspace={activePanel !== "notepad" && analysisProps.phase !== "intake"}
            isDescriptionVisible={isDescriptionVisible}
            onDescriptionToggle={() => setDescribedPanel((current) => current === activePanel ? null : activePanel)}
            descriptionRef={descriptionRef}
            onDocumentActionsTarget={setDocumentActionsTarget}
          />
        )}

        {(activePanel === "notepad" || desktopNavigation) && (
          <NotepadPanel
            entries={entries}
            readOnly={notebookReadOnly}
            hidden={activePanel !== "notepad"}
            onEntriesChange={onEntriesChange}
            onEntryNavigate={onEntryNavigate}
            onEntrySeen={onEntrySeen}
          />
        )}
        {(activePanel === "analysis" || activePanel === "output" || desktopNavigation) && <DocumentPanel {...analysisProps} activePanel={desktopNavigation?.documentPanel ?? activePanel} hidden={activePanel === "notepad"} documentActionsTarget={documentActionsTarget} />}
      </div>
    </aside>
  );
}
