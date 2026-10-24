import { readFile, mkdir, lstat, realpath, writeFile, unlink, rmdir } from "node:fs/promises";
import { resolve, dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

export const DEV = Object.freeze({
  repository: "catsystemexe/APU_MS_site", branch: "dev", worker: "apu-ms-site-dev",
  account: "4638092f63fa7fe58bcb9d2d041b7855", productionWorker: "apu-ms-site",
  productionBranch: "next", productionUrl: "https://apu-ms-site.catsystem-exe.workers.dev",
  issuer: "https://catsystem-ai.cloudflareaccess.com", operator: "catsystem.exe@gmail.com",
});
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const INPUT_KEYS = ["kvNamespaceId", "accessApplicationId", "accessAudience", "accessTeamDomain", "operatorEmail"];
const TELEMETRY_OFF = { APU_TELEMETRY_ENABLED: "0", APU_TELEMETRY_METADATA_ENABLED: "0" };
const TELEMETRY_DATABASE = "apu-ms-site-dev-telemetry";
const TELEMETRY_MIGRATIONS = "../../telemetry/migrations"; // Relative to dist/dev-worker/wrangler.json, not cwd.
function validateTelemetry(value) {
  requireThat(object(value), "invalid_telemetry_input");
  if (value.enabled === false && !Object.hasOwn(value, "staged")) { equal(value, { enabled: false }, "invalid_telemetry_input"); return; }
  const staged = value.enabled === false && value.staged === true;
  equal(Object.keys(value).sort(), ["enabled", "databaseId", "databaseName", "dedicatedDev", "hostname",
    ...(staged ? ["staged"] : ["cohort", "keyVersion", "noticeVersion"])].sort(), "invalid_telemetry_input");
  requireThat((staged || value.enabled === true) && value.dedicatedDev === true, "dedicated_telemetry_dev_required");
  requireThat(typeof value.databaseId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.databaseId), "invalid_telemetry_database");
  equal(value.databaseName, TELEMETRY_DATABASE, "dedicated_telemetry_dev_required");
  equal(value.hostname, "apu-ms-site-dev.catsystem-exe.workers.dev", "invalid_telemetry_hostname");
  if (!staged) requireThat([value.cohort, value.keyVersion, value.noticeVersion].every(v => typeof v === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(v)), "invalid_telemetry_versions");
}
const EXISTING_KV = ["4a24c791d31a4c0983170c921cb744aa", "8dd4e8a10dc74086bbd746e733b3d8d8", "1729ce8a6acd4cdcbed8248ac543677b"];
const EXISTING_AUD = "1e1680481c99464a844a6ef0e502cf49fae89fc91c8cf3806ba48026b0088610";
const EXISTING_ACCESS_APP = "67a86152-2917-40c8-8e5f-6dce0beeaca8";
const RULES = [{ type: "ESModule", globs: ["**/*.js", "**/*.mjs"] }];
const CORE = { name: DEV.worker, account_id: DEV.account, main: "./dist/server/index.js", no_bundle: true,
  find_additional_modules: true, base_dir: "./dist/server", rules: RULES, keep_vars: false,
  compatibility_date: "2026-08-21", compatibility_flags: ["nodejs_compat"], workers_dev: true, preview_urls: false };
