export type MarkdownInline =
  | { kind: "text"; value: string }
  | { kind: "strong" | "emphasis"; children: MarkdownInline[] };

export type MarkdownBlock =
  | { kind: "heading"; level: number; children: MarkdownInline[] }
  | { kind: "paragraph"; lines: MarkdownInline[][] }
  | { kind: "unordered-list" | "ordered-list"; items: MarkdownInline[][] };

export function parseMarkdownInline(source: string): MarkdownInline[] {
  const result: MarkdownInline[] = [];
  const pattern = /(\*\*|__)(.+?)\1|(?<!\*)\*([^*\n]+?)\*(?!\*)|(?<!_)_([^_\n]+?)_(?!_)/g;
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) result.push({ kind: "text", value: source.slice(cursor, index) });
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    result.push({
      kind: match[2] !== undefined ? "strong" : "emphasis",
      children: parseMarkdownInline(value),
    });
    cursor = index + match[0].length;
  }
  if (cursor < source.length) result.push({ kind: "text", value: source.slice(cursor) });
  return result;
}

export function parseGeneratedMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1].length, children: parseMarkdownInline(heading[2]) });
      index += 1;
      continue;
    }

    const unordered = /^\s*[-+*]\s+(.+)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      const kind = unordered ? "unordered-list" : "ordered-list";
      const items: MarkdownInline[][] = [];
      while (index < lines.length) {
        const item = kind === "unordered-list"
          ? /^\s*[-+*]\s+(.+)$/.exec(lines[index])
          : /^\s*\d+[.)]\s+(.+)$/.exec(lines[index]);
        if (!item) break;
        items.push(parseMarkdownInline(item[1]));
        index += 1;
      }
      blocks.push({ kind, items });
      continue;
    }

    const paragraphLines: MarkdownInline[][] = [];
    while (index < lines.length && lines[index].trim()
      && !/^(#{1,6})\s+/.test(lines[index])
      && !/^\s*(?:[-+*]|\d+[.)])\s+/.test(lines[index])) {
      paragraphLines.push(parseMarkdownInline(lines[index]));
      index += 1;
    }
    blocks.push({ kind: "paragraph", lines: paragraphLines });
  }

  return blocks;
}
