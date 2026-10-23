import { check, integer, LIMITS, MEASUREMENT_VERSION, object, uuid, validateClientEvent,
  type ClientEvent, type EventName, type Health, type Payloads } from "./contract.ts";
type Context = { context: string; session_id: string; tab_id: string; server_anchor_ms: number; expires_at: number;
  measurement_version: string; metadata_enabled: boolean };
export type ClientOptions = {
  enabled?: boolean; eligible?: boolean; noticeVersion?: string;
  fetcher?: typeof fetch; monotonic?: () => number; random?: () => number;
};
type Queued = { event: ClientEvent; queued: number; attempts: number; next: number };
/** No listeners, timers, IDs, requests or storage access until explicit per-visit opt-in. B2 owns instrumentation. */
export function createTelemetryClient(options: ClientOptions = {}) {
  const transport = options.fetcher ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const clock = options.monotonic ?? (() => performance.now());
  let eligible = options.eligible === true, consent = false, generation = 0;
  let context: Context | null = null, anchor = 0, sequence = 0, lastInteraction = 0;
  let queue: Queued[] = [], timer: ReturnType<typeof setInterval> | undefined, flushing = false;
  let health: Health = "disabled", dropped = 0;
  const controllers = new Set<AbortController>();
  function clear() {
    generation++; consent = false; context = null; queue = []; sequence = 0; flushing = false;
    if (timer) clearInterval(timer); timer = undefined;
    for (const controller of controllers) controller.abort(); controllers.clear();
  }
  async function send(path: string, body: unknown, keepalive = false) {
    const controller = new AbortController(); controllers.add(controller);
    try { return await transport(path, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: controller.signal, keepalive }); }
    finally { controllers.delete(controller); }
  }
  const active = () => options.enabled === true && eligible && consent && context !== null;
  function elapsed() { return Math.floor(clock() - anchor); }
  function expire() {
    const now = clock();
    const before = queue.length; queue = queue.filter(q => now - q.queued <= LIMITS.delayMs);
    dropped += before - queue.length; if (before !== queue.length) health = "queue_dropped";
  }
  async function flush(keepalive = false) {
    if (!active() || flushing) return;
    expire(); const now = clock(), current = context!, g = generation;
    const batch = queue.filter(q => q.next <= now).slice(0, LIMITS.batch);
    if (!batch.length) return;
    flushing = true;
    try {
      const response = await send("/api/telemetry/events", { context: current.context, events: batch.map(q => q.event), sent_elapsed_ms: elapsed() }, keepalive);
      if (g !== generation) return;
      if (response.ok) {
        const body: unknown = await response.json();
        if (!object(body) || body.code !== "ready" || !Array.isArray(body.acknowledged) ||
          !batch.every(q => (body.acknowledged as unknown[]).includes(q.event.event_id))) {
          clear(); health = "unavailable"; return;
        }
        queue = queue.filter(q => !batch.includes(q)); health = "ready";
      } else if (response.status === 429 || response.status >= 500) retry(batch, response.status === 429 ? 60000 : 500);
      else { clear(); health = response.status === 401 ? "unauthorized" : "invalid_event"; }
    } catch { if (g === generation) retry(batch, 500); }
    finally { if (g === generation) flushing = false; }
  }
  function retry(batch: Queued[], delay: number) {
    for (const q of batch) {
      q.attempts++;
      q.next = clock() + delay * q.attempts + Math.floor((options.random ?? Math.random)() * 250);
      if (q.attempts > 2) { queue = queue.filter(candidate => candidate !== q); dropped++; }
    }
    expire(); health = "unavailable";
  }
  async function stop(revoke = true) {
    const token = context?.context; clear(); health = "stopped";
    // Control-only revocation. No queued event is flushed after withdrawal.
    if (revoke && token) { try { await send("/api/telemetry/context", { action: "stop", context: token }, true); } catch { /* best effort */ } }
  }
  return {
    async optIn() {
      if (options.enabled !== true || !eligible || !options.noticeVersion) { health = "disabled"; return false; }
      clear(); consent = true; const g = generation, sent = clock(), tab_id = crypto.randomUUID();
      try {
        const response = await send("/api/telemetry/context", { action: "start", opt_in: true, notice_version: options.noticeVersion, tab_id });
        const body: unknown = await response.json();
        if (g !== generation) return false;
        check(response.ok && object(body) && body.code === "ready" && typeof body.context === "string" && body.context.length <= 1024 &&
          uuid(body.session_id) && body.tab_id === tab_id && integer(body.server_anchor_ms) && integer(body.expires_at) &&
          body.expires_at > body.server_anchor_ms && body.measurement_version === MEASUREMENT_VERSION && typeof body.metadata_enabled === "boolean" &&
          clock() - sent <= 5000, "invalid_context");
        context = body as Context; anchor = sent; lastInteraction = 0; health = "ready";
        timer = setInterval(() => { void flush(); }, LIMITS.intervalMs); return true;
      } catch { if (g === generation) { clear(); health = "unavailable"; } return false; }
    },
    async refuse() { await stop(); health = "consent_required"; },
    stop,
    identityUncertain() { clear(); health = "unauthorized"; },
    setEligible(value: boolean) { eligible = value; if (!value) { clear(); health = "ineligible"; } },
    /** A real interaction, never a heartbeat. false asks B2 to renew the visit with opt-in. */
    interaction() {
      if (!active()) return false;
      const t = elapsed();
      if (t < 0 || t >= LIMITS.lifetimeMs || t - lastInteraction >= LIMITS.idleMs) { clear(); health = "invalid_context"; return false; }
      lastInteraction = t; return true;
    },
    emit<N extends EventName>(event_name: N, workflow_id: string | null, payload: Payloads[N]) {
      if (!active()) return false;
      const t = elapsed();
      if (t < 0 || t >= LIMITS.lifetimeMs || t - lastInteraction >= LIMITS.idleMs) { clear(); health = "invalid_context"; return false; }
      try {
        const event = validateClientEvent({ schema_version: 1, measurement_version: MEASUREMENT_VERSION, source: "client", event_id: crypto.randomUUID(),
          event_name, workflow_id, payload, session_id: context!.session_id, tab_id: context!.tab_id, client_seq: sequence, elapsed_ms: t }, context!.metadata_enabled);
        sequence++; expire();
        if (queue.length >= LIMITS.queue) { queue.shift(); dropped++; health = "queue_dropped"; }
        // Snapshot caller data: mutations after enqueue cannot alter retry identity.
        queue.push({ event: structuredClone(event), queued: clock(), attempts: 0, next: clock() });
        return true;
      } catch { health = "invalid_event"; return false; }
    },
    flush,
    operationHeaders(workflow: string | null, operation: string | null): Record<string, string> {
      if (!active() || !uuid(workflow) || !uuid(operation)) return {};
      if (elapsed() - lastInteraction >= LIMITS.idleMs || elapsed() >= LIMITS.lifetimeMs) { clear(); health = "invalid_context"; return {}; }
      return { "x-apu-telemetry-context": context!.context, "x-apu-telemetry-workflow": workflow, "x-apu-telemetry-operation": operation };
    },
    status: () => ({ code: health, queued: queue.length, dropped, active: active() }),
  };
}
