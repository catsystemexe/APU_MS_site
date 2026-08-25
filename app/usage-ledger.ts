export const USAGE_PRICING_VERSION = "openai-standard-2026-08-25" as const;
export const USAGE_LONG_CONTEXT_THRESHOLD = 272_000;
export const USAGE_FILE_SEARCH_RATE_PER_1000 = 2.5;

export type TelemetryPhase = "F1" | "F2" | "F3";
export type UsageOperation =
  | "extraction"
  | "grounding"
  | "controller"
  | "main_chat"
  | "analysis"
  | "f2_component_generation"
  | "f2_build"
  | "f2_preview"
  | "f3_render";
export type ProviderStatus = "completed" | "incomplete" | "failed" | "transport_error" | "unknown";
export type ApplicationStatus = "accepted" | "rejected_invalid_output" | "failed" | "not_applicable";
export type UsageSource = "provider_reported" | "unavailable";
export type PricingStatus = "priced" | "missing_usage" | "unknown_model" | "unknown_tier" | "invalid_usage";

export type ProviderUsageInput = {
  input_tokens?: unknown;
  input_tokens_details?: {
    cached_tokens?: unknown;
    cache_write_tokens?: unknown;
  };
  output_tokens?: unknown;
  output_tokens_details?: { reasoning_tokens?: unknown };
  total_tokens?: unknown;
};

export type NormalizedUsage = {
  input_tokens: number | null;
  cached_input_tokens: number | null;
  cache_write_tokens: number | null;
  output_tokens: number | null;
  reasoning_tokens: number | null;
  provider_total_tokens: number | null;
  normalized_total_tokens: number | null;
  has_invalid_values: boolean;
};

export type PricingRates = {
  input: number;
  cached_input: number;
  cache_write: number;
  output: number;
};

export type PricingSnapshot = {
  pricing_version: string;
  currency: "USD";
  context_band: "short" | "long" | null;
  service_tier: string | null;
  tier_source: "reported" | "requested" | "unknown";
  rates_per_million: PricingRates | null;
  file_search_rate_per_1000: number | null;
  estimated_cost_usd: number | null;
  status: PricingStatus;
};

export type ModelUsageRecord = {
  call_id: string;
  request_id: string;
  turn_id: string | null;
  phase: TelemetryPhase;
  operation: UsageOperation;
  attempt_index: number;
  retry_of_call_id: string | null;
  fallback_for_call_id: string | null;
  started_at: string;
  completed_at: string | null;
  requested_model: string;
  reported_model: string | null;
  reasoning_effort: "low" | "medium" | null;
  requested_service_tier: string | null;
  reported_service_tier: string | null;
  provider_request_id: string | null;
  provider_response_id: string | null;
  provider_status: ProviderStatus;
  application_status: ApplicationStatus;
  usage_source: UsageSource;
  usage: NormalizedUsage;
  file_search_calls: number;
  pricing_snapshot: PricingSnapshot;
  error: { category: string; code: string | null } | null;
};

export type UsageLedgerSummary = {
  call_count: number;
  completed_call_count: number;
  incomplete_call_count: number;
  failed_call_count: number;
  uncertain_charge_call_count: number;
  input_tokens: number;
  cached_input_tokens: number;
  cache_write_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  provider_total_tokens: number;
  normalized_total_tokens: number;
  known_cost_subtotal_usd: number;
  priced_call_count: number;
  unpriced_call_count: number;
  complete_estimated_cost_usd: number | null;
};

type PricingBands = { short: PricingRates; long: PricingRates };

// OpenAI API standard pricing, USD per 1M tokens, verified 2026-08-25.
// This table is intentionally independent from the legacy per-message estimator.
export const USAGE_PRICING_CATALOG = {
  "gpt-5.6-sol": {
    short: { input: 4, cached_input: 0.4, cache_write: 5, output: 20 },
    long: { input: 8, cached_input: 0.8, cache_write: 10, output: 30 },
  },
  "gpt-5.6-terra": {
    short: { input: 2, cached_input: 0.2, cache_write: 2.5, output: 12 },
    long: { input: 4, cached_input: 0.4, cache_write: 5, output: 18 },
  },
  "gpt-5.6-luna": {
    short: { input: 0.2, cached_input: 0.02, cache_write: 0.25, output: 1.2 },
    long: { input: 0.4, cached_input: 0.04, cache_write: 0.5, output: 1.8 },
  },
} as const satisfies Record<string, PricingBands>;

function isTokenCount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function normalizedToken(value: unknown): { value: number | null; invalid: boolean } {
  if (value === undefined || value === null) return { value: null, invalid: false };
  return isTokenCount(value) ? { value, invalid: false } : { value: null, invalid: true };
}

