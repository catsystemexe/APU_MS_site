/** Pilot v1 wire contract. No application state or arbitrary metadata is accepted. */
export const SCHEMA_VERSION = 1 as const;
export const MEASUREMENT_VERSION = "pilot-v1" as const;
export const LIMITS = Object.freeze({ batch: 20, requestBytes: 32768, eventBytes: 2048,
  intervalMs: 15000, idleMs: 1800000, lifetimeMs: 43200000, delayMs: 120000,
  queue: 100, eventsPerMinute: 120, contextsPerHour: 30 });
export const phases = ["F1", "F2", "F3", "unknown"] as const;
export const operations = ["extraction", "grounding", "controller", "main_chat", "analysis", "need_routing",
  "f2_component_generation", "f2_build", "f2_preview", "f3_render", "f2_local_reconciliation"] as const;
export type Phase = typeof phases[number];
export type Operation = typeof operations[number];
export type ErrorClass = "transport" | "provider" | "incomplete" | "invalid_output" | "unknown";
export type Format = "auto" | "text" | "table" | "cards";
export type Payloads = {
  activity_interval: { start_ms: number; end_ms: number; last_interaction_ms: number; phase: Phase };
  workflow_started: { phase: Phase };
  phase_transition: { from: Phase; to: Phase; reason: "user_navigation" | "controller_instruction" | "return" };
  operation_requested: { operation_instance_id: string; operation: Operation; reason: "initial" | "retry" | "regenerate"; prior_operation_id: string | null };
  operation_resolved: { operation_instance_id: string; outcome: "accepted" | "failed" | "stale_discarded" | "cancelled" | "local_noop"; error_class?: ErrorClass };
  document_accepted: { output_id: string; representation: "baseline" | "generated"; format?: Format };
  workflow_reset: { reason: "reset" | "new_project" };
  session_closed: { reason: "logout" | "hidden_close" | "idle" };
  workflow_metadata: { activePath?: "POCHOPIT" | "POZOROVAT" | "VYTVOŘIT"; format?: Format };
};
export type EventName = keyof Payloads;
export type ClientEvent<N extends EventName = EventName> = N extends EventName ? {
  schema_version: 1; measurement_version: typeof MEASUREMENT_VERSION; source: "client";
  event_id: string; event_name: N; session_id: string; tab_id: string;
  workflow_id: string | null; client_seq: number; elapsed_ms: number; payload: Payloads[N];
} : never;
export type StoredEvent = { event: ClientEvent; occurred_at: number; received_at: number; app_version: "unknown" };
export type Health = "disabled" | "not_ready" | "ineligible" | "consent_required" | "unauthorized" | "invalid_request" |
  "invalid_context" | "invalid_event" | "conflict" | "rate_limited" | "unavailable" | "ready" | "stopped" | "sink_timeout" | "queue_dropped";
export class TelemetryError extends Error {
  readonly code: Health;
  constructor(code: Health) { super(code); this.code = code; }
}
export function check(condition: unknown, code: Health = "invalid_event"): asserts condition {
  if (!condition) throw new TelemetryError(code);
}
export function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function keys(value: unknown, required: string[], optional: string[] = []): asserts value is Record<string, unknown> {
  check(object(value) && required.every(k => Object.hasOwn(value, k)) && Object.keys(value).every(k => required.includes(k) || optional.includes(k)));
}
export function uuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}
export function integer(value: unknown, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= max;
}
export function oneOf(value: unknown, values: readonly unknown[]) { return values.includes(value); }
export function bytes(value: unknown) { return new TextEncoder().encode(JSON.stringify(value)).byteLength; }
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
const formats = ["auto", "text", "table", "cards"];
const errors = ["transport", "provider", "incomplete", "invalid_output", "unknown"];
export function validateClientEvent(value: unknown, metadata = false): ClientEvent {
  keys(value, ["schema_version", "measurement_version", "source", "event_id", "event_name", "session_id", "tab_id", "workflow_id", "client_seq", "elapsed_ms", "payload"]);
  check(value.schema_version === 1 && value.measurement_version === MEASUREMENT_VERSION && value.source === "client");
  check(uuid(value.event_id) && uuid(value.session_id) && uuid(value.tab_id) && integer(value.client_seq) && integer(value.elapsed_ms, LIMITS.lifetimeMs));
  check(value.workflow_id === null || uuid(value.workflow_id));
  check(bytes(value) <= LIMITS.eventBytes);
  const p = value.payload;
  switch (value.event_name) {
    case "activity_interval":
      keys(p, ["start_ms", "end_ms", "last_interaction_ms", "phase"]);
      check(integer(p.start_ms) && integer(p.end_ms) && integer(p.last_interaction_ms) && p.end_ms > p.start_ms &&
        p.end_ms - p.start_ms <= LIMITS.intervalMs && p.end_ms <= value.elapsed_ms && p.last_interaction_ms <= p.end_ms &&
        p.end_ms - p.last_interaction_ms <= 60000 && oneOf(p.phase, phases)); break;
    case "workflow_started": keys(p, ["phase"]); check(oneOf(p.phase, phases)); break;
    case "phase_transition":
      keys(p, ["from", "to", "reason"]); check(oneOf(p.from, phases) && oneOf(p.to, phases) && p.from !== p.to &&
        oneOf(p.reason, ["user_navigation", "controller_instruction", "return"])); break;
    case "operation_requested":
      keys(p, ["operation_instance_id", "operation", "reason", "prior_operation_id"]);
      check(uuid(p.operation_instance_id) && oneOf(p.operation, operations) && oneOf(p.reason, ["initial", "retry", "regenerate"]) &&
        (p.prior_operation_id === null || uuid(p.prior_operation_id))); break;
    case "operation_resolved":
      keys(p, ["operation_instance_id", "outcome"], ["error_class"]);
      check(uuid(p.operation_instance_id) && oneOf(p.outcome, ["accepted", "failed", "stale_discarded", "cancelled", "local_noop"]) &&
        (p.error_class === undefined || oneOf(p.error_class, errors))); break;
    case "document_accepted":
      keys(p, ["output_id", "representation"], ["format"]);
      check(uuid(p.output_id) && oneOf(p.representation, ["baseline", "generated"]) &&
        (p.format === undefined || (metadata && oneOf(p.format, formats)))); break;
    case "workflow_reset": keys(p, ["reason"]); check(oneOf(p.reason, ["reset", "new_project"])); break;
    case "session_closed": keys(p, ["reason"]); check(oneOf(p.reason, ["logout", "hidden_close", "idle"])); break;
    case "workflow_metadata":
      check(metadata); keys(p, [], ["activePath", "format"]); check(Object.keys(p).length > 0 &&
        (p.activePath === undefined || oneOf(p.activePath, ["POCHOPIT", "POZOROVAT", "VYTVOŘIT"])) &&
        (p.format === undefined || oneOf(p.format, formats))); break;
    default: check(false);
  }
  check(value.event_name === "session_closed" || value.event_name === "activity_interval" || uuid(value.workflow_id));
  return value as ClientEvent;
}
export function validateBatch(value: unknown, metadata = false): ClientEvent[] {
  check(Array.isArray(value) && value.length > 0 && value.length <= LIMITS.batch && bytes(value) <= LIMITS.requestBytes);
  return value.map(event => validateClientEvent(event, metadata));
}
