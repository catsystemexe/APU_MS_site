import { readFileSync, writeFileSync, readdirSync, lstatSync, realpathSync } from "node:fs";
import { resolve, dirname, relative, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { createHash } from "node:crypto";
import { DEV } from "./prepare-worker.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const MIGRATION = Object.freeze({ accountId: DEV.account, databaseName: "apu-ms-site-dev-telemetry", binding: "TELEMETRY_DB",
  directory: resolve(ROOT, "telemetry/migrations"), file: "0001_pilot_v1.sql",
  lf: "81d3a4f48446b9583fd13b6288518fc06ea1ff283360001c2c84825f474c9d37",
  crlf: "34a97fe1898f6dbc282ad03c67fb3b902f9a4186d65b5cf60266b0560cf31619" });
function check(ok, code) { if (!ok) throw Error(code); }
function keys(value, expected) {
  check(value !== null && typeof value === "object" && !Array.isArray(value) &&
    isDeepStrictEqual(Object.keys(value).sort(), [...expected].sort()), "unexpected_migration_fields");
}
export function validateMigrationIdentity(identity) {
  keys(identity, ["accountId", "databaseId", "databaseName", "jurisdiction"]);
  check(identity.accountId === MIGRATION.accountId && identity.databaseName === MIGRATION.databaseName && identity.jurisdiction === "eu", "wrong_migration_target");
  check(typeof identity.databaseId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(identity.databaseId), "invalid_migration_uuid");
}
export function verifyApprovedMigration() {
  check(realpathSync(MIGRATION.directory) === MIGRATION.directory &&
    isDeepStrictEqual(readdirSync(MIGRATION.directory).sort(), [MIGRATION.file]), "unexpected_migration_files");
  const file = resolve(MIGRATION.directory, MIGRATION.file), stat = lstatSync(file);
  check(stat.isFile() && !stat.isSymbolicLink(), "unsafe_migration_file");
  const sha = createHash("sha256").update(readFileSync(file)).digest("hex");
  check(sha === MIGRATION.lf || sha === MIGRATION.crlf, "unapproved_migration_hash");
  return { sha256: sha, lineEndings: sha === MIGRATION.lf ? "LF" : "CRLF" };
}
export function buildMigrationConfig(identity) {
  validateMigrationIdentity(identity); verifyApprovedMigration();
  // No main/name/assets/vars/KV/Access: this config cannot prepare a Worker deployment.
  return { account_id: MIGRATION.accountId, send_metrics: false, d1_databases: [{ binding: MIGRATION.binding,
    database_name: MIGRATION.databaseName, database_id: identity.databaseId, migrations_dir: MIGRATION.directory }] };
}
export function validateMigrationConfig(config, identity) {
  check(isDeepStrictEqual(config, buildMigrationConfig(identity)), "migration_config_mismatch");
}
export function validateMigrationReadback(identity, preflight) {
  validateMigrationIdentity(identity);
  keys(preflight, ["inventory", "info", "schema", "applied"]);
  check(Array.isArray(preflight.inventory) && Array.isArray(preflight.schema) && Array.isArray(preflight.applied), "invalid_migration_readback");
  const matches = preflight.inventory.filter(db => db?.name === MIGRATION.databaseName || db?.uuid === identity.databaseId);
  check(matches.length === 1 && matches[0].name === MIGRATION.databaseName && matches[0].uuid === identity.databaseId, "migration_inventory_mismatch");
  check(preflight.info?.name === MIGRATION.databaseName && preflight.info.uuid === identity.databaseId && preflight.info.jurisdiction === "eu", "migration_info_mismatch");
}
export function migrationOnlyArgs(action, configPath, config, identity, preflight) {
  check(isAbsolute(configPath) && configPath.endsWith(".json"), "absolute_migration_config_required");
  validateMigrationConfig(config, identity); validateMigrationReadback(identity, preflight);
  check(action === "list" || action === "apply", "unsupported_migration_action");
  if (action === "apply") {
    // The operator supplies fresh exact-target read-back after the authorized list.
    // Only empty Wrangler bookkeeping may exist; no replay or repair of a schema.
    check(preflight.applied.length === 0 && preflight.schema.length === 1 &&
      preflight.schema.every(row => row.type === "table" && row.name === "d1_migrations"), "migration_not_pristine");
  }
  return ["d1", "migrations", action, MIGRATION.databaseName, "--remote", "--config", configPath];
}
function privatePath(path) {
  check(typeof path === "string" && isAbsolute(path) && path.endsWith(".json"), "private_absolute_json_required");
  const outside = relative(ROOT, resolve(path));
  check(isAbsolute(outside) || outside.startsWith(".." + sep), "migration_evidence_must_be_outside_repository");
  check(realpathSync(dirname(path)) === dirname(path), "unsafe_migration_evidence_path");
}
function json(path) {
  privatePath(path);
  const stat = lstatSync(path); check(stat.isFile() && !stat.isSymbolicLink(), "unsafe_migration_evidence_file");
  return JSON.parse(readFileSync(path, "utf8"));
}
export function runMigrationPreparation(args) {
  const plan = args[0] === "--plan", offset = plan ? 2 : 1;
  check(plan || ["--prepare", "--check"].includes(args[0]), "unsupported_migration_preparation");
  check(args.length === (plan ? 8 : 5) && args[offset] === "--identity" && args[offset + 2] === "--config" &&
    (!plan || args[6] === "--preflight"), "explicit_migration_paths_required");
  const identity = json(args[offset + 1]), configPath = args[offset + 3]; privatePath(configPath);
  const config = buildMigrationConfig(identity);
  if (args[0] === "--prepare") {
    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    return { status: "PREPARED_MIGRATION_ONLY_NOT_DEPLOYED" };
  }
  const actual = json(configPath); validateMigrationConfig(actual, identity);
  return plan ? migrationOnlyArgs(args[1], configPath, actual, identity, json(args[7])) : { status: "PASS_OFFLINE_MIGRATION_CONFIG" };
}
// Local files and pure argument planning only. No subprocess, network or remote execution.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(runMigrationPreparation(process.argv.slice(2)))); }
  catch { console.error(JSON.stringify({ error: "migration_preparation_stopped" })); process.exitCode = 1; }
}
