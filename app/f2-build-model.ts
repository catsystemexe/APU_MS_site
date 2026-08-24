import type { WorkingHypothesis } from "./analysis-model";
import type { CategoryId, F1ToF2NeedContract, F2Path } from "./notepad-model";

export type F2Skill = { id: string; path: F2Path; label: string; active: boolean; parameterText: string };
export type F2ContextItem = { id: string; text: string };
export type F2NotebookContextItem = { category: CategoryId; text: string };
export type F2Uncertainty = { description: string; whyRelevant: string; limits: string; relatedDecisionOrArea: string };
export type UnderstandingResult = { kind: "understanding"; relationships: string[]; comparisons: string[]; expertFrame: string[]; synthesis: string };
export type ObservationResult = { kind: "observation"; purpose: string; observableIndicators: Array<{ indicator: string; interpretation: string }>; situations: string[]; comparisonConditions: string[]; scope: string; evidenceMethod: string[]; hypothesisLinks: string[]; limitations: string[] };
export type CreationResult = { kind: "creation"; pedagogicalObjective: string; candidateApproaches: string[]; variantComparison: string[]; workingApproach: string; conditions: string[]; whatToVerify: string[]; relevantHypotheses: string[]; limitations: string[] };
export type F2PathResult = UnderstandingResult | ObservationResult | CreationResult;
export type F2ProcessedBuild = { path: F2Path; hypotheses: WorkingHypothesis[]; pathResult: F2PathResult; decisions: string[]; uncertainties: F2Uncertainty[]; missingInformation: string[]; processedRevision: number; processedResultId: string };
export type F2BuildState = {
  canonicalNeed: F1ToF2NeedContract; initialPath: F2Path; activePath: F2Path; f3Target: string | null;
  workingHypotheses: WorkingHypothesis[]; skills: F2Skill[]; addedContext: F2ContextItem[];
  entryUncertainties: F2Uncertainty[]; processedBuilds: Partial<Record<F2Path, F2ProcessedBuild>>; buildRevision: number;
};
export type F2BuildRequest = {
  kind: "f2-build"; initialPath: F2Path; activePath: F2Path; canonicalNotebookContext: F2NotebookContextItem[];
  canonicalNeed: F1ToF2NeedContract; f3Target: string | null; workingHypotheses: WorkingHypothesis[];
  activeSkills: Array<Pick<F2Skill, "id" | "label" | "parameterText">>; skillParameters: Record<string, string>;
  addedContext: F2ContextItem[]; previousProcessedBuildState: F2ProcessedBuild | null; buildRevision: number; model?: string;
  entryUncertainties: F2Uncertainty[];
};
export type F2BuildResult = Omit<F2ProcessedBuild, "path" | "processedRevision" | "processedResultId">;
export type F2PreviewSnapshot = {
  snapshotId: string;
  canonicalNeed: F1ToF2NeedContract; initialPath: F2Path; activePath: F2Path; f3Target: string | null;
  hypotheses: WorkingHypothesis[]; activeSkills: F2Skill[]; skillParameters: Record<string, string>; addedContext: F2ContextItem[];
  processedBuild: F2ProcessedBuild; decisions: string[]; uncertainties: F2Uncertainty[]; buildRevision: number; processedRevision: number;
};
export type F2RenderedPreview = { title: string; introduction: string; sections: Array<{ heading: string; content: string }> };
export type F2PreviewState = { snapshot: F2PreviewSnapshot; sourceBuildRevision: number; status: "current" | "stale"; render: F2RenderedPreview } | null;

export const F2_PATH_META: Record<F2Path, { label: F2Path; description: string }> = {
  POCHOPIT: { label: "POCHOPIT", description: "Jak této situaci odborně rozumět?" },
  POZOROVAT: { label: "POZOROVAT", description: "Co potřebujeme zjistit v realitě?" },
  VYTVOŘIT: { label: "VYTVOŘIT", description: "Jaký praktický obsah / přístup / prostředek má smysl připravit?" },
};
const SKILL_LABELS: Record<F2Path, string[]> = {
  POCHOPIT: ["Rozvinout hypotézy", "Porovnat vysvětlení", "Najít souvislosti", "Doplnit odborný rámec", "Zpřesnit obraz"],
  POZOROVAT: ["Určit, co sledovat", "Vybrat situace", "Porovnat podmínky", "Nastavit rozsah", "Určit evidenci"],
  VYTVOŘIT: ["Určit cíl", "Najít přístupy", "Porovnat varianty", "Nastavit podmínky", "Určit, co ověřovat"],
};
export const F2_SKILL_DEFINITIONS = Object.entries(SKILL_LABELS).flatMap(([path, labels]) => labels.map((label, index) => ({ id: `${path.toLowerCase()}-${index + 1}`, path: path as F2Path, label })));

