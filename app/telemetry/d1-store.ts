import { canonical, check, LIMITS, TelemetryError, validateBatch, type StoredEvent } from "./contract.ts";
import { ownerOf, validateNewSession, type Owner, type Session, type TelemetryStore } from "./store.ts";
import type { AiCall } from "./model-usage-adapter.ts";
/** Structural subset shared by D1 and the SQLite emulator in tests. */
export interface SqlStatement {
  bind(...values: (string | number | null)[]): SqlStatement;
  first<T>(): Promise<T | null>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface TelemetryDatabase { prepare(sql: string): SqlStatement; batch(statements: SqlStatement[]): Promise<{ meta: { changes: number } }[]> }
const columns = "session_id,tab_id,participant_id,cohort_id,key_version,test_class,notice_version,measurement_version,opened_at,last_interaction_at,expires_at,stopped_at";
function failure(error: unknown): never {
  if (error instanceof TelemetryError) throw error;
  // Database exception text is inspected only, never logged or returned.
  const text = error instanceof Error ? error.message : "";
  throw new TelemetryError(text.includes("telemetry_conflict") ? "conflict" : text.includes("budget_count") ? "rate_limited" : text.includes("telemetry_inactive") ? "invalid_context" : "unavailable");
}
export class D1TelemetryStore implements TelemetryStore {
  constructor(private readonly db: TelemetryDatabase) {}
  async createSession(session: Session) {
    try {
      validateNewSession(session);
      const result = await this.db.prepare(`INSERT INTO telemetry_sessions (${columns}) SELECT ${Array(12).fill("?").join(",")}
        WHERE (SELECT count(*) FROM telemetry_sessions WHERE participant_id=? AND cohort_id=? AND opened_at>?) < 30`)
        .bind(...columns.split(",").map(k => session[k as keyof Session]), session.participant_id, session.cohort_id, session.opened_at - 3600000).run();
      check(result.meta.changes === 1, "rate_limited");
    } catch (error) { failure(error); }
  }
  async getSession(id: string) { return this.db.prepare(`SELECT ${columns} FROM telemetry_sessions WHERE session_id=?`).bind(id).first<Session>(); }
  private async owned(owner: Owner) {
    const session = await this.getSession(owner.session_id);
    check(session && canonical(ownerOf(session)) === canonical(owner), "invalid_context");
    return session;
  }
  async stopSession(owner: Owner, now: number) {
    await this.owned(owner);
    await this.db.prepare("UPDATE telemetry_sessions SET stopped_at=COALESCE(stopped_at,?) WHERE session_id=?").bind(now, owner.session_id).run();
  }
  async touchRequest(owner: Owner, now: number) {
    await this.owned(owner);
    const result = await this.db.prepare(`UPDATE telemetry_sessions SET last_interaction_at=MAX(last_interaction_at,?)
      WHERE session_id=? AND stopped_at IS NULL AND expires_at>? AND last_interaction_at>?`)
      .bind(now, owner.session_id, now, now - LIMITS.idleMs).run();
    check(result.meta.changes === 1, "invalid_context");
  }
  async ingest(owner: Owner, events: StoredEvent[], now: number) {
    try {
      const session = await this.owned(owner);
      check(session.stopped_at === null && now < session.expires_at && now - session.last_interaction_at < LIMITS.idleMs, "invalid_context");
      validateBatch(events.map(v => v.event), true); // privacy gate is enforced before storage
      let last = session.last_interaction_at;
      for (const { event, occurred_at, received_at, app_version } of events) {
        check(event.session_id === owner.session_id && event.tab_id === owner.tab_id && received_at === now &&
          occurred_at === session.opened_at + event.elapsed_ms && occurred_at <= now + 5000 && now - occurred_at <= LIMITS.delayMs && app_version === "unknown");
        if (event.event_name === "activity_interval") last = Math.max(last, session.opened_at + event.payload.last_interaction_ms);
        else if (["workflow_started", "phase_transition", "operation_requested", "workflow_reset"].includes(event.event_name)) last = Math.max(last, occurred_at);
      }
      const minute = Math.floor(now / 60000);
      const statements = [this.db.prepare(`UPDATE telemetry_sessions SET
        budget_count=CASE WHEN budget_minute=? THEN budget_count+? ELSE ? END,budget_minute=?,
        last_interaction_at=MAX(last_interaction_at,?) WHERE session_id=? AND stopped_at IS NULL AND expires_at>? AND last_interaction_at>?`)
        .bind(minute, events.length, events.length, minute, last, owner.session_id, now, now - LIMITS.idleMs)];
      for (const row of events) {
        const e = row.event;
        statements.push(this.db.prepare(`INSERT INTO telemetry_events
          (event_id,session_id,tab_id,client_seq,workflow_id,event_name,schema_version,measurement_version,occurred_at,received_at,app_version,event_json)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(event_id) DO NOTHING`)
          .bind(e.event_id, e.session_id, e.tab_id, e.client_seq, e.workflow_id, e.event_name, 1, e.measurement_version,
            row.occurred_at, now, "unknown", canonical(e)));
      }
      await this.db.batch(statements); // D1 batch is atomic; trigger conflict rolls back budget and all inserts
      return events.map(v => v.event.event_id);
    } catch (error) { return failure(error); }
  }
  async upsertAi(call: AiCall) {
    try {
      await this.owned(call.owner);
      const p = call.projection;
      await this.db.prepare(`INSERT INTO telemetry_ai_calls
        (call_id,session_id,workflow_id,started_at,state,identity_json,projection_json,cost_nano_usd) VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT(call_id) DO UPDATE SET state=excluded.state,projection_json=excluded.projection_json,cost_nano_usd=excluded.cost_nano_usd
        WHERE telemetry_ai_calls.state='pending' AND excluded.state='final'`)
        .bind(p.call_id, call.owner.session_id, p.workflow_id, p.started_at, p.state, canonical(call.identity), canonical(p), p.cost_nano_usd).run();
    } catch (error) { failure(error); }
  }
}
