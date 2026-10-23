import { readFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { civilDate, isoWeek, midnight, nextDate, splitDays, union, TIMEZONE, type Interval } from "./time.ts";

export const METRIC_VERSION = "pilot-report-v1";
export type Cell = string | number | boolean | null;
export type Row = Record<string, Cell>;
type Source = Record<string, string | number | null>;
export type ReportOptions = { cohort: string; from: string; to: string; asOf: number; retainedSince: number;
  testClass?: "tester" | "developer" | "synthetic"; linkage?: boolean };
const DAY = 86400000, n = (r: Source, key: string) => Number(r[key] ?? 0), text = (r: Source, key: string) => String(r[key] ?? "");
const sql = (name: string) => readFileSync(new URL(`./${name}.sql`, import.meta.url), "utf8");
const scope = sql("scope");
const statements = Object.fromEntries(["sessions", "workflows", "calls", "events"].map(name => [name, scope + sql(name)]));
export const REPORT_SQL = statements;
export function validateOptions(o: ReportOptions) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(o.cohort) || !["tester", "developer", "synthetic"].includes(o.testClass ?? "tester")) throw Error("invalid_filter");
  const from = midnight(o.from), to = midnight(o.to);
  if (![o.asOf, o.retainedSince].every(v => Number.isSafeInteger(v) && v >= 0) || !(o.retainedSince <= from && from < to && to <= o.asOf) ||
    o.asOf - o.retainedSince > 31 * DAY) throw Error("invalid_window");
  return { cohort: o.cohort, test_class: o.testClass ?? "tester", from, to, as_of: o.asOf, retained_since: o.retainedSince };
}
function sum(rows: Source[], field: string) { const value = rows.reduce((a, r) => a + n(r, field), 0); if (!Number.isSafeInteger(value)) throw Error("unsafe_aggregate"); return value; }
function median(values: number[]) { if (!values.length) return null; const v = [...values].sort((a, b) => a - b), mid = Math.floor(v.length / 2); return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2; }
const ratio = (a: number, b: number) => b ? a / b : null;
function cost(calls: Source[]) {
  const known = sum(calls, "cost_nano_usd"), unknown = calls.filter(c => c.cost_nano_usd === null).length;
  return { ai_count: calls.length, known_cost_nano_usd: known, unknown_cost_count: unknown, complete_cost_nano_usd: unknown ? null : known };
}
function group<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>(); for (const r of rows) { const k = key(r); if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(r); } return groups;
}
const participant = (r: Source) => `${text(r, "key_version")}:${text(r, "participant_id")}`;
const episode = (r: Source) => `${participant(r)}:${text(r, "workflow_id")}`;
const byTime = (a: Source, b: Source) => n(a, "occurred_at") - n(b, "occurred_at") || n(a, "client_seq") - n(b, "client_seq") || text(a, "event_id").localeCompare(text(b, "event_id"));

