import type { F2PreviewSnapshot } from "./f2-build-model";

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
  sourceSnapshotId: string; sourceSnapshotRevision: number; sourceSnapshot: F2PreviewSnapshot; target: string;
  config: F3Config; configRevision: number; finalRender: F3FinalRender | null;
};
export type F3RenderRequest = { kind: "f3-render"; sourceSnapshot: F2PreviewSnapshot; sourceSnapshotId: string; f3Target: string; config: F3Config; f3ConfigRevision: number; model?: string };

export const DEFAULT_F3_CONFIG: F3Config = { audience: "teacher", languageStyle: "plain", lengthDetail: "standard", structureMode: "auto" };
export function f2SnapshotId(snapshot: F2PreviewSnapshot) { return `${snapshot.canonicalNeed.needId}:${snapshot.activePath}:${snapshot.buildRevision}`; }
export function createF3State(snapshot: F2PreviewSnapshot): F3State {
  return { sourceSnapshotId: f2SnapshotId(snapshot), sourceSnapshotRevision: snapshot.buildRevision, sourceSnapshot: structuredClone(snapshot), target: snapshot.f3Target?.trim() || "Strukturovaný výstup", config: { ...DEFAULT_F3_CONFIG }, configRevision: 0, finalRender: null };
}
export function updateF3Config(state: F3State, change: Partial<F3Config>): F3State {
  const config = { ...state.config, ...change };
  if (JSON.stringify(config) === JSON.stringify(state.config)) return state;
  return { ...state, config, configRevision: state.configRevision + 1, finalRender: state.finalRender ? { ...state.finalRender, status: "stale", staleReason: "configuration" } : null };
}
export function hasNewerF2Snapshot(state: F3State, snapshot: F2PreviewSnapshot | null | undefined) { return Boolean(snapshot && f2SnapshotId(snapshot) !== state.sourceSnapshotId); }
export function adoptF2Snapshot(state: F3State, snapshot: F2PreviewSnapshot): F3State {
  const id = f2SnapshotId(snapshot); if (id === state.sourceSnapshotId) return state;
  return { ...state, sourceSnapshotId: id, sourceSnapshotRevision: snapshot.buildRevision, sourceSnapshot: structuredClone(snapshot), target: snapshot.f3Target?.trim() || "Strukturovaný výstup", finalRender: state.finalRender ? { ...state.finalRender, status: "stale", staleReason: "source" } : null };
}
export function createF3RenderRequest(state: F3State, model?: string): F3RenderRequest { return structuredClone({ kind: "f3-render", sourceSnapshot: state.sourceSnapshot, sourceSnapshotId: state.sourceSnapshotId, f3Target: state.target, config: state.config, f3ConfigRevision: state.configRevision, ...(model ? { model } : {}) }); }
export function acceptF3Render(state: F3State, result: F3RenderResult, request: F3RenderRequest): F3State {
  if (request.sourceSnapshotId !== state.sourceSnapshotId || request.f3ConfigRevision !== state.configRevision) return state;
  return { ...state, finalRender: { sourceSnapshotId: request.sourceSnapshotId, f3ConfigRevision: request.f3ConfigRevision, content: structuredClone(result), status: "current", staleReason: null } };
}
