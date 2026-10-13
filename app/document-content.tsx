"use client";

import type { RefObject } from "react";
import { CircleHelp, Lightbulb, NotebookPen, Layers, type LucideIcon } from "lucide-react";
import type { F3Material } from "./f3-finalization-model";
import { documentSectionKind, documentTextBlocks, hasWorkingDocumentProjection, type DocumentTextBlock, type DocumentSectionKind, type WorkingDocumentStyle } from "./document-presentation";

const sectionIcons: Record<DocumentSectionKind, LucideIcon> = {
  notebook: NotebookPen, hypotheses: Lightbulb, extensions: Layers, uncertainty: CircleHelp,
};

function DocumentBlocks({ blocks }: { blocks: DocumentTextBlock[] }) {
  return <>{blocks.map((block, index) => block.kind === "list"
    ? <ul className="document-list" key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul>
    : <p className={`document-paragraph${blocks[index + 1]?.kind === "list" && /^[^\n]+:$/.test(block.text) ? " document-list-label" : ""}`} key={index}>{block.text}</p>)}</>;
}
function DocumentText({ text }: { text: string }) { return <DocumentBlocks blocks={documentTextBlocks(text)} />; }

function DocumentHeading({ heading, level }: { heading: string; level: 3 | 4 }) {
  const kind = documentSectionKind(heading);
  const Icon = kind ? sectionIcons[kind] : null;
  const Heading = level === 3 ? "h3" : "h4";
  return <Heading className={`document-heading ${level === 3 ? "document-major-heading" : "document-subheading"}`}>
    {Icon && <Icon className="document-section-icon" aria-hidden="true" focusable="false" />}<span>{heading}</span>
  </Heading>;
}

// One readable document for accepted working analysis and existing F3 materials.
// Controls and source adoption remain owned by the surrounding workspace.
export function DocumentContent({ content, documentRef, stale, workingAnalysis, sourceRevision, documentStyle = "a" }: {
  content: F3Material;
  documentRef: RefObject<HTMLElement | null>;
  stale: boolean;
  workingAnalysis: boolean;
  sourceRevision: number | null;
  documentStyle?: WorkingDocumentStyle;
}) {
  return <article ref={documentRef} className={`f3-material${stale ? " is-stale" : ""}${workingAnalysis ? ` working-document document-style-${documentStyle}` : ""}`} data-document-style={workingAnalysis ? documentStyle : undefined}>
    <header>
      {!workingAnalysis && <span>Další podoba Výstupu</span>}
      <h2>{content.title}</h2>
      {!workingAnalysis && <p>{sourceRevision === null ? "Zdroj: dříve přijatý Rozbor (starší výstup)." : `Zdroj: přijatý Rozbor, revize ${sourceRevision}.`}</p>}
    </header>
    {stale && <p><strong>Starší výstup — zdroj nebo nastavení se změnily.</strong></p>}
    {workingAnalysis ? <DocumentText text={content.introduction} /> : <p>{content.introduction}</p>}
    {workingAnalysis && hasWorkingDocumentProjection(content) ? content.documentGroups.map((group) => <section className="document-group" key={group.heading}>
      <DocumentHeading heading={group.heading} level={3} />
      {group.sections.map((section, index) => <section className="document-subsection" data-document-role={section.role} key={`${index}-${section.heading}`}>
        <DocumentHeading heading={section.heading} level={4} />
        <DocumentBlocks blocks={section.blocks} />
      </section>)}
    </section>) : content.sections.map((section, index) => <section key={`${index}-${section.heading}`}>
      {workingAnalysis ? <DocumentHeading heading={section.heading} level={3} /> : <h3>{section.heading}</h3>}
      {workingAnalysis ? <DocumentText text={section.content} /> : <p>{section.content}</p>}
    </section>)}
    {content.table && <div className="f3-table-wrap"><table><thead><tr>{content.table.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{content.table.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>}
    {content.cards.length > 0 && <div className="f3-cards">{content.cards.map((card, index) => <section key={`${card.title}-${index}`}><h3>{card.title}</h3><p>{card.content}</p></section>)}</div>}
    {content.usageNote && <aside><strong>{workingAnalysis && hasWorkingDocumentProjection(content) ? content.usageHeading : "Podmínka použití"}</strong>{workingAnalysis ? <DocumentText text={content.usageNote} /> : <p>{content.usageNote}</p>}</aside>}
  </article>;
}