/** Local read-only analysis. SQL preaggregates each many-side before joins; no pricing authority here. */
export function createReport(db: DatabaseSync, options: ReportOptions) {
  const p = validateOptions(options), params = { cohort: p.cohort, test_class: p.test_class, to: p.to, as_of: p.as_of, retained_since: p.retained_since };
  const load = (name: string, limit: number): Source[] => {
    const rows = db.prepare(statements[name]).all(params) as Source[];
    if (rows.length > limit) throw Error("report_limit_exceeded"); return rows;
  };
  // One SQLite snapshot across all four reads, even while an operator's local copy is being updated.
  db.exec("BEGIN");
  let sessions: Source[], workflows: Source[], calls: Source[], events: Source[];
  try { sessions = load("sessions", 10000); workflows = load("workflows", 20000); calls = load("calls", 100000); events = load("events", 600000); db.exec("COMMIT"); }
  catch (error) { db.exec("ROLLBACK"); throw error; }
  const inWindow = (ms: number) => ms >= p.from && ms < p.to;
  const callsBySession = group(calls, c => text(c, "session_id")), eventsBySession = group(events, e => text(e, "session_id"));
  const callsByWorkflow = group(calls.filter(c => c.workflow_id !== null), episode), eventsByWorkflow = group(events.filter(e => e.workflow_id !== null), episode);
  const operationKey = (r: Source) => `${episode(r)}:${text(r, "operation_instance_id")}`;
  const callsByOperation = group(calls, operationKey), outcomesByOperation = group(events.filter(e => e.event_name === "operation_resolved"), operationKey);
  const sessionsById = new Map(sessions.map(s => [s.session_id, s]));
  const observedIntervals = events.filter(e => e.event_name === "activity_interval").flatMap(e => {
    const start = Math.max(p.retained_since, n(e, "opened_at") + n(e, "start_ms")), end = Math.min(p.as_of, n(e, "opened_at") + n(e, "end_ms"));
    return end > start ? [{ e, start, end }] : [];
  });
  const intervals = observedIntervals.flatMap(i => { const start = Math.max(p.from, i.start), end = Math.min(p.to, i.end); return end > start ? [{ ...i, start, end }] : []; });
  const sessionIntervals = group(observedIntervals, i => text(i.e, "session_id"));
  const activeMs = (id: string) => union((sessionIntervals.get(id) ?? []).map(i => [i.start, i.end]));
  const intents = [...group(events.filter(e => e.event_name === "operation_requested"), e => `${episode(e)}:${text(e, "operation_instance_id")}`).values()].map(rows => rows.sort(byTime)[0]);
  const missingIntents = intents.filter(e => e.operation !== "f2_local_reconciliation" && !callsByOperation.has(operationKey(e)));
  const missingBySession = group(missingIntents, e => text(e, "session_id")), missingByWorkflow = group(missingIntents, episode);
  const sessionRows: Row[] = sessions.filter(s => inWindow(n(s, "opened_at"))).map(s => {
    const id = text(s, "session_id"), ai = callsBySession.get(id) ?? [], ev = eventsBySession.get(id) ?? [];
    const totals = cost(ai), active = activeMs(id), qualified = active > 0 || ai.length > 0;
    const last = Math.max(n(s, "opened_at"), n(s, "last_interaction_at"), ...ev.map(e => n(e, "occurred_at")), ...ai.map(c => Math.min(p.as_of, Math.max(n(c, "started_at"), n(c, "completed_at")))));
    const mature = p.as_of - last >= DAY, missing = (missingBySession.get(id) ?? []).length;
    const complete = qualified && totals.unknown_cost_count === 0 && missing === 0 && n(s, "sequence_gaps") === 0;
    if (totals.known_cost_nano_usd !== n(s, "known_cost_nano_usd") || totals.ai_count !== n(s, "ai_count")) throw Error("sql_reconciliation_failed");
    return { session_id: id, participant_id: text(s, "participant_id"), key_version: text(s, "key_version"), opened_at: n(s, "opened_at"),
      qualified, mature, stopped: s.stopped_at !== null, active_ms: active, ...totals,
      complete_cost_nano_usd: complete ? totals.known_cost_nano_usd : null, uncovered_intents: missing,
      event_count: n(s, "event_count"), sequence_gaps: n(s, "sequence_gaps"), last_observed_at: last };
  });
  const workflowRows: Row[] = workflows.map(w => {
    const key = episode(w), ai = callsByWorkflow.get(key) ?? [], ev = eventsByWorkflow.get(key) ?? [];
    const start = ev.find(e => e.event_name === "workflow_started"), reset = ev.find(e => e.event_name === "workflow_reset");
    const docs = [...group(ev.filter(e => e.event_name === "document_accepted" && (!reset || byTime(e, reset) < 0)), e => text(e, "output_id")).values()].map(v => v.sort(byTime)[0]).sort(byTime);
    const first = docs[0], last = Math.max(n(w, "started_at"), ...ev.map(e => n(e, "occurred_at")), ...ai.map(c => Math.min(p.as_of, Math.max(n(c, "started_at"), n(c, "completed_at")))));
    const owners = [...new Set([...ev, ...ai].map(e => text(e, "session_id")))].map(id => sessionsById.get(id)!);
    const left = !start || n(start, "occurred_at") < p.from || owners.some(s => n(s, "opened_at") < p.retained_since);
    const status = left ? "left_truncated" : first ? "completed" : reset ? "reset" : p.as_of - last >= DAY ? "unfinished_observed" : "right_censored";
    const totals = cost(ai), missing = (missingByWorkflow.get(key) ?? []).length;
    const gaps = owners.some(s => n(s, "sequence_gaps") > 0);
    const complete = !left && !gaps && !missing && totals.unknown_cost_count === 0;
    const before = first ? ai.filter(c => n(c, "started_at") <= n(first, "occurred_at")) : [];
    const firstUnknown = first ? before.filter(c => c.cost_nano_usd === null || c.state !== "final" || n(c, "completed_at") > n(first, "occurred_at")).length : 0;
    const firstKnown = sum(before.filter(c => c.cost_nano_usd !== null && c.state === "final" && n(c, "completed_at") <= n(first!, "occurred_at")), "cost_nano_usd");
    const firstMissing = first ? (missingByWorkflow.get(key) ?? []).filter(e => byTime(e, first) <= 0).length : 0;
    if (totals.known_cost_nano_usd !== n(w, "known_cost_nano_usd") || totals.ai_count !== n(w, "ai_count")) throw Error("sql_reconciliation_failed");
    const transitions = ev.filter(e => e.event_name === "phase_transition"), path = start ? [text(start, "phase")] : ["unknown"];
    let repeated = 0, backwards = 0; const seen = new Set(path);
    for (const e of transitions) { const to = text(e, "to_phase"); if (seen.has(to)) repeated++; seen.add(to); path.push(to); if (to < text(e, "from_phase")) backwards++; }
    return { workflow_id: text(w, "workflow_id"), participant_id: text(w, "participant_id"), key_version: text(w, "key_version"),
      started_at: start ? n(start, "occurred_at") : null, last_observed_at: last, status, mature: !["right_censored", "left_truncated"].includes(status),
      ...totals, complete_cost_nano_usd: complete ? totals.known_cost_nano_usd : null,
      first_completion_at: first ? n(first, "occurred_at") : null, first_completion_known_nano_usd: first ? firstKnown : null,
      first_completion_cost_nano_usd: first && !left && !gaps && firstMissing === 0 && firstUnknown === 0 ? firstKnown : null,
      first_completion_unknown_count: first ? firstUnknown : null,
      output_count: docs.length, baseline_outputs: docs.filter(e => e.representation === "baseline").length, generated_outputs: docs.filter(e => e.representation === "generated").length,
      phase_path: path.join(">"), repeated_phase_entries: repeated, backward_transitions: backwards, uncovered_intents: missing, sequence_gap: gaps,
      observed_in_window: ev.some(e => inWindow(n(e, "occurred_at"))) || ai.some(c => inWindow(n(c, "started_at"))) };
  }).filter(w => w.observed_in_window);
  const periodCalls = calls.filter(c => inWindow(n(c, "started_at")));
  const phaseRows: Row[] = [...group(intervals, i => `${text(i.e, "session_id")}:${text(i.e, "phase")}`).values()].map(v => ({ session_id: text(v[0].e, "session_id"), phase: text(v[0].e, "phase") || "unknown", active_ms: union(v.map(i => [i.start, i.end])) }));
  const transitionRows: Row[] = [...group(events.filter(e => e.event_name === "phase_transition" && inWindow(n(e, "occurred_at"))), e => `${text(e, "from_phase")}>${text(e, "to_phase")}`).values()].map(v => ({ from: text(v[0], "from_phase"), to: text(v[0], "to_phase"), count: v.length }));
  const operationRows: Row[] = [...group(intents.filter(e => inWindow(n(e, "occurred_at"))), e => `${text(e, "operation")}:${text(e, "reason")}`).values()].map(v => {
    const opCalls = v.flatMap(e => callsByOperation.get(operationKey(e)) ?? []);
    const outcomes = v.flatMap(e => outcomesByOperation.get(operationKey(e)) ?? []);
    return { operation: text(v[0], "operation"), reason: text(v[0], "reason"), intents: v.length, resolved: new Set(outcomes.map(e => e.operation_instance_id)).size,
      failed: new Set(outcomes.filter(e => e.outcome === "failed").map(e => e.operation_instance_id)).size,
      stale_discarded: new Set(outcomes.filter(e => e.outcome === "stale_discarded").map(e => e.operation_instance_id)).size, ...cost(opCalls) };
  });
  const modelRows: Row[] = [...group(periodCalls, c => [c.requested_model, c.reported_model, c.operation, c.phase, c.pricing_version].join(":" )).values()].map(v => ({
    requested_model: text(v[0], "requested_model"), reported_model: v[0].reported_model, operation: text(v[0], "operation"), phase: text(v[0], "phase"), pricing_version: text(v[0], "pricing_version"), ...cost(v) }));
  const participantDays = new Map<string, { participant_id: string; key_version: string; date: string; intervals: Interval[]; ai: Source[] }>();
  function dayRow(r: Source, date: string) {
    const key = `${participant(r)}:${date}`; if (!participantDays.has(key)) participantDays.set(key, { participant_id: text(r, "participant_id"), key_version: text(r, "key_version"), date, intervals: [], ai: [] });
    return participantDays.get(key)!;
  }
  for (const i of intervals) for (const part of splitDays(i.start, i.end)) dayRow(i.e, part.date).intervals.push(part.interval);
  for (const c of periodCalls) dayRow(c, civilDate(n(c, "started_at"))).ai.push(c);
  const daily = [...participantDays.values()];
  const dailyByParticipant = group(daily, d => `${d.key_version}:${d.participant_id}`);
  const participantOwners = new Map([...daily, ...sessionRows.filter(s => s.qualified)].map(r => [`${r.key_version}:${r.participant_id}`, { participant_id: String(r.participant_id), key_version: String(r.key_version) }]));
  const participantRows: Row[] = options.linkage ? [...participantOwners.entries()].map(([key, owner]) => {
    const v = dailyByParticipant.get(key) ?? [];
    const qualified = sessionRows.filter(s => s.qualified && s.participant_id === owner.participant_id && s.key_version === owner.key_version).sort((a, b) => Number(a.opened_at) - Number(b.opened_at));
    const starts = qualified.map(s => Number(s.opened_at)), gaps = starts.slice(1).map((s, i) => s - starts[i]);
    return { ...owner, sessions: qualified.length, active_days: v.length, act_only_days: v.filter(d => d.intervals.length).length,
      active_ms: v.reduce((a, d) => a + union(d.intervals), 0), returning: qualified.length >= 2, return_day: v.length >= 2,
      additional_same_day_visits: qualified.length - new Set(starts.map(civilDate)).size, intervisit_gap_count: gaps.length, intervisit_mean_ms: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null,
      intervisit_median_ms: median(gaps), ...cost(v.flatMap(d => d.ai)) };
  }) : [];
  const days: Row[] = [];
  for (let date = options.from; midnight(date) < p.to;) {
    const d = daily.filter(d => d.date === date), s = sessionRows.filter(s => civilDate(Number(s.opened_at)) === date), ai = periodCalls.filter(c => civilDate(n(c, "started_at")) === date);
    days.push({ date, week: isoWeek(date), sessions: s.filter(s => s.qualified).length, context_only: s.filter(s => !s.qualified).length,
      participants: options.linkage ? d.length : null, active_ms: options.linkage ? d.reduce((a, d) => a + union(d.intervals), 0) : null, ...cost(ai) });
    date = nextDate(date);
  }
  const weeks: Row[] = [...group(days, d => String(d.week)).values()].map(v => {
    const dates = new Set(v.map(d => d.date)), d = daily.filter(d => dates.has(d.date));
    return { week: v[0].week, sessions: v.reduce((a, d) => a + Number(d.sessions), 0), context_only: v.reduce((a, d) => a + Number(d.context_only), 0),
      participants: options.linkage ? new Set(d.map(d => `${d.key_version}:${d.participant_id}`)).size : null,
      active_ms: options.linkage ? d.reduce((a, d) => a + union(d.intervals), 0) : null, ...cost(d.flatMap(d => d.ai)) };
  });
  const matureSessions = sessionRows.filter(s => s.mature && s.qualified), eligible = matureSessions.filter(s => s.complete_cost_nano_usd !== null), aiEligible = eligible.filter(s => Number(s.ai_count) > 0);
  const mature = workflowRows.filter(w => w.mature), completed = mature.filter(w => w.status === "completed"), completedCosts = completed.filter(w => w.first_completion_cost_nano_usd !== null);
  const knownMature = mature.reduce((a, w) => a + Number(w.known_cost_nano_usd), 0), outputCount = mature.reduce((a, w) => a + Number(w.output_count), 0);
  const meanPrice = (rows: Row[], field: string) => ratio(rows.reduce((a, r) => a + Number(r[field]), 0), rows.length);
  const total = cost(periodCalls);
  const quality: Row = { observed_sessions: sessionRows.length, observed_events: events.filter(e => inWindow(n(e, "occurred_at"))).length,
    observed_ai_calls: periodCalls.length, pending_calls: periodCalls.filter(c => c.state === "pending").length,
    unresolved_over_15m: periodCalls.filter(c => c.state === "pending" && p.as_of - n(c, "started_at") > 900000).length,
    unknown_cost_calls: total.unknown_cost_count, unlinked_workflow_calls: periodCalls.filter(c => c.workflow_id === null).length,
    unlinked_operation_calls: periodCalls.filter(c => c.operation_instance_id === null).length,
    sequence_gaps: sum(sessions, "sequence_gaps"), uncovered_ai_intents: missingIntents.filter(e => inWindow(n(e, "occurred_at"))).length,
    delayed_events: events.filter(e => n(e, "received_at") - n(e, "occurred_at") > 120000).length,
    drift_events: events.filter(e => n(e, "occurred_at") - n(e, "received_at") > 5000).length,
    expected_live_calls: null, expected_live_events: null, live_loss_rate: null };
  for (const field of ["input_tokens", "output_tokens", "cached_input_tokens", "cache_write_tokens"]) { quality[field] = sum(periodCalls, field); quality[`${field}_missing`] = periodCalls.filter(c => c[field] === null).length; }
  const participants = participantOwners.size;
  const summary: Row = { ...total, qualified_sessions: sessionRows.filter(s => s.qualified).length, context_only_sessions: sessionRows.filter(s => !s.qualified).length,
    observed_participants: options.linkage ? participants : null, mature_active_sessions: matureSessions.length,
    complete_ai_sessions_n: aiEligible.length, incomplete_mature_sessions: matureSessions.filter(s => s.complete_cost_nano_usd === null).length,
    complete_active_sessions_n: eligible.length, mean_ai_session_usd: meanPrice(aiEligible, "complete_cost_nano_usd") === null ? null : meanPrice(aiEligible, "complete_cost_nano_usd")! / 1e9,
    median_ai_session_usd: median(aiEligible.map(s => Number(s.complete_cost_nano_usd))) === null ? null : median(aiEligible.map(s => Number(s.complete_cost_nano_usd)))! / 1e9,
    mean_all_active_session_usd: meanPrice(eligible, "complete_cost_nano_usd") === null ? null : meanPrice(eligible, "complete_cost_nano_usd")! / 1e9,
    median_all_active_session_usd: median(eligible.map(s => Number(s.complete_cost_nano_usd))) === null ? null : median(eligible.map(s => Number(s.complete_cost_nano_usd)))! / 1e9,
    workflows_observed: workflowRows.length, workflows_mature: mature.length, workflows_completed: completed.length,
    workflows_reset: mature.filter(w => w.status === "reset").length, workflows_unfinished: mature.filter(w => w.status === "unfinished_observed").length,
    workflows_censored: workflowRows.filter(w => w.status === "right_censored").length, workflows_left_truncated: workflowRows.filter(w => w.status === "left_truncated").length,
    mature_conversion: ratio(completed.length, mature.length), outputs: outputCount, mature_known_cost_nano_usd: knownMature,
    mature_cost_incomplete: mature.some(w => w.complete_cost_nano_usd === null), cost_per_completed_workflow_usd: ratio(knownMature, completed.length) === null ? null : knownMature / completed.length / 1e9,
    cost_per_output_usd: outputCount ? knownMature / outputCount / 1e9 : null, first_completion_complete_n: completedCosts.length,
    first_completion_incomplete_n: completed.length - completedCosts.length, first_completion_mean_usd: completedCosts.length ? meanPrice(completedCosts, "first_completion_cost_nano_usd")! / 1e9 : null,
    first_completion_median_usd: completedCosts.length ? median(completedCosts.map(w => Number(w.first_completion_cost_nano_usd)))! / 1e9 : null,
    failed_provider_calls: periodCalls.filter(c => c.state === "final" && ["failed", "incomplete", "transport_error"].includes(text(c, "provider_status"))).length,
    rejected_application_calls: periodCalls.filter(c => c.state === "final" && c.application_status === "rejected_invalid_output").length,
    retry_calls: periodCalls.filter(c => c.retry_of_call_id !== null).length, fallback_calls: periodCalls.filter(c => c.fallback_for_call_id !== null).length,
    user_retries: intents.filter(e => inWindow(n(e, "occurred_at")) && e.reason === "retry").length, user_regenerations: intents.filter(e => inWindow(n(e, "occurred_at")) && e.reason === "regenerate").length,
    returning_participants: options.linkage ? participantRows.filter(r => r.returning).length : null, return_day_participants: options.linkage ? participantRows.filter(r => r.return_day).length : null,
    returning_share: options.linkage ? ratio(participantRows.filter(r => r.returning).length, participants) : null,
    return_day_share: options.linkage ? ratio(participantRows.filter(r => r.return_day).length, participants) : null,
    participant_active_ms: options.linkage ? daily.reduce((a, d) => a + union(d.intervals), 0) : null };
  // Shared exports conservatively suppress the entire row if any behavioral partition or its complement has <5 participants.
  const sharedParticipants = new Set([...sessionRows, ...daily].map(r => `${r.key_version}:${r.participant_id}`)).size;
  const partitions = [sessionRows.filter(s => s.qualified), sessionRows.filter(s => !s.qualified), matureSessions, eligible, aiEligible, matureSessions.filter(s => s.complete_cost_nano_usd === null), completedCosts,
    periodCalls.filter(c => c.cost_nano_usd === null), periodCalls.filter(c => c.state === "pending"), periodCalls.filter(c => ["failed", "incomplete", "transport_error"].includes(text(c,"provider_status"))),
    ...["input_tokens", "output_tokens", "cached_input_tokens", "cache_write_tokens"].map(field => periodCalls.filter(c => c[field] === null)),
    ...["retry", "regenerate"].map(reason => intents.filter(e => e.reason === reason)),
    ...["completed", "reset", "unfinished_observed", "right_censored", "left_truncated"].map(status => workflowRows.filter(w => w.status === status)),
    ...[true, false].map(value => participantRows.filter(r => r.returning === value)), ...[true, false].map(value => participantRows.filter(r => r.return_day === value))];
  const smallCell = !options.linkage || sharedParticipants < 5 || partitions.some(rows => { const count = new Set(rows.map(r => `${r.key_version}:${r.participant_id}`)).size; return count > 0 && (count < 5 || (sharedParticipants - count > 0 && sharedParticipants - count < 5)); });
  return { metadata: { metric_version: METRIC_VERSION, schema_version: 1, measurement_version: "pilot-v1", timezone: TIMEZONE,
    cohort: p.cohort, test_class: p.test_class, from: options.from, to: options.to, as_of: new Date(p.as_of).toISOString(), retained_since: new Date(p.retained_since).toISOString(),
    participant_linkage: options.linkage ? "approved" : "unavailable", cost_scope: "observed_calls_only", active_time: "interaction_proxy" } satisfies Row,
    smallCell, rows: { summary: [summary], sessions: sessionRows, workflows: workflowRows, calls: periodCalls as Row[], models: modelRows,
      participants: participantRows, days, weeks, phases: phaseRows, transitions: transitionRows, operations: operationRows, quality: [quality] } };
}
export type PilotReport = ReturnType<typeof createReport>;
