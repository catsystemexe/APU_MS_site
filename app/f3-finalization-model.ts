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
  sourceSnapshotId: string; sourceSnapshotRevision: string; sourceSnapshot: F2ToF3Snapshot; target: string;
  sourceOutdated: boolean; config: F3Config; configRevision: number; finalRender: F3FinalRender | null;
};
export type F3RenderRequest = { kind: "f3-render"; sourceSnapshot: F2ToF3Snapshot; sourceSnapshotId: string; f3Target: string; config: F3Config; f3ConfigRevision: number; model?: string };

export const DEFAULT_F3_CONFIG: F3Config = { audience: "teacher", languageStyle: "plain", lengthDetail: "standard", structureMode: "auto" };
export function f2SnapshotId(snapshot: F2ToF3Snapshot) { return snapshot.snapshotId; }
export function createF3State(snapshot: F2ToF3Snapshot): F3State {
  return { sourceSnapshotId: f2SnapshotId(snapshot), sourceSnapshotRevision: snapshot.sourceRevision, sourceSnapshot: structuredClone(snapshot), target: snapshot.f3Target?.trim() || "Strukturovaný výstup", sourceOutdated: false, config: { ...DEFAULT_F3_CONFIG }, configRevision: 0, finalRender: null };
}
export function updateF3Config(state: F3State, change: Partial<F3Config>): F3State {
  const config = { ...state.config, ...change };
  if (JSON.stringify(config) === JSON.stringify(state.config)) return state;
  return { ...state, config, configRevision: state.configRevision + 1, finalRender: state.finalRender ? { ...state.finalRender, status: "stale", staleReason: state.sourceOutdated ? "source" : "configuration" } : null };
}
export function hasNewerF2Snapshot(state: F3State, snapshot: F2ToF3Snapshot | null | undefined) { return Boolean(snapshot && snapshot.sourceFingerprint !== state.sourceSnapshot.sourceFingerprint); }
export function markF3SourceStale(state: F3State, currentSourceFingerprint: string | null): F3State {
  const sourceOutdated = currentSourceFingerprint !== state.sourceSnapshot.sourceFingerprint;
  let finalRender = state.finalRender;
  if (sourceOutdated && finalRender) finalRender = { ...finalRender, status: "stale", staleReason: "source" };
  else if (!sourceOutdated && finalRender?.staleReason === "source" && finalRender.sourceSnapshotId === state.sourceSnapshotId) {
    finalRender = finalRender.f3ConfigRevision === state.configRevision
      ? { ...finalRender, status: "current", staleReason: null }
      : { ...finalRender, status: "stale", staleReason: "configuration" };
  }
  if (sourceOutdated === state.sourceOutdated && finalRender === state.finalRender) return state;
  return { ...state, sourceOutdated, finalRender };
}
export function adoptF2Snapshot(state: F3State, snapshot: F2ToF3Snapshot): F3State {
  if (snapshot.sourceFingerprint === state.sourceSnapshot.sourceFingerprint) return state;
  const id = f2SnapshotId(snapshot);
  return { ...state, sourceSnapshotId: id, sourceSnapshotRevision: snapshot.sourceRevision, sourceSnapshot: structuredClone(snapshot), target: snapshot.f3Target?.trim() || "Strukturovaný výstup", sourceOutdated: false, finalRender: state.finalRender ? { ...state.finalRender, status: "stale", staleReason: "source" } : null };
}
export function createF3RenderRequest(state: F3State, model?: string): F3RenderRequest { return structuredClone({ kind: "f3-render", sourceSnapshot: state.sourceSnapshot, sourceSnapshotId: state.sourceSnapshotId, f3Target: state.target, config: state.config, f3ConfigRevision: state.configRevision, ...(model ? { model } : {}) }); }
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");
const hasText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
export function parseF3RenderResult(value: unknown): F3RenderResult {
  if (!isRecord(value)) throw new Error("Model vrátil neúplný nebo neplatný F3 výsledek.");
  const valid = value.kind === "boundary_issue"
    ? hasText(value.reason) && hasText(value.affectedArea) && hasText(value.suggestedReturnToF2)
    : value.kind === "material" && hasText(value.title) && hasText(value.introduction) && Array.isArray(value.sections) && value.sections.length > 0 && value.sections.every((section) => isRecord(section) && hasText(section.heading) && hasText(section.content)) && (value.table === null || (isRecord(value.table) && isStringArray(value.table.columns) && value.table.columns.length > 0 && Array.isArray(value.table.rows) && value.table.rows.every(isStringArray))) && Array.isArray(value.cards) && value.cards.every((card) => isRecord(card) && hasText(card.title) && hasText(card.content)) && (value.usageNote === null || hasText(value.usageNote));
  if (!valid) throw new Error("Model vrátil neúplný nebo neplatný F3 výsledek.");
  return structuredClone(value) as F3RenderResult;
}
export function acceptF3Render(state: F3State, result: F3RenderResult, request: F3RenderRequest): F3State {
  if (state.sourceOutdated || request.sourceSnapshotId !== state.sourceSnapshotId || request.f3ConfigRevision !== state.configRevision) return state;
  return { ...state, finalRender: { sourceSnapshotId: request.sourceSnapshotId, f3ConfigRevision: request.f3ConfigRevision, content: parseF3RenderResult(result), status: "current", staleReason: null } };
}
