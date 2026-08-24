import type { WorkingHypothesis } from "./analysis-model";
import type { CategoryId, F1ToF2NeedContract, F2Path } from "./notepad-model";

export type F2Skill = { id: string; path: F2Path; label: string; active: boolean; parameterText: string };
export type F2ContextItem = { id: string; text: string };
export type F2NotebookContextItem = { category: CategoryId; text: string };
export type F2Uncertainty = { missing: string; importance: string; limitation: string };
export type F2AnalyticalState = {
  relationships: string[];
  comparisons: string[];
  expertFrame: string[];
  synthesis: string;
  decisions: string[];
  uncertainties: F2Uncertainty[];
};
export type F2BuildState = {
  canonicalNeed: F1ToF2NeedContract;
  initialPath: F2Path;
  activePath: F2Path;
  f3Target: string | null;
  workingHypotheses: WorkingHypothesis[];
  skills: F2Skill[];
  addedContext: F2ContextItem[];
  analytical: F2AnalyticalState;
  buildRevision: number;
  processedRevision: number | null;
};
export type PochopitBuildRequest = {
  kind: "pochopit-build";
  initialPath: F2Path;
  activePath: "POCHOPIT";
  situation: F2NotebookContextItem[];
  canonicalNeed: F1ToF2NeedContract;
  f3Target: string | null;
  workingHypotheses: WorkingHypothesis[];
  activeSkills: Array<Pick<F2Skill, "id" | "label" | "parameterText">>;
  addedContext: F2ContextItem[];
  previousAnalyticalState: F2AnalyticalState | null;
  buildRevision: number;
  model?: string;
};
export type PochopitBuildResult = { hypotheses: WorkingHypothesis[]; analytical: F2AnalyticalState };
export type F2PreviewSnapshot = {
  canonicalNeed: F1ToF2NeedContract; initialPath: F2Path; activePath: F2Path; f3Target: string | null;
  hypotheses: WorkingHypothesis[]; activeSkills: F2Skill[]; addedContext: F2ContextItem[];
  analytical: F2AnalyticalState; buildRevision: number; processedRevision: number;
};
export type F2RenderedPreview = { title: string; introduction: string; sections: Array<{ heading: string; content: string }> };
export type F2PreviewState = {
  snapshot: F2PreviewSnapshot; sourceBuildRevision: number; status: "current" | "stale";
  render: F2RenderedPreview;
} | null;

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
const emptyAnalytical = (): F2AnalyticalState => ({ relationships: [], comparisons: [], expertFrame: [], synthesis: "", decisions: [], uncertainties: [] });

export function createF2BuildState(need: F1ToF2NeedContract, uncertainties: string[] = [], hypotheses: WorkingHypothesis[] = []): F2BuildState {
  return { canonicalNeed: structuredClone(need), initialPath: need.initialF2Path, activePath: need.initialF2Path, f3Target: need.f3Target,
    workingHypotheses: structuredClone(hypotheses), skills: F2_SKILL_DEFINITIONS.map((skill) => ({ ...skill, active: false, parameterText: "" })), addedContext: [],
    analytical: { ...emptyAnalytical(), uncertainties: uncertainties.map((missing) => ({ missing, importance: "Může zpřesnit analytický obraz.", limitation: "Omezuje míru jistoty, nikoli možnost pokračovat v rozboru." })) }, buildRevision: 0, processedRevision: null };
}
function revise(state: F2BuildState, change: Partial<F2BuildState>) { return { ...state, ...change, buildRevision: state.buildRevision + 1 }; }
export function switchF2Path(state: F2BuildState, activePath: F2Path) { return activePath === state.activePath ? state : revise(state, { activePath }); }
export function toggleF2Skill(state: F2BuildState, id: string) { return revise(state, { skills: state.skills.map((skill) => skill.id === id ? { ...skill, active: !skill.active } : skill) }); }
export function parameterizeF2Skill(state: F2BuildState, id: string, parameterText: string) { const skill = state.skills.find((item) => item.id === id); return !skill || skill.parameterText === parameterText ? state : revise(state, { skills: state.skills.map((item) => item.id === id ? { ...item, parameterText } : item) }); }
export function addF2Context(state: F2BuildState, item: F2ContextItem) { return revise(state, { addedContext: [...state.addedContext, item] }); }
export function removeF2Context(state: F2BuildState, id: string) { return revise(state, { addedContext: state.addedContext.filter((item) => item.id !== id) }); }

