// Temporary DEV operator diagnostics. This contract contains no content, identity or provider IDs.
import { operations, uuid } from "./contract.ts";
export const T5_TRACE_PREFIX = "APU_T5_TRACE_V1 ";
export type TraceRecord = Record<string, unknown>;
export type T5Trace = { call: (id: string, operation: string, attempt: number) => { invoke(): void; response(body: unknown, status: number): void; error(aborted?: boolean): void };
  writeAck(id: string, state: "pending" | "final"): void };
const obj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const number = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0;
const tag = (v: unknown) => typeof v === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(v);
const model = (v: unknown) => v === null || v === "unknown" || typeof v === "string" && /^gpt-5\.6-(luna|terra|sol)(-\d{4}-\d{2}-\d{2})?$/.test(v);
const tiers = [null, "unknown", "default", "auto", "flex", "priority", "scale"];
const statuses = [null, "unknown", "completed", "incomplete", "failed", "in_progress", "queued", "cancelled"];
const usageFields = ["input_tokens", "output_tokens", "total_tokens", "input_tokens_details", "output_tokens_details"];
const details = { input_tokens_details: ["cached_tokens", "cache_write_tokens"], output_tokens_details: ["reasoning_tokens"] };
function keys(v: Record<string, unknown>, allowed: string[], required = allowed) {
  return Object.keys(v).every(k => allowed.includes(k)) && required.every(k => Object.hasOwn(v, k));
}
function validUsage(v: unknown): boolean {
  if (v === null) return true;
  if (!obj(v) || !keys(v, usageFields, [])) return false;
  return Object.entries(v).every(([k, value]) => k in details
    ? value === null || obj(value) && keys(value, details[k as keyof typeof details], []) && Object.values(value).every(n => n === null || number(n))
    : value === null || number(value));
}
export function validateTrace(value: unknown): value is TraceRecord {
  if (!obj(value) || value.v !== 1 || !tag(value.cohort_id) || !uuid(value.call_id) || !number(value.time_ms)) return false;
  const base = ["v", "cohort_id", "call_id", "stage", "time_ms"];
  if (value.stage === "write_ack") return keys(value, [...base, "state"]) && ["pending", "final"].includes(String(value.state));
  if (!operations.includes(value.operation as typeof operations[number]) || !number(value.attempt_index)) return false;
  const common = [...base, "operation", "attempt_index"];
  if (value.stage === "invoke") return keys(value, common);
  if (value.stage === "transport_error") return keys(value, [...common, "error_class"]) && ["aborted", "transport"].includes(String(value.error_class));
  if (value.stage !== "response") return false;
  return keys(value, [...common, "http_status", "provider_status", "model", "service_tier", "usage_valid", "usage", "file_search_calls"], [...common, "http_status", "provider_status", "model", "service_tier", "usage_valid", "file_search_calls"])
    && number(value.http_status) && Number(value.http_status) <= 599 && statuses.includes(value.provider_status as null) && model(value.model)
    && tiers.includes(value.service_tier as null) && typeof value.usage_valid === "boolean"
    && (!Object.hasOwn(value, "usage") || validUsage(value.usage)) && (value.file_search_calls === null || number(value.file_search_calls));
}
function rawUsage(body: Record<string, unknown>): { usage?: unknown; usage_valid: boolean } {
  if (!Object.hasOwn(body, "usage")) return { usage_valid: true };
  if (validUsage(body.usage)) return { usage: structuredClone(body.usage), usage_valid: true };
  // Never serialize unsupported strings/objects from provider data, even on failure.
  return { usage_valid: false };
}
export function createT5Trace(cohort: string, log: (message: string) => void = message => console.info(message), now = Date.now): T5Trace {
  const emit = (event: TraceRecord) => { try { const v = { v: 1, cohort_id: cohort, time_ms: now(), ...event }; if (validateTrace(v)) log(T5_TRACE_PREFIX + JSON.stringify(v)); } catch { /* diagnostics fail open */ } };
  return {
    call(id, operation, attempt) {
      let started = false, terminal = false;
      const common = { call_id: id, operation, attempt_index: attempt };
      return {
        invoke() { if (!started) { started = true; emit({ ...common, stage: "invoke" }); } },
        response(raw, status) {
          if (!started || terminal) return; terminal = true;
          try {
            const b = obj(raw) ? raw : {};
            emit({ ...common, stage: "response", http_status: status,
              provider_status: statuses.includes(b.status as null) ? b.status ?? null : "unknown",
              model: model(b.model) ? b.model : "unknown", service_tier: tiers.includes(b.service_tier as null) ? b.service_tier ?? null : "unknown",
              ...rawUsage(b), file_search_calls: Array.isArray(b.output) ? b.output.filter(item => obj(item) && item.type === "file_search_call").length : null });
          } catch { /* malformed diagnostics cannot break the response */ }
        },
        error(aborted = false) { if (started && !terminal) { terminal = true; emit({ ...common, stage: "transport_error", error_class: aborted ? "aborted" : "transport" }); } },
      };
    },
    writeAck(id, state) { emit({ call_id: id, stage: "write_ack", state }); },
  };
}
