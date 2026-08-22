import type { DevLogStatus, DevLogType, SharedFeedbackItem, SharedFeedbackResult } from "./shared-feedback";

export const DEV_LOG_SCHEMA = "apu-dev-log/v1";
export const DEV_LOG_SOURCE_TYPES = ["BUG", "PRODUCT_CHANGE", "METHODOLOGY_CHANGE", "PRODUCT_PROPOSAL", "METHODOLOGY_PROPOSAL", "UNCERTAINTY"] as const;
export const DEV_LOG_SOURCE_STATUSES = ["NEW", "IN_PROGRESS", "DONE"] as const;

type SourceType = (typeof DEV_LOG_SOURCE_TYPES)[number];
type SourceStatus = (typeof DEV_LOG_SOURCE_STATUSES)[number];

export const DEV_LOG_SECTION_LABELS = ["Podnět", "Smysl / potřeba", "Navrhované řešení", "Dopad na APU", "Přínos", "Rizika / nevýhody", "Otevřené otázky"] as const;

export type ParsedDevLogEntry = {
  schema: typeof DEV_LOG_SCHEMA;
  id: string;
  createdAt: string;
  type: SourceType;
  status: SourceStatus;
  title: string;
  sections: Record<(typeof DEV_LOG_SECTION_LABELS)[number], string>;
};

export type DevLogParseResult = { entry: ParsedDevLogEntry | null; error: string | null };

function unquote(value: string) {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))) return trimmed.slice(1, -1);
  return trimmed;
}

export function parseDevLogEntry(markdown: string): DevLogParseResult {
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) return { entry: null, error: "chybí platný YAML frontmatter" };

  const metadata: Record<string, string> = {};
  for (const line of frontmatter[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const separator = line.indexOf(":");
    if (separator < 1) return { entry: null, error: `neplatný řádek frontmatter: ${line}` };
    metadata[line.slice(0, separator).trim()] = unquote(line.slice(separator + 1));
  }

  if (metadata.schema !== DEV_LOG_SCHEMA) return { entry: null, error: `nepodporované schema ${metadata.schema || "(prázdné)"}` };
  if (!metadata.id?.trim()) return { entry: null, error: "chybí ID" };
  if (!metadata.created_at || Number.isNaN(Date.parse(metadata.created_at))) return { entry: null, error: "created_at není platné ISO datum" };
  if (!DEV_LOG_SOURCE_TYPES.includes(metadata.type as SourceType)) return { entry: null, error: `nepodporovaný type ${metadata.type || "(prázdný)"}` };
  if (!DEV_LOG_SOURCE_STATUSES.includes(metadata.status as SourceStatus)) return { entry: null, error: `nepodporovaný status ${metadata.status || "(prázdný)"}` };
  if (!metadata.title?.trim()) return { entry: null, error: "chybí title" };

  const body = markdown.slice(frontmatter[0].length);
  const headings = [...body.matchAll(/^##[ \t]+(.+?)[ \t]*$/gm)];
  const sections = {} as ParsedDevLogEntry["sections"];
  for (const label of DEV_LOG_SECTION_LABELS) {
    const headingIndex = headings.findIndex((match) => match[1] === label);
    if (headingIndex < 0) return { entry: null, error: `chybí sekce „${label}“` };
    const start = (headings[headingIndex].index ?? 0) + headings[headingIndex][0].length;
    const end = headings[headingIndex + 1]?.index ?? body.length;
    const content = body.slice(start, end).trim();
    if (!content) return { entry: null, error: `sekce „${label}“ je prázdná` };
    sections[label] = content;
  }

  return { entry: { schema: DEV_LOG_SCHEMA, id: metadata.id.trim(), createdAt: metadata.created_at, type: metadata.type as SourceType, status: metadata.status as SourceStatus, title: metadata.title.trim(), sections }, error: null };
}

const TYPE_MAP: Record<SourceType, DevLogType> = {
  BUG: "bug", PRODUCT_CHANGE: "improvement", METHODOLOGY_CHANGE: "improvement",
  PRODUCT_PROPOSAL: "discussion", METHODOLOGY_PROPOSAL: "discussion", UNCERTAINTY: "discussion",
};
const STATUS_MAP: Record<SourceStatus, DevLogStatus> = { NEW: "new", IN_PROGRESS: "in_progress", DONE: "done" };

export function toDevLogUiItem(entry: ParsedDevLogEntry): SharedFeedbackItem {
  return {
    id: entry.id, type: TYPE_MAP[entry.type], title: entry.title, status: STATUS_MAP[entry.status], createdAt: entry.createdAt,
    source: "repository", summary: entry.sections["Podnět"],
    details: DEV_LOG_SECTION_LABELS.map((label) => ({ label, text: entry.sections[label] })), note: "",
  };
}

export function loadDevLogEntries(files: Record<string, string>, warn: (message: string) => void = console.warn): SharedFeedbackResult {
  const items: SharedFeedbackItem[] = [];
  const ids = new Set<string>();
  for (const [filename, markdown] of Object.entries(files).sort(([left], [right]) => left.localeCompare(right))) {
    const parsed = parseDevLogEntry(markdown);
    if (!parsed.entry) { warn(`[DEV LOG] Přeskakuji ${filename}: ${parsed.error}.`); continue; }
    if (ids.has(parsed.entry.id)) { warn(`[DEV LOG] Přeskakuji ${filename} (${parsed.entry.id}): duplicitní ID.`); continue; }
    ids.add(parsed.entry.id);
    items.push(toDevLogUiItem(parsed.entry));
  }
  return { data: { version: 1, items }, error: null };
}

