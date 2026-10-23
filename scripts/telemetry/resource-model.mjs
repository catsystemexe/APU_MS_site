// Synthetic local scale model. No Cloudflare/provider/network operations.
import { mock } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { performance } from "node:perf_hooks";
import { reportingFixture, START, AS_OF } from "../../tests/helpers/telemetry-report-fixture.mjs";
import { createReport, REPORT_SQL } from "../../telemetry/reports/engine.ts";
import { midnight } from "../../telemetry/reports/time.ts";
const directory = resolve(process.argv[2] ?? "work/telemetry-b3-resource"), count = Number(process.argv[3] ?? 6000);
if (!Number.isInteger(count) || count < 1 || count > 6000) throw Error("invalid_synthetic_scale");
mkdirSync(directory, { recursive: true });
const file = join(directory, "telemetry-resource.sqlite"); if (existsSync(file)) throw Error("synthetic_target_exists");
const after = [], f = await reportingFixture({ mock, after(fn) { after.push(fn); } }); let db;
try {
  const c = await f.client("resource-seed"); c.pilot.view(true, true); c.pilot.interaction(); c.pilot.meaningful();
  for (let i = 1; i <= 60; i++) {
    f.time(START + i * 15000); c.pilot.interaction(); c.pilot.tick();
    if (i <= 10) { const op = c.pilot.begin("main_chat"); await f.call(c, op, 5000); op.resolve("accepted"); }
    await f.drain(c);
  }
  c.pilot.transition("F2", "user_navigation"); c.pilot.transition("F3", "user_navigation"); c.pilot.document(Symbol(), "baseline"); await f.drain(c);
  const session = f.db.rows("telemetry_sessions")[0], events = f.db.rows("telemetry_events"), calls = f.db.rows("telemetry_ai_calls");
  const logicalWrites = Number(f.db.db.prepare("SELECT total_changes() n").get().n);
  db = new DatabaseSync(file); db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL");
  db.exec(readFileSync(new URL("../../telemetry/migrations/0001_pilot_v1.sql", import.meta.url), "utf8"));
  const insertSession = db.prepare("INSERT INTO telemetry_sessions(session_id,tab_id,participant_id,cohort_id,key_version,test_class,notice_version,measurement_version,opened_at,last_interaction_at,expires_at,stopped_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)");
  const insertEvent = db.prepare("INSERT INTO telemetry_events(event_id,session_id,tab_id,client_seq,workflow_id,event_name,schema_version,measurement_version,occurred_at,received_at,app_version,event_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)");
  const insertAi = db.prepare("INSERT INTO telemetry_ai_calls(call_id,session_id,workflow_id,started_at,state,identity_json,projection_json,cost_nano_usd) VALUES(?,?,?,?,?,?,?,?)");
  const loadStart = performance.now(), base = Date.parse("2026-09-24T08:00:00Z"); db.exec("BEGIN");
  // Clone only validated stored rows from the real B2/B1 seed. New random IDs and generated HMAC-shaped subjects.
  for (let i = 0; i < count; i++) {
    const opened = base + Math.floor(i / 200) * 86400000 + (i % 2) * 1800000, delta = opened - START, ids = new Map();
    const mapId = value => { if (!ids.has(value)) ids.set(value, crypto.randomUUID()); return ids.get(value); };
    const pid = createHash("sha256").update(`synthetic-load-${i % 100}`).digest("base64url");
    const remap = value => typeof value === "string" && /^[a-f0-9-]{36}$/.test(value) ? mapId(value) : Array.isArray(value) ? value.map(remap) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k === "participant_id" ? pid : ["started_at", "completed_at"].includes(k) ? v === null ? null : v + delta : remap(v)])) : value;
    const sid = mapId(session.session_id), tab = mapId(session.tab_id);
    insertSession.run(sid, tab, pid, "b3-synthetic", "k1", "synthetic", "n1", "pilot-v1", opened, session.last_interaction_at + delta, session.expires_at + delta, null);
    for (const e of events) { const v = remap(JSON.parse(e.event_json)); insertEvent.run(v.event_id, sid, tab, v.client_seq, v.workflow_id, v.event_name, 1, "pilot-v1", e.occurred_at + delta, e.received_at + delta, "unknown", JSON.stringify(v)); }
    for (const a of calls) { const v = remap(JSON.parse(a.projection_json)); insertAi.run(v.call_id, sid, v.workflow_id, v.started_at, "final", JSON.stringify(remap(JSON.parse(a.identity_json))), JSON.stringify(v), v.cost_nano_usd); }
  }
  db.exec("COMMIT"); const loadMs = performance.now() - loadStart, walBytes = statSync(file + "-wal").size; db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  const pageSize = Number(db.prepare("PRAGMA page_size").get().page_size), pages = Number(db.prepare("PRAGMA page_count").get().page_count);
  // Python's SQLite exposes dbstat even when the Node build lacks that optional virtual table.
  const sizes = JSON.parse(execFileSync("python", ["-c", "import sqlite3,json,sys; d=sqlite3.connect('file:'+sys.argv[1]+'?mode=ro',uri=True); print(json.dumps([dict(zip(['name','bytes','cells'],r)) for r in d.execute('SELECT name,sum(pgsize),sum(ncell) FROM dbstat GROUP BY name ORDER BY name')]))", file], { encoding: "utf8" }));
  const options = { cohort: "b3-synthetic", testClass: "synthetic", linkage: true, from: "2026-09-24", to: "2026-10-24", asOf: AS_OF, retainedSince: midnight("2026-09-24") };
  const params = { cohort: options.cohort, test_class: options.testClass, to: midnight(options.to), as_of: AS_OF, retained_since: options.retainedSince };
  const plans = Object.fromEntries(Object.entries(REPORT_SQL).map(([name, sql]) => [name, db.prepare("EXPLAIN QUERY PLAN " + sql).all(params).map(p => p.detail)]));
  const reportStart = performance.now(), report = createReport(db, options), reportMs = performance.now() - reportStart;
  if (report.rows.summary[0].ai_count !== count * 10 || report.rows.summary[0].known_cost_nano_usd !== count * 100000000) throw Error("scale_reconciliation_failed");
  const queryMetrics = {};
  for (const [name, sql] of Object.entries(REPORT_SQL)) {
    const start = performance.now(); let rows = 0;
    for (const row of db.prepare(sql).iterate(params)) { if (!row) throw Error("invalid_row"); rows++; }
    queryMetrics[name] = { rows, elapsed_ms: performance.now() - start };
  }
  const perSession = { sessions: 1, events: events.length, ai_calls: calls.length, rows: 1 + events.length + calls.length, ingest_batches: f.batches.length, logical_writes: logicalWrites };
  // Index-cell estimates, NOT D1 billing: session insert=4; event insert=5; AI pending insert=4/final update=1.
  const indexedWrites = 4 + events.length * 5 + calls.length * 5 + f.batches.length + 10;
  const insertWrites = indexedWrites * 200, deleteWrites = (4 + events.length * 5 + calls.length * 4) * 200;
  const result = { synthetic: true, sqlite_version: db.prepare("SELECT sqlite_version() v").get().v, sessions: count, per_session: perSession,
    engine_sha256: createHash("sha256").update(readFileSync(new URL("../../telemetry/reports/engine.ts", import.meta.url))).digest("hex"),
    query_sql_sha256: Object.fromEntries(Object.entries(REPORT_SQL).map(([name, sql]) => [name, createHash("sha256").update(sql).digest("hex")])),
    rows: count * perSession.rows, page_size: pageSize, pages, bytes: pages * pageSize, bytes_per_session: pages * pageSize / count, bulk_wal_bytes: walBytes,
    load_ms: loadMs, report_ms: reportMs, known_cost_nano_usd: report.rows.summary[0].known_cost_nano_usd, index_sizes: sizes, query_plans: plans, query_metrics: queryMetrics,
    estimates: { indexed_writes_per_session: indexedWrites, indexed_write_amplification: indexedWrites / logicalWrites, daily_insert_row_writes: insertWrites,
      daily_steady_retention_row_writes: deleteWrites, daily_steady_total_row_writes: insertWrites + deleteWrites, report_source_row_visits: count * (4 + 3 * (events.length + calls.length)),
      d1_billed_meta: "NOT AVAILABLE in SQLite; index-cell writes/source-row visits are estimates", account_plan: "NOT VERIFIED" } };
  writeFileSync(join(directory, "resource-model.json"), JSON.stringify(result, null, 2) + "\n");
  process.stdout.write(JSON.stringify({ ...result, index_sizes: undefined, query_plans: undefined }) + "\n");
} finally { db?.close(); for (const fn of after) await fn(); mock.restoreAll(); }
