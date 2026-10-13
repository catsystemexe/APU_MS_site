// Ephemeral presentation choices; never part of a snapshot or F3Config.
export type WorkingDocumentStyle = "a" | "b";

export type DocumentTextBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] };

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

export type DocumentSectionKind = "need" | "summary" | "notebook" | "focus" | "hypothesis" | "comparison" | "knowledge" | "observation" | "indicators" | "priorities" | "approach" | "objective" | "conditions" | "verification" | "uncertainty";
const sectionKinds: Record<string, DocumentSectionKind> = {
  "Pedagogická potřeba": "need", "Shrnutí Rozboru": "summary",
  "Výchozí informace ze Zápisníku": "notebook", "Zacílení pracovní analýzy": "focus",
  "Porovnání a souvislosti": "comparison", "Odborný rámec": "knowledge",
  "Kontrasty podmínek": "observation", "Pozorovatelné indikátory": "indicators",
  "Priority pozorování": "priorities", "Pracovní přístup": "approach",
  "Pedagogický cíl": "objective", "Podmínky úspěchu": "conditions",
  "Následné ověřování": "verification", "Nejistota a omezení": "uncertainty",
};

export function documentSectionKind(heading: string): DocumentSectionKind | null {
  if (/^Pracovní hypotéza \d+: .+/.test(heading) || /^Rozvinutí hypotézy: .+/.test(heading)) return "hypothesis";
  return Object.hasOwn(sectionKinds, heading) ? sectionKinds[heading] : null;
}
