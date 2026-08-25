import type { WorkingHypothesis } from "./analysis-model";
import type { CategoryId, F1ToF2NeedContract, F2Path } from "./notepad-model";

// Legacy F2 path/skill and processed-build contracts remain below for the
// unchanged POZOROVAT, VYTVOŘIT, Preview and API flows. The focused POCHOPIT
// component contract is independent and does not use these abstractions.
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

export type PochopitBuildConfig = {
  expansionDepth: 0 | 1 | 2 | 3;
  compareHypotheses: boolean;
  expertFrame: boolean;
};
export type RozborComponentKind = "hypothesis-expansion" | "hypothesis-comparison" | "expert-frame";
export type RequiredRozborComponent = {
  id: string;
  kind: RozborComponentKind;
  hypothesisId?: string;
  fingerprint: string;
};
export type RozborComponent = RequiredRozborComponent & {
  content: string;
};
export type PochopitBuildState = {
  config: PochopitBuildConfig;
  components: RozborComponent[];
};
export type RozborComponentReconciliation = {
  keep: RozborComponent[];
  remove: RozborComponent[];
  missing: RequiredRozborComponent[];
  stale: Array<{ spec: RequiredRozborComponent; component: RozborComponent }>;
  pendingComponentIds: string[];
  staleComponentIds: string[];
  hasGeneratedRozbor: boolean;
  isRozborCurrent: boolean;
};

export const DEFAULT_POCHOPIT_BUILD_CONFIG: PochopitBuildConfig = {
  expansionDepth: 0,
  compareHypotheses: false,
  expertFrame: false,
};

export function createPochopitBuildState(): PochopitBuildState {
  return { config: { ...DEFAULT_POCHOPIT_BUILD_CONFIG }, components: [] };
}

export function updatePochopitBuildConfig(
  state: PochopitBuildState,
  change: Partial<PochopitBuildConfig>,
): PochopitBuildState {
  const config = { ...state.config, ...change };
  return config.expansionDepth === state.config.expansionDepth &&
    config.compareHypotheses === state.config.compareHypotheses &&
    config.expertFrame === state.config.expertFrame
    ? state
    : { ...state, config };
}

function relevantHypothesisContent(hypothesis: WorkingHypothesis) {
  return [
    hypothesis.title,
    hypothesis.summary,
    hypothesis.relevantNeeds,
    hypothesis.supportingInformation,
    hypothesis.limitations,
    hypothesis.unknowns,
    hypothesis.question ?? null,
    hypothesis.questions ?? [],
  ];
}

function canonicalNeedSource(need: F1ToF2NeedContract) {
  return [need.needId, need.needText];
}

/** Stable fingerprint of the complete baseline source, suitable for consumers
 * whose semantics depend on the whole ordered Rozbor baseline. */
export function createRozborBaselineFingerprint(need: F1ToF2NeedContract, hypotheses: WorkingHypothesis[]) {
  return JSON.stringify([
    canonicalNeedSource(need),
    hypotheses.map((hypothesis) => [hypothesis.id, relevantHypothesisContent(hypothesis)]),
  ]);
}

export function deriveRequiredRozborComponents(
  need: F1ToF2NeedContract,
  hypotheses: WorkingHypothesis[],
  config: PochopitBuildConfig,
): RequiredRozborComponent[] {
  const required: RequiredRozborComponent[] = [];
  if (config.expansionDepth > 0) {
    for (const hypothesis of hypotheses) {
      required.push({
        id: `hypothesis:${hypothesis.id}:expansion`,
        kind: "hypothesis-expansion",
        hypothesisId: hypothesis.id,
        // Local expansions intentionally do not use the whole-baseline
        // fingerprint, so editing a sibling hypothesis cannot invalidate them.
        fingerprint: JSON.stringify([
          "hypothesis-expansion",
          canonicalNeedSource(need),
          hypothesis.id,
          relevantHypothesisContent(hypothesis),
          config.expansionDepth,
        ]),
      });
    }
  }
  if (config.compareHypotheses) {
    required.push({
      id: "comparison:all",
      kind: "hypothesis-comparison",
      fingerprint: JSON.stringify([
        "hypothesis-comparison",
        createRozborBaselineFingerprint(need, hypotheses),
        config.expansionDepth,
        true,
      ]),
    });
  }
  if (config.expertFrame) {
    required.push({
      id: "expert-frame:all",
      kind: "expert-frame",
      // The expert layer reads the baseline, not optional expansion output.
      fingerprint: JSON.stringify([
        "expert-frame",
        createRozborBaselineFingerprint(need, hypotheses),
        true,
      ]),
    });
  }
  return required;
}

