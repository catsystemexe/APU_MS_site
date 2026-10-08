import {
  InstrumentedModelCallError,
  runInstrumentedModelCall,
  type InstrumentedProviderResponse,
  type ProviderResponseBody,
} from "./model-call-instrumentation.ts";
import { upsertUsageRecord, type ModelUsageRecord, type TelemetryPhase, type UsageOperation } from "./usage-ledger.ts";

export type RequestUsageCollector = {
  sink: (record: ModelUsageRecord) => void;
  records: () => ModelUsageRecord[];
};

export function createRequestUsageCollector(): RequestUsageCollector {
  let current: ModelUsageRecord[] = [];
  return {
    sink(record) { current = upsertUsageRecord(current, record); },
    records: () => current,
  };
}

export function modelUsagePayload<T extends Record<string, unknown>>(payload: T, collector: RequestUsageCollector) {
  return { ...payload, model_usage_records: collector.records() };
}

function diagnosticToken(value: unknown, fallback = "unknown") {
  return typeof value === "string" && /^[a-z0-9_.\[\]-]{1,120}$/i.test(value) ? value : fallback;
}

function diagnosticMessage(value: unknown) {
  if (typeof value !== "string") return null;
  const safe = value
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\bAuthorization\s*[:=]\s*\S+(?:\s+\S+)?/gi, "Authorization=[redacted]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\bsk-[a-z0-9_-]+/gi, "[redacted]")
    .replace(/\s+/g, " ")
    .trim();
  if (!safe) return null;
  return safe.length <= 300 ? safe : `${safe.slice(0, 299)}…`;
}

export function providerResponseDiagnostic(
  record: ModelUsageRecord | undefined,
  response?: Pick<InstrumentedProviderResponse<ProviderResponseBody>, "body" | "status_code">,
) {
  const providerError = response?.body.error;
  const message = diagnosticMessage(providerError?.message);
  return [
    `http_status=${response?.status_code ?? "unknown"}`,
    `provider_status=${record?.provider_status ?? "unknown"}`,
    `category=${diagnosticToken(record?.error?.category)}`,
    `code=${diagnosticToken(providerError?.code ?? record?.error?.code)}`,
    `type=${diagnosticToken(providerError?.type)}`,
    `param=${diagnosticToken(providerError?.param)}`,
    ...(message ? [`message=${message}`] : []),
  ].join("; ");
}

type OpenAIResponse = Pick<Response, "headers" | "json" | "status">;
type OpenAIFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<OpenAIResponse>;

export type OpenAIResponsesCallInput<TApplicationResult> = {
  api_key: string;
  request_id: string;
  turn_id?: string | null;
  phase: TelemetryPhase;
  operation: UsageOperation;
  requested_model: string;
  reasoning_effort: "low" | "medium" | null;
  requested_service_tier?: string | null;
  payload: Record<string, unknown>;
  collector: RequestUsageCollector;
  validate_application_response?: (body: ProviderResponseBody) => TApplicationResult | Promise<TApplicationResult>;
  fetcher?: OpenAIFetch;
};

function responseBody(value: unknown): ProviderResponseBody {
  return value && typeof value === "object" ? value as ProviderResponseBody : {};
}

export async function callOpenAIResponses<TApplicationResult = void>(input: OpenAIResponsesCallInput<TApplicationResult>) {
  const fetcher = input.fetcher ?? fetch;
  return runInstrumentedModelCall({
    request_id: input.request_id,
    turn_id: input.turn_id ?? null,
    phase: input.phase,
    operation: input.operation,
    requested_model: input.requested_model,
    reasoning_effort: input.reasoning_effort,
    requested_service_tier: input.requested_service_tier ?? null,
    sink: input.collector.sink,
    validate_application_response: input.validate_application_response,
    invoke: async ({ headers }) => {
      const upstream = await fetcher("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.api_key}`,
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(input.payload),
      });
      const body = await upstream.json().catch(() => ({}));
      return { body: responseBody(body), headers: upstream.headers, status_code: upstream.status };
    },
  });
}

export function usageErrorPayload(error: unknown, collector: RequestUsageCollector) {
  if (error instanceof InstrumentedModelCallError) return modelUsagePayload({ error: error.message }, collector);
  return null;
}
