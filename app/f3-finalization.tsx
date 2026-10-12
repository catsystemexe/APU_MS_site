"use client";

import { createPortal } from "react-dom";
import { useMemo, useRef, useState } from "react";
import { renderWorkingAnalysis } from "./f3-working-analysis";
import { copyF3Output, printF3Output } from "./f3-output-export";
import type { F2ToF3Snapshot } from "./f2-build-model";
import { createF3State, hasNewerF2Snapshot, type F3Representation, type F3Config, type F3State } from "./f3-finalization-model";

const options = {
  audience: [["teacher", "Pro učitele"], ["parent", "Pro rodiče"], ["student", "Pro žáka"], ["internal", "Interní podklad"]],
  languageStyle: [["concise", "Stručný"], ["plain", "Běžný"], ["professional", "Odbornější"], ["accessible", "Srozumitelný"]],
  lengthDetail: [["brief", "Stručný"], ["standard", "Standardní"], ["detailed", "Podrobný"]],
  structureMode: [["auto", "Podle cíle"], ["text", "Strukturovaný text"], ["table", "Tabulka"], ["cards", "Karty"]],
} as const;

export function F3Finalization({ snapshot, sourceError, state: providedState, status, error, onRepresentation, onConfig, onRender, onAdopt, onReturn, controlsTarget }: {
  controlsTarget?: HTMLElement | null;
  snapshot: F2ToF3Snapshot | null; sourceError: string | null; state: F3State | null; status: "idle" | "loading" | "error"; error: string | null;
  onRepresentation: (representation: F3Representation) => void; onConfig: (change: Partial<F3Config>) => void; onRender: () => void; onAdopt: () => void; onReturn: () => void;
}) {
  const state = useMemo(() => providedState ?? (snapshot ? createF3State(snapshot) : null), [providedState, snapshot]);
  const baseline = useMemo(() => state ? renderWorkingAnalysis(state.sourceSnapshot) : null, [state?.sourceSnapshot]);
  const materialRef = useRef<HTMLElement>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  if (!snapshot && !state) return <div className="workspace-empty-state"><h2>Výstup</h2><p>{sourceError ?? "Pracovní analýza bude dostupná po úspěšném vstupu do Rozboru."}</p><button type="button" className="f3-secondary" onClick={onReturn}>Vrátit se do Rozboru</button></div>;
  if (!state) return null;
  const newer = hasNewerF2Snapshot(state, snapshot); const render = state.finalRender; const content = state.representation === "analysis" ? baseline : render?.content;
  const stale = state.sourceStatus === "stale" || (state.representation === "material" && render?.status === "stale");
  const controls = <div className="f3-tools">
    <header><h2>Výstup</h2><p>Pracovní analýzu můžete rovnou exportovat. Nastavení níže slouží jen k vytvoření další podoby Výstupu.</p><button type="button" className="f3-secondary" onClick={onReturn}>Vrátit se do Rozboru</button></header>

    {state.sourceStatus === "stale" && <aside className="f3-notice"><div><strong>Rozbor se od přijetí zdroje změnil</strong><span>{newer ? "Aktuální Rozbor lze explicitně přijmout; dosavadní výstup zůstane viditelný pro referenci." : sourceError ?? "Nejprve aktualizujte Rozbor, potom jej přijměte jako nový zdroj."}</span></div>{newer && <button type="button" onClick={onAdopt}>Přijmout aktuální Rozbor</button>}</aside>}
    <div className="f3-representations" aria-label="Podoba Výstupu">
      <button type="button" className="f3-secondary" aria-pressed={state.representation === "analysis"} onClick={() => onRepresentation("analysis")}>Pracovní analýza</button>
      <button type="button" className="f3-secondary" aria-pressed={state.representation === "material"} disabled={!render} onClick={() => onRepresentation("material")}>Další podoba Výstupu</button>
    </div>
    <section className="f3-controls" aria-label="Nastavení další podoby Výstupu">
      {(Object.keys(options) as Array<keyof F3Config>).map((key) => <label key={key}><span>{({ audience: "Adresát", languageStyle: "Styl / jazyk", lengthDetail: "Rozsah / detail", structureMode: "Struktura" } as const)[key]}</span><select value={state.config[key]} onChange={(event) => onConfig({ [key]: event.target.value } as Partial<F3Config>)}>{options[key].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>)}
    </section>
    <div className="f3-render-action">{render?.status === "stale" && <strong>{render.staleReason === "source" ? "Zdrojový Rozbor se změnil. Dosavadní výstup zůstává pro referenci." : "Formátovací nastavení změněno. Dosavadní výstup zůstává pro referenci."}</strong>}{error && <strong role="alert">{error}</strong>}<button type="button" disabled={status === "loading" || state.sourceStatus === "stale"} onClick={onRender}>{status === "loading" ? "Vytvářím výstup…" : render ? "REGENEROVAT VÝSTUP" : "Vytvořit další podobu"}</button></div>

    {content?.kind === "material" && <div className="f3-export" aria-label="Export Výstupu">
      <button type="button" className="f3-secondary" onClick={() => { if (materialRef.current) { try { printF3Output(materialRef.current); } catch { setExportNotice("Tisk se nepodařilo otevřít."); } } }}>Tisk / Uložit jako PDF</button>
      <button type="button" className="f3-secondary" onClick={() => void copyF3Output(content, undefined, stale).then(() => setExportNotice("Text zkopírován.")).catch((cause) => setExportNotice(cause.message))}>Kopírovat text</button>
      {exportNotice && <span role="status">{exportNotice}</span>}
    </div>}
  </div>;
  return <div className={`f3-finalization${controlsTarget ? " is-document-only" : ""}`}>
    {controlsTarget ? createPortal(controls, controlsTarget) : controls}
    <header><div><span>F3 · Výstup</span><h2>{state.representation === "analysis" ? "Pracovní pedagogická analýza" : state.target}</h2><p>Zdroj: přijatý Rozbor, revize {state.sourceSnapshotRevision}.</p></div></header>
    {state.sourceStatus === "stale" && <p className="f3-notice" role="status">Rozbor se od přijetí zdroje změnil. Dosavadní výstup zůstává pro referenci.</p>}
    {content?.kind === "boundary_issue" && <aside className="f3-boundary" role="alert"><strong>Finalizace vyžaduje změnu v Rozboru</strong><p>{content.reason}</p><span>Dotčená oblast: {content.affectedArea}</span><button type="button" onClick={onReturn}>Vrátit se do Rozboru</button></aside>}
    {content?.kind === "material" && <article ref={materialRef} className={`f3-material${stale ? " is-stale" : ""}`}><header><span>{state.representation === "analysis" ? "Pracovní pedagogická analýza" : "Finální výstup"}</span><h2>{content.title}</h2></header>{stale && <p><strong>Starší výstup — zdroj nebo nastavení se změnily.</strong></p>}<p>{content.introduction}</p>{content.sections.map((section) => <section key={section.heading}><h3>{section.heading}</h3><p>{section.content}</p></section>)}{content.table && <div className="f3-table-wrap"><table><thead><tr>{content.table.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{content.table.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>}{content.cards.length > 0 && <div className="f3-cards">{content.cards.map((card, index) => <section key={`${card.title}-${index}`}><h3>{card.title}</h3><p>{card.content}</p></section>)}</div>}{content.usageNote && <aside><strong>Podmínka použití</strong><p>{content.usageNote}</p></aside>}</article>}
  </div>;
}