export function canonicalF1NeedFingerprint(need: F1ToF2NeedContract) {
  return JSON.stringify([need.needId, need.needText, need.initialF2Path, need.f3Target]);
}

export function hasSameCanonicalF1Need(left: F1ToF2NeedContract, right: F1ToF2NeedContract) {
  return canonicalF1NeedFingerprint(left) === canonicalF1NeedFingerprint(right);
}

export function createF2BuildState(need: F1ToF2NeedContract, uncertainties: string[] = [], hypotheses: WorkingHypothesis[] = []): F2BuildState {
  const initialUncertainties = uncertainties.map((description) => ({ description, whyRelevant: "Může zpřesnit analytický obraz.", limits: "Omezuje míru jistoty, nikoli možnost pokračovat.", relatedDecisionOrArea: "výchozí analytický obraz" }));
  return { canonicalNeed: structuredClone(need), initialPath: need.initialF2Path, activePath: need.initialF2Path, f3Target: need.f3Target, workingHypotheses: structuredClone(hypotheses), skills: F2_SKILL_DEFINITIONS.map((skill) => ({ ...skill, active: false, parameterText: "" })), addedContext: [], entryUncertainties: initialUncertainties, processedBuilds: {}, buildRevision: 0 };
}
export function synchronizeF2BuildWithCanonicalNeed(build: F2BuildState | null, need: F1ToF2NeedContract, uncertainties: string[] = [], hypotheses: WorkingHypothesis[] = []) {
  if (!build) return createF2BuildState(need, uncertainties, hypotheses);
  if (hasSameCanonicalF1Need(build.canonicalNeed, need)) return build;
  // A changed canonical contract invalidates all derived state. Reset activePath to
  // the new initial route rather than preserving an unexplained working override.
  return createF2BuildState(need);
}
function revise(state: F2BuildState, change: Partial<F2BuildState>) { return { ...state, ...change, buildRevision: state.buildRevision + 1 }; }
export function switchF2Path(state: F2BuildState, activePath: F2Path) { return activePath === state.activePath ? state : revise(state, { activePath }); }
export function toggleF2Skill(state: F2BuildState, id: string) { return revise(state, { skills: state.skills.map((skill) => skill.id === id && skill.path === state.activePath ? { ...skill, active: !skill.active } : skill) }); }
export function parameterizeF2Skill(state: F2BuildState, id: string, parameterText: string) { const skill = state.skills.find((item) => item.id === id && item.path === state.activePath); return !skill || skill.parameterText === parameterText ? state : revise(state, { skills: state.skills.map((item) => item.id === id ? { ...item, parameterText } : item) }); }
export function addF2Context(state: F2BuildState, item: F2ContextItem) { return revise(state, { addedContext: [...state.addedContext, item] }); }
export function removeF2Context(state: F2BuildState, id: string) { return revise(state, { addedContext: state.addedContext.filter((item) => item.id !== id) }); }

