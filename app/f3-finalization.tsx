"use client";

import { createPortal } from "react-dom";
import { Copy, Printer, Share2 } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { renderWorkingAnalysis } from "./f3-working-analysis";
import { copyF3Output, printF3Output } from "./f3-output-export";
import { DocumentContent } from "./document-content";
import type { WorkingDocumentMetadata } from "./working-document-lifecycle";
import type { WorkingDocumentStyle } from "./document-presentation";
import type { F2ToF3Snapshot } from "./f2-build-model";
import { createF3State, hasNewerF2Snapshot, type F3Material, type F3Representation, type F3Config, type F3State } from "./f3-finalization-model";

const options = {
  audience: [["teacher", "Pro učitele"], ["parent", "Pro rodiče"], ["student", "Pro žáka"], ["internal", "Interní podklad"]],
  languageStyle: [["concise", "Stručný"], ["plain", "Běžný"], ["professional", "Odbornější"], ["accessible", "Srozumitelný"]],
  lengthDetail: [["brief", "Stručný"], ["standard", "Standardní"], ["detailed", "Podrobný"]],
  structureMode: [["auto", "Podle cíle"], ["text", "Strukturovaný text"], ["table", "Tabulka"], ["cards", "Karty"]],
} as const;

export function F3Finalization({ snapshot, sourceError, state: providedState, status, error, onRepresentation, onConfig, onRender, onAdopt, onReturn, controlsTarget, documentMode = "output", documentActionsTarget, unavailable, onContinueToOutput, documentStyle = "a", onDocumentStyle, documentMetadata, documentUpdating = false }: {
  documentMetadata?: WorkingDocumentMetadata | null;
  documentUpdating?: boolean;
  documentStyle?: WorkingDocumentStyle;
  onDocumentStyle?: (style: WorkingDocumentStyle) => void;
  controlsTarget?: HTMLElement | null;
  documentMode?: "analysis" | "output";
  documentActionsTarget?: HTMLElement | null;
  unavailable?: ReactNode;
  onContinueToOutput?: () => void;
  snapshot: F2ToF3Snapshot | null; sourceError: string | null; state: F3State | null; status: "idle" | "loading" | "error"; error: string | null;
  onRepresentation: (representation: F3Representation) => void; onConfig: (change: Partial<F3Config>) => void; onRender: () => void; onAdopt: () => void; onReturn: () => void;
}) {
  const state = useMemo(() => providedState ?? (snapshot ? createF3State(snapshot) : null), [providedState, snapshot]);
  // Build reads the current accepted F2 source; Output reads its adopted source.
  // Explicit successful Build acceptance may adopt; navigation never does.
  const source = documentMode === "analysis" ? snapshot : state?.sourceSnapshot;
  const baseline = useMemo(() => source ? renderWorkingAnalysis(source) : null, [source]);
  const materialRef = useRef<HTMLElement>(null);
  const [exportNotice, setExportNotice] = useState<{ content: F3Material | null; stale: boolean; message: string } | null>(null);
  const newer = state ? hasNewerF2Snapshot(state, snapshot) : false; const render = state?.finalRender;
  const workingAnalysis = documentMode === "analysis" || state?.representation === "analysis";
  const content = unavailable ? null : workingAnalysis ? baseline : render?.content;
  const stale = documentMode === "output" && (state?.sourceStatus === "stale" || (state?.representation === "material" && render?.status === "stale"));
  const exportable = content?.kind === "material" && !documentUpdating && status !== "loading";
  const reportExport = (message: string) => setExportNotice({ content: content?.kind === "material" ? content : null, stale, message });
  const exportControls = <div className="document-actions" role="group" aria-label="Akce dokumentu">
    <button type="button" disabled={!exportable} aria-label="Kopírovat dokument" title="Kopírovat dokument" onClick={() => { if (exportable) void copyF3Output(content, undefined, stale).then(() => reportExport("Text zkopírován.")).catch((cause) => reportExport(cause instanceof Error ? cause.message : "Kopírování se nepodařilo.")); }}><Copy aria-hidden="true" /></button>
    <button type="button" disabled={!exportable} aria-label="Tisk / Uložit jako PDF" title="Tisk / Uložit jako PDF" onClick={() => { if (exportable && materialRef.current) { try { printF3Output(materialRef.current); } catch { reportExport("Tisk se nepodařilo otevřít."); } } }}><Printer aria-hidden="true" /></button>
    <button type="button" disabled aria-label="Sdílet dokument — Připravujeme" title="Sdílet dokument — Připravujeme"><Share2 aria-hidden="true" /><span>Připravujeme</span></button>
    <span className="document-export-feedback" role="status" aria-live="polite">{exportNotice && exportNotice.content === content && exportNotice.stale === stale ? exportNotice.message : ""}</span>
  </div>;
  const controls = state && <div className="f3-tools">
    <div className="f3-tool-body">
    <header><h2>Výstup</h2><p>Pracovní analýzu můžete rovnou exportovat. Nastavení níže slouží jen k vytvoření další podoby Výstupu.</p></header>

    <fieldset className="document-style-picker">
      <legend>Vzhled pracovní analýzy</legend>
      <div role="group" aria-label="Styl výchozího dokumentu">
        <button type="button" className="f3-secondary" aria-pressed={documentStyle === "a"} onClick={() => onDocumentStyle?.("a")}>VAR A — Čistý dokument</button>
        <button type="button" className="f3-secondary" aria-pressed={documentStyle === "b"} onClick={() => onDocumentStyle?.("b")}>VAR B — Strukturovaný dokument</button>
      </div>
      <p>Stejný přijatý obsah, pouze jiný vzhled. Platí i v Buildu; další generované podoby se nemění.</p>
    </fieldset>

    {state.sourceStatus === "stale" && <aside className="f3-notice"><div><strong>Rozbor se od přijetí zdroje změnil</strong><span>{newer ? "Aktuální Rozbor lze explicitně přijmout; dosavadní výstup zůstane viditelný pro referenci." : sourceError ?? "Nejprve aktualizujte Rozbor, potom jej přijměte jako nový zdroj."}</span></div>{newer && <button type="button" onClick={onAdopt}>Přijmout aktuální Rozbor</button>}</aside>}
    <div className="f3-representations" aria-label="Podoba Výstupu">
      <button type="button" className="f3-secondary" aria-pressed={state.representation === "analysis"} onClick={() => onRepresentation("analysis")}>Pracovní analýza</button>
      <button type="button" className="f3-secondary" aria-pressed={state.representation === "material"} disabled={!render} onClick={() => onRepresentation("material")}>Další podoba Výstupu</button>
    </div>
    <section className="f3-controls" aria-label="Nastavení další podoby Výstupu">
      {(Object.keys(options) as Array<keyof F3Config>).map((key) => <label key={key}><span>{({ audience: "Adresát", languageStyle: "Styl / jazyk", lengthDetail: "Rozsah / detail", structureMode: "Struktura" } as const)[key]}</span><select value={state.config[key]} onChange={(event) => onConfig({ [key]: event.target.value } as Partial<F3Config>)}>{options[key].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>)}
    </section>
    </div>
    <footer className="f3-tool-actions">
    <div className="f3-render-action">{state.representation === "material" && render?.status === "stale" && <strong>{render.staleReason === "source" ? "Zdrojový Rozbor se změnil. Dosavadní výstup zůstává pro referenci." : "Formátovací nastavení změněno. Dosavadní výstup zůstává pro referenci."}</strong>}{error && <strong role="alert">{error}</strong>}<button type="button" disabled={status === "loading" || state.sourceStatus === "stale"} onClick={onRender} title="Vytvořit zvolenou podobu z přijatého Rozboru">{status === "loading" ? "AKTUALIZUJI DOKUMENT" : "AKTUALIZOVAT DOKUMENT"}</button></div>
    </footer>
  </div>;
  const actions = documentActionsTarget ? createPortal(exportControls, documentActionsTarget) : null;
  if (unavailable) return <>{actions}{unavailable}</>;
  if (!snapshot && !state) return <>{actions}<div className="workspace-empty-state"><h2>Výstup</h2><p>{sourceError ?? "Pracovní analýza bude dostupná po úspěšném vstupu do Rozboru."}</p><button type="button" className="f3-secondary" onClick={onReturn}>Přejít do Buildu</button></div></>;
  if (!state) return <>{actions}</>;
  return <div className={`f3-finalization${controlsTarget || documentMode === "analysis" ? " is-document-only" : ""}`}>
    {actions}
    {documentMode === "output" && (controlsTarget ? createPortal(controls, controlsTarget) : controls)}
    {documentMode === "analysis" && !controlsTarget && onContinueToOutput && <div className="working-analysis-actions"><button type="button" className="f3-secondary" onClick={onContinueToOutput}>Další podoba Výstupu</button></div>}
    {documentMode === "output" && state.sourceStatus === "stale" && <p className="f3-notice" role="status">Rozbor se od přijetí zdroje změnil. Dosavadní výstup zůstává pro referenci.</p>}
    {content?.kind === "boundary_issue" && <aside className="f3-boundary" role="alert"><strong>Finalizace vyžaduje změnu v Rozboru</strong><p>{content.reason}</p><span>Dotčená oblast: {content.affectedArea}</span><button type="button" onClick={onReturn}>Přejít do Buildu</button></aside>}
    {content?.kind === "material" && <DocumentContent content={content} documentRef={materialRef} stale={stale} workingAnalysis={workingAnalysis} sourceRevision={workingAnalysis ? source?.sourceRevision ?? null : render?.sourceSnapshotId === state.sourceSnapshotId ? state.sourceSnapshotRevision : null} documentStyle={documentStyle} documentMetadata={documentMetadata} />}
  </div>;
}
