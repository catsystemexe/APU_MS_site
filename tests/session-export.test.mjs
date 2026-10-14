import test from "node:test";
import assert from "node:assert/strict";
import { buildSessionExport, createSessionTelemetry, mergeSessionTelemetry, sessionExportFilename } from "../app/session-export.ts";

const emptyNotepad = { manifestations: [], goals: [], context: [], course: [], helps: [] };

test("APU Session JSON export is versioned, valid and links chat turns to telemetry", () => {
  const base = createSessionTelemetry({ requestId: "req_1", turnId: "turn_1", phase: "intake", startedAt: "2026-08-16T10:00:00.000Z" });
  const telemetry = mergeSessionTelemetry(base, {
    completed_at: "2026-08-16T10:00:02.000Z",
    latency_ms: { user_to_first_token: 800, main_model_ttft: 300, total: 2000 },
    stages: [
      { name: "extract", status: "completed", duration_ms: 250, model: "gpt-5.6-luna", reasoning: "medium" },
      { name: "grounding", status: "skipped", duration_ms: null },
      { name: "controller", status: "completed", duration_ms: 180, model: "gpt-5.6-luna", reasoning: "low" },
      { name: "main", status: "completed", duration_ms: 1500, model: "gpt-5.6-luna", reasoning: "low" },
    ],
    tools: { file_search: { available: true, invoked: false, calls: 0, duration_ms: null } },
  });
  const data = buildSessionExport({
    session: { id: "session_1", startedAt: "2026-08-16T10:00:00.000Z", phase: "intake", communicationProfile: "colleague", activePanel: null, appVersion: "APU Site 0.1", coreVersion: "1.5", coreReleaseId: "core", runtimeWrapper: "app/runtime-instructions.ts" },
    messages: [{ id: "m1", turnId: "turn_1", role: "user", content: "test", telemetryRefs: ["req_1"] }],
    notepad: emptyNotepad, analysis: null, output: null, telemetry: [telemetry], exportedAt: "2026-08-16T10:02:03.000Z",
  });
  assert.equal(data.schema_version, "1.0");
  assert.equal(data.chat[0].telemetry_refs[0], data.telemetry[0].request_id);
  assert.equal(data.telemetry[0].stages[1].status, "skipped");
  assert.equal(data.summary_metrics.median_user_to_first_token_ms, 800);
  assert.equal(data.telemetry[0].latency_ms.preflight_total, null);
  assert.equal(data.telemetry[0].tools.file_search.invoked, false);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(data)));
});

test("transition analysis is counted in its target phase and file-search calls are actual invocations", () => {
  const base = createSessionTelemetry({ requestId: "req_2", turnId: "turn_2", phase: "intake", startedAt: "2026-08-16T10:00:00.000Z" });
  const analysis = mergeSessionTelemetry(base, {
    phase: "F2", transition_from: "F1", path: "analysis",
    tools: { file_search: { available: true, invoked: true, calls: 1, duration_ms: null } },
  });
  const data = buildSessionExport({
    session: { id: "session_2", startedAt: "2026-08-16T10:00:00.000Z", phase: "development", communicationProfile: "colleague", activePanel: "analysis", appVersion: "APU Site 0.1", coreVersion: "1.5", coreReleaseId: "core", runtimeWrapper: "app/runtime-instructions.ts" },
    messages: [], notepad: emptyNotepad, analysis: null, output: null, telemetry: [analysis], exportedAt: "2026-08-16T10:02:03.000Z",
  });
  assert.equal(data.summary_metrics.f2_requests, 1);
  assert.equal(data.summary_metrics.f1_requests, 0);
  assert.equal(data.summary_metrics.file_search_calls, 1);
  assert.equal(data.summary_metrics.requests_with_file_search, 1);
  assert.equal(data.telemetry[0].transition_from, "F1");
});

test("server null TTFT does not overwrite the client-visible first delta measurement", () => {
  const client = mergeSessionTelemetry(
    createSessionTelemetry({ requestId: "req_3", turnId: "turn_3", phase: "intake", startedAt: "2026-08-16T10:00:00.000Z" }),
    { latency_ms: { user_to_first_token: 1300 } },
  );
  const merged = mergeSessionTelemetry(client, { latency_ms: { user_to_first_token: null, main_model_ttft: 400 } });
  assert.equal(merged.latency_ms.user_to_first_token, 1300);
  assert.equal(merged.latency_ms.preflight_total, null);
});

