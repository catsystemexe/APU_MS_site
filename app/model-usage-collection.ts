import { upsertUsageRecord, type ModelUsageRecord } from "./usage-ledger.ts";

export const MODEL_USAGE_RECORDS_FIELD = "model_usage_records" as const;

export type ModelUsageRecordsResponse = {
  model_usage_records?: unknown;
};

const phases = new Set(["F1", "F2", "F3"]);
const operations = new Set([
  "extraction", "grounding", "controller", "main_chat", "analysis",
  "f2_component_generation", "f2_build", "f2_preview", "f3_render",
]);
const providerStatuses = new Set(["completed", "incomplete", "failed", "transport_error", "unknown"]);
const applicationStatuses = new Set(["accepted", "rejected_invalid_output", "failed", "not_applicable"]);
const pricingStatuses = new Set(["priced", "missing_usage", "unknown_model", "unknown_tier", "invalid_usage"]);

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function string(value: unknown): value is string {
  return typeof value === "string";
}

function nullableString(value: unknown) {
  return value === null || string(value);
}

function token(value: unknown) {
  return value === null || (typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0);
}

function money(value: unknown) {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

function isUsage(value: unknown) {
  return object(value)
    && token(value.input_tokens)
    && token(value.cached_input_tokens)
    && token(value.cache_write_tokens)
    && token(value.output_tokens)
    && token(value.reasoning_tokens)
    && token(value.provider_total_tokens)
    && token(value.normalized_total_tokens)
    && typeof value.has_invalid_values === "boolean";
}

function isPricing(value: unknown) {
  if (!object(value) || !string(value.pricing_version) || value.currency !== "USD"
    || !(value.context_band === "short" || value.context_band === "long" || value.context_band === null)
    || !nullableString(value.service_tier)
    || !(value.tier_source === "reported" || value.tier_source === "requested" || value.tier_source === "unknown")
    || !money(value.file_search_rate_per_1000)
    || !money(value.estimated_cost_usd)
    || !pricingStatuses.has(value.status as string)) return false;
  if (value.rates_per_million === null) return true;
  return object(value.rates_per_million)
    && money(value.rates_per_million.input)
    && money(value.rates_per_million.cached_input)
    && money(value.rates_per_million.cache_write)
    && money(value.rates_per_million.output);
}

export function isModelUsageRecord(value: unknown): value is ModelUsageRecord {
  if (!object(value)) return false;
  return string(value.call_id) && value.call_id.length > 0
    && string(value.request_id) && value.request_id.length > 0
    && nullableString(value.turn_id)
    && phases.has(value.phase as string)
    && operations.has(value.operation as string)
    && token(value.attempt_index)
    && nullableString(value.retry_of_call_id)
    && nullableString(value.fallback_for_call_id)
    && string(value.started_at)
    && nullableString(value.completed_at)
    && string(value.requested_model)
    && nullableString(value.reported_model)
    && (value.reasoning_effort === "low" || value.reasoning_effort === "medium" || value.reasoning_effort === null)
    && nullableString(value.requested_service_tier)
    && nullableString(value.reported_service_tier)
    && nullableString(value.provider_request_id)
    && nullableString(value.provider_response_id)
    && providerStatuses.has(value.provider_status as string)
    && applicationStatuses.has(value.application_status as string)
    && (value.usage_source === "provider_reported" || value.usage_source === "unavailable")
    && isUsage(value.usage)
    && token(value.file_search_calls)
    && isPricing(value.pricing_snapshot)
    && (value.error === null || (object(value.error) && string(value.error.category) && nullableString(value.error.code)));
}

export function readModelUsageRecords(response: unknown): ModelUsageRecord[] {
  if (!object(response) || !Array.isArray(response[MODEL_USAGE_RECORDS_FIELD])) return [];
  return response[MODEL_USAGE_RECORDS_FIELD].filter(isModelUsageRecord);
}

export function appendModelUsageRecords(current: ModelUsageRecord[], incoming: ModelUsageRecord[]): ModelUsageRecord[] {
  let next = current;
  for (const record of incoming) {
    try {
      next = upsertUsageRecord(next, record);
    } catch {
      // A conflicting immutable identity is malformed at this client boundary.
      // Retain the first accepted record and keep the application functional.
    }
  }
  return next;
}
