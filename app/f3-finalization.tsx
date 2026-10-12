"use client";

import { createPortal } from "react-dom";
import { useMemo, useRef, useState } from "react";
import { renderWorkingAnalysis } from "./f3-working-analysis";
import { copyF3Output, printF3Output } from "./f3-output-export";
import { DocumentContent } from "./document-content";
import type { F2ToF3Snapshot } from "./f2-build-model";
import { createF3State, hasNewerF2Snapshot, type F3Representation, type F3Config, type F3State } from "./f3-finalization-model";

const options = {
  audience: [["teacher", "Pro učitele"], ["parent", "Pro rodiče"], ["student", "Pro žáka"], ["internal", "Interní podklad"]],
  languageStyle: [["concise", "Stručný"], ["plain", "Běžný"], ["professional", "Odbornější"], ["accessible", "Srozumitelný"]],
  lengthDetail: [["brief", "Stručný"], ["standard", "Standardní"], ["detailed", "Podrobný"]],
  structureMode: [["auto", "Podle cíle"], ["text", "Strukturovaný text"], ["table", "Tabulka"], ["cards", "Karty"]],
} as const;

export function F3Finalization({ snapshot, sourceError, state: providedState, status, error, onRepresentation, onConfig, onRender, onAdopt, onReturn, controlsTarget, documentMode = "output", analysisExportTarget, onContinueToOutput }: {
  controlsTarget?: HTMLElement | null;
  documentMode?: "analysis" | "output";
  analysisExportTarget?: HTMLElement | null;
  onContinueToOutput?: () => void;
  snapshot: F2ToF3Snapshot | null; sourceError: string | null; state: F3State | null; status: "idle" | "loading" | "error"; error: string | null;
  onRepresentation: (representation: F3Representation) => void; onConfig: (change: Partial<F3Config>) => void; onRender: () => void; onAdopt: () => void; onReturn: () => void;
}) {
  const state = useMemo(() => providedState ?? (snapshot ? createF3State(snapshot) : null), [providedState, snapshot]);
  // Build reads the current accepted F2 source; Output retains its explicitly
  // adopted source. Presentation navigation never adopts or replaces either.
  const source = documentMode === "analysis" ? snapshot : state?.sourceSnapshot;
  const baseline = useMemo(() => source ? renderWorkingAnalysis(source) : null, [source]);
  const materialRef = useRef<HTMLElement>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  if (!snapshot && !state) return <div className="workspace-empty-state"><h2>Výstup</h2><p>{sourceError ?? "Pracovní analýza bude dostupná po úspěšném vstupu do Rozboru."}</p><button type="button" className="f3-secondary" onClick={onReturn}>Vrátit se do Rozboru</button></div>;
  if (!state) return null;
  const newer = hasNewerF2Snapshot(state, snapshot); const render = state.finalRender;
  const workingAnalysis = documentMode === "analysis" || state.representation === "analysis";
  const content = workingAnalysis ? baseline : render?.content;
  const stale = documentMode === "output" && (state.sourceStatus === "stale" || (state.representation === "material" && render?.status === "stale"));
  const exportControls = content?.kind === "material" && <div className="f3-export" aria-label="Export dokumentu">
    <button type="button" className="f3-secondary" onClick={() => { if (materialRef.current) { try { printF3Output(materialRef.current); } catch { setExportNotice("Tisk se nepodařilo otevřít."); } } }}>Tisk / Uložit jako PDF</button>
    <button type="button" className="f3-secondary" onClick={() => void copyF3Output(content, undefined, stale).then(() => setExportNotice("Text zkopírován.")).catch((cause) => setExportNotice(cause.message))}>Kopírovat text</button>
    {exportNotice && <span role="status">{exportNotice}</span>}
  </div>;
  const controls = <div className="f3-tools">
    <div className="f3-tool-body">
    <header><h2>Výstup</h2><p>Pracovní analýzu můžete rovnou exportovat. Nastavení níže slouží jen k vytvoření další podoby Výstupu.</p><button type="button" className="f3-secondary" onClick={onReturn}>Vrátit se do Rozboru</button></header>

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
    <div className="f3-render-action">{render?.status === "stale" && <strong>{render.staleReason === "source" ? "Zdrojový Rozbor se změnil. Dosavadní výstup zůstává pro referenci." : "Formátovací nastavení změněno. Dosavadní výstup zůstává pro referenci."}</strong>}{error && <strong role="alert">{error}</strong>}<button type="button" disabled={status === "loading" || state.sourceStatus === "stale"} onClick={onRender}>{status === "loading" ? "Vytvářím výstup…" : render ? "REGENEROVAT VÝSTUP" : "Vytvořit další podobu"}</button></div>

    {exportControls}
    </footer>
  </div>;
  return <div className={`f3-finalization${controlsTarget || documentMode === "analysis" ? " is-document-only" : ""}`}>
    {documentMode === "output" && (controlsTarget ? createPortal(controls, controlsTarget) : controls)}
    {documentMode === "analysis" && (analysisExportTarget ? createPortal(exportControls, analysisExportTarget) : <div className="working-analysis-actions">{exportControls}<button type="button" className="f3-secondary" onClick={onContinueToOutput}>Další podoba Výstupu</button></div>)}
    {documentMode === "output" && state.sourceStatus === "stale" && <p className="f3-notice" role="status">Rozbor se od přijetí zdroje změnil. Dosavadní výstup zůstává pro referenci.</p>}
    {content?.kind === "boundary_issue" && <aside className="f3-boundary" role="alert"><strong>Finalizace vyžaduje změnu v Rozboru</strong><p>{content.reason}</p><span>Dotčená oblast: {content.affectedArea}</span><button type="button" onClick={onReturn}>Vrátit se do Rozboru</button></aside>}
    {content?.kind === "material" && <DocumentContent content={content} documentRef={materialRef} stale={stale} workingAnalysis={workingAnalysis} sourceRevision={workingAnalysis ? source?.sourceRevision ?? null : render?.sourceSnapshotId === state.sourceSnapshotId ? state.sourceSnapshotRevision : null} />}
  </div>;
}
