"use client";

import type { F2ToF3Snapshot } from "./f2-build-model";
import { hasNewerF2Snapshot, type F3Config, type F3State } from "./f3-finalization-model";

const options = {
  audience: [["teacher", "Pro učitele"], ["parent", "Pro rodiče"], ["student", "Pro žáka"], ["internal", "Interní podklad"]],
  languageStyle: [["concise", "Stručný"], ["plain", "Běžný"], ["professional", "Odbornější"], ["accessible", "Srozumitelný"]],
  lengthDetail: [["brief", "Stručný"], ["standard", "Standardní"], ["detailed", "Podrobný"]],
  structureMode: [["auto", "Podle cíle"], ["text", "Strukturovaný text"], ["table", "Tabulka"], ["cards", "Karty"]],
} as const;

export function F3Finalization({ snapshot, currentSourceFingerprint, sourceIssue, state, status, error, onEnter, onConfig, onRender, onAdopt, onReturn }: {
  snapshot: F2ToF3Snapshot | null; currentSourceFingerprint: string | null; sourceIssue: string | null;
  state: F3State | null; status: "idle" | "loading" | "error"; error: string | null;
  onEnter: () => void; onConfig: (change: Partial<F3Config>) => void; onRender: () => void; onAdopt: () => void; onReturn: () => void;
}) {
  if (!state && !snapshot) return <div className="workspace-empty-state"><h2>Výstup</h2><p>{sourceIssue ?? "Nejprve dokončete aktuální Rozbor."}</p><button type="button" className="f3-secondary" onClick={onReturn}>Vrátit se do Rozboru</button></div>;
  if (!state && snapshot) return <div className="f3-entry"><div><span>Aktuální Rozbor · předávací snapshot</span><h2>{snapshot.f3Target?.trim() || "Strukturovaný výstup"}</h2><p>{snapshot.canonicalNeed.needText}</p><small>Zdroj {snapshot.sourceRevision} · {snapshot.activePath}</small></div><button type="button" onClick={onEnter}>Přejít k Výstupu</button></div>;
  if (!state) return null;
  const newer = hasNewerF2Snapshot(state, snapshot);
  const sourceChanged = currentSourceFingerprint !== state.sourceSnapshot.sourceFingerprint;
  const render = state.finalRender; const content = render?.content;
  return <div className="f3-finalization">
    <header><div><span>F3 · Výstup</span><h2>{state.target}</h2><p>Věcný obsah je uzamčen ke snapshotu Rozboru {state.sourceSnapshotRevision} · {state.sourceSnapshot.activePath}.</p></div><button type="button" className="f3-secondary" onClick={onReturn}>Vrátit se do Rozboru</button></header>
    {sourceChanged && <aside className="f3-notice"><div><strong>Rozbor se od přijatého snapshotu změnil</strong><span>{newer ? "Novější aktuální Rozbor se použije až po vašem potvrzení." : sourceIssue ?? "Nejprve dokončete aktualizaci Rozboru; dosavadní Výstup zůstává viditelný."}</span></div>{newer && <button type="button" onClick={onAdopt}>Přijmout aktuální Rozbor</button>}</aside>}
    <section className="f3-controls" aria-label="Nastavení finalizace">
      {(Object.keys(options) as Array<keyof F3Config>).map((key) => <label key={key}><span>{({ audience: "Adresát", languageStyle: "Styl / jazyk", lengthDetail: "Rozsah / detail", structureMode: "Struktura" } as const)[key]}</span><select value={state.config[key]} onChange={(event) => onConfig({ [key]: event.target.value } as Partial<F3Config>)}>{options[key].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>)}
    </section>
    <div className="f3-render-action">{render?.status === "stale" && <strong>{render.staleReason === "source" ? "Zdrojový snapshot se změnil. Dosavadní výstup zůstává pro referenci." : "Formátovací nastavení změněno. Dosavadní výstup zůstává pro referenci."}</strong>}{error && <strong role="alert">{error}</strong>}<button type="button" disabled={status === "loading" || sourceChanged} onClick={onRender}>{status === "loading" ? "Vytvářím výstup…" : sourceChanged ? "NEJPRVE PŘIJMĚTE ROZBOR" : render ? "REGENEROVAT VÝSTUP" : "VYTVOŘIT VÝSTUP"}</button></div>
    {content?.kind === "boundary_issue" && <aside className="f3-boundary" role="alert"><strong>Finalizace vyžaduje změnu v Rozboru</strong><p>{content.reason}</p><span>Dotčená oblast: {content.affectedArea}</span><button type="button" onClick={onReturn}>Vrátit se do Rozboru</button></aside>}
    {content?.kind === "material" && <article className={`f3-material${render?.status === "stale" ? " is-stale" : ""}`}><header><span>Finální výstup</span><h2>{content.title}</h2></header><p>{content.introduction}</p>{content.sections.map((section) => <section key={section.heading}><h3>{section.heading}</h3><p>{section.content}</p></section>)}{content.table && <div className="f3-table-wrap"><table><thead><tr>{content.table.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{content.table.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>}{content.cards.length > 0 && <div className="f3-cards">{content.cards.map((card, index) => <section key={`${card.title}-${index}`}><h3>{card.title}</h3><p>{card.content}</p></section>)}</div>}{content.usageNote && <aside><strong>Podmínka použití</strong><p>{content.usageNote}</p></aside>}</article>}
  </div>;
}