class PreparationFailure extends Error { constructor(code) { super(code); this.code = code; } }
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
function requireThat(condition, code) { if (!condition) throw new PreparationFailure(code); }
function equal(actual, expected, code) { requireThat(isDeepStrictEqual(actual, expected), code); }
export function validateDevTemplate(template) {
  requireThat(object(template), "invalid_dev_template");
  equal(Object.keys(template).sort(), [...Object.keys(CORE), "$schema", "kv_namespaces", "vars", "observability", "assets"].sort(), "unsupported_dev_setting");
  for (const [key, value] of Object.entries(CORE)) equal(template[key], value, "dev_target_or_build_contract_changed");
  equal(template.$schema, "node_modules/wrangler/config-schema.json", "unexpected_schema");
  equal(template.kv_namespaces, [{ binding: "DEV_LOG_STATE", id: null }], "dev_kv_must_be_provisioned");
  const accessVars = { ...template.vars };
  const telemetryVars = Object.fromEntries(Object.entries(accessVars).filter(([key]) => key.startsWith("APU_TELEMETRY_")));
  if (Object.keys(telemetryVars).length) equal(telemetryVars, TELEMETRY_OFF, "telemetry_defaults_must_be_disabled");
  for (const key of Object.keys(telemetryVars)) delete accessVars[key];
  equal(accessVars, { APU_LOCAL_DEV_AUTH: "0", CF_ACCESS_TEAM_DOMAIN: null, CF_ACCESS_AUD: null, APU_DEVELOPER_EMAILS: null }, "dev_access_must_be_provisioned");
  equal(template.observability, { enabled: false }, "unexpected_dev_observability");
  equal(template.assets, { directory: "dist/client", binding: "ASSETS", not_found_handling: "none" }, "unexpected_dev_assets");
}
export function validateDevInputs(inputs) {
  requireThat(object(inputs), "missing_dev_inputs");
  equal(Object.keys(inputs).sort(), [...INPUT_KEYS, ...(Object.hasOwn(inputs, "telemetry") ? ["telemetry"] : [])].sort(), "unsupported_dev_input");
  if (Object.hasOwn(inputs, "telemetry")) validateTelemetry(inputs.telemetry);
  requireThat(typeof inputs.kvNamespaceId === "string" && /^[0-9a-f]{32}$/.test(inputs.kvNamespaceId) && !/^0+$/.test(inputs.kvNamespaceId), "missing_or_invalid_dev_kv");
  requireThat(!EXISTING_KV.includes(inputs.kvNamespaceId), "existing_kv_reuse_forbidden");
  requireThat(typeof inputs.accessApplicationId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(inputs.accessApplicationId) && !/^0[-0]+$/.test(inputs.accessApplicationId), "missing_or_invalid_dev_access_application");
  requireThat(inputs.accessApplicationId !== EXISTING_ACCESS_APP, "existing_access_application_forbidden");
  requireThat(typeof inputs.accessAudience === "string" && /^[0-9a-f]{64}$/.test(inputs.accessAudience) && !/^0+$/.test(inputs.accessAudience), "missing_or_invalid_dev_audience");
  requireThat(inputs.accessAudience !== EXISTING_AUD, "existing_access_audience_forbidden");
  equal(inputs.accessTeamDomain, DEV.issuer, "unapproved_dev_access_issuer");
  equal(inputs.operatorEmail, DEV.operator, "dev_operator_only");
}
function materialize(template, inputs) {
  // Copy the reviewed DEV template, never production vars, bindings, secrets,
  // routes, environments, Preview/base settings or process.env defaults.
  const config = structuredClone(template);
  delete config.$schema;
  config.main = "../server/index.js"; config.base_dir = "../server";
  config.assets.directory = "../client";
  config.kv_namespaces = [{ binding: "DEV_LOG_STATE", id: inputs.kvNamespaceId }];
  config.vars = { APU_LOCAL_DEV_AUTH: "0", CF_ACCESS_TEAM_DOMAIN: inputs.accessTeamDomain,
    CF_ACCESS_AUD: inputs.accessAudience, APU_DEVELOPER_EMAILS: inputs.operatorEmail };
  if (inputs.telemetry?.enabled === true || inputs.telemetry?.staged === true) {
    const t = inputs.telemetry;
    requireThat(t.databaseId !== inputs.accessApplicationId && t.databaseId !== EXISTING_ACCESS_APP &&
      ![inputs.kvNamespaceId, ...EXISTING_KV].includes(t.databaseId.replaceAll("-", "")), "invalid_telemetry_database");
    config.d1_databases = [{ binding: "TELEMETRY_DB", database_id: t.databaseId, database_name: t.databaseName,
      migrations_dir: TELEMETRY_MIGRATIONS }];
    Object.assign(config.vars, TELEMETRY_OFF, { APU_TELEMETRY_ENV: "dev", APU_TELEMETRY_HOSTNAME: t.hostname });
    if (t.enabled === true) Object.assign(config.vars, { APU_TELEMETRY_ENABLED: "1",
      APU_TELEMETRY_COHORT: t.cohort, APU_TELEMETRY_KEY_VERSION: t.keyVersion, APU_TELEMETRY_NOTICE_VERSION: t.noticeVersion });
    // Keys, privacy approval and enrollment are separately gated; preparation cannot activate collection.
  }
  return config;
}
export function validateDevConfig(config, template, inputs) {
  validateDevTemplate(template); validateDevInputs(inputs);
  equal(config, materialize(template, inputs), "dev_config_or_isolation_mismatch");
}
export function buildDevConfig(template, artifact, inputs) {
  validateDevTemplate(template); validateDevInputs(inputs);
  requireThat(object(artifact), "canonical_artifact_config_missing");
  equal(artifact.name, DEV.productionWorker, "unexpected_canonical_artifact");
  equal(artifact.main, "index.js", "unexpected_canonical_artifact");
  equal(artifact.no_bundle, true, "unexpected_canonical_artifact");
  equal(artifact.rules, RULES, "unexpected_canonical_artifact");
  equal(artifact.compatibility_date, CORE.compatibility_date, "unexpected_canonical_artifact");
  equal(artifact.compatibility_flags, CORE.compatibility_flags, "unexpected_canonical_artifact");
  equal(artifact.assets, { directory: "../client", binding: "ASSETS", not_found_handling: "none" }, "unexpected_canonical_artifact");
  if (inputs.telemetry?.enabled === true || inputs.telemetry?.staged === true) {
    const productionDatabases = artifact.d1_databases ?? [];
    requireThat(Array.isArray(productionDatabases) && !productionDatabases.some(db => db?.database_id === inputs.telemetry.databaseId),
      "production_telemetry_database_reuse_forbidden");
  }
  const config = materialize(template, inputs);
  validateDevConfig(config, template, inputs);
  return config;
}
// A future command contract only. This module has no process runner, provider
// client or network API and cannot execute even this command in P3.
export function futureDevCommand() {
  return ["--no-install", "wrangler", "deploy", "--config", "dist/dev-worker/wrangler.json", "--name", DEV.worker];
}
export function validateFutureDevCommand(command, args, config, template, inputs) {
  equal(command, "npx", "unsupported_dev_deployment_command");
  equal(args, futureDevCommand(), "unsupported_dev_deployment_command");
  validateDevConfig(config, template, inputs);
}
// Pure argument plan, never a process runner. G1-B needs separate authorization,
// account/UUID/EU read-back; even Wrangler migrations list can create bookkeeping.
export function telemetryMigrationArgs(action, config, template, inputs) {
  validateDevConfig(config, template, inputs);
  requireThat(inputs.telemetry?.enabled === false && inputs.telemetry?.staged === true, "staged_telemetry_required");
  requireThat(action === "list" || action === "apply", "unsupported_telemetry_migration_action");
  return ["d1", "migrations", action, TELEMETRY_DATABASE, "--remote", "--config", "dist/dev-worker/wrangler.json"];
}
export function parsePreparationArgs(args) {
  requireThat(Array.isArray(args), "unsupported_preparation_command");
  requireThat(["--check-template", "--check-config", "--prepare-config"].includes(args[0]), "unsupported_preparation_command");
  requireThat(args[1] === "--target" && args[2] === DEV.worker, "explicit_dev_target_required");
  if (args[0] === "--check-template") requireThat(args.length === 3, "unsupported_preparation_command");
  else requireThat(args.length === 5 && args[3] === "--inputs" && typeof args[4] === "string" && isAbsolute(args[4]), "explicit_dev_inputs_required");
  return { mode: args[0], inputsPath: args[4] };
}
async function json(path) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch { throw new PreparationFailure("preparation_input_unavailable"); }
}
export async function runPreparation(args) {
  const options = parsePreparationArgs(args);
  const template = await json(resolve(ROOT, "wrangler.dev.json"));
  validateDevTemplate(template);
  if (options.mode === "--check-template") return { status: "PASS_INACTIVE_TEMPLATE", target: DEV.worker, deploymentAuthorized: false };
  const inputs = await json(options.inputsPath);
  validateDevInputs(inputs); // No artifact read or output creation when incomplete.
  const artifact = await json(resolve(ROOT, "dist/server/wrangler.json"));
  const entry = await lstat(resolve(ROOT, "dist/server/index.js"));
  requireThat(entry.isFile() && !entry.isSymbolicLink() && entry.size > 0, "canonical_artifact_missing");
  const config = buildDevConfig(template, artifact, inputs);
  if (options.mode === "--prepare-config") {
    const dist = resolve(ROOT, "dist"), directory = resolve(dist, "dev-worker");
    requireThat(await realpath(dist) === dist, "unsafe_dev_output_path");
    // Exclusive directory and files: never overwrite or follow a pre-existing
    // staging path, especially one pointing to the production build artifact.
    await mkdir(directory, { mode: 0o700 });
    const created = [];
    try {
      requireThat(await realpath(directory) === directory, "unsafe_dev_output_path");
      const metadata = { kind: "apu-dedicated-dev-preparation", branch: DEV.branch, worker: DEV.worker,
        account: DEV.account, accessApplicationId: inputs.accessApplicationId,
        inputEvidence: "SUPPLIED INPUTS ONLY; authenticated provisioning/ownership and effective bindings require separate hosted verification",
        deploymentAuthorized: false, automaticDevUpdatesConfigured: false };
      for (const [name, data] of [["wrangler.json", config], ["preparation.json", metadata]]) {
        const path = resolve(directory, name);
        created.push(path);
        await writeFile(path, JSON.stringify(data, null, 2) + "\n", { flag: "wx", mode: 0o600 });
      }
    } catch (error) {
      for (const path of created) { try { await unlink(path); } catch {} }
      try { await rmdir(directory); } catch {}
      throw error;
    }
  }
  return { status: options.mode === "--prepare-config" ? "PASS_PREPARED_NOT_DEPLOYED" : "PASS_OFFLINE_CONFIG",
    target: DEV.worker, deploymentAuthorized: false, automaticDevUpdatesConfigured: false };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await runPreparation(process.argv.slice(2)))); }
  catch (error) {
    console.error(JSON.stringify({ error: "DEV_preparation_stopped", cause: error instanceof PreparationFailure ? error.code : "preparation_failed_details_suppressed" }));
    process.exitCode = 1;
  }
}
