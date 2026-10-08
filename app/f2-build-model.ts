import type { WorkingHypothesis } from "./analysis-model";
import type { CategoryId, F1ToF2NeedContract, F2Path } from "./notepad-model";

// Legacy path/skill, processed-build and Preview contracts remain isolated for
// later migration. The primary F2 workspace uses the shared current-Rozbor
// component contract below for all three paths.
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
export type PozorovatBuildConfig = {
  expansionDepth: 0 | 1 | 2 | 3;
  compareHypotheses: boolean;
  keyIndicators: boolean;
  observationPriorities: boolean;
};
export type VytvoritBuildConfig = {
  expansionDepth: 0 | 1 | 2 | 3;
  candidateApproaches: boolean;
  refineObjective: boolean;
  successConditions: boolean;
  followUpVerification: boolean;
};
export type CurrentRozborBuildConfig = PochopitBuildConfig | PozorovatBuildConfig | VytvoritBuildConfig;
export type RozborComponentKind =
  | "hypothesis-expansion"
  | "hypothesis-comparison"
  | "expert-frame"
  | "observation-comparison"
  | "observation-indicators"
  | "observation-priorities"
  | "creation-approaches"
  | "creation-objective"
  | "success-conditions"
  | "follow-up-verification";
export type RequiredRozborComponent = {
  id: string;
  kind: RozborComponentKind;
  hypothesisId?: string;
  fingerprint: string;
};
export type ObservationIndicatorsContent = {
  purpose: string;
  indicators: Array<{
    indicator: string;
    observableAs: string;
    situation: string;
    supportSignal: string;
    weakeningSignal: string;
    supportsHypothesisIds: string[];
    weakensHypothesisIds: string[];
    doesNotDiscriminateWhen: string;
    limitations: string[];
  }>;
  limitations: string[];
};
export type ObservationComparisonContent = {
  contrasts: Array<{
    conditionA: string;
    conditionB: string;
    whatToObserve: string;
    supportSignal: string;
    weakeningSignal: string;
    supportsHypothesisIds: string[];
    weakensHypothesisIds: string[];
    doesNotDiscriminateWhen: string;
    limitations: string[];
  }>;
  limitations: string[];
};
export type ObservationPrioritiesContent = {
  priorities: Array<{ priority: number; focus: string; reason: string; hypothesisIds: string[] }>;
  limitations: string[];
};
export type CreationApproachesContent = {
  candidateApproaches: Array<{ title: string; description: string; hypothesisIds: string[]; limitations: string[] }>;
  workingApproach: { title: string; rationale: string; hypothesisIds: string[]; limitations: string[] };
};
export type CreationObjectiveContent = { objective: string; hypothesisIds: string[]; limitations: string[] };
export type SuccessConditionsContent = { conditions: Array<{ condition: string; whyRequired: string }>; limitations: string[] };
export type FollowUpVerificationContent = {
  checks: Array<{ indicator: string; when: string; successSignal: string; adjustmentSignal: string; hypothesisIds: string[] }>;
  limitations: string[];
};
export type RozborComponentContent =
  | string
  | ObservationIndicatorsContent
  | ObservationComparisonContent
  | ObservationPrioritiesContent
  | CreationApproachesContent
  | CreationObjectiveContent
  | SuccessConditionsContent
  | FollowUpVerificationContent;
export type RozborComponent = RequiredRozborComponent & {
  content: RozborComponentContent;
};
export type PochopitBuildState = {
  config: PochopitBuildConfig;
  components: RozborComponent[];
};
export type PozorovatBuildState = { config: PozorovatBuildConfig; components: RozborComponent[] };
export type VytvoritBuildState = { config: VytvoritBuildConfig; components: RozborComponent[] };
export type CurrentRozborState = {
  POCHOPIT: PochopitBuildState;
  POZOROVAT: PozorovatBuildState;
  VYTVOŘIT: VytvoritBuildState;
};
export type F2ToF3Snapshot = {
  kind: "f2-to-f3-snapshot";
  snapshotId: string;
  sourceFingerprint: string;
  sourceRevision: string;
  canonicalNeed: F1ToF2NeedContract;
  activePath: F2Path;
  baselineHypotheses: WorkingHypothesis[];
  currentRozbor: {
    config: CurrentRozborBuildConfig;
    components: RozborComponent[];
  };
  uncertainties: string[];
  f3Target: string | null;
};
export type RozborComponentGenerationRequest = {
  activePath: F2Path;
  canonicalNeed: F1ToF2NeedContract;
  hypotheses: WorkingHypothesis[];
  config: CurrentRozborBuildConfig;
  components: RequiredRozborComponent[];
};
export type GeneratedRozborComponent = Pick<RequiredRozborComponent, "id" | "kind" | "hypothesisId"> & { content: RozborComponentContent };
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
export const DEFAULT_POZOROVAT_BUILD_CONFIG: PozorovatBuildConfig = {
  expansionDepth: 0,
  compareHypotheses: false,
  keyIndicators: false,
  observationPriorities: false,
};
export const DEFAULT_VYTVORIT_BUILD_CONFIG: VytvoritBuildConfig = {
  expansionDepth: 0,
  candidateApproaches: false,
  refineObjective: false,
  successConditions: false,
  followUpVerification: false,
};