function hasUsageValue(input: ProviderUsageInput | undefined) {
  return input !== undefined && [
    input.input_tokens,
    input.input_tokens_details?.cached_tokens,
    input.input_tokens_details?.cache_write_tokens,
    input.output_tokens,
    input.output_tokens_details?.reasoning_tokens,
    input.total_tokens,
  ].some((value) => value !== undefined && value !== null);
}

function baseModelName(model: string | null) {
  if (!model) return null;
  return Object.keys(USAGE_PRICING_CATALOG).find((name) => model === name || model.startsWith(`${name}-`)) ?? null;
}

function pricingTier(input: { requested_service_tier: string | null; reported_service_tier: string | null }) {
  if (input.reported_service_tier) return { service_tier: input.reported_service_tier, tier_source: "reported" as const };
  if (input.requested_service_tier === "default") return { service_tier: "default", tier_source: "requested" as const };
  return { service_tier: null, tier_source: "unknown" as const };
}

function validFileSearchCalls(value: unknown) {
  return isTokenCount(value) ? value : 0;
}

export function normalizeProviderUsage(input?: ProviderUsageInput): NormalizedUsage {
  const values = [
    normalizedToken(input?.input_tokens),
    normalizedToken(input?.input_tokens_details?.cached_tokens),
    normalizedToken(input?.input_tokens_details?.cache_write_tokens),
    normalizedToken(input?.output_tokens),
    normalizedToken(input?.output_tokens_details?.reasoning_tokens),
    normalizedToken(input?.total_tokens),
  ];
  const [inputTokens, cachedInputTokens, cacheWriteTokens, outputTokens, reasoningTokens, providerTotalTokens] = values;
  return {
    input_tokens: inputTokens.value,
    cached_input_tokens: cachedInputTokens.value,
    cache_write_tokens: cacheWriteTokens.value,
    output_tokens: outputTokens.value,
    reasoning_tokens: reasoningTokens.value,
    provider_total_tokens: providerTotalTokens.value,
    normalized_total_tokens: inputTokens.value === null || outputTokens.value === null ? null : inputTokens.value + outputTokens.value,
    has_invalid_values: values.some((value) => value.invalid),
  };
}

export function priceUsageRecord(input: {
  requested_model: string;
  reported_model: string | null;
  requested_service_tier: string | null;
  reported_service_tier: string | null;
  usage: NormalizedUsage;
  file_search_calls: number;
}): PricingSnapshot {
  const tier = pricingTier(input);
  const model = baseModelName(input.reported_model ?? input.requested_model);
  const base = {
    pricing_version: USAGE_PRICING_VERSION,
    currency: "USD" as const,
    service_tier: tier.service_tier,
    tier_source: tier.tier_source,
  };
  const usage = input.usage;
  const inputTokens = usage.input_tokens;
  const outputTokens = usage.output_tokens;
  const cachedInputTokens = usage.cached_input_tokens ?? 0;
  const cacheWriteTokens = usage.cache_write_tokens ?? 0;

  if (usage.has_invalid_values || !isTokenCount(input.file_search_calls) ||
      (inputTokens !== null && cachedInputTokens + cacheWriteTokens > inputTokens)) {
    return { ...base, context_band: null, rates_per_million: null, file_search_rate_per_1000: null, estimated_cost_usd: null, status: "invalid_usage" };
  }
  if (inputTokens === null || outputTokens === null) {
    return { ...base, context_band: null, rates_per_million: null, file_search_rate_per_1000: null, estimated_cost_usd: null, status: "missing_usage" };
  }
  if (!model) {
    return { ...base, context_band: null, rates_per_million: null, file_search_rate_per_1000: null, estimated_cost_usd: null, status: "unknown_model" };
  }
  if (tier.service_tier !== "default") {
    return { ...base, context_band: null, rates_per_million: null, file_search_rate_per_1000: null, estimated_cost_usd: null, status: "unknown_tier" };
  }

  const context_band = inputTokens > USAGE_LONG_CONTEXT_THRESHOLD ? "long" : "short";
  const rates = USAGE_PRICING_CATALOG[model as keyof typeof USAGE_PRICING_CATALOG][context_band];
  const regularInputTokens = inputTokens - cachedInputTokens - cacheWriteTokens;
  const estimatedCostUsd = (
    regularInputTokens * rates.input
    + cachedInputTokens * rates.cached_input
    + cacheWriteTokens * rates.cache_write
    + outputTokens * rates.output
  ) / 1_000_000 + input.file_search_calls * USAGE_FILE_SEARCH_RATE_PER_1000 / 1_000;

  return {
    ...base,
    context_band,
    rates_per_million: { ...rates },
    file_search_rate_per_1000: USAGE_FILE_SEARCH_RATE_PER_1000,
    estimated_cost_usd: estimatedCostUsd,
    status: "priced",
  };
}

