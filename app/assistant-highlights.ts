type TextRange = { start: number; end: number };

const STOP_WORDS = new Set([
  "aby", "ale", "ani", "bez", "bude", "byl", "byla", "bylo", "do", "ho", "i", "je", "jako",
  "ji", "k", "ke", "na", "nebo", "od", "po", "pod", "pro", "pri", "se", "si", "s", "ta", "tak",
  "to", "u", "v", "ve", "z", "za", "ze", "zak", "zejmena",
]);

function tokenStems(text: string) {
  return [...new Set(
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("cs-CZ")
      .match(/[a-z0-9]+/g)
      ?.filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
      .map((token) => token.length >= 7 ? token.slice(0, 6) : token.length >= 5 ? token.slice(0, 4) : token) ?? [],
  )];
}

function segments(content: string) {
  const ranges: Array<TextRange & { stems: Set<string> }> = [];
  const pattern = /[^.!?;:\n]+(?:[.!?;:]|$)/g;
  for (const match of content.matchAll(pattern)) {
    const rawStart = match.index ?? 0;
    const rawEnd = rawStart + match[0].length;
    const start = rawStart + (match[0].match(/^\s*/)?.[0].length ?? 0);
    const end = rawEnd - (match[0].match(/\s*$/)?.[0].length ?? 0);
    if (end <= start) continue;
    ranges.push({ start, end, stems: new Set(tokenStems(content.slice(start, end))) });
  }
  return ranges;
}

function mergeRanges(ranges: TextRange[]) {
  return ranges
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .reduce<TextRange[]>((merged, range) => {
      const previous = merged.at(-1);
      if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
      else merged.push({ ...range });
      return merged;
    }, []);
}

/** Finds the APU clauses that restate newly extracted notebook facts. */
export function findAssistantHighlightRanges(content: string, factTexts: string[]) {
  const candidates = segments(content);
  const selected: TextRange[] = [];

  for (const factText of factTexts) {
    const factStems = tokenStems(factText);
    if (!factStems.length) continue;
    let best: { range: TextRange; matches: number; ratio: number } | null = null;

    for (const candidate of candidates) {
      const matches = factStems.filter((stem) => candidate.stems.has(stem)).length;
      const ratio = matches / factStems.length;
      if (!best || matches > best.matches || (matches === best.matches && ratio > best.ratio)) {
        best = { range: candidate, matches, ratio };
      }
    }

    if (best && (best.matches >= 2 || best.ratio >= 0.5)) {
      selected.push({ start: best.range.start, end: best.range.end });
    }
  }

  return mergeRanges(selected);
}