export function createPochopitBuildState(): PochopitBuildState {
  return { config: { ...DEFAULT_POCHOPIT_BUILD_CONFIG }, components: [] };
}

export function createCurrentRozborState(): CurrentRozborState {
  return {
    POCHOPIT: createPochopitBuildState(),
    POZOROVAT: { config: { ...DEFAULT_POZOROVAT_BUILD_CONFIG }, components: [] },
    VYTVOŘIT: { config: { ...DEFAULT_VYTVORIT_BUILD_CONFIG }, components: [] },
  };
}

export function updateCurrentRozborConfig(
  state: CurrentRozborState,
  path: F2Path,
  change: Partial<PochopitBuildConfig & PozorovatBuildConfig & VytvoritBuildConfig>,
): CurrentRozborState {
  const current = state[path];
  const config = { ...current.config, ...change } as typeof current.config;
  return JSON.stringify(config) === JSON.stringify(current.config)
    ? state
    : { ...state, [path]: { ...current, config } } as CurrentRozborState;
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

export function deriveRequiredCurrentRozborComponents(
  path: F2Path,
  need: F1ToF2NeedContract,
  hypotheses: WorkingHypothesis[],
  config: CurrentRozborBuildConfig,
): RequiredRozborComponent[] {
  if (path === "POCHOPIT") return deriveRequiredRozborComponents(need, hypotheses, config as PochopitBuildConfig);
  const required: RequiredRozborComponent[] = [];
  const expansionDepth = config.expansionDepth;
  if (expansionDepth > 0) {
    for (const hypothesis of hypotheses) {
      required.push({
        id: `hypothesis:${hypothesis.id}:expansion`,
        kind: "hypothesis-expansion",
        hypothesisId: hypothesis.id,
        fingerprint: JSON.stringify([
          path,
          "hypothesis-expansion",
          canonicalNeedSource(need),
          hypothesis.id,
          relevantHypothesisContent(hypothesis),
          expansionDepth,
        ]),
      });
    }
  }
  const baseline = createRozborBaselineFingerprint(need, hypotheses);
  if (path === "POZOROVAT") {
    const observation = config as PozorovatBuildConfig;
    if (observation.compareHypotheses) required.push({ id: "observation-comparison:all", kind: "observation-comparison", fingerprint: JSON.stringify([path, "observation-comparison", baseline, expansionDepth]) });
    if (observation.keyIndicators) required.push({ id: "observation-indicators:all", kind: "observation-indicators", fingerprint: JSON.stringify([path, "observation-indicators", baseline]) });
    if (observation.observationPriorities) required.push({ id: "observation-priorities:all", kind: "observation-priorities", fingerprint: JSON.stringify([path, "observation-priorities", baseline]) });
    return required;
  }
  const creation = config as VytvoritBuildConfig;
  if (creation.candidateApproaches) required.push({ id: "creation-approaches:all", kind: "creation-approaches", fingerprint: JSON.stringify([path, "creation-approaches", baseline]) });
  if (creation.refineObjective) required.push({ id: "creation-objective:all", kind: "creation-objective", fingerprint: JSON.stringify([path, "creation-objective", baseline]) });
  if (creation.successConditions) required.push({ id: "success-conditions:all", kind: "success-conditions", fingerprint: JSON.stringify([path, "success-conditions", baseline]) });
  if (creation.followUpVerification) required.push({ id: "follow-up-verification:all", kind: "follow-up-verification", fingerprint: JSON.stringify([path, "follow-up-verification", baseline]) });
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

export function createRozborGenerationRequest(
  need: F1ToF2NeedContract,
  hypotheses: WorkingHypothesis[],
  config: PochopitBuildConfig,
  existing: RozborComponent[],
): RozborComponentGenerationRequest | null {
  const required = deriveRequiredRozborComponents(need, hypotheses, config);
  const { missing, stale } = reconcileRozborComponents(required, existing);
  const components = [...missing, ...stale.map(({ spec }) => spec)];
  if (components.length === 0) return null;
  return structuredClone({ activePath: "POCHOPIT" as const, canonicalNeed: need, hypotheses, config, components });
}

export function createCurrentRozborGenerationRequest(
  path: F2Path,
  need: F1ToF2NeedContract,
  hypotheses: WorkingHypothesis[],
  config: CurrentRozborBuildConfig,
  existing: RozborComponent[],
): RozborComponentGenerationRequest | null {
  const required = deriveRequiredCurrentRozborComponents(path, need, hypotheses, config);
  const { missing, stale } = reconcileRozborComponents(required, existing);
  const components = [...missing, ...stale.map(({ spec }) => spec)];
  if (components.length === 0) return null;
  return structuredClone({ activePath: path, canonicalNeed: need, hypotheses, config, components });
}

const isComponentRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const isComponentStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0);
const isNonEmptyComponentStringArray = (value: unknown): value is string[] => isComponentStringArray(value) && value.length > 0;
const hasText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

function parseComponentContent(kind: RozborComponentKind, value: unknown): RozborComponentContent {
  if (["hypothesis-expansion", "hypothesis-comparison", "expert-frame"].includes(kind)) {
    if (!hasText(value)) throw new Error("Model vrátil prázdný obsah komponenty Rozboru.");
    return value.trim();
  }
  if (!isComponentRecord(value)) throw new Error("Model vrátil neúplný strukturovaný obsah komponenty Rozboru.");
  if (kind === "observation-indicators") {
    if (!hasText(value.purpose) || !Array.isArray(value.indicators) || value.indicators.length === 0 || !isNonEmptyComponentStringArray(value.limitations)) throw new Error("Model vrátil neúplné pozorovací indikátory.");
    const indicators = value.indicators.map((item) => {
      if (!isComponentRecord(item) || !hasText(item.indicator) || !hasText(item.observableAs) || !hasText(item.situation) || !hasText(item.supportSignal) || !hasText(item.weakeningSignal) || !isComponentStringArray(item.supportsHypothesisIds) || !isComponentStringArray(item.weakensHypothesisIds) || !hasText(item.doesNotDiscriminateWhen) || !isComponentStringArray(item.limitations) || item.supportsHypothesisIds.length + item.weakensHypothesisIds.length === 0) throw new Error("Model vrátil neúplný nebo nediagnostický indikátor.");
      return item as ObservationIndicatorsContent["indicators"][number];
    });
    return { purpose: value.purpose.trim(), indicators, limitations: value.limitations };
  }
  if (kind === "observation-comparison") {
    if (!Array.isArray(value.contrasts) || value.contrasts.length === 0 || !isNonEmptyComponentStringArray(value.limitations)) throw new Error("Model nevrátil úplný kontrast podmínek.");
    const contrasts = value.contrasts.map((item) => {
      if (!isComponentRecord(item) || !hasText(item.conditionA) || !hasText(item.conditionB) || !hasText(item.whatToObserve) || !hasText(item.supportSignal) || !hasText(item.weakeningSignal) || !isComponentStringArray(item.supportsHypothesisIds) || !isComponentStringArray(item.weakensHypothesisIds) || item.supportsHypothesisIds.length + item.weakensHypothesisIds.length === 0 || !hasText(item.doesNotDiscriminateWhen) || !isComponentStringArray(item.limitations)) throw new Error("Model vrátil neúplný kontrast podmínek.");
      return item as ObservationComparisonContent["contrasts"][number];
    });
    return { contrasts, limitations: value.limitations };
  }
  if (kind === "observation-priorities") {
    if (!Array.isArray(value.priorities) || value.priorities.length === 0 || !isNonEmptyComponentStringArray(value.limitations)) throw new Error("Model nevrátil priority pozorování.");
    const priorities = value.priorities.map((item) => {
      if (!isComponentRecord(item) || !Number.isInteger(item.priority) || (item.priority as number) < 1 || !hasText(item.focus) || !hasText(item.reason) || !isComponentStringArray(item.hypothesisIds) || item.hypothesisIds.length === 0) throw new Error("Model vrátil neúplnou prioritu pozorování.");
      return item as ObservationPrioritiesContent["priorities"][number];
    });
    return { priorities, limitations: value.limitations };
  }
  if (kind === "creation-approaches") {
    if (!Array.isArray(value.candidateApproaches) || value.candidateApproaches.length === 0 || !isComponentRecord(value.workingApproach)) throw new Error("Model nevrátil zvolený pracovní přístup.");
    const candidateApproaches = value.candidateApproaches.map((item) => {
      if (!isComponentRecord(item) || !hasText(item.title) || !hasText(item.description) || !isNonEmptyComponentStringArray(item.hypothesisIds) || !isComponentStringArray(item.limitations)) throw new Error("Model vrátil neúplný možný přístup.");
      return item as CreationApproachesContent["candidateApproaches"][number];
    });
    const working = value.workingApproach;
    if (!hasText(working.title) || !hasText(working.rationale) || !isNonEmptyComponentStringArray(working.hypothesisIds) || !isNonEmptyComponentStringArray(working.limitations)) throw new Error("Model nevrátil zvolený pracovní přístup.");
    return { candidateApproaches, workingApproach: working as CreationApproachesContent["workingApproach"] };
  }
  if (kind === "creation-objective") {
    if (!hasText(value.objective) || !isNonEmptyComponentStringArray(value.hypothesisIds) || !isNonEmptyComponentStringArray(value.limitations)) throw new Error("Model nevrátil úplný praktický cíl.");
    return value as CreationObjectiveContent;
  }
  if (kind === "success-conditions") {
    if (!Array.isArray(value.conditions) || value.conditions.length === 0 || !isNonEmptyComponentStringArray(value.limitations)) throw new Error("Model nevrátil podmínky úspěchu.");
    const conditions = value.conditions.map((item) => {
      if (!isComponentRecord(item) || !hasText(item.condition) || !hasText(item.whyRequired)) throw new Error("Model vrátil neúplnou podmínku úspěchu.");
      return item as SuccessConditionsContent["conditions"][number];
    });
    return { conditions, limitations: value.limitations };
  }
  if (!Array.isArray(value.checks) || value.checks.length === 0 || !isNonEmptyComponentStringArray(value.limitations)) throw new Error("Model nevrátil následné ověřování.");
  const checks = value.checks.map((item) => {
    if (!isComponentRecord(item) || !hasText(item.indicator) || !hasText(item.when) || !hasText(item.successSignal) || !hasText(item.adjustmentSignal) || !isComponentStringArray(item.hypothesisIds) || item.hypothesisIds.length === 0) throw new Error("Model vrátil neúplný následný indikátor.");
    return item as FollowUpVerificationContent["checks"][number];
  });
  return { checks, limitations: value.limitations };
}

export function parseGeneratedRozborComponents(value: unknown, requested: RequiredRozborComponent[]): GeneratedRozborComponent[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as { components?: unknown }).components)) throw new Error("Model nevrátil úplnou sadu komponent Rozboru.");
  const requestedById = new Map(requested.map((spec) => [spec.id, spec]));
  const seen = new Set<string>();
  const components = (value as { components: unknown[] }).components.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Model vrátil neplatnou komponentu Rozboru.");
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.id !== "string" || seen.has(candidate.id)) throw new Error("Model vrátil duplicitní nebo neplatné ID komponenty Rozboru.");
    seen.add(candidate.id);
    const spec = requestedById.get(candidate.id);
    if (!spec || candidate.kind !== spec.kind || candidate.hypothesisId !== spec.hypothesisId) throw new Error("Model vrátil nevyžádanou nebo neplatnou komponentu Rozboru.");
    return { id: spec.id, kind: spec.kind, ...(spec.hypothesisId ? { hypothesisId: spec.hypothesisId } : {}), content: parseComponentContent(spec.kind, candidate.content) };
  });
  if (components.length !== requested.length || requested.some((spec) => !seen.has(spec.id))) throw new Error("Model nevrátil úplnou sadu komponent Rozboru.");
  return components;
}