export function createModelUsageRecord(input: Omit<ModelUsageRecord, "usage_source" | "usage" | "file_search_calls" | "pricing_snapshot"> & {
  provider_usage?: ProviderUsageInput;
  file_search_calls?: number;
}): ModelUsageRecord {
  const { provider_usage: providerUsage, file_search_calls: fileSearchCallsInput, ...record } = input;
  const usage = normalizeProviderUsage(providerUsage);
  const fileSearchCalls = validFileSearchCalls(fileSearchCallsInput);
  return {
    ...record,
    usage_source: hasUsageValue(providerUsage) ? "provider_reported" : "unavailable",
    usage,
    file_search_calls: fileSearchCalls,
    pricing_snapshot: priceUsageRecord({ ...record, usage, file_search_calls: fileSearchCalls }),
  };
}

export function finalizeModelUsageRecord(current: ModelUsageRecord, patch: Omit<Partial<ModelUsageRecord>, "call_id" | "request_id" | "turn_id" | "phase" | "operation" | "attempt_index" | "retry_of_call_id" | "fallback_for_call_id" | "started_at" | "usage" | "usage_source" | "pricing_snapshot" | "file_search_calls"> & {
  provider_usage?: ProviderUsageInput;
  file_search_calls?: number;
}): ModelUsageRecord {
  const { provider_usage: providerUsage, file_search_calls: fileSearchCallsInput, ...recordPatch } = patch;
  const usage = providerUsage === undefined ? current.usage : normalizeProviderUsage(providerUsage);
  const fileSearchCalls = fileSearchCallsInput === undefined ? current.file_search_calls : validFileSearchCalls(fileSearchCallsInput);
  const next = {
    ...current,
    ...recordPatch,
    usage_source: providerUsage === undefined ? current.usage_source : hasUsageValue(providerUsage) ? "provider_reported" as const : "unavailable" as const,
    usage,
    file_search_calls: fileSearchCalls,
  };
  return {
    ...next,
    pricing_snapshot: priceUsageRecord(next),
  };
}

const immutableIdentityKeys = [
  "call_id", "request_id", "turn_id", "phase", "operation", "attempt_index",
  "retry_of_call_id", "fallback_for_call_id", "started_at", "requested_model",
] as const satisfies Array<keyof ModelUsageRecord>;

export function upsertUsageRecord(records: ModelUsageRecord[], incoming: ModelUsageRecord): ModelUsageRecord[] {
  const existing = records.find((record) => record.call_id === incoming.call_id);
  if (!existing) return [...records, incoming];
  for (const key of immutableIdentityKeys) {
    if (existing[key] !== incoming[key]) throw new Error(`Conflicting immutable usage identity for call_id ${incoming.call_id}: ${key}`);
  }
  return records.map((record) => record.call_id === incoming.call_id ? incoming : record);
}

export function summarizeUsageRecords(records: ModelUsageRecord[]): UsageLedgerSummary {
  const unique = new Map<string, ModelUsageRecord>();
  for (const record of records) {
    const existing = unique.get(record.call_id);
    if (existing) {
      for (const key of immutableIdentityKeys) {
        if (existing[key] !== record[key]) throw new Error(`Conflicting immutable usage identity for call_id ${record.call_id}: ${key}`);
      }
    }
    unique.set(record.call_id, record);
  }
  const values = [...unique.values()];
  const sum = (pick: (record: ModelUsageRecord) => number | null) => values.reduce((total, record) => total + (pick(record) ?? 0), 0);
  const priced = values.filter((record) => record.pricing_snapshot.status === "priced");
  const unpriced = values.filter((record) => record.pricing_snapshot.status !== "priced");
  const uncertain = values.filter((record) => record.provider_status === "transport_error");

  return {
    call_count: values.length,
    completed_call_count: values.filter((record) => record.provider_status === "completed").length,
    incomplete_call_count: values.filter((record) => record.provider_status === "incomplete").length,
    failed_call_count: values.filter((record) => record.provider_status === "failed" || record.provider_status === "transport_error").length,
    uncertain_charge_call_count: uncertain.length,
    input_tokens: sum((record) => record.usage.input_tokens),
    cached_input_tokens: sum((record) => record.usage.cached_input_tokens),
    cache_write_tokens: sum((record) => record.usage.cache_write_tokens),
    output_tokens: sum((record) => record.usage.output_tokens),
    reasoning_tokens: sum((record) => record.usage.reasoning_tokens),
    provider_total_tokens: sum((record) => record.usage.provider_total_tokens),
    normalized_total_tokens: sum((record) => record.usage.normalized_total_tokens),
    known_cost_subtotal_usd: priced.reduce((total, record) => total + (record.pricing_snapshot.estimated_cost_usd ?? 0), 0),
    priced_call_count: priced.length,
    unpriced_call_count: unpriced.length,
    complete_estimated_cost_usd: unpriced.length || uncertain.length
      ? null
      : priced.reduce((total, record) => total + (record.pricing_snapshot.estimated_cost_usd ?? 0), 0),
  };
}
