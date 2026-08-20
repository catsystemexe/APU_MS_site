import type { AnalysisState } from "./analysis-model";
import type { CommunicationProfileId } from "./communication-profile";
import type { Diagnostics } from "./conversation-diagnostics";
import type { ConversationPhase } from "./dialog-action";
import type { WorkspacePanel } from "./notepad";
import type { NotepadState } from "./notepad-model";

export const SESSION_EXPORT_SCHEMA_VERSION = "1.0" as const;

export type SessionStage = {
  name: "extract" | "grounding" | "controller" | "main" | "analysis";
  status: "completed" | "skipped" | "failed";
  duration_ms: number | null;
  api_request_id?: string;
  model?: string;
  reasoning?: "low" | "medium";
  service_tier?: string;
  usage?: UsageSnapshot;
};

export type UsageSnapshot = {
  input_tokens: number | null;
  cached_input_tokens: number | null;
  cache_write_tokens: number | null;
  output_tokens: number | null;
  reasoning_tokens: number | null;
  total_tokens: number | null;
};

export type ContextSizes = {
  unit: "chars";
  core: number | null;
  runtime_instructions: number | null;
  notebook: number | null;
  previous_analysis: number | null;
  user_message: number | null;
  previous_response_context: number | null;
};

export type SessionTelemetry = {
  request_id: string;
  turn_id: string;
  phase: "F1" | "F2" | "F3";
  path: string;
  started_at: string;
  completed_at: string | null;
  latency_ms: {
    user_to_first_token: number | null;
    preflight_total: number | null;
    analysis_user_visible_ms: number | null;
    analysis_backend_total_ms: number | null;
    total: number | null;
    main_model_ttft: number | null;
    generation: number | null;
  };
  transition_from?: "F1" | "F2" | "F3";
  controller?: { mode: "llm" | "llm_fallback" | "deterministic_bypass" | "controlled_navigation" };
  stages: SessionStage[];
  context_sizes: ContextSizes;
  tools: { file_search: { available: boolean; invoked: boolean; calls: number; duration_ms: number | null } };
  notebook_mutation?: { added: number; updated: number; conflicts: number; rejected_by_grounding: number };
  streaming: { model: boolean; backend: boolean; transport: boolean; ui: boolean };
};

export type ExportMessage = {
  id: string;
  turnId?: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  phaseLabel?: string;
  diagnostics?: Diagnostics;
  telemetryRefs?: string[];
};

