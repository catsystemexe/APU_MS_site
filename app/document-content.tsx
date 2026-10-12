"use client";

import type { RefObject } from "react";
import type { F3Material } from "./f3-finalization-model";

// One readable document for accepted working analysis and existing F3 materials.
// Controls and source adoption remain owned by the surrounding workspace.
export function DocumentContent({ content, documentRef, stale, workingAnalysis, sourceRevision }: {
  content: F3Material;
  documentRef: RefObject<HTMLElement | null>;
  stale: boolean;
  workingAnalysis: boolean;
  sourceRevision: number | null;
}) {
  return <article ref={documentRef} className={`f3-material${stale ? " is-stale" : ""}`}>
    <header>
      {!workingAnalysis && <span>Další podoba Výstupu</span>}
      <h2>{content.title}</h2>
      <p>{sourceRevision === null ? "Zdroj: dříve přijatý Rozbor (starší výstup)." : `Zdroj: přijatý Rozbor, revize ${sourceRevision}.`}</p>
    </header>
    {stale && <p><strong>Starší výstup — zdroj nebo nastavení se změnily.</strong></p>}
    <p>{content.introduction}</p>
    {content.sections.map((section) => <section key={section.heading}><h3>{section.heading}</h3><p>{section.content}</p></section>)}
    {content.table && <div className="f3-table-wrap"><table><thead><tr>{content.table.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{content.table.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>}
    {content.cards.length > 0 && <div className="f3-cards">{content.cards.map((card, index) => <section key={`${card.title}-${index}`}><h3>{card.title}</h3><p>{card.content}</p></section>)}</div>}
    {content.usageNote && <aside><strong>Podmínka použití</strong><p>{content.usageNote}</p></aside>}
  </article>;
}
