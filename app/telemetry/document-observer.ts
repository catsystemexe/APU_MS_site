import type { F3State, F3RenderRequest, F3FinalRender } from "../f3-finalization-model.ts";
import type { Pilot, PilotOperation } from "./pilot.ts";
/** Observe committed results of explicit actions, never emit merely from a React render/effect. */
export function createDocumentObserver(pilot: Pick<Pilot, "document">) {
  let expected: { operation: PilotOperation; request: Pick<F3RenderRequest, "sourceSnapshotId" | "sourceFingerprint" | "f3ConfigRevision">; previous: F3FinalRender | null } | null = null;
  let expose = false;
  let baselines = new Map<string, symbol>(), generated = new WeakMap<object, symbol>();
  function visible(state: F3State) {
    if (state.sourceStatus !== "current") return;
    if (state.representation === "analysis") {
      let token = baselines.get(state.sourceSnapshotId);
      if (!token) { token = Symbol(); baselines.set(state.sourceSnapshotId, token); }
      pilot.document(token, "baseline");
    } else if (state.finalRender?.status === "current" && state.finalRender.content.kind === "material") {
      let token = generated.get(state.finalRender.content);
      if (!token) { token = Symbol(); generated.set(state.finalRender.content, token); }
      pilot.document(token, "generated");
    }
  }
  return {
    expose() { expose = true; },
    expect(operation: PilotOperation, request: F3RenderRequest, previous: F3FinalRender | null) {
      if (!operation.isCurrent()) return;
      expected?.operation.resolve("stale_discarded"); expected = { operation, request: { sourceSnapshotId: request.sourceSnapshotId, sourceFingerprint: request.sourceFingerprint, f3ConfigRevision: request.f3ConfigRevision }, previous }; expose = true;
    },
    observe(state: F3State | null, isOutput: boolean) {
      if (!state) return;
      if (expected && state.finalRender === expected.previous) return;
      if (expected && state.finalRender !== expected.previous) {
        const { operation, request } = expected, render = state.finalRender;
        if (!operation.isCurrent()) { operation.resolve("stale_discarded"); expected = null; expose = false; return; }
        const current = render && state.sourceStatus === "current" && render.status === "current" &&
          request.sourceSnapshotId === state.sourceSnapshotId && request.sourceFingerprint === state.sourceSnapshot.sourceFingerprint &&
          request.f3ConfigRevision === state.configRevision && render.f3ConfigRevision === request.f3ConfigRevision;
        operation.resolve(!current ? "stale_discarded" : render.content.kind === "material" ? "accepted" : "failed",
          current && render.content.kind !== "material" ? "invalid_output" : undefined);
        expected = null;
      }
      if (expose && isOutput) { visible(state); expose = false; }
    },
    reset() { expected?.operation.resolve("stale_discarded"); expected = null; expose = false; baselines = new Map(); generated = new WeakMap(); },
  };
}
