import assert from "node:assert/strict";
import test from "node:test";
import { readFile, writeFile, mkdtemp, mkdir, rm, copyFile, symlink } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { MIGRATION, buildMigrationConfig, validateMigrationConfig, validateMigrationReadback, migrationOnlyArgs } from "../ops/dev/prepare-telemetry-migration.mjs";
const require = createRequire(import.meta.url), root = fileURLToPath(new URL("..", import.meta.url));
// Synthetic UUID only. The actual EU D1 identity is supplied privately by the operator.
const identity = () => ({ accountId: MIGRATION.accountId, databaseId: "12345678-1234-4234-8234-123456789abc", databaseName: MIGRATION.databaseName, jurisdiction: "eu" });
const preflight = () => ({ inventory: [{ name: MIGRATION.databaseName, uuid: identity().databaseId }],
  info: { name: MIGRATION.databaseName, uuid: identity().databaseId, jurisdiction: "eu" }, schema: [], applied: [] });
test("minimal migration-only config is schema-valid and has no Worker/KV/Access/runtime inputs", async () => {
  const config = buildMigrationConfig(identity());
  assert.deepEqual(config, { account_id: MIGRATION.accountId, send_metrics: false, d1_databases: [{ binding: "TELEMETRY_DB",
    database_name: MIGRATION.databaseName, database_id: identity().databaseId, migrations_dir: resolve(root, "telemetry/migrations") }] });
  const schema = JSON.parse(await readFile(new URL("../node_modules/wrangler/config-schema.json", import.meta.url), "utf8"));
  const Ajv = require("ajv"), validate = new Ajv({ strict: false, logger: false }).compile(schema);
  assert.equal(validate(config), true, JSON.stringify(validate.errors));
});
for (const [field, value] of [["account_id", "f".repeat(32)], ["name", "apu-ms-site-dev"], ["vars", {}], ["main", "worker.js"],
  ["kv_namespaces", []], ["secrets", []]]) test(`migration config rejects changed/extra ${field}`, () => {
  assert.throws(() => validateMigrationConfig({ ...buildMigrationConfig(identity()), [field]: value }, identity()));
});
for (const [field, value] of [["binding", "DEV_LOG_STATE"], ["database_name", "production"], ["database_id", "87654321-1234-4234-8234-123456789abc"], ["migrations_dir", "../../db/migrations"]])
  test(`migration binding rejects changed ${field}`, () => {
    const config = buildMigrationConfig(identity()); config.d1_databases[0][field] = value;
    assert.throws(() => validateMigrationConfig(config, identity()));
  });
for (const [field, value] of [["accountId", "f".repeat(32)], ["databaseName", "production"], ["databaseId", "bad"],
  ["databaseId", "00000000-0000-0000-0000-000000000000"], ["jurisdiction", "weur"], ["accessAudience", "unneeded"]])
  test(`restricted identity rejects ${field} substitution`, () => assert.throws(() => buildMigrationConfig({ ...identity(), [field]: value })));