export function reconcileRozborComponents(
  required: RequiredRozborComponent[],
  existing: RozborComponent[],
): RozborComponentReconciliation {
  const requiredById = new Map(required.map((spec) => [spec.id, spec]));
  const existingById = new Map(existing.map((component) => [component.id, component]));
  const keep: RozborComponent[] = [];
  const remove = existing.filter((component) => !requiredById.has(component.id));
  const missing: RequiredRozborComponent[] = [];
  const stale: RozborComponentReconciliation["stale"] = [];

  for (const spec of required) {
    const component = existingById.get(spec.id);
    if (!component) missing.push(spec);
    else if (component.kind !== spec.kind || component.hypothesisId !== spec.hypothesisId || component.fingerprint !== spec.fingerprint) {
      stale.push({ spec, component });
    } else keep.push(component);
  }

  const pendingComponentIds = missing.map((spec) => spec.id);
  const staleComponentIds = stale.map(({ spec }) => spec.id);
  return {
    keep,
    remove,
    missing,
    stale,
    pendingComponentIds,
    staleComponentIds,
    hasGeneratedRozbor: existing.length > 0,
    isRozborCurrent: remove.length === 0 && missing.length === 0 && stale.length === 0,
  };
}

export const F2_PATH_META: Record<F2Path, { label: F2Path; description: string }> = {
  POCHOPIT: { label: "POCHOPIT", description: "Jak této situaci odborně rozumět?" },
  POZOROVAT: { label: "POZOROVAT", description: "Co potřebujeme zjistit v realitě?" },
  VYTVOŘIT: { label: "VYTVOŘIT", description: "Jaký praktický obsah / přístup / prostředek má smysl připravit?" },
};
export const F2_PATH_BASE_SEMANTICS: Record<F2Path, string> = {
  POCHOPIT: "Rozviň soudržné odborné porozumění situaci i bez volitelné analytické operace.",
  POZOROVAT: "Odvoď užitečný cílený směr získávání evidence i bez volitelné analytické operace.",
  VYTVOŘIT: "Odvoď zdůvodněnou praktickou specifikaci buildu i bez volitelné analytické operace.",
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
  if (hasSameCanonicalF1Need(build.canonicalNeed, need)) {
    // Entry analysis may finish after the local F2 shell has been initialized.
    // It remains authoritative only until F2 accepts its first model result;
    // afterwards workingHypotheses is the newer shared, F2-owned layer.
    if (Object.keys(build.processedBuilds).length > 0 || JSON.stringify(build.workingHypotheses) === JSON.stringify(hypotheses)) return build;
    return revise(build, { workingHypotheses: structuredClone(hypotheses) });
  }
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
  return structuredClone({ kind: "f2-build", initialPath: build.initialPath, activePath: build.activePath, canonicalNotebookContext, canonicalNeed: build.canonicalNeed, f3Target: build.f3Target, workingHypotheses: build.workingHypotheses, activeSkills, skillParameters: Object.fromEntries(activeSkills.map((skill) => [skill.id, skill.parameterText])), addedContext: build.addedContext, entryUncertainties: build.entryUncertainties, previousProcessedBuildState: build.processedBuilds[build.activePath] ?? null, buildRevision: build.buildRevision, ...(model ? { model } : {}) });
}
export const createPochopitBuildRequest = createF2BuildRequest;
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");
const isHypothesis = (value: unknown): value is WorkingHypothesis => isRecord(value) && typeof value.id === "string" && Number.isInteger(value.rank) && typeof value.title === "string" && typeof value.summary === "string" && isStringArray(value.relevantNeeds) && isStringArray(value.supportingInformation) && isStringArray(value.limitations) && isStringArray(value.unknowns) && (value.question === undefined || value.question === null || typeof value.question === "string") && (value.questions === undefined || isStringArray(value.questions));
const isUncertainty = (value: unknown): value is F2Uncertainty => isRecord(value) && typeof value.description === "string" && typeof value.whyRelevant === "string" && typeof value.limits === "string" && typeof value.relatedDecisionOrArea === "string";
function isPathResult(value: unknown, path: F2Path): value is F2PathResult {
  if (!isRecord(value)) return false;
  if (path === "POCHOPIT") return value.kind === "understanding" && isStringArray(value.relationships) && isStringArray(value.comparisons) && isStringArray(value.expertFrame) && typeof value.synthesis === "string";
  if (path === "POZOROVAT") return value.kind === "observation" && typeof value.purpose === "string" && Array.isArray(value.observableIndicators) && value.observableIndicators.every((item) => isRecord(item) && typeof item.indicator === "string" && typeof item.interpretation === "string") && isStringArray(value.situations) && isStringArray(value.comparisonConditions) && typeof value.scope === "string" && isStringArray(value.evidenceMethod) && isStringArray(value.hypothesisLinks) && isStringArray(value.limitations);
  return value.kind === "creation" && typeof value.pedagogicalObjective === "string" && isStringArray(value.candidateApproaches) && isStringArray(value.variantComparison) && typeof value.workingApproach === "string" && isStringArray(value.conditions) && isStringArray(value.whatToVerify) && isStringArray(value.relevantHypotheses) && isStringArray(value.limitations);
}
export function parseF2BuildResult(value: unknown, path: F2Path): F2BuildResult {
  if (!isRecord(value) || !Array.isArray(value.hypotheses) || !value.hypotheses.every(isHypothesis) || !isPathResult(value.pathResult, path) || !isStringArray(value.decisions) || !Array.isArray(value.uncertainties) || !value.uncertainties.every(isUncertainty) || !isStringArray(value.missingInformation)) throw new Error("Model vrátil neúplný nebo neplatný F2 výsledek.");
  return structuredClone(value) as F2BuildResult;
}
export function parseF2RenderedPreview(value: unknown): F2RenderedPreview {
  if (!isRecord(value) || typeof value.title !== "string" || typeof value.introduction !== "string" || !Array.isArray(value.sections) || !value.sections.every((section) => isRecord(section) && typeof section.heading === "string" && typeof section.content === "string")) throw new Error("Model vrátil neúplný nebo neplatný PREVIEW výsledek.");
  return structuredClone(value) as F2RenderedPreview;
}
export function applyF2BuildResult(build: F2BuildState, result: F2BuildResult, requestedPath: F2Path, requestedRevision: number): F2BuildState {
  result = parseF2BuildResult(result, requestedPath);
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
export function acceptRenderedPreview(snapshot: F2PreviewSnapshot, render: F2RenderedPreview): F2PreviewState { return { snapshot: structuredClone(snapshot), sourceBuildRevision: snapshot.buildRevision, status: "current", render: parseF2RenderedPreview(render) }; }
export function previewStatus(preview: F2PreviewState, build: F2BuildState): F2PreviewState {
  if (!preview) return null;
  const processed = currentF2ProcessedBuild(build);
  const current = hasSameCanonicalF1Need(preview.snapshot.canonicalNeed, build.canonicalNeed) &&
    preview.sourceBuildRevision === build.buildRevision &&
    processed?.processedResultId === preview.snapshot.processedBuild.processedResultId;
  return { ...preview, status: current ? "current" : "stale" };
}
