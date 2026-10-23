import { getRequestExecutionContext } from "vinext/shims/request-context";
import { USAGE_PRICING_VERSION, type ModelUsageRecord } from "../usage-ledger.ts";
import type { ModelCallSink } from "../model-call-instrumentation.ts";
import type { AccessIdentity } from "../access-auth.ts";
import { canonical, check, integer, oneOf, operations, uuid, type Health } from "./contract.ts";
import { eligibleParticipant, readiness, resolveContext } from "./server.ts";
import { ownerOf, type Owner, type TelemetryStore } from "./store.ts";
import { telemetryResources, type TelemetryResources } from "./runtime.ts";
export type AiScope = { request_id?: string; owner: Owner; workflow_id: string | null; operation_instance_id: string | null };
export type AiProjection = {
  schema_version: 1; measurement_version: "pilot-v1"; source: "server"; event_name: "ai_call_started" | "ai_call_finalized"; state: "pending" | "final";
  call_id: string; request_id: string; workflow_id: string | null; operation_instance_id: string | null;
  phase: ModelUsageRecord["phase"]; operation: ModelUsageRecord["operation"]; attempt_index: number;
  retry_of_call_id: string | null; fallback_for_call_id: string | null; started_at: number; completed_at: number | null;
  requested_model: string; reported_model: string | null; reasoning_effort: ModelUsageRecord["reasoning_effort"];
  requested_service_tier: string | null; reported_service_tier: string | null;
  provider_status: ModelUsageRecord["provider_status"]; application_status: ModelUsageRecord["application_status"];
  usage_source: ModelUsageRecord["usage_source"]; usage: ModelUsageRecord["usage"];
  file_search_calls: number; pricing_snapshot: ModelUsageRecord["pricing_snapshot"];
  pricing_regime: "standard-30m-estimate"; usage_coverage: "observed" | "incomplete";
  cost_nano_usd: number | null; error_class: "transport" | "provider" | "incomplete" | "invalid_output" | "unknown" | null;
};
export type AiCall = { owner: Owner; identity: Record<string, unknown>; projection: AiProjection };
const nullableUuid = (v: unknown) => v === null || uuid(v);
const model = (v: string) => /^gpt-5\.6-(sol|terra|luna)(-\d{4}-\d{2}-\d{2})?$/.test(v) ? v : "unknown";
const tier = (v: string | null) => v === null ? null : oneOf(v, ["default", "auto", "flex", "priority", "scale"]) ? v : "unknown";
const numberOrNull = (v: number | null) => v === null || (Number.isFinite(v) && v >= 0);
export function projectModelUsage(record: ModelUsageRecord, scope: AiScope): AiCall {
  check(uuid(record.call_id) && uuid(record.request_id) && nullableUuid(record.retry_of_call_id) && nullableUuid(record.fallback_for_call_id) &&
    nullableUuid(scope.workflow_id) && nullableUuid(scope.operation_instance_id) && integer(record.attempt_index) &&
    oneOf(record.phase, ["F1", "F2", "F3"]) && oneOf(record.operation, operations) && record.operation !== ("f2_local_reconciliation" as string));
  const started = Date.parse(record.started_at), completed = record.completed_at === null ? null : Date.parse(record.completed_at);
  check(integer(started) && (completed === null || (integer(completed) && completed >= started)));
  check(oneOf(record.provider_status, ["completed", "incomplete", "failed", "transport_error", "unknown"]) &&
    oneOf(record.application_status, ["accepted", "rejected_invalid_output", "failed", "not_applicable"]) &&
    oneOf(record.usage_source, ["provider_reported", "unavailable"]) && oneOf(record.reasoning_effort, ["low", "medium", null]));
  const u = record.usage;
  const usage = { input_tokens: u.input_tokens, cached_input_tokens: u.cached_input_tokens, cache_write_tokens: u.cache_write_tokens,
    output_tokens: u.output_tokens, reasoning_tokens: u.reasoning_tokens, provider_total_tokens: u.provider_total_tokens,
    normalized_total_tokens: u.normalized_total_tokens, has_invalid_values: u.has_invalid_values };
  check(Object.values(usage).every(v => typeof v === "boolean" || v === null || integer(v)) && typeof usage.has_invalid_values === "boolean");
  const invalidSubsets = (u.input_tokens !== null && (u.cached_input_tokens ?? 0) + (u.cache_write_tokens ?? 0) > u.input_tokens) ||
    (u.output_tokens !== null && (u.reasoning_tokens ?? 0) > u.output_tokens);
  usage.has_invalid_values ||= invalidSubsets;
  const p = record.pricing_snapshot;
  check(p.pricing_version === USAGE_PRICING_VERSION && p.currency === "USD" && oneOf(p.context_band, ["short", "long", null]) &&
    oneOf(p.tier_source, ["reported", "requested", "unknown"]) && oneOf(p.status, ["priced", "missing_usage", "unknown_model", "unknown_tier", "invalid_usage"]) &&
    numberOrNull(p.estimated_cost_usd) && numberOrNull(p.file_search_rate_per_1000) && integer(record.file_search_calls));
  const rates = p.rates_per_million;
  if (rates) check([rates.input, rates.cached_input, rates.cache_write, rates.output].every(v => v !== null && numberOrNull(v)));
  const pricing = { pricing_version: USAGE_PRICING_VERSION, currency: "USD" as const, context_band: p.context_band,
    service_tier: tier(p.service_tier), tier_source: p.tier_source, rates_per_million: rates ? {
      input: rates.input, cached_input: rates.cached_input, cache_write: rates.cache_write, output: rates.output } : null,
    file_search_rate_per_1000: p.file_search_rate_per_1000, estimated_cost_usd: p.estimated_cost_usd, status: p.status };
  const complete = completed !== null && !usage.has_invalid_values && record.usage_source === "provider_reported" &&
    record.provider_status !== "transport_error" && model(record.requested_model) !== "unknown" &&
    (record.reported_model === null || model(record.reported_model) !== "unknown") && p.status === "priced" && p.estimated_cost_usd !== null;
  const cost = complete ? Math.round(p.estimated_cost_usd! * 1e9) : null;
  check(cost === null || integer(cost));
  const projection: AiProjection = { schema_version: 1, measurement_version: "pilot-v1", source: "server", event_name: completed === null ? "ai_call_started" : "ai_call_finalized", state: completed === null ? "pending" : "final",
    call_id: record.call_id, request_id: record.request_id, workflow_id: scope.workflow_id, operation_instance_id: scope.operation_instance_id,
    phase: record.phase, operation: record.operation, attempt_index: record.attempt_index,
    retry_of_call_id: record.retry_of_call_id, fallback_for_call_id: record.fallback_for_call_id, started_at: started, completed_at: completed,
    requested_model: model(record.requested_model), reported_model: record.reported_model === null ? null : model(record.reported_model),
    reasoning_effort: record.reasoning_effort, requested_service_tier: tier(record.requested_service_tier), reported_service_tier: tier(record.reported_service_tier),
    provider_status: record.provider_status, application_status: record.application_status, usage_source: record.usage_source,
    usage, file_search_calls: record.file_search_calls, pricing_snapshot: pricing, pricing_regime: "standard-30m-estimate",
    usage_coverage: complete ? "observed" : "incomplete", cost_nano_usd: cost,
    error_class: !record.error ? null : record.provider_status === "transport_error" ? "transport" : record.provider_status === "incomplete" ? "incomplete" :
      record.application_status === "rejected_invalid_output" ? "invalid_output" : record.provider_status === "failed" ? "provider" : "unknown" };
  const identity = { owner: { ...scope.owner }, workflow_id: scope.workflow_id, operation_instance_id: scope.operation_instance_id,
    call_id: record.call_id, request_id: record.request_id, phase: record.phase, operation: record.operation, started_at: started,
    requested_model: projection.requested_model, reasoning_effort: projection.reasoning_effort, requested_service_tier: projection.requested_service_tier,
    attempt_index: record.attempt_index, retry_of_call_id: record.retry_of_call_id, fallback_for_call_id: record.fallback_for_call_id };
  return { owner: { ...scope.owner }, identity, projection };
}
export type SafeRequestSink = { sink: ModelCallSink; retain: (work: Promise<unknown>) => void; health: () => Health };
/** Captures the current Vinext lifetime once, including for later stream callbacks. */
export function createSafeRequestSink(store: TelemetryStore, scope: AiScope): SafeRequestSink {
  const lifetime = getRequestExecutionContext();
  // Copy immutable request context before yielding; no worker-global identity bridge.
  const captured = JSON.parse(canonical(scope)) as AiScope;
  let health: Health = lifetime ? "ready" : "unavailable";
  return { health: () => health, retain(work) {
    if (!lifetime) return;
    const contained = Promise.resolve(work).catch(() => { health = "unavailable"; });
    try { lifetime.waitUntil(contained); } catch { health = "unavailable"; }
  }, async sink(record) {
    if (!lifetime) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const call = projectModelUsage(captured.request_id ? { ...record, request_id: captured.request_id } : record, captured);
      const write = Promise.resolve().then(() => store.upsertAi(call)).catch(() => { health = "unavailable"; });
      lifetime.waitUntil(write);
      await Promise.race([write, new Promise<void>(resolve => { timer = setTimeout(() => { health = "sink_timeout"; resolve(); }, 100); })]);
    } catch { health = "unavailable"; }
    finally { if (timer) clearTimeout(timer); }
  } };
}
/** B2 calls after existing Access validation. Invalid association is always fail-open. */
export async function createRequestTelemetrySink(request: Request, identity: AccessIdentity, r: TelemetryResources = telemetryResources(), options: { requestIdIsClientOwned?: boolean } = {}): Promise<SafeRequestSink> {
  let health: Health = "disabled";
  const lifetime = getRequestExecutionContext();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const noop = { sink: () => {}, retain: () => {}, health: () => health };
  try {
    const ready = readiness(request, r); health = ready.code;
    if (!ready.policy || !r.store || !lifetime) return noop;
    const token = request.headers.get("x-apu-telemetry-context");
    if (!token) return noop;
    const workflow_id = request.headers.get("x-apu-telemetry-workflow"), operation_instance_id = request.headers.get("x-apu-telemetry-operation");
    check(nullableUuid(workflow_id) && nullableUuid(operation_instance_id), "invalid_context");
    const policy = ready.policy, store = r.store, validatedIdentity = { ...identity };
    const resolve = (async () => {
      const participant = await eligibleParticipant(validatedIdentity, policy), now = Date.now();
      const session = await resolveContext(token, participant, policy, r, now);
      await store.touchRequest(ownerOf(session), now);
      return createSafeRequestSink(store, { ...(options.requestIdIsClientOwned ? { request_id: crypto.randomUUID() } : {}), owner: ownerOf(session), workflow_id, operation_instance_id });
    })().catch(() => { health = "invalid_context"; return noop; });
    lifetime.waitUntil(resolve.then(() => {}));
    return await Promise.race([resolve, new Promise<SafeRequestSink>(done => {
      timer = setTimeout(() => { health = "sink_timeout"; done(noop); }, 100);
    })]);
  } catch { health = "unavailable"; return noop; }
  finally { if (timer) clearTimeout(timer); }
}
