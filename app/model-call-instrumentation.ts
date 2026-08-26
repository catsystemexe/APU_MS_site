import {
  createModelUsageRecord,
  finalizeModelUsageRecord,
  type ApplicationStatus,
  type ModelUsageRecord,
  type ProviderStatus,
  type ProviderUsageInput,
  type TelemetryPhase,
  type UsageOperation,
} from "./usage-ledger.ts";

type ResponseHeaders = Pick<Headers, "get"> | Record<string, string | undefined>;

export type ProviderResponseBody = {
  id?: unknown;
  model?: unknown;
  service_tier?: unknown;
  status?: unknown;
  usage?: ProviderUsageInput;
  output?: unknown;
  error?: { code?: unknown } | null;
  incomplete_details?: { reason?: unknown } | null;
};

export type InstrumentedProviderResponse<TBody extends ProviderResponseBody> = {
  body: TBody;
  headers?: ResponseHeaders;
  status_code?: number;
};

export type ModelCallSink = (record: ModelUsageRecord) => void | Promise<void>;

export type InstrumentedModelCallInput<TBody extends ProviderResponseBody, TApplicationResult = void> = {
  request_id: string;
  turn_id?: string | null;
  phase: TelemetryPhase;
  operation: UsageOperation;
  attempt_index?: number;
  retry_of_call_id?: string | null;
  fallback_for_call_id?: string | null;
  requested_model: string;
  reasoning_effort?: "low" | "medium" | null;
  requested_service_tier?: string | null;
  call_id?: string;
  now?: () => Date;
  create_call_id?: () => string;
  sink: ModelCallSink;
  invoke: (request: { call_id: string; headers: Readonly<Record<string, string>> }) => Promise<InstrumentedProviderResponse<TBody>>;
  validate_application_response?: (body: TBody) => TApplicationResult | Promise<TApplicationResult>;
};

export type InstrumentedModelCallLifecycleInput = Omit<
  InstrumentedModelCallInput<ProviderResponseBody>,
  "invoke" | "validate_application_response"
>;

type ApplicationFinalization = {
  application_status?: ApplicationStatus;
  error?: { category: string; code: string | null } | null;
};

export class InstrumentedModelCallError extends Error {
  readonly usage_record: ModelUsageRecord;
  readonly cause: unknown;