export function createF2BuildRequest(build: F2BuildState, canonicalNotebookContext: F2NotebookContextItem[], model?: string): F2BuildRequest {
  const activeSkills = build.skills.filter((skill) => skill.path === build.activePath && skill.active).map(({ id, label, parameterText }) => ({ id, label, parameterText: parameterText.trim() }));
  if (!activeSkills.length) throw new Error("Vyberte alespoň jednu vrstvu buildu.");
  return structuredClone({ kind: "f2-build", initialPath: build.initialPath, activePath: build.activePath, canonicalNotebookContext, canonicalNeed: build.canonicalNeed, f3Target: build.f3Target, workingHypotheses: build.workingHypotheses, activeSkills, skillParameters: Object.fromEntries(activeSkills.map((skill) => [skill.id, skill.parameterText])), addedContext: build.addedContext, entryUncertainties: build.entryUncertainties, previousProcessedBuildState: build.processedBuilds[build.activePath] ?? null, buildRevision: build.buildRevision, ...(model ? { model } : {}) });
}
export const createPochopitBuildRequest = createF2BuildRequest;
export function applyF2BuildResult(build: F2BuildState, result: F2BuildResult, requestedPath: F2Path, requestedRevision: number): F2BuildState {
  if (build.activePath !== requestedPath || build.buildRevision !== requestedRevision || result.pathResult.kind !== ({ POCHOPIT: "understanding", POZOROVAT: "observation", VYTVOŘIT: "creation" } as const)[requestedPath]) return build;
  const hypotheses = reconcileF2Hypotheses(build.workingHypotheses, result.hypotheses);
  const processed: F2ProcessedBuild = { ...structuredClone(result), hypotheses, path: requestedPath, processedRevision: requestedRevision, processedResultId: crypto.randomUUID() };
  return { ...build, workingHypotheses: hypotheses, processedBuilds: { ...build.processedBuilds, [requestedPath]: processed } };
}
export const applyPochopitBuildResult = (build: F2BuildState, result: F2BuildResult, requestedRevision: number) => applyF2BuildResult(build, result, "POCHOPIT", requestedRevision);
export function reconcileF2Hypotheses(previous: WorkingHypothesis[], incoming: WorkingHypothesis[]): WorkingHypothesis[] {
  const previousById = new Map(previous.map((item) => [item.id, item])); const ids = new Set<string>();
  return incoming.map((item, index) => { let id = item.id.trim(); if (!id || ids.has(id)) id = `hypothesis-${crypto.randomUUID()}`; ids.add(id); const old = previousById.get(id); return { ...old, ...item, id, rank: index + 1, relevantNeeds: item.relevantNeeds ?? old?.relevantNeeds ?? [], question: item.question ?? old?.question ?? null, supportingInformation: item.supportingInformation ?? old?.supportingInformation ?? [], limitations: item.limitations ?? old?.limitations ?? [], unknowns: item.unknowns ?? old?.unknowns ?? [], questions: item.questions ?? old?.questions ?? [] }; });
}
export function currentF2ProcessedBuild(build: F2BuildState) { return build.processedBuilds[build.activePath] ?? null; }
export function createF2PreviewSnapshot(build: F2BuildState): F2PreviewSnapshot {
  const processedBuild = currentF2ProcessedBuild(build);
  if (!processedBuild || processedBuild.processedRevision !== build.buildRevision) throw new Error("Nejprve rozpracujte aktuální konfiguraci buildu.");
  const activeSkills = build.skills.filter((skill) => skill.path === build.activePath && skill.active);
  return structuredClone({ snapshotId: crypto.randomUUID(), canonicalNeed: build.canonicalNeed, initialPath: build.initialPath, activePath: build.activePath, f3Target: build.f3Target, hypotheses: build.workingHypotheses, activeSkills, skillParameters: Object.fromEntries(activeSkills.map((skill) => [skill.id, skill.parameterText])), addedContext: build.addedContext, processedBuild, decisions: processedBuild.decisions, uncertainties: processedBuild.uncertainties, buildRevision: build.buildRevision, processedRevision: processedBuild.processedRevision });
}
export function acceptRenderedPreview(snapshot: F2PreviewSnapshot, render: F2RenderedPreview): F2PreviewState { return { snapshot: structuredClone(snapshot), sourceBuildRevision: snapshot.buildRevision, status: "current", render: structuredClone(render) }; }
export function previewStatus(preview: F2PreviewState, build: F2BuildState): F2PreviewState {
  if (!preview) return null;
  const processed = currentF2ProcessedBuild(build);
  const current = hasSameCanonicalF1Need(preview.snapshot.canonicalNeed, build.canonicalNeed) &&
    preview.sourceBuildRevision === build.buildRevision &&
    processed?.processedResultId === preview.snapshot.processedBuild.processedResultId;
  return { ...preview, status: current ? "current" : "stale" };
}
