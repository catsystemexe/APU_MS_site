import { normalizeProviderUsage, priceUsageRecord } from "./usage-ledger.ts";

export type ModelDefinition = {
  id: string;
  label: string;
  description: string;
  reasoningEffort: "low" | "medium";
};

// Routing and UI metadata only. Runtime pricing is owned by usage-ledger.ts.
export const MODEL_CATALOG = {
  "gpt-5.6-sol": {
    id: "gpt-5.6-sol",
    label: "GPT-5.6 Sol",
    description: "Vyšší kvalita · dražší",
    reasoningEffort: "medium",
  },
  "gpt-5.6-terra": {
    id: "gpt-5.6-terra",
    label: "GPT-5.6 Terra",
    description: "Vyvážený poměr kvality a ceny",
    reasoningEffort: "low",
  },
  "gpt-5.6-luna": {
    id: "gpt-5.6-luna",
    label: "GPT-5.6 Luna",
    description: "Rychlejší · nejlevnější",
    reasoningEffort: "low",
  },
} as const satisfies Record<string, ModelDefinition>;

export type SupportedModelId = keyof typeof MODEL_CATALOG;

export const DEFAULT_MODEL_ID: SupportedModelId = "gpt-5.6-terra";

export function isSupportedModel(value: unknown): value is SupportedModelId {
  return typeof value === "string" && value in MODEL_CATALOG;
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
  // Compatibility adapter for legacy/shadow diagnostics. It intentionally owns
  // no rates: the canonical call-level pricing implementation produces the value.
  return priceUsageRecord({
    requested_model: input.model,
    reported_model: input.model,
    requested_service_tier: "default",
    reported_service_tier: "default",
    usage: normalizeProviderUsage({
      input_tokens: input.inputTokens,
      input_tokens_details: {
        cached_tokens: input.cachedInputTokens,
        cache_write_tokens: input.cacheWriteTokens,
      },
      output_tokens: input.outputTokens,
    }),
    file_search_calls: input.fileSearchCalls ?? 0,
  }).estimated_cost_usd;
}

export function publicModelCatalog() {
  return (Object.values(MODEL_CATALOG) as ModelDefinition[]).map(({ id, label, description }) => ({
    id,
    label,
    description,
  }));
}