export function applyGeneratedRozborComponents(
  state: PochopitBuildState,
  requested: RequiredRozborComponent[],
  generated: GeneratedRozborComponent[],
): PochopitBuildState {
  const parsed = parseGeneratedRozborComponents({ components: generated }, requested);
  const byId = new Map(parsed.map((item) => [item.id, item]));
  const additions: RozborComponent[] = requested.map((spec) => ({ ...spec, content: byId.get(spec.id)!.content }));
  const ids = new Set(additions.map(({ id }) => id));
  return { ...state, components: [...state.components.filter(({ id }) => !ids.has(id)), ...additions] };
}

/** Applies a complete reconciliation in one state transition. Current
 * components are retained by reference, while stale/missing components are
 * supplied by the validated selective generation response. */
export function applyRozborComponentUpdate(
  state: PochopitBuildState,
  required: RequiredRozborComponent[],
  generated: GeneratedRozborComponent[],
): PochopitBuildState {
  const reconciliation = reconcileRozborComponents(required, state.components);
  const requested = [...reconciliation.missing, ...reconciliation.stale.map(({ spec }) => spec)];
  const parsed = parseGeneratedRozborComponents({ components: generated }, requested);
  const generatedById = new Map(parsed.map((component) => [component.id, component]));
  const keptById = new Map(reconciliation.keep.map((component) => [component.id, component]));
  const components = required.map((spec) => {
    const kept = keptById.get(spec.id);
    if (kept) return kept;
    return { ...spec, content: generatedById.get(spec.id)!.content };
  });
  return { ...state, components };
}

