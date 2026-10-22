// Ephemeral presentation choices; never part of a snapshot or F3Config.
import type { F3Material } from "./f3-finalization-model";

export type WorkingDocumentStyle = "a" | "b";

export type DocumentTextBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] };

export type WorkingDocumentSection = {
  heading: string;
  content: string; // Compatibility text, derived from the same blocks.
  blocks: DocumentTextBlock[];
  role: "notebook" | "focus" | "hypothesis" | "uncertainty" | "extension";
};
export type WorkingDocumentGroup = {
  heading: "Informace ze Zápisníku" | "Pracovní hypotézy" | "Rozšíření analýzy";
  sections: WorkingDocumentSection[];
};
// Local document view metadata; absent from snapshots and provider contracts.
export type WorkingDocumentProjection = F3Material & { documentGroups: WorkingDocumentGroup[]; usageHeading: "Podmínka použití" };
export function hasWorkingDocumentProjection(material: F3Material): material is WorkingDocumentProjection {
  return Array.isArray((material as WorkingDocumentProjection).documentGroups);
}
export function documentBlocksToText(blocks: DocumentTextBlock[]) {
  return blocks.map((block) => block.kind === "list" ? block.items.map((item) => `• ${item}`).join("\n") : block.text).join("\n\n");
}

// Only explicit, unindented bullet-prefixed lines are lists. Preserve all other
// wording/newlines, including Markdown, numbered prose and uncertain continuations.
// This adapter is a view of F3Material, not another analytical content source.
export function documentTextBlocks(text: string): DocumentTextBlock[] {
  const blocks: DocumentTextBlock[] = [];
  for (const paragraph of text.split(/\n\n+/)) {
    const lines = paragraph.split("\n");
    if (lines.some((line, index) => index > 0 && /^• /.test(lines[index - 1]) && !/^• /.test(line))) {
      blocks.push({ kind: "paragraph", text: paragraph });
      continue; // A possible wrapped list item remains faithfully unparsed.
    }
    let prose: string[] = [];
    let items: string[] = [];
    const flushProse = () => { if (prose.length) blocks.push({ kind: "paragraph", text: prose.join("\n") }); prose = []; };
    const flushList = () => { if (items.length) blocks.push({ kind: "list", items }); items = []; };
    for (const line of lines) {
      const bullet = /^• (\S.*)$/.exec(line);
      if (bullet) { flushProse(); items.push(bullet[1]); }
      else { flushList(); prose.push(line); }
    }
    flushProse(); flushList();
  }
  return blocks;
}

export type DocumentSectionKind = "notebook" | "hypotheses" | "extensions" | "uncertainty";
const sectionKinds: Record<string, DocumentSectionKind> = {
  "Informace ze Zápisníku": "notebook", "Pracovní hypotézy": "hypotheses",
  "Rozšíření analýzy": "extensions", "Nejistota a omezení": "uncertainty",
};

export function documentSectionKind(heading: string): DocumentSectionKind | null {
  return Object.hasOwn(sectionKinds, heading) ? sectionKinds[heading] : null;
}
