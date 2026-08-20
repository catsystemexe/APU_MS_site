export type ModelPricing = {
  input: number;
  cachedInput: number;
  cacheWrite: number;
  output: number;
};

export type ModelDefinition = {
  id: string;
  label: string;
  description: string;
  reasoningEffort: "low" | "medium";
  standard: ModelPricing;
  longContext: ModelPricing;
};

// OpenAI API standard pricing, USD per 1M tokens, verified 2026-08-10.
// The chat route explicitly requests service_tier="default" so these rates apply.
// Requests above 272k input tokens use the long-context rates for the full request.
export const MODEL_CATALOG = {
  "gpt-5.6-sol": {
    id: "gpt-5.6-sol",
    label: "GPT-5.6 Sol",
    description: "Vyšší kvalita · dražší",
    reasoningEffort: "medium",
    standard: { input: 5, cachedInput: 0.5, cacheWrite: 6.25, output: 30 },
    longContext: { input: 10, cachedInput: 1, cacheWrite: 12.5, output: 45 },
  },
  "gpt-5.6-terra": {
    id: "gpt-5.6-terra",
    label: "GPT-5.6 Terra",
    description: "Vyvážený poměr kvality a ceny",
    reasoningEffort: "low",
    standard: { input: 2, cachedInput: 0.2, cacheWrite: 2.5, output: 12 },
    longContext: { input: 4, cachedInput: 0.4, cacheWrite: 5, output: 18 },
  },
  "gpt-5.6-luna": {
    id: "gpt-5.6-luna",
    label: "GPT-5.6 Luna",
    description: "Rychlejší · nejlevnější",
    reasoningEffort: "low",
    standard: { input: 0.2, cachedInput: 0.02, cacheWrite: 0.25, output: 1.2 },
    longContext: { input: 0.4, cachedInput: 0.04, cacheWrite: 0.5, output: 1.8 },
  },
} as const satisfies Record<string, ModelDefinition>;

export type SupportedModelId = keyof typeof MODEL_CATALOG;

export const DEFAULT_MODEL_ID: SupportedModelId = "gpt-5.6-terra";
export const LONG_CONTEXT_THRESHOLD = 272_000;
export const FILE_SEARCH_CALL_USD = 2.5 / 1_000;

export function isSupportedModel(value: unknown): value is SupportedModelId {
  return typeof value === "string" && value in MODEL_CATALOG;
}

export function baseModelName(model: string): SupportedModelId | undefined {
  return (Object.keys(MODEL_CATALOG) as SupportedModelId[]).find(
    (name) => model === name || model.startsWith(`${name}-`),
  );
}

export type CostInput = {
  model: string;
  inputTokens: number;
  cachedInputTokens?: number;
  cacheWriteTokens?: number;
  outputTokens: number;
  fileSearchCalls?: number;
};

export function estimateCostUsd(input: CostInput): number | null {
  const pricingName = baseModelName(input.model);
  if (!pricingName) return null;

  const definition = MODEL_CATALOG[pricingName];
  const pricing = input.inputTokens > LONG_CONTEXT_THRESHOLD
    ? definition.longContext
    : definition.standard;
  const cachedInputTokens = input.cachedInputTokens ?? 0;
  const cacheWriteTokens = input.cacheWriteTokens ?? 0;
  const regularInputTokens = Math.max(0, input.inputTokens - cachedInputTokens - cacheWriteTokens);

  return (
    regularInputTokens * pricing.input
    + cachedInputTokens * pricing.cachedInput
    + cacheWriteTokens * pricing.cacheWrite
    + input.outputTokens * pricing.output
  ) / 1_000_000 + (input.fileSearchCalls ?? 0) * FILE_SEARCH_CALL_USD;
}

export function publicModelCatalog() {
  return (Object.values(MODEL_CATALOG) as ModelDefinition[]).map(({ id, label, description }) => ({
    id,
    label,
    description,
  }));
}