test("invalid timing values are exported as null and excluded from summary medians", () => {
  const telemetry = mergeSessionTelemetry(
    createSessionTelemetry({ requestId: "req_4", turnId: "turn_4", phase: "development", startedAt: "2026-08-16T10:00:00.000Z" }),
    { latency_ms: { user_to_first_token: -10, total: Number.POSITIVE_INFINITY, analysis_user_visible_ms: 1220, analysis_backend_total_ms: 980 } },
  );
  const data = buildSessionExport({
    session: { id: "session_4", startedAt: "2026-08-16T10:00:00.000Z", phase: "development", communicationProfile: "colleague", activePanel: "analysis", appVersion: "APU Site 0.1", coreVersion: "1.5", coreReleaseId: "core", runtimeWrapper: "app/runtime-instructions.ts" },
    messages: [], notepad: emptyNotepad, analysis: null, output: null, telemetry: [telemetry], exportedAt: "2026-08-16T10:02:03.000Z",
  });
  assert.equal(data.telemetry[0].latency_ms.user_to_first_token, null);
  assert.equal(data.telemetry[0].latency_ms.total, null);
  assert.equal(data.telemetry[0].latency_ms.analysis_user_visible_ms, 1220);
  assert.equal(data.summary_metrics.median_user_to_first_token_ms, null);
});

test("session export filename is a JSON file", () => {
  assert.match(sessionExportFilename("2026-08-16T10:02:03.000Z"), /^apu-session-2026-08-16-\d{6}\.json$/);
});

test("legacy Session JSON stays schema 1.0 with unchanged stages/summary when optional observability is absent", () => {
  const base = createSessionTelemetry({ requestId: "legacy", turnId: "turn", phase: "intake", startedAt: "2026-10-14T00:00:00Z" });
  const telemetry = mergeSessionTelemetry(base, {
    stages: [{ name: "extract", status: "completed", duration_ms: 20 }, { name: "grounding", status: "completed", duration_ms: 30 }],
    controller: { mode: "llm_fallback", fallback_reason: "provider_failure" },
  });
  const data = buildSessionExport({
    session: { id: "legacy", startedAt: base.started_at, phase: "intake", communicationProfile: "colleague", activePanel: null, appVersion: "test", coreVersion: "test", coreReleaseId: "test", runtimeWrapper: "test" },
    messages: [], notepad: emptyNotepad, analysis: null, output: null, telemetry: [telemetry],
  });
  assert.equal(data.schema_version, "1.0");
  assert.equal(data.telemetry[0].path, "extract-grounding");
  assert.equal(Object.hasOwn(data.telemetry[0], "grounding"), false);
  assert.equal(Object.hasOwn(data.telemetry[0].controller, "rejection_reason"), false);
  assert.deepEqual(data.telemetry[0].stages, telemetry.stages);
  assert.equal(data.summary_metrics.requests, 1);assert.equal(data.summary_metrics.f1_requests, 1);
});

test("optional primary/rescue and controller rejection details survive merge/export without changing legacy aggregation", () => {
  const base = createSessionTelemetry({ requestId: "modern", turnId: "turn", phase: "intake", startedAt: "2026-10-14T00:00:00Z" });
  const client = mergeSessionTelemetry(base, { latency_ms: { user_to_first_token: 800 } });
  const usage = { input_tokens: 10, cached_input_tokens: null, cache_write_tokens: null, output_tokens: 2, reasoning_tokens: null, total_tokens: 12 };
  const grounding = {
    primary: { status: "completed", call_id: "primary", duration_ms: 20, model: "gpt-5.6-luna", provider_status: "completed", application_status: "accepted", failure_reason: null, skipped_reason: null, usage },
    rescue: { status: "failed", call_id: "rescue", duration_ms: 30, model: "gpt-5.6-luna", provider_status: "completed", application_status: "rejected_invalid_output", failure_reason: "grounding_contract_validation_failure", skipped_reason: null, usage },
    counts: { submitted: 2, primary_accepted: 1, primary_explicit_rejected: 1, primary_unresolved: 0, rescue_submitted: 1, rescue_accepted: 0, final_accepted: 1 },
  };
  const telemetry = mergeSessionTelemetry(client, {
    stages: [{ name: "extract", status: "completed", duration_ms: 10 }, { name: "grounding", status: "completed", duration_ms: 50 }],
    latency_ms: { user_to_first_token: null }, grounding,
    controller: { mode: "llm_fallback", fallback_reason: "controller_contract_validation_failure", rejection_reason: "nav_option_mismatch" },
  });
  const data = buildSessionExport({
    session: { id: "modern", startedAt: base.started_at, phase: "intake", communicationProfile: "colleague", activePanel: null, appVersion: "test", coreVersion: "test", coreReleaseId: "test", runtimeWrapper: "test" },
    messages: [], notepad: emptyNotepad, analysis: null, output: null, telemetry: [telemetry],
  });
  const serialized = JSON.parse(JSON.stringify(data));
  assert.equal(serialized.schema_version, "1.0");
  assert.deepEqual(serialized.telemetry[0].grounding, grounding);
  assert.deepEqual(serialized.telemetry[0].controller, telemetry.controller);
  assert.equal(serialized.telemetry[0].path, "extract-grounding");
  assert.equal(serialized.telemetry[0].latency_ms.user_to_first_token, 800);
  assert.equal(serialized.summary_metrics.requests, 1);
  assert.equal(serialized.summary_metrics.median_user_to_first_token_ms, 800);
});
