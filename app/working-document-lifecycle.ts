import { advanceAcceptedF2Source, type F2AnalysisContext, type F2ToF3Snapshot } from "./f2-build-model.ts";
import { adoptF2Snapshot, createF3State, type F3State } from "./f3-finalization-model.ts";

// Session-only document provenance, never analytical evidence or provider data.
export type WorkingDocumentMetadata = { createdAt: string };
export function acceptWorkingDocumentMetadata(current: WorkingDocumentMetadata | null, acceptedAt: string): WorkingDocumentMetadata {
  if (current) return current;
  if (!Number.isFinite(Date.parse(acceptedAt))) throw new Error("Neplatný čas vytvoření dokumentu.");
  return { createdAt: acceptedAt };
}
export function workingDocumentCreationDate(metadata: WorkingDocumentMetadata | null | undefined): string | null {
  if (!metadata || !Number.isFinite(Date.parse(metadata.createdAt))) return null;
  return new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" }).format(new Date(metadata.createdAt));
}

// Called only by explicit Build acceptance, after response/source-currency checks.
// Compute both states before committing either; no setters or side effects here.
export function acceptBuildDocumentUpdate(previous: F2ToF3Snapshot | null, f3: F3State | null,
  need: F2ToF3Snapshot["canonicalNeed"], hypotheses: F2ToF3Snapshot["baselineHypotheses"],
  path: F2ToF3Snapshot["activePath"], rozbor: F2ToF3Snapshot["currentRozbor"], context: F2AnalysisContext) {
  const snapshot = advanceAcceptedF2Source(previous, need, hypotheses, path, rozbor, context);
  return { snapshot, f3: snapshot === previous ? f3 : f3 ? adoptF2Snapshot(f3, snapshot) : createF3State(snapshot) };
}
