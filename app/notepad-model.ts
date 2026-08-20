export const NOTEPAD_STORAGE_KEY = "apu-site:notepad-map:v2";
export const LEGACY_NOTEPAD_STORAGE_KEY = "apu-site:notepad-map:v1";

export type CategoryId = "manifestations" | "goals" | "context" | "course" | "helps";

export type SourceReference = {
  messageId: string;
  quote: string;
  start: number;
  end: number;
};

export type NotepadEntry = {
  id: string;
  text: string;
  origin: "manual" | "extracted";
  source?: SourceReference;
  reviewStatus?: "unreviewed" | "reviewed";
  visibility?: "unseen" | "seen";
};

export type NotepadState = Record<CategoryId, NotepadEntry[]>;

export type ExtractionCandidate = {
  category: CategoryId;
  sourceQuote: string;
  notebookText: string;
  action: "add" | "duplicate" | "conflict" | "skip";
  relatedEntryId: string | null;
  reason: string | null;
  start: number;
  end: number;
};

export type ExtractionResult = {
  situationRelation: "same" | "related" | "different" | "uncertain";
  situationReason: string | null;
  candidates: ExtractionCandidate[];
};

export const EMPTY_NOTEPAD: NotepadState = {
  manifestations: [],
  goals: [],
  context: [],
  course: [],
  helps: [],
};

export const CATEGORY_IDS: CategoryId[] = [
  "manifestations",
  "goals",
  "context",
  "course",
  "helps",
];

export function createLocalId(prefix = "note") {
  return globalThis.crypto?.randomUUID?.() ??
    `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function isSourceReference(value: unknown): value is SourceReference {
  if (!value || typeof value !== "object") return false;
  const source = value as Partial<SourceReference>;
  return typeof source.messageId === "string" &&
    typeof source.quote === "string" &&
    typeof source.start === "number" &&
    typeof source.end === "number";
}

function isNotepadEntry(value: unknown): value is NotepadEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<NotepadEntry>;
  return typeof entry.id === "string" &&
    typeof entry.text === "string" &&
    (entry.origin === "manual" || entry.origin === "extracted") &&
    (entry.source === undefined || isSourceReference(entry.source)) &&
    (entry.reviewStatus === undefined || entry.reviewStatus === "unreviewed" || entry.reviewStatus === "reviewed") &&
    (entry.visibility === undefined || entry.visibility === "unseen" || entry.visibility === "seen");
}

export function parseNotepadState(value: unknown): NotepadState | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<Record<CategoryId, unknown>>;
  if (!CATEGORY_IDS.every((id) => Array.isArray(record[id]))) return null;

  const parsed = structuredClone(EMPTY_NOTEPAD);
  for (const category of CATEGORY_IDS) {
    const items = record[category] as unknown[];
    if (!items.every(isNotepadEntry)) return null;
    parsed[category] = items;
  }
  return parsed;
}

export function migrateLegacyNotepad(value: unknown): NotepadState | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<Record<CategoryId, unknown>>;
  if (!CATEGORY_IDS.every((id) => Array.isArray(record[id]))) return null;

  const migrated = structuredClone(EMPTY_NOTEPAD);
  for (const category of CATEGORY_IDS) {
    const items = record[category] as unknown[];
    if (!items.every((item) => typeof item === "string")) return null;
    migrated[category] = (items as string[]).map((text) => ({
      id: createLocalId("legacy"),
      text,
      origin: "manual",
    }));
  }
  return migrated;
}

export function compactNotepad(
  state: NotepadState,
  options: { excludeSourceMessageId?: string } = {},
) {
  return CATEGORY_IDS.flatMap((category) =>
    state[category]
      .filter((entry) => entry.text.trim() && entry.source?.messageId !== options.excludeSourceMessageId)
      .map((entry) => ({
        category,
        id: entry.id,
        text: entry.text.trim(),
        trust: "confirmed" as const,
      })),
  );
}

export function confirmNotepadEntry(
  state: NotepadState,
  category: CategoryId,
  entryId: string,
) {
  const next = structuredClone(state);
  const index = next[category].findIndex((entry) => entry.id === entryId);
  if (index < 0 || next[category][index].reviewStatus !== "unreviewed") return state;
  next[category][index].reviewStatus = "reviewed";
  return next;
}

export function locateSourceQuote(message: string, quote: string) {
  if (!quote) return null;
  const start = message.indexOf(quote);
  if (start < 0) return null;
  return { start, end: start + quote.length };
}

export function applyCandidates(
  state: NotepadState,
  messageId: string,
  candidates: ExtractionCandidate[],
) {
  const next = structuredClone(state);
  const added: NotepadEntry[] = [];

  for (const candidate of candidates) {
    if (candidate.action !== "add") continue;
    const normalized = candidate.notebookText.trim().toLocaleLowerCase("cs-CZ");
    const duplicate = next[candidate.category].some(
      (entry) => entry.text.trim().toLocaleLowerCase("cs-CZ") === normalized,
    );
    if (!normalized || duplicate) continue;

    const entry: NotepadEntry = {
      id: createLocalId("auto"),
      text: candidate.notebookText.trim(),
      origin: "extracted",
      reviewStatus: "reviewed",
      visibility: "unseen",
      source: {
        messageId,
        quote: candidate.sourceQuote,
        start: candidate.start,
        end: candidate.end,
      },
    };
    next[candidate.category].push(entry);
    added.push(entry);
  }

  return { state: next, added };
}

export function replaceEntryFromConflict(
  state: NotepadState,
  messageId: string,
  candidate: ExtractionCandidate,
) {
  if (!candidate.relatedEntryId) return state;
  const next = structuredClone(state);
  const index = next[candidate.category].findIndex((entry) => entry.id === candidate.relatedEntryId);
  if (index < 0) return state;
  next[candidate.category][index] = {
    id: candidate.relatedEntryId,
    text: candidate.notebookText.trim(),
    origin: "extracted",
    reviewStatus: "reviewed",
    visibility: "unseen",
    source: {
      messageId,
      quote: candidate.sourceQuote,
      start: candidate.start,
      end: candidate.end,
    },
  };
  return next;
}
