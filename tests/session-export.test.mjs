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
