import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
const migration = await readFile(new URL("../../telemetry/migrations/0001_pilot_v1.sql", import.meta.url), "utf8");
export class EmulatedTelemetryD1 {
  constructor(database = ":memory:") { this.db = new DatabaseSync(database); this.db.exec(migration); }
  prepare(sql) {
    const statement = this.db.prepare(sql); let values = [];
    const result = { bind(...v) { values = v; return result; }, async first() { const row = statement.get(...values); return row ? { ...row } : null; },
      async run() { return result.execute(); }, execute() { return { meta: { changes: Number(statement.run(...values).changes) } }; } };
    return result;
  }
  async batch(statements) {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result = statements.map(s => s.execute()); this.db.exec("COMMIT"); return result; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  rows(table) { return this.db.prepare(`SELECT * FROM ${table}`).all().map(row => ({ ...row })); }
}
