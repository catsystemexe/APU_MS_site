import type { F2ToF3Snapshot } from "./f2-build-model";

export type F3Audience = "teacher" | "parent" | "student" | "internal";
export type F3LanguageStyle = "concise" | "plain" | "professional" | "accessible";
export type F3LengthDetail = "brief" | "standard" | "detailed";
export type F3StructureMode = "auto" | "text" | "table" | "cards";
export type F3Config = { audience: F3Audience; languageStyle: F3LanguageStyle; lengthDetail: F3LengthDetail; structureMode: F3StructureMode };
export type F3Material = {
  kind: "material"; title: string; introduction: string;
  sections: Array<{ heading: string; content: string }>;
  table: { columns: string[]; rows: string[][] } | null;
  cards: Array<{ title: string; content: string }>;
  usageNote: string | null;
};
export type F3BoundaryIssue = { kind: "boundary_issue"; reason: string; affectedArea: string; suggestedReturnToF2: string };
export type F3RenderResult = F3Material | F3BoundaryIssue;
export type F3FinalRender = { sourceSnapshotId: string; f3ConfigRevision: number; content: F3RenderResult; status: "current" | "stale"; staleReason: "configuration" | "source" | null };
export type F3State = {
  sourceSnapshotId: string;
  sourceSnapshotRevision: number;
  sourceSnapshot: F2ToF3Snapshot;
  sourceStatus: "current" | "stale";
  observedSourceFingerprint: string;
  target: string;
  config: F3Config;
  configRevision: number;
  finalRender: F3FinalRender | null;
};
export type F3RenderRequest = {
  kind: "f3-render";
  sourceSnapshot: F2ToF3Snapshot;
  sourceSnapshotId: string;
  sourceFingerprint: string;
  f3Target: string;
  config: F3Config;
  f3ConfigRevision: number;
  model?: string;
};

export const DEFAULT_F3_CONFIG: F3Config = { audience: "teacher", languageStyle: "plain", lengthDetail: "standard", structureMode: "auto" };
export function f2SnapshotId(snapshot: F2ToF3Snapshot) { return snapshot.snapshotId; }
function immutableSnapshot(snapshot: F2ToF3Snapshot) {
  const freeze = (value: unknown): void => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  };
  const copy = structuredClone(snapshot);
  freeze(copy);
  return copy;
}
export function createF3State(snapshot: F2ToF3Snapshot): F3State {
  const sourceSnapshot = immutableSnapshot(snapshot);
  return {
    sourceSnapshotId: f2SnapshotId(snapshot),
    sourceSnapshotRevision: snapshot.sourceRevision,
    sourceSnapshot,
    sourceStatus: "current",
    observedSourceFingerprint: snapshot.sourceFingerprint,
    target: snapshot.f3Target?.trim() || "Strukturovaný výstup",
    config: { ...DEFAULT_F3_CONFIG },
    configRevision: 0,
    finalRender: null,
  };
}
export function updateF3Config(state: F3State, change: Partial<F3Config>): F3State {
  const config = { ...state.config, ...change };
  if (JSON.stringify(config) === JSON.stringify(state.config)) return state;
  return {
    ...state,
    config,
    configRevision: state.configRevision + 1,
    finalRender: state.finalRender ? {
      ...state.finalRender,
      status: "stale",
      staleReason: state.finalRender.staleReason === "source" ? "source" : "configuration",
    } : null,
  };
}
export function markF3SourceStale(state: F3State, currentSourceFingerprint: string): F3State {
  if (currentSourceFingerprint === state.observedSourceFingerprint) return state;
  return {
    ...state,
    sourceStatus: "stale",
    observedSourceFingerprint: currentSourceFingerprint,
    finalRender: state.finalRender ? { ...state.finalRender, status: "stale", staleReason: "source" } : null,
  };
}
export function hasNewerF2Snapshot(state: F3State, snapshot: F2ToF3Snapshot | null | undefined) {
  return Boolean(snapshot && (snapshot.sourceFingerprint !== state.sourceSnapshot.sourceFingerprint || state.sourceStatus === "stale"));
}
export function adoptF2Snapshot(state: F3State, snapshot: F2ToF3Snapshot): F3State {
  if (snapshot.sourceFingerprint === state.sourceSnapshot.sourceFingerprint && state.sourceStatus === "current") return state;
  return {
    ...state,
    sourceSnapshotId: f2SnapshotId(snapshot),
    sourceSnapshotRevision: snapshot.sourceRevision,
    sourceSnapshot: immutableSnapshot(snapshot),
    sourceStatus: "current",
    observedSourceFingerprint: snapshot.sourceFingerprint,
    target: snapshot.f3Target?.trim() || "Strukturovaný výstup",
    finalRender: state.finalRender ? { ...state.finalRender, status: "stale", staleReason: "source" } : null,
  };
}
export function createF3RenderRequest(state: F3State, model?: string): F3RenderRequest {
  if (state.sourceStatus === "stale") throw new Error("Nejprve přijměte aktuální Rozbor jako nový zdroj Výstupu.");
  return structuredClone({
    kind: "f3-render",
    sourceSnapshot: state.sourceSnapshot,
    sourceSnapshotId: state.sourceSnapshotId,
    sourceFingerprint: state.sourceSnapshot.sourceFingerprint,
    f3Target: state.target,
    config: state.config,
    f3ConfigRevision: state.configRevision,
    ...(model ? { model } : {}),
  });
}
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");
const hasText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const isTable = (value: unknown): value is F3Material["table"] => {
  if (value === null) return true;
  if (!isRecord(value) || !isStringArray(value.columns) || value.columns.length === 0 || !Array.isArray(value.rows)) return false;
  const columnCount = value.columns.length;
  return value.rows.every((row) => isStringArray(row) && row.length === columnCount);
};
export function parseF3RenderResult(value: unknown): F3RenderResult {
  if (!isRecord(value)) throw new Error("Model vrátil neúplný nebo neplatný F3 výsledek.");
  const valid = value.kind === "boundary_issue"
    ? hasText(value.reason) && hasText(value.affectedArea) && hasText(value.suggestedReturnToF2)
    : value.kind === "material" && hasText(value.title) && hasText(value.introduction) && Array.isArray(value.sections) && value.sections.length > 0 && value.sections.every((section) => isRecord(section) && hasText(section.heading) && hasText(section.content)) && isTable(value.table) && Array.isArray(value.cards) && value.cards.every((card) => isRecord(card) && hasText(card.title) && hasText(card.content)) && (value.usageNote === null || hasText(value.usageNote));
  if (!valid) throw new Error("Model vrátil neúplný nebo neplatný F3 výsledek.");
  return structuredClone(value) as F3RenderResult;
}
export function acceptF3Render(state: F3State, result: F3RenderResult, request: F3RenderRequest): F3State {
  if (state.sourceStatus !== "current" || request.sourceSnapshotId !== state.sourceSnapshotId || request.sourceFingerprint !== state.sourceSnapshot.sourceFingerprint || request.f3ConfigRevision !== state.configRevision) return state;
  const content = parseF3RenderResult(result);
  return { ...state, finalRender: { sourceSnapshotId: request.sourceSnapshotId, f3ConfigRevision: request.f3ConfigRevision, content, status: "current", staleReason: null } };
}
