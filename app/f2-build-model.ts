import type { WorkingHypothesis } from "./analysis-model";
import type { F1ToF2NeedContract, F2Path } from "./notepad-model";

export type F2Skill = { id: string; path: F2Path; label: string; active: boolean; parameterText: string };
export type F2ContextItem = { id: string; text: string };
export type F2BuildState = {
  canonicalNeed: F1ToF2NeedContract;
  initialPath: F2Path;
  activePath: F2Path;
  f3Target: string | null;
  skills: F2Skill[];
  addedContext: F2ContextItem[];
  decisions: string[];
  uncertainties: string[];
  buildRevision: number;
};
export type F2PreviewSnapshot = {
  canonicalNeed: F1ToF2NeedContract;
  initialPath: F2Path;
  activePath: F2Path;
  f3Target: string | null;
  hypotheses: WorkingHypothesis[];
  activeSkills: F2Skill[];
  addedContext: F2ContextItem[];
  decisions: string[];
  uncertainties: string[];
  buildRevision: number;
};
export type F2PreviewState = { snapshot: F2PreviewSnapshot; sourceBuildRevision: number; status: "current" | "stale" } | null;

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

export const F2_SKILL_DEFINITIONS = Object.entries(SKILL_LABELS).flatMap(([path, labels]) =>
  labels.map((label, index) => ({ id: `${path.toLowerCase()}-${index + 1}`, path: path as F2Path, label })),
);

export function createF2BuildState(need: F1ToF2NeedContract, uncertainties: string[] = []): F2BuildState {
  return {
    canonicalNeed: structuredClone(need), initialPath: need.initialF2Path, activePath: need.initialF2Path,
    f3Target: need.f3Target, skills: F2_SKILL_DEFINITIONS.map((skill) => ({ ...skill, active: false, parameterText: "" })),
    addedContext: [], decisions: [], uncertainties: [...uncertainties], buildRevision: 0,
  };
}

function revise(state: F2BuildState, change: Partial<F2BuildState>) { return { ...state, ...change, buildRevision: state.buildRevision + 1 }; }
export function switchF2Path(state: F2BuildState, activePath: F2Path) { return activePath === state.activePath ? state : revise(state, { activePath }); }
export function toggleF2Skill(state: F2BuildState, id: string) {
  return revise(state, { skills: state.skills.map((skill) => skill.id === id ? { ...skill, active: !skill.active } : skill) });
}
export function parameterizeF2Skill(state: F2BuildState, id: string, parameterText: string) {
  const skill = state.skills.find((item) => item.id === id);
  return !skill || skill.parameterText === parameterText ? state : revise(state, { skills: state.skills.map((item) => item.id === id ? { ...item, parameterText } : item) });
}
export function addF2Context(state: F2BuildState, item: F2ContextItem) { return revise(state, { addedContext: [...state.addedContext, item] }); }
export function removeF2Context(state: F2BuildState, id: string) { return revise(state, { addedContext: state.addedContext.filter((item) => item.id !== id) }); }
export function createF2Preview(build: F2BuildState, hypotheses: WorkingHypothesis[]): F2PreviewState {
  const snapshot: F2PreviewSnapshot = structuredClone({
    canonicalNeed: build.canonicalNeed, initialPath: build.initialPath, activePath: build.activePath, f3Target: build.f3Target,
    hypotheses, activeSkills: build.skills.filter((skill) => skill.active), addedContext: build.addedContext,
    decisions: build.decisions, uncertainties: build.uncertainties, buildRevision: build.buildRevision,
  });
  return { snapshot, sourceBuildRevision: build.buildRevision, status: "current" };
}
export function previewStatus(preview: F2PreviewState, build: F2BuildState): F2PreviewState {
  return preview ? { ...preview, status: preview.sourceBuildRevision === build.buildRevision ? "current" : "stale" } : null;
}