function phaseName(phase: ConversationPhase) {
  return phase === "intake" ? "F1" : phase === "development" ? "F2" : "F3";
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function validDuration(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 3_600_000
    ? Math.round(value)
    : null;
}

export function createSessionTelemetry(input: {
  requestId: string;
  turnId: string;
  phase: ConversationPhase;
  startedAt: string;
}): SessionTelemetry {
  return {
    request_id: input.requestId,
    turn_id: input.turnId,
    phase: phaseName(input.phase),
    path: "",
    started_at: input.startedAt,
    completed_at: null,
    latency_ms: { user_to_first_token: null, preflight_total: null, analysis_user_visible_ms: null, analysis_backend_total_ms: null, total: null, main_model_ttft: null, generation: null },
    stages: [],
    context_sizes: {
      unit: "chars", core: null, runtime_instructions: null, notebook: null,
      previous_analysis: null, user_message: null, previous_response_context: null,
    },
    tools: { file_search: { available: false, invoked: false, calls: 0, duration_ms: null } },
    streaming: { model: false, backend: false, transport: false, ui: false },
  };
}

export function toUsageSnapshot(value: Partial<Diagnostics> | undefined): UsageSnapshot {
  return {
    input_tokens: value?.inputTokens ?? null,
    cached_input_tokens: value?.cachedInputTokens ?? null,
    cache_write_tokens: value?.cacheWriteTokens ?? null,
    output_tokens: value?.outputTokens ?? null,
    reasoning_tokens: value?.reasoningTokens ?? null,
    total_tokens: value?.totalTokens ?? null,
  };
}

export function mergeSessionTelemetry(current: SessionTelemetry, patch: Partial<Omit<SessionTelemetry, "latency_ms" | "streaming" | "context_sizes" | "tools">> & {
  stages?: SessionStage[];
  context_sizes?: Partial<ContextSizes>;
  tools?: Partial<SessionTelemetry["tools"]>;
  latency_ms?: Partial<SessionTelemetry["latency_ms"]>;
  streaming?: Partial<SessionTelemetry["streaming"]>;
}): SessionTelemetry {
  const stages = (patch.stages ? [...current.stages, ...patch.stages] : current.stages)
    .map((stage) => ({ ...stage, duration_ms: validDuration(stage.duration_ms) }));
  const names = stages.map((stage) => stage.name);
  const latency = { ...current.latency_ms, ...patch.latency_ms };
  // Server-side telemetry cannot observe the client's first rendered delta. Keep the
  // client measurement when a later server patch deliberately reports null.
  if (patch.latency_ms?.user_to_first_token === null && current.latency_ms.user_to_first_token !== null) {
    latency.user_to_first_token = current.latency_ms.user_to_first_token;
  }
  for (const key of Object.keys(latency) as Array<keyof typeof latency>) latency[key] = validDuration(latency[key]);
  return {
    ...current,
    ...patch,
    stages,
    path: names.join("-") || patch.path || current.path,
    context_sizes: { ...current.context_sizes, ...patch.context_sizes },
    tools: { ...current.tools, ...patch.tools, file_search: { ...current.tools.file_search, ...patch.tools?.file_search } },
    latency_ms: latency,
    streaming: { ...current.streaming, ...patch.streaming },
  };
}

export function buildSessionExport(input: {
  session: { id: string; startedAt: string; phase: ConversationPhase; communicationProfile: CommunicationProfileId; activePanel: WorkspacePanel; appVersion: string; coreVersion: string; coreReleaseId: string; runtimeWrapper: string };
  messages: ExportMessage[];
  notepad: NotepadState;
  analysis: AnalysisState | null;
  output: unknown | null;
  telemetry: SessionTelemetry[];
  exportedAt?: string;
}) {
  const telemetry = input.telemetry.map((item) => ({ ...item, stages: item.stages.map((stage) => ({ ...stage })) }));
  const ttft = telemetry.flatMap((item) => validDuration(item.latency_ms.user_to_first_token) === null ? [] : [validDuration(item.latency_ms.user_to_first_token)!]);
  const totals = telemetry.flatMap((item) => validDuration(item.latency_ms.total) === null ? [] : [validDuration(item.latency_ms.total)!]);
  const fileSearchCalls = telemetry.reduce((total, item) => total + item.tools.file_search.calls, 0);
  const requestsWithFileSearch = telemetry.filter((item) => item.tools.file_search.invoked).length;
  const phases = (phase: string) => telemetry.filter((item) => item.phase === phase).length;
  return {
    schema_version: SESSION_EXPORT_SCHEMA_VERSION,
    export: { exported_at: input.exportedAt ?? new Date().toISOString(), format: "APU Session JSON", schema_version: SESSION_EXPORT_SCHEMA_VERSION, source: "APU" },
    session: {
      session_id: input.session.id,
      started_at: input.session.startedAt,
      current_phase: phaseName(input.session.phase),
      communication_profile: input.session.communicationProfile,
      active_panel: input.session.activePanel,
      app_version: input.session.appVersion,
      core: { version: input.session.coreVersion, release_id: input.session.coreReleaseId, runtime_wrapper: input.session.runtimeWrapper },
      chat_turns: input.messages.length,
      telemetry_requests: telemetry.length,
    },
    chat: input.messages.map((message) => ({
      message_id: message.id,
      turn_id: message.turnId ?? null,
      role: message.role,
      content: message.content,
      timestamp: message.createdAt ?? null,
      phase: message.phaseLabel ?? null,
      telemetry_refs: message.telemetryRefs ?? [],
    })),
    notebook: structuredClone(input.notepad),
    analysis: input.analysis ? structuredClone(input.analysis) : null,
    output: input.output === null ? null : structuredClone(input.output),
    telemetry,
    summary_metrics: {
      requests: telemetry.length,
      f1_requests: phases("F1"), f2_requests: phases("F2"), f3_requests: phases("F3"),
      grounding_used: telemetry.filter((item) => item.stages.some((stage) => stage.name === "grounding" && stage.status === "completed")).length,
      file_search_calls: fileSearchCalls,
      requests_with_file_search: requestsWithFileSearch,
      median_user_to_first_token_ms: median(ttft),
      median_total_latency_ms: median(totals),
    },
  };
}

export function sessionExportFilename(exportedAt: string) {
  const date = new Date(exportedAt);
  const part = (value: number) => String(value).padStart(2, "0");
  return `apu-session-${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}-${part(date.getHours())}${part(date.getMinutes())}${part(date.getSeconds())}.json`;
}

export function downloadSessionExport(data: ReturnType<typeof buildSessionExport>, environment: { document?: Document; url?: Pick<typeof URL, "createObjectURL" | "revokeObjectURL"> } = {}) {
  const page = environment.document ?? (typeof document === "undefined" ? undefined : document);
  const objectUrl = environment.url ?? (typeof URL === "undefined" ? undefined : URL);
  if (!page || !objectUrl) throw new Error("Stažení exportu není v tomto prohlížeči dostupné.");
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const href = objectUrl.createObjectURL(blob);
  const link = page.createElement("a");
  link.href = href; link.download = sessionExportFilename(data.export.exported_at); link.rel = "noopener";
  page.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => objectUrl.revokeObjectURL(href), 1000);
}