export function createPochopitBuildRequest(build: F2BuildState, situation: F2NotebookContextItem[], model?: string): PochopitBuildRequest {
  if (build.activePath !== "POCHOPIT") throw new Error("Modelové rozpracování je zatím dostupné pouze pro cestu POCHOPIT.");
  const activeSkills = build.skills.filter((skill) => skill.path === "POCHOPIT" && skill.active).map(({ id, label, parameterText }) => ({ id, label, parameterText: parameterText.trim() }));
  if (!activeSkills.length) throw new Error("Vyberte alespoň jednu vrstvu buildu.");
  return structuredClone({ kind: "pochopit-build", initialPath: build.initialPath, activePath: "POCHOPIT", situation, canonicalNeed: build.canonicalNeed, f3Target: build.f3Target, workingHypotheses: build.workingHypotheses,
    activeSkills, addedContext: build.addedContext, previousAnalyticalState: build.processedRevision === null ? null : build.analytical, buildRevision: build.buildRevision, ...(model ? { model } : {}) });
}
export function applyPochopitBuildResult(build: F2BuildState, result: PochopitBuildResult, requestedRevision: number): F2BuildState {
  if (build.activePath !== "POCHOPIT" || build.buildRevision !== requestedRevision) return build;
  return { ...build, workingHypotheses: reconcileF2Hypotheses(build.workingHypotheses, result.hypotheses), analytical: structuredClone(result.analytical), processedRevision: requestedRevision };
}
export function reconcileF2Hypotheses(previous: WorkingHypothesis[], incoming: WorkingHypothesis[]): WorkingHypothesis[] {
  const previousById = new Map(previous.map((item) => [item.id, item]));
  const ids = new Set<string>();
  return incoming.map((item, index) => {
    let id = item.id.trim();
    if (!id || ids.has(id)) id = `hypothesis-${crypto.randomUUID()}`;
    ids.add(id);
    const old = previousById.get(id);
    return { ...old, ...item, id, rank: index + 1, relevantNeeds: item.relevantNeeds ?? old?.relevantNeeds ?? [], question: item.question ?? old?.question ?? null,
      supportingInformation: item.supportingInformation ?? old?.supportingInformation ?? [], limitations: item.limitations ?? old?.limitations ?? [], unknowns: item.unknowns ?? old?.unknowns ?? [], questions: item.questions ?? old?.questions ?? [] };
  });
}
export function createF2PreviewSnapshot(build: F2BuildState): F2PreviewSnapshot {
  if (build.activePath !== "POCHOPIT" || build.processedRevision === null || build.processedRevision !== build.buildRevision) throw new Error("Nejprve rozpracujte aktuální konfiguraci buildu.");
  return structuredClone({ canonicalNeed: build.canonicalNeed, initialPath: build.initialPath, activePath: build.activePath, f3Target: build.f3Target,
    hypotheses: build.workingHypotheses, activeSkills: build.skills.filter((skill) => skill.path === build.activePath && skill.active), addedContext: build.addedContext,
    analytical: build.analytical, buildRevision: build.buildRevision, processedRevision: build.processedRevision });
}
export function acceptRenderedPreview(snapshot: F2PreviewSnapshot, render: F2RenderedPreview): F2PreviewState { return { snapshot: structuredClone(snapshot), sourceBuildRevision: snapshot.buildRevision, status: "current", render: structuredClone(render) }; }
export function previewStatus(preview: F2PreviewState, build: F2BuildState): F2PreviewState { return preview ? { ...preview, status: preview.sourceBuildRevision === build.buildRevision ? "current" : "stale" } : null; }