export function applyCurrentRozborComponentUpdate(
  state: CurrentRozborState,
  path: F2Path,
  required: RequiredRozborComponent[],
  generated: GeneratedRozborComponent[],
): CurrentRozborState {
  const current = state[path];
  const next = applyRozborComponentUpdate(current as PochopitBuildState, required, generated);
  return { ...state, [path]: next } as CurrentRozborState;
}

function collectCurrentRozborUncertainties(hypotheses: WorkingHypothesis[], components: RozborComponent[]) {
  const collected = hypotheses.flatMap((hypothesis) => [...hypothesis.limitations, ...hypothesis.unknowns]);
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!isComponentRecord(value)) return;
    if (Array.isArray(value.limitations)) {
      for (const limitation of value.limitations) if (hasText(limitation)) collected.push(limitation.trim());
    }
    for (const [key, item] of Object.entries(value)) if (key !== "limitations") visit(item);
  };
  for (const component of components) visit(component.content);
  return [...new Set(collected.map((item) => item.trim()).filter(Boolean))];
}

function sourceRevision(fingerprint: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < fingerprint.length; index += 1) {
    hash ^= fingerprint.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createF2ToF3SourceFingerprint(
  activePath: F2Path,
  canonicalNeed: F1ToF2NeedContract,
  hypotheses: WorkingHypothesis[],
  config: CurrentRozborBuildConfig,
  components: RozborComponent[],
) {
  return JSON.stringify([
    "current-rozbor-to-f3-v1",
    canonicalF1NeedFingerprint(canonicalNeed),
    activePath,
    createRozborBaselineFingerprint(canonicalNeed, hypotheses),
    config,
    components.map(({ id, kind, hypothesisId, fingerprint, content }) => [id, kind, hypothesisId ?? null, fingerprint, content]),
    canonicalNeed.f3Target,
  ]);
}

function assertF2ToF3Readiness(
  activePath: F2Path,
  canonicalNeed: F1ToF2NeedContract,
  hypotheses: WorkingHypothesis[],
  config: CurrentRozborBuildConfig,
  components: RozborComponent[],
) {
  if (!canonicalNeed.needText.trim() || hypotheses.length === 0) throw new Error("Aktuální Rozbor nemá úplný výchozí obsah pro Výstup.");
  const required = deriveRequiredCurrentRozborComponents(activePath, canonicalNeed, hypotheses, config);
  const reconciliation = reconcileRozborComponents(required, components);
  if (!reconciliation.isRozborCurrent) throw new Error("Rozbor není aktuální vůči svému zdroji nebo nastavení.");
  parseGeneratedRozborComponents({ components }, required);
  if (activePath === "POZOROVAT" && !components.some(({ kind }) => kind.startsWith("observation-"))) {
    throw new Error("Rozbor POZOROVAT zatím neobsahuje pozorovací specifikaci pro Výstup.");
  }
  if (activePath === "VYTVOŘIT") {
    const approaches = components.find(({ kind }) => kind === "creation-approaches")?.content;
    const workingApproach = isComponentRecord(approaches) ? (approaches as Record<string, unknown>).workingApproach : null;
    if (!isComponentRecord(workingApproach) || !hasText(workingApproach.title) || !hasText(workingApproach.rationale)) {
      throw new Error("Rozbor VYTVOŘIT musí před Výstupem obsahovat explicitní pracovní / doporučený přístup.");
    }
  }
}

export function createF2ToF3Snapshot(
  activePath: F2Path,
  canonicalNeed: F1ToF2NeedContract,
  hypotheses: WorkingHypothesis[],
  config: CurrentRozborBuildConfig,
  components: RozborComponent[],
): F2ToF3Snapshot {
  assertF2ToF3Readiness(activePath, canonicalNeed, hypotheses, config, components);
  const sourceFingerprint = createF2ToF3SourceFingerprint(activePath, canonicalNeed, hypotheses, config, components);
  return structuredClone({
    kind: "f2-to-f3-snapshot" as const,
    snapshotId: crypto.randomUUID(),
    sourceFingerprint,
    sourceRevision: sourceRevision(sourceFingerprint),
    canonicalNeed,
    activePath,
    baselineHypotheses: hypotheses,
    currentRozbor: { config, components },
    uncertainties: collectCurrentRozborUncertainties(hypotheses, components),
    f3Target: canonicalNeed.f3Target,
  });
}

export function parseF2ToF3Snapshot(value: unknown): F2ToF3Snapshot {
  if (!isComponentRecord(value) || value.kind !== "f2-to-f3-snapshot" || !hasText(value.snapshotId) || !hasText(value.sourceFingerprint) || !hasText(value.sourceRevision)) throw new Error("Neplatný snapshot aktuálního Rozboru.");
  if (!isComponentRecord(value.canonicalNeed) || !hasText(value.canonicalNeed.needId) || !hasText(value.canonicalNeed.needText) || !["POCHOPIT", "POZOROVAT", "VYTVOŘIT"].includes(String(value.canonicalNeed.initialF2Path)) || !(value.canonicalNeed.f3Target === null || typeof value.canonicalNeed.f3Target === "string")) throw new Error("Snapshot neobsahuje platnou pedagogickou potřebu.");
  if (!["POCHOPIT", "POZOROVAT", "VYTVOŘIT"].includes(String(value.activePath)) || !Array.isArray(value.baselineHypotheses) || !value.baselineHypotheses.every((hypothesis) => isComponentRecord(hypothesis) && hasText(hypothesis.id) && typeof hypothesis.rank === "number" && hasText(hypothesis.title) && hasText(hypothesis.summary) && isComponentStringArray(hypothesis.relevantNeeds) && isComponentStringArray(hypothesis.supportingInformation) && isComponentStringArray(hypothesis.limitations) && isComponentStringArray(hypothesis.unknowns) && Array.isArray(hypothesis.questions))) throw new Error("Snapshot neobsahuje platné výchozí hypotézy.");
  if (!isComponentRecord(value.currentRozbor) || !isComponentRecord(value.currentRozbor.config) || !Array.isArray(value.currentRozbor.components) || !isComponentStringArray(value.uncertainties) || !(value.f3Target === null || typeof value.f3Target === "string")) throw new Error("Snapshot neobsahuje platný aktuální Rozbor.");
  const snapshot = value as F2ToF3Snapshot;
  assertF2ToF3Readiness(snapshot.activePath, snapshot.canonicalNeed, snapshot.baselineHypotheses, snapshot.currentRozbor.config, snapshot.currentRozbor.components);
  const fingerprint = createF2ToF3SourceFingerprint(snapshot.activePath, snapshot.canonicalNeed, snapshot.baselineHypotheses, snapshot.currentRozbor.config, snapshot.currentRozbor.components);
  if (snapshot.sourceFingerprint !== fingerprint || snapshot.sourceRevision !== sourceRevision(fingerprint) || snapshot.f3Target !== snapshot.canonicalNeed.f3Target) throw new Error("Snapshot neodpovídá deklarovanému zdroji Rozboru.");
  return structuredClone(snapshot);
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