for (const [label, change] of [
  ["missing DB", p => p.inventory = []], ["duplicate DB", p => p.inventory.push({ ...p.inventory[0] })],
  ["inventory UUID", p => p.inventory[0].uuid = "87654321-1234-4234-8234-123456789abc"],
  ["info UUID", p => p.info.uuid = "87654321-1234-4234-8234-123456789abc"],
  ["info name", p => p.info.name = "production"], ["missing EU", p => delete p.info.jurisdiction],
  ["region without jurisdiction", p => { delete p.info.jurisdiction; p.info.created_in_region = "EEUR"; }],
]) test(`fresh read-back rejects ${label}`, () => { const p = preflight(); change(p); assert.throws(() => validateMigrationReadback(identity(), p)); });
test("changed receipt UUID cannot agree with original inventory/info; apply rejects prior or unrelated schema", () => {
  assert.throws(() => validateMigrationReadback({ ...identity(), databaseId: "87654321-1234-4234-8234-123456789abc" }, preflight()));
  const config = buildMigrationConfig(identity()), path = resolve(tmpdir(), "migration-only.json");
  for (const p of [preflight(), { ...preflight(), applied: [{ name: MIGRATION.file }] }, { ...preflight(), schema: [{ type: "table", name: "telemetry_sessions" }] },
    { ...preflight(), schema: [{ type: "table", name: "business" }] }]) assert.throws(() => migrationOnlyArgs("apply", path, config, identity(), p), /migration_not_pristine/);
  assert.deepEqual(migrationOnlyArgs("apply", path, config, identity(), { ...preflight(), schema: [{ type: "table", name: "d1_migrations" }] }),
    ["d1", "migrations", "apply", MIGRATION.databaseName, "--remote", "--config", path]);
  for (const action of ["create", "delete", "deploy", "execute", "apply --force"]) assert.throws(() => migrationOnlyArgs(action, path, config, identity(), preflight()));
});
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "apu-migration-only-")), repo = join(directory, "repo"), evidence = join(directory, "private");
  await mkdir(join(repo, "ops/dev"), { recursive: true }); await mkdir(join(repo, "telemetry/migrations"), { recursive: true }); await mkdir(evidence);
  for (const name of ["ops/dev/prepare-worker.mjs", "ops/dev/prepare-telemetry-migration.mjs", "telemetry/migrations/0001_pilot_v1.sql"])
    await copyFile(resolve(root, name), join(repo, name));
  const tool = await import(pathToFileURL(join(repo, "ops/dev/prepare-telemetry-migration.mjs")).href);
  const idPath = join(evidence, "identity.json"), configPath = join(evidence, "migration-only.json");
  await writeFile(idPath, JSON.stringify(identity()));
  return { directory, repo, evidence, tool, idPath, configPath, script: join(repo, "ops/dev/prepare-telemetry-migration.mjs") };
}
test("CLI is offline, external/exclusive, rejects unknown args and in-repo UUID config", async t => {
  const f = await fixture();
  try {
    const invoke = args => spawnSync(process.execPath, [f.script, ...args], { encoding: "utf8" });
    const args = ["--prepare", "--identity", f.idPath, "--config", f.configPath];
    const result = invoke(args); assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout + result.stderr, new RegExp(identity().databaseId));
    assert.equal(invoke(args).status, 1); // Never overwrite an existing evidence/config file.
    assert.equal(invoke(["--check", ...args.slice(1)]).status, 0);
    const readbackPath = join(f.evidence, "preflight.json"); await writeFile(readbackPath, JSON.stringify({ ...preflight(), schema: [{ type: "table", name: "d1_migrations" }] }));
    const planned = invoke(["--plan", "apply", "--identity", f.idPath, "--config", f.configPath, "--preflight", readbackPath]);
    assert.equal(planned.status, 0, planned.stderr);
    assert.deepEqual(JSON.parse(planned.stdout), ["d1", "migrations", "apply", MIGRATION.databaseName, "--remote", "--config", f.configPath]);
    await writeFile(readbackPath, JSON.stringify({ ...preflight(), applied: [{ name: MIGRATION.file }] }));
    assert.equal(invoke(["--plan", "apply", "--identity", f.idPath, "--config", f.configPath, "--preflight", readbackPath]).status, 1);
    for (const bad of [["--deploy"], [...args, "--force"], ["--prepare", "--identity", f.idPath, "--config", join(f.repo, "config.json")]]) assert.equal(invoke(bad).status, 1);
    await t.test("CLI refuses a real identity symlink", async sub => {
      const linked = join(f.evidence, "linked.json");
      try { await symlink(f.idPath, linked); }
      catch (error) {
        if (process.platform === "win32" && ["EPERM", "EACCES"].includes(error.code)) {
          sub.skip(`NOT VERIFIED: Windows symlink creation denied (${error.code}); rerun with symlink privileges`); return;
        }
        throw error;
      }
      assert.equal(invoke(["--prepare", "--identity", linked, "--config", join(f.evidence, "other.json")]).status, 1);
    });
    const source = await readFile(f.script, "utf8");
    assert.doesNotMatch(source, /node:child_process|\bfetch\s*\(|process\.env\s*[.\[]/);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});
test("only byte-exact approved LF/CRLF migration files pass; changed SQL and extra files stop", async t => {
  const f = await fixture();
  try {
    const file = join(f.repo, "telemetry/migrations", MIGRATION.file);
    const lf = (await readFile(file, "utf8")).replace(/\r\n/g, "\n");
    // Exercise both approved byte forms even in an autocrlf Windows checkout.
    await writeFile(file, lf);
    assert.equal(f.tool.verifyApprovedMigration().lineEndings, "LF");
    await writeFile(file, lf.replace(/\n/g, "\r\n")); assert.equal(f.tool.verifyApprovedMigration().lineEndings, "CRLF");
    await writeFile(file, lf + "-- changed\n"); assert.throws(() => f.tool.buildMigrationConfig(identity()), /unapproved_migration_hash/);
    await writeFile(file, lf); await writeFile(join(dirname(file), "0002_other.sql"), "SELECT 1;");
    assert.throws(() => f.tool.verifyApprovedMigration(), /unexpected_migration_files/);
    await rm(join(dirname(file), "0002_other.sql"));
    await t.test("migration refuses a real SQL symlink", async sub => {
      await rm(file);
      try { await symlink(resolve(root, "telemetry/migrations", MIGRATION.file), file); }
      catch (error) {
        if (process.platform === "win32" && ["EPERM", "EACCES"].includes(error.code)) {
          sub.skip(`NOT VERIFIED: Windows symlink creation denied (${error.code}); rerun with symlink privileges`); return;
        }
        throw error;
      }
      assert.throws(() => f.tool.verifyApprovedMigration(), /unsafe_migration_file/);
    });
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});
test("installed Wrangler loads absolute migration path from minimal external config, applies once locally and reconciles schema", { timeout: 90000 }, async () => {
  const f = await fixture();
  try {
    const config = f.tool.buildMigrationConfig(identity()); await writeFile(f.configPath, JSON.stringify(config));
    const before = await readFile(f.configPath), cwd = join(f.directory, "unrelated"); await mkdir(cwd);
    const env = { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_SEND_ERROR_REPORTS: "false",
      CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false", WRANGLER_LOG_PATH: join(f.evidence, "wrangler.log") };
    for (const key of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_API_KEY", "CLOUDFLARE_EMAIL", "CLOUDFLARE_ACCOUNT_ID"]) delete env[key];
    const run = args => {
      assert.ok(args.includes("--local") && !args.includes("--remote"), "no remote test commands");
      const result = spawnSync(process.execPath, [resolve(root, "node_modules/wrangler/bin/wrangler.js"), ...args,
        "--persist-to", join(f.directory, "state")], { cwd, env, encoding: "utf8", timeout: 25000 });
      assert.equal(result.status, 0, result.stderr + result.stdout); return result.stdout;
    };
    const migrate = (action, p) => run(f.tool.migrationOnlyArgs(action, f.configPath, config, identity(), p).map(a => a === "--remote" ? "--local" : a));
    const query = sql => JSON.parse(run(["d1", "execute", MIGRATION.databaseName, "--local", "--config", f.configPath, "--command", sql, "--json"]))[0].results;
    assert.match(migrate("list", preflight()), /0001_pilot_v1\.sql/);
    const ready = { ...preflight(), schema: [{ type: "table", name: "d1_migrations" }] };
    migrate("apply", ready);
    const sql = "SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name LIKE 'telemetry_%' AND sql IS NOT NULL ORDER BY type,name";
    const actual = query(sql), expected = new DatabaseSync(":memory:");
    try {
      expected.exec(await readFile(join(f.repo, "telemetry/migrations", MIGRATION.file), "utf8"));
      const normalize = rows => rows.map(r => ({ ...r, sql: r.sql.replace(/\s+/g, " ").trim() }));
      assert.deepEqual(normalize(actual), normalize(expected.prepare(sql).all().map(r => ({ ...r }))));
    } finally { expected.close(); }
    assert.deepEqual(["table", "index", "trigger"].map(type => actual.filter(r => r.type === type).length), [3, 6, 4]);
    const applied = query("SELECT name,COUNT(*) AS applied FROM d1_migrations GROUP BY name");
    assert.deepEqual(applied, [{ name: MIGRATION.file, applied: 1 }]);
    assert.deepEqual(query("SELECT (SELECT COUNT(*) FROM telemetry_sessions)+(SELECT COUNT(*) FROM telemetry_events)+(SELECT COUNT(*) FROM telemetry_ai_calls) AS records"), [{ records: 0 }]);
    assert.deepEqual(query("PRAGMA foreign_key_check"), []);
    const done = { ...preflight(), schema: actual, applied };
    assert.throws(() => f.tool.migrationOnlyArgs("apply", f.configPath, config, identity(), done), /migration_not_pristine/);
    assert.doesNotMatch(migrate("list", done), /0001_pilot_v1\.sql/);
    assert.deepEqual(await readFile(f.configPath), before);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});