  constructor(message: string, usageRecord: ModelUsageRecord, cause?: unknown) {
    super(message);
    this.name = "InstrumentedModelCallError";
    this.usage_record = usageRecord;
    this.cause = cause;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function responseHeader(headers: ResponseHeaders | undefined, name: string) {
  if (!headers) return null;
  if ("get" in headers && typeof headers.get === "function") return headers.get(name);
  const wanted = name.toLowerCase();
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === wanted);
  return entry?.[1] ?? null;
}

function providerStatus(value: unknown, statusCode: number | undefined): ProviderStatus {
  if (statusCode !== undefined && (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599)) return "unknown";
  if (statusCode !== undefined && (statusCode < 200 || statusCode >= 300)) return "failed";
  if (value === "completed" || value === "incomplete" || value === "failed") return value;
  return "unknown";
}

function applicationStatus(status: ProviderStatus): ApplicationStatus {
  if (status === "completed") return "accepted";
  if (status === "unknown") return "not_applicable";
  return "failed";
}

function fileSearchCalls(output: unknown) {
  if (!Array.isArray(output)) return 0;
  return output.filter((item) => isRecord(item) && item.type === "file_search_call").length;
}

function providerError(body: ProviderResponseBody, status: ProviderStatus) {
  if (status === "completed") return null;
  const errorCode = optionalString(body.error?.code);
  const incompleteReason = optionalString(body.incomplete_details?.reason);
  return {
    category: status === "incomplete" ? "provider_incomplete" : "provider_response",
    code: errorCode ?? incompleteReason,
  };
}

function assertClientRequestId(callId: string) {
  if (callId.length === 0 || callId.length > 512 || !/^[\x20-\x7E]+$/.test(callId)) {
    throw new Error("call_id must be a non-empty ASCII value of at most 512 characters");
  }
}

export function createInstrumentedModelCallLifecycle(input: InstrumentedModelCallLifecycleInput) {
  const now = input.now ?? (() => new Date());
  const callId = input.call_id ?? (input.create_call_id ?? (() => crypto.randomUUID()))();
  assertClientRequestId(callId);

  const pending = createModelUsageRecord({
    call_id: callId,
    request_id: input.request_id,
    turn_id: input.turn_id ?? null,
    phase: input.phase,
    operation: input.operation,
    attempt_index: input.attempt_index ?? 0,
    retry_of_call_id: input.retry_of_call_id ?? null,
    fallback_for_call_id: input.fallback_for_call_id ?? null,
    started_at: now().toISOString(),
    completed_at: null,
    requested_model: input.requested_model,
    reported_model: null,
    reasoning_effort: input.reasoning_effort ?? null,
    requested_service_tier: input.requested_service_tier ?? null,
    reported_service_tier: null,
    provider_request_id: null,
    provider_response_id: null,
    provider_status: "unknown",
    application_status: "not_applicable",
    error: null,
  });

  let began = false;
  let finalRecord: ModelUsageRecord | null = null;
  const begin = async () => {
    if (began) return;
    began = true;
    await input.sink(pending);
  };

  return {
    call_id: callId,
    headers: { "X-Client-Request-Id": callId } as const,
    provider_status<TBody extends ProviderResponseBody>(response: InstrumentedProviderResponse<TBody>) {
      return providerStatus(response.body.status, response.status_code);
    },
    is_finalized: () => finalRecord !== null,
    begin,
    async finish_provider<TBody extends ProviderResponseBody>(
      response: InstrumentedProviderResponse<TBody>,
      application: ApplicationFinalization = {},
    ) {
      await begin();
      if (finalRecord) return finalRecord;
      const body = response.body;
      const status = providerStatus(body.status, response.status_code);
      finalRecord = finalizeModelUsageRecord(pending, {
        completed_at: now().toISOString(),
        reported_model: optionalString(body.model),
        reported_service_tier: optionalString(body.service_tier),
        provider_request_id: responseHeader(response.headers, "x-request-id"),
        provider_response_id: optionalString(body.id),
        provider_status: status,
        application_status: application.application_status ?? applicationStatus(status),
        provider_usage: body.usage,
        file_search_calls: fileSearchCalls(body.output),
        error: application.error !== undefined ? application.error : providerError(body, status),
      });
      await input.sink(finalRecord);
      return finalRecord;
    },
    async finish_transport(errorCode: string | null = null) {
      await begin();
      if (finalRecord) return finalRecord;
      finalRecord = finalizeModelUsageRecord(pending, {
        completed_at: now().toISOString(),
        provider_status: "transport_error",
        application_status: "failed",
        error: { category: "transport", code: errorCode },
      });
      await input.sink(finalRecord);
      return finalRecord;
    },
  };
}

export async function runInstrumentedModelCall<TBody extends ProviderResponseBody, TApplicationResult = void>(
  input: InstrumentedModelCallInput<TBody, TApplicationResult>,
): Promise<{ response: InstrumentedProviderResponse<TBody>; usage_record: ModelUsageRecord; application_result: TApplicationResult | undefined }> {
  const lifecycle = createInstrumentedModelCallLifecycle(input);
  await lifecycle.begin();

  let response: InstrumentedProviderResponse<TBody>;
  try {
    response = await input.invoke({
      call_id: lifecycle.call_id,
      headers: lifecycle.headers,
    });
  } catch (cause) {
    const failed = await lifecycle.finish_transport();
    throw new InstrumentedModelCallError("Model provider transport failed", failed, cause);
  }

  const body = response.body;
  const status = lifecycle.provider_status(response);

  let applicationResult: TApplicationResult | undefined;
  if (status === "completed" && input.validate_application_response) {
    try {
      applicationResult = await input.validate_application_response(body);
    } catch (cause) {
      const completed = await lifecycle.finish_provider(response, {
        application_status: "rejected_invalid_output",
        error: { category: "application_validation", code: null },
      });
      throw new InstrumentedModelCallError("Model response failed application validation", completed, cause);
    }
  }

  const completed = await lifecycle.finish_provider(response);
  return { response, usage_record: completed, application_result: applicationResult };
}
