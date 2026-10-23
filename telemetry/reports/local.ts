import { DatabaseSync } from "node:sqlite";
import { constants, lstatSync, realpathSync, readFileSync, writeFileSync, openSync, closeSync, unlinkSync } from "node:fs";
import { isAbsolute, dirname, basename } from "node:path";
import { digest } from "./csv.ts";
const token = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);
export type Target = { database: string; cohort: string; testClass: "tester" | "developer" | "synthetic"; mode: "local-test" | "operator-snapshot" };
/** A dedicated file + sidecar scope, never a remote DB name/URL, arbitrary business DB or symlink. */
export function openTarget(target: Target, mutate = false): DatabaseSync {
  if (!isAbsolute(target.database) || !/^telemetry-[A-Za-z0-9_-]+\.sqlite$/.test(basename(target.database)) || !token(target.cohort) ||
    !["tester", "developer", "synthetic"].includes(target.testClass) || !["local-test", "operator-snapshot"].includes(target.mode) ||
    (mutate && (target.mode !== "local-test" || target.testClass !== "synthetic"))) throw Error("invalid_local_target");
  if (!lstatSync(target.database).isFile() || lstatSync(target.database).isSymbolicLink() || realpathSync(target.database) !== target.database) throw Error("invalid_local_target");
  const manifest = JSON.parse(readFileSync(target.database + ".target.json", "utf8"));
  if (JSON.stringify(Object.keys(manifest).sort()) !== JSON.stringify(["cohorts", "kind", "mode", "schema_version", "test_class"].sort()) ||
    manifest.kind !== "apu-telemetry" || manifest.schema_version !== 1 || manifest.mode !== target.mode || manifest.test_class !== target.testClass ||
    !Array.isArray(manifest.cohorts) || !manifest.cohorts.length || !manifest.cohorts.every(token) || !manifest.cohorts.includes(target.cohort)) throw Error("target_manifest_mismatch");
  const db = new DatabaseSync(target.database, { readOnly: !mutate });
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name);
    if (JSON.stringify(tables) !== JSON.stringify(["telemetry_ai_calls", "telemetry_events", "telemetry_sessions"])) throw Error("not_telemetry_only");
    for (const [table, required] of [["telemetry_sessions", ["cohort_id", "participant_id", "test_class", "key_version"]], ["telemetry_events", ["event_json", "occurred_at", "session_id"]], ["telemetry_ai_calls", ["projection_json", "cost_nano_usd", "started_at", "session_id"]]] as const) {
      const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(r => r.name); if (required.some(c => !columns.includes(c))) throw Error("schema_mismatch");
    }
    db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=1000"); return db;
  } catch (error) { db.close(); throw error; }
}
export type DeleteRequest = { action: "retention"; asOf: number } | { action: "participant"; asOf: number; participant: string };
const queryScope = "SELECT session_id FROM telemetry_sessions WHERE cohort_id=? AND test_class=?";
export function deletionPlan(db: DatabaseSync, target: Target, request: DeleteRequest) {
  if (!Number.isSafeInteger(request.asOf) || request.asOf < 30 * 86400000 || !token(target.cohort)) throw Error("invalid_deletion_scope");
  if (request.action !== "retention" && request.action !== "participant") throw Error("invalid_deletion_scope");
  if (request.action === "participant" && !/^[A-Za-z0-9_-]{43}$/.test(request.participant)) throw Error("invalid_participant");
  const cutoff = request.asOf - 30 * 86400000, extra = request.action === "participant" ? " AND participant_id=?" : "";
  const scope = queryScope + extra, params = [target.cohort, target.testClass, ...(request.action === "participant" ? [request.participant] : [])];
  const evSql = `SELECT event_id id FROM telemetry_events WHERE session_id IN (${scope})${request.action === "retention" ? " AND occurred_at<?" : ""} ORDER BY event_id`;
  const aiSql = `SELECT call_id id FROM telemetry_ai_calls WHERE session_id IN (${scope})${request.action === "retention" ? " AND started_at<?" : ""} ORDER BY call_id`;
  const childParams = [...params, ...(request.action === "retention" ? [cutoff] : [])];
  const eventIds = db.prepare(evSql + " LIMIT 600001").all(...childParams).map(r => String(r.id)), aiIds = db.prepare(aiSql + " LIMIT 100001").all(...childParams).map(r => String(r.id));
  const sessionSql = `${scope}${request.action === "retention" ? ` AND opened_at<? AND NOT EXISTS(SELECT 1 FROM telemetry_events e WHERE e.session_id=telemetry_sessions.session_id AND e.occurred_at>=?) AND NOT EXISTS(SELECT 1 FROM telemetry_ai_calls a WHERE a.session_id=telemetry_sessions.session_id AND a.started_at>=?)` : ""} ORDER BY session_id`;
  const sessionIds = db.prepare(sessionSql + " LIMIT 10001").all(...params, ...(request.action === "retention" ? [cutoff, cutoff, cutoff] : [])).map(r => String(r.session_id));
  if (eventIds.length > 600000 || aiIds.length > 100000 || sessionIds.length > 10000) throw Error("deletion_limit_exceeded");
  const identity = { version: 1, database: realpathSync(target.database), cohort: target.cohort, test_class: target.testClass, mode: target.mode,
    ...request, cutoff, eventIds, aiIds, sessionIds };
  return { confirmation: digest(JSON.stringify(identity)), counts: { events: eventIds.length, ai_calls: aiIds.length, sessions: sessionIds.length }, identity };
}
/** Only synthetic local/test mutations are implemented. Plan is rechecked under the write lock. */
export function applyDeletion(db: DatabaseSync, target: Target, request: DeleteRequest, confirmation: string, ledgerPath: string) {
  if (target.mode !== "local-test" || target.testClass !== "synthetic" || !isAbsolute(ledgerPath) || dirname(ledgerPath) !== dirname(target.database) || !/^telemetry-deletion-[A-Za-z0-9_-]+\.json$/.test(basename(ledgerPath))) throw Error("local_deletion_only");
  db.exec("BEGIN IMMEDIATE");
  try {
    const plan = deletionPlan(db, target, request); if (plan.confirmation !== confirmation) throw Error("deletion_plan_changed");
    // Persist an authorized replay intent BEFORE commit. If commit fails, replaying the same request is still safe/idempotent.
    writeFileSync(ledgerPath, JSON.stringify({ version: 1, purpose: "authorized-deletion-replay", cohort: target.cohort, test_class: target.testClass, request, confirmation }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    for (const [table, key, ids] of [["telemetry_events", "event_id", plan.identity.eventIds], ["telemetry_ai_calls", "call_id", plan.identity.aiIds], ["telemetry_sessions", "session_id", plan.identity.sessionIds]] as const) {
      const statement = db.prepare(`DELETE FROM ${table} WHERE ${key}=?`); for (const id of ids) statement.run(id);
    }
    db.exec("COMMIT"); return { confirmation: plan.confirmation, counts: plan.counts };
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}
export function writeExport(path: string, csv: string, asOf: number) {
  if (!isAbsolute(path) || realpathSync(dirname(path)) !== dirname(path) || !/^telemetry-[A-Za-z0-9_-]+\.csv$/.test(basename(path))) throw Error("invalid_export_target");
  const fd = openSync(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
  try { writeFileSync(fd, csv); } finally { closeSync(fd); }
  try { writeFileSync(path + ".expiry.json", JSON.stringify({ version: 1, sha256: digest(csv), created_at: asOf, expires_at: asOf + 7 * 86400000 }) + "\n", { flag: "wx", mode: 0o600 }); }
  catch (error) { unlinkSync(path); throw error; }
}
export function safeCliError(error: unknown) {
  const code = error instanceof Error ? error.message : "local_tool_failed";
  return /^[a-z_]{1,64}$/.test(code) ? code : "local_tool_failed"; // never echo SQL, paths, pseudonyms or raw rows on failure
}
