import { createTelemetryClient, type ClientOptions } from "./client.ts";
import { createActivityClock, type ActivityInterval } from "./activity-clock.ts";
import type { ErrorClass, Operation, Phase } from "./contract.ts";
export type PilotAvailability = { enabled: false } | { enabled: true; noticeVersion: string; noticeText: string };
export type OperationOutcome = "accepted" | "failed" | "stale_discarded" | "cancelled" | "local_noop";
export type PilotOperation = { isCurrent: () => boolean; transition: (next: Phase, reason: "user_navigation" | "controller_instruction" | "return") => void; headers: () => Record<string, string> | Promise<Record<string, string>>; resolve: (outcome: OperationOutcome, error?: ErrorClass) => void };
export function createPilot(options: ClientOptions & { wall?: () => number } = {}) {
  const client = createTelemetryClient(options), activity = createActivityClock(), civil = options.wall ?? Date.now;
  let consent = false, generation = 0, epoch = 0, phase: Phase = "F1", workflow: string | null = null;
  let pendingInteraction = false;
  let pending: Promise<boolean> | null = null, visible = false, focused = false;
  let started = new Set<string>(), documents = new Set<symbol>();
  const lastOperations = new Map<Operation, string>();
  const ignored: PilotOperation = { isCurrent: () => false, transition(next) { phase = next; }, headers: () => ({}), resolve() {} };
  const enabled = () => options.enabled === true && consent;
  function emitIntervals(intervals: ActivityInterval[]) {
    for (const interval of intervals) client.emit("activity_interval", workflow, interval);
  }
  function elapsed() { return client.timing()?.elapsed_ms ?? 0; }
  function startSession() {
    if (pending) return pending;
    const g = generation;
    pending = client.optIn().then(ok => {
      if (g !== generation) return false;
      if (ok) { activity.reset(phase); activity.view(elapsed(), civil(), visible, focused); if (pendingInteraction) activity.interaction(elapsed(), civil()); pendingInteraction = false; }
      return ok;
    }).catch(() => false).finally(() => { if (g === generation) pending = null; });
    return pending;
  }
  function ensureSession() {
    if (!enabled()) return;
    if (!client.status().active) void startSession();
  }
  async function ready() {
    if (!pending) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { await Promise.race([pending, new Promise<void>(resolve => { timer = setTimeout(resolve, 100); })]); }
    finally { if (timer) clearTimeout(timer); }
  }
  function ensureWorkflow() {
    if (!enabled()) return null;
    ensureSession();
    if (!workflow) workflow = crypto.randomUUID();
    if (!started.has(workflow) && client.status().active && client.emit("workflow_started", workflow, { phase })) started.add(workflow);
    return workflow;
  }
  function closeLocal() {
    generation++; consent = false; pending = null; pendingInteraction = false; activity.reset(); workflow = null;
    started = new Set(); documents = new Set(); lastOperations.clear(); epoch++;
  }
  function transition(next: Phase, reason: "user_navigation" | "controller_instruction" | "return") {
    if (next === phase) return;
    if (enabled()) {
      const wf = ensureWorkflow(); emitIntervals(activity.phase(elapsed(), civil(), next));
      if (wf) client.emit("phase_transition", wf, { from: phase, to: next, reason });
    }
    phase = next;
  }
  return {
    async optIn() { if (options.enabled !== true) return false; consent = true; return startSession(); },
    async stop() { closeLocal(); await client.stop(); },
    uncertain() { closeLocal(); client.identityUncertain(); },
    /** Browser listener and supported app-action entrypoint; never a timer heartbeat. */
    interaction() {
      if (!enabled()) return;
      const wasActive = client.status().active;
      if (wasActive && !client.interaction()) { activity.reset(); pendingInteraction = true; ensureSession(); return; }
      if (!wasActive) pendingInteraction = true;
      ensureSession();
      if (client.status().active) emitIntervals(activity.interaction(elapsed(), civil()));
    },
    view(isVisible: boolean, isFocused: boolean) {
      visible = isVisible; focused = isFocused;
      if (enabled() && client.status().active) emitIntervals(activity.view(elapsed(), civil(), visible, focused));
    },
    tick() { if (enabled() && client.status().active) emitIntervals(activity.tick(elapsed(), civil())); },
    meaningful() { if (enabled()) { this.interaction(); ensureWorkflow(); } },
    transition,
    begin(operation: Operation, reason: "initial" | "retry" | "regenerate" = "initial"): PilotOperation {
      if (!enabled()) return ignored;
      // Authorized requests extend a visit, independently of the visible/focused activity proxy.
      if (client.status().active && !client.interaction()) activity.reset();
      ensureSession(); const wf = ensureWorkflow(); if (!wf) return ignored;
      const id = crypto.randomUUID(), g = generation, operationEpoch = epoch;
      const phaseAtStart = phase;
      const prior = reason === "initial" ? null : lastOperations.get(operation) ?? null;
      lastOperations.set(operation, id);
      let emitted = false, finished = false, session: string | null = null;
      function intent() {
        if (emitted || g !== generation || !enabled() || !client.status().active) return;
        if (!started.has(wf!) && client.emit("workflow_started", wf, { phase: phaseAtStart })) started.add(wf!);
        emitted = client.emit("operation_requested", wf, { operation_instance_id: id, operation, reason, prior_operation_id: prior });
        session = client.timing()?.session_id ?? null;
      }
      intent();
      const isCurrent = () => g === generation && operationEpoch === epoch && enabled() && emitted && session === client.timing()?.session_id;
      return {
        isCurrent,
        transition(next, reason) { if (isCurrent()) transition(next, reason); else phase = next; },
        headers() {
          const capture = () => {
          intent();
          if (!emitted || g !== generation || session !== client.timing()?.session_id) return {};
          const headers = client.operationHeaders(wf, id);
          // A supported request also advances the visit inactivity clock; no activity interval is fabricated.
          client.interaction(); void client.flush(); return headers;
          };
          return pending ? ready().then(capture) : capture();
        },
        resolve(outcome, error) {
          if (finished) return; finished = true;
          if (!emitted || g !== generation || session !== client.timing()?.session_id) return;
          client.emit("operation_resolved", wf, { operation_instance_id: id,
            outcome: operationEpoch === epoch ? outcome : "stale_discarded", ...(error ? { error_class: error } : {}) });
        },
      };
    },
    document(key: symbol, representation: "baseline" | "generated") {
      if (!enabled() || phase !== "F3" || documents.has(key)) return;
      const wf = ensureWorkflow();
      if (wf && client.emit("document_accepted", wf, { output_id: crypto.randomUUID(), representation })) documents.add(key);
    },
    reset() {
      if (enabled()) {
        emitIntervals(activity.tick(elapsed(), civil()));
        if (workflow) client.emit("workflow_reset", workflow, { reason: "reset" });
      }
      epoch++; workflow = null; started = new Set(); documents = new Set(); lastOperations.clear(); phase = "F1"; activity.reset("F1");
    },
    flush: (keepalive = false) => client.flush(keepalive),
    status: client.status,
  };
}
export type Pilot = ReturnType<typeof createPilot>;
