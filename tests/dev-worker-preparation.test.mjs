import assert from "node:assert/strict";
import test from "node:test";
import { readFile, writeFile, mkdtemp, mkdir, rm, lstat, symlink } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";
import { DatabaseSync } from "node:sqlite";
import { DEV, validateDevTemplate, validateDevInputs, buildDevConfig, validateDevConfig,
  futureDevCommand, validateFutureDevCommand, parsePreparationArgs, telemetryMigrationArgs } from "../ops/dev/prepare-worker.mjs";
const require = createRequire(import.meta.url);
const yaml = require("js-yaml");
const root = fileURLToPath(new URL("..", import.meta.url));
const template = JSON.parse(await readFile(new URL("../wrangler.dev.json", import.meta.url), "utf8"));
const example = JSON.parse(await readFile(new URL("../config/dev-worker.inputs.example.json", import.meta.url), "utf8"));
const productionText = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const production = ts.parseConfigFileTextToJson("wrangler.jsonc", productionText).config;
const artifact = JSON.parse(await readFile(new URL("../dist/server/wrangler.json", import.meta.url), "utf8"));
// Synthetic provisioning-shaped inputs only: these IDs are NOT live resources,
// authenticated evidence, a checked-in deployable configuration or permission.
const inputs = () => ({ kvNamespaceId: "0123456789abcdef0011223344556677",
  accessApplicationId: "d00d1234-2222-4333-8444-555566667777",
  accessAudience: "0123456789abcdef".repeat(4),
  accessTeamDomain: "https://catsystem-ai.cloudflareaccess.com", operatorEmail: "catsystem.exe@gmail.com" });

test("DEV has a separate explicit Worker/account, with inactive mandatory placeholders", () => {
  validateDevTemplate(template);
  assert.equal(template.name, "apu-ms-site-dev"); assert.notEqual(template.name, production.name);
  assert.equal(production.name, "apu-ms-site"); assert.equal(DEV.productionBranch, "next"); assert.equal(DEV.branch, "dev");
  assert.equal(DEV.productionUrl, "https://apu-ms-site.catsystem-exe.workers.dev");
  assert.equal(template.kv_namespaces[0].id, null); assert.equal(template.vars.CF_ACCESS_AUD, null);
  assert.equal(template.vars.APU_DEVELOPER_EMAILS, null); assert.ok(Object.entries(example).filter(([key]) => key !== "telemetry").every(([, value]) => value === null));
  assert.throws(() => validateDevInputs(example));
  assert.equal(template.vars.APU_LOCAL_DEV_AUTH, "0"); assert.equal(template.keep_vars, false);
  assert.equal(template.preview_urls, false); assert.equal(template.env, undefined); assert.equal(template.previews, undefined);
});
test("pinned Wrangler schema rejects incomplete template but accepts isolated generated DEV config", async () => {
  const schema = JSON.parse(await readFile(new URL("../node_modules/wrangler/config-schema.json", import.meta.url), "utf8"));
  const Ajv = require("ajv"), ajv = new Ajv({ strict: false, logger: false });
  const validate = ajv.compile(schema);
  assert.equal(validate(template), false, "null KV ID cannot be directly deployed as a valid Wrangler config");
  const config = buildDevConfig(template, artifact, inputs());
  assert.equal(validate(config), true, JSON.stringify(validate.errors));
});
for (const key of Object.keys(example).filter(key => key !== "telemetry")) {
  for (const missing of [undefined, null, ""]) test(`mandatory DEV ${key} rejects ${String(missing)} without fallback`, () => {
    const value = inputs(); if (missing === undefined) delete value[key]; else value[key] = missing;
    assert.throws(() => buildDevConfig(template, artifact, value));
  });
}
for (const id of [...production.kv_namespaces.flatMap(value => [value.id, value.preview_id]), ...production.previews.kv_namespaces.map(value => value.id)]) {
  test(`existing production/legacy/PR-specific KV namespace ${id} cannot be reused`, () => {
    assert.throws(() => buildDevConfig(template, artifact, { ...inputs(), kvNamespaceId: id }), { code: "existing_kv_reuse_forbidden" });
  });
}
for (const [label, change] of [
  ["zero KV placeholder", value => value.kvNamespaceId = "0".repeat(32)],
  ["malformed KV", value => value.kvNamespaceId = "not-a-namespace"],
  ["existing Access audience", value => value.accessAudience = production.previews.vars.CF_ACCESS_AUD],
  ["zero audience", value => value.accessAudience = "0".repeat(64)],
  ["malformed audience", value => value.accessAudience = "unverified-audience"],
  ["existing Access application", value => value.accessApplicationId = "67a86152-2917-40c8-8e5f-6dce0beeaca8"],
  ["zero Access application", value => value.accessApplicationId = "00000000-0000-0000-0000-000000000000"],
  ["malformed Access application", value => value.accessApplicationId = "invalid"],
  ["wrong Access issuer", value => value.accessTeamDomain = "https://other.cloudflareaccess.com"],
  ["HTTP issuer", value => value.accessTeamDomain = "http://catsystem-ai.cloudflareaccess.com"],
  ["additional developer", value => value.operatorEmail += ",teacher@example.com"],
  ["other developer", value => value.operatorEmail = "teacher@example.com"],
  ["auth bypass", value => value.APU_LOCAL_DEV_AUTH = "1"],
  ["provider key", value => value.OPENAI_API_KEY = "PRIVATE_PRODUCTION_KEY"],
  ["vector store", value => value.APU_VECTOR_STORE_ID = "PRIVATE_PRODUCTION_VECTOR"],
  ["target override", value => value.worker = "apu-ms-site"],
]) test(`DEV provisioning inputs reject ${label}`, () => {
  const value = inputs(); change(value); assert.throws(() => buildDevConfig(template, artifact, value));
});
for (const [label, change] of [
  ["production Worker", value => value.name = production.name], ["missing Worker", value => delete value.name],
  ["wrong account", value => value.account_id = "f".repeat(32)],
  ["inherited production vars", value => value.keep_vars = true],
  ["auth bypass", value => value.vars.APU_LOCAL_DEV_AUTH = "1"],
  ["provider default", value => value.vars.OPENAI_API_KEY = "PRIVATE_KEY"],
  ["vector default", value => value.vars.APU_VECTOR_STORE_ID = "PRIVATE_STORE"],
  ["named environment fallback", value => value.env = { production: production }],
  ["Preview base inheritance", value => value.previews = production.previews],
  ["production KV", value => value.kv_namespaces = production.kv_namespaces],
  ["service binding", value => value.services = [{ binding: "PROD", service: "apu-ms-site" }]],
  ["build command", value => value.build = { command: "PRIVATE_UNREVIEWED_COMMAND" }],
  ["route override", value => value.routes = ["production.invalid/*"]],
]) test(`DEV template rejects ${label}`, () => {
  const value = structuredClone(template); change(value); assert.throws(() => buildDevConfig(value, artifact, inputs()));
});
test("canonical artifact is reused by path; no production resources or environment defaults are copied", () => {
  const untrusted = structuredClone(artifact);
  untrusted.vars = { OPENAI_API_KEY: "PRIVATE_KEY", APU_VECTOR_STORE_ID: "PRIVATE_STORE" };
  untrusted.kv_namespaces = production.kv_namespaces;
  untrusted.services = [{ binding: "PROD", service: "apu-ms-site" }];
  untrusted.previews = production.previews;
  const before = JSON.stringify(untrusted), config = buildDevConfig(template, untrusted, inputs());
  assert.equal(JSON.stringify(untrusted), before, "source artifact config is not mutated");
  assert.equal(resolve(root, "dist/dev-worker", config.main), resolve(root, "dist/server/index.js"));
  assert.equal(resolve(root, "dist/dev-worker", config.base_dir), resolve(root, "dist/server"));
  assert.equal(resolve(root, "dist/dev-worker", config.assets.directory), resolve(root, "dist/client"));
  assert.deepEqual(config.kv_namespaces, [{ binding: "DEV_LOG_STATE", id: inputs().kvNamespaceId }]);
  assert.deepEqual(config.vars, { APU_LOCAL_DEV_AUTH: "0", CF_ACCESS_TEAM_DOMAIN: inputs().accessTeamDomain,
    CF_ACCESS_AUD: inputs().accessAudience, APU_DEVELOPER_EMAILS: inputs().operatorEmail });
  assert.doesNotMatch(JSON.stringify(config), /PRIVATE|OPENAI_API_KEY|APU_VECTOR_STORE_ID|services|previews/);
  assert.equal(config.keep_vars, false); assert.equal(config.name, DEV.worker);
});
for (const [field, value] of [["name", "other"], ["main", "./worker/index.ts"], ["no_bundle", false],
  ["rules", []], ["compatibility_date", "2000-01-01"], ["compatibility_flags", []], ["assets", {}]]) {
  test(`unexpected canonical artifact ${field} fails before staging`, () => {
    assert.throws(() => buildDevConfig(template, { ...artifact, [field]: value }, inputs()), { code: "unexpected_canonical_artifact" });
  });
}
for (const [label, change] of [
  ["production name", c => c.name = DEV.productionWorker], ["production account", c => delete c.account_id],
  ["production KV", c => c.kv_namespaces[0].id = production.kv_namespaces[0].id],
  ["Access reuse", c => c.vars.CF_ACCESS_AUD = production.previews.vars.CF_ACCESS_AUD],
  ["provider secret", c => c.vars.OPENAI_API_KEY = "PRIVATE_KEY"],
  ["unknown binding", c => c.r2_buckets = [{ binding: "PROD", bucket_name: "production" }]],
  ["inheritance", c => c.keep_vars = true], ["bypass", c => c.vars.APU_LOCAL_DEV_AUTH = "1"],
]) test(`future config validation rejects ${label}`, () => {
  const config = buildDevConfig(template, artifact, inputs()); change(config);
  assert.throws(() => validateDevConfig(config, template, inputs()), { code: "dev_config_or_isolation_mismatch" });
});
test("future command requires explicit new config and Worker; it is never executed", () => {
  const config = buildDevConfig(template, artifact, inputs());
  validateFutureDevCommand("npx", futureDevCommand(), config, template, inputs());
  assert.deepEqual(futureDevCommand(), ["--no-install", "wrangler", "deploy", "--config", "dist/dev-worker/wrangler.json", "--name", DEV.worker]);
  for (const args of [[], ["deploy"], futureDevCommand().slice(0, 5), [...futureDevCommand(), "--keep-vars"],
    futureDevCommand().map(x => x === DEV.worker ? DEV.productionWorker : x),
    futureDevCommand().map(x => x === "dist/dev-worker/wrangler.json" ? "wrangler.jsonc" : x)]) {
    assert.throws(() => validateFutureDevCommand("npx", args, config, template, inputs()));
  }
  assert.throws(() => validateFutureDevCommand("wrangler", futureDevCommand(), config, template, inputs()));
});
test("pinned explicit --config resolution cannot fall back to production's generated redirect", async () => {
  const source = await readFile(new URL("../node_modules/wrangler/wrangler-dist/cli.js", import.meta.url), "utf8");
  const start = source.indexOf("function resolveWranglerConfigPath("), end = source.indexOf("function findWranglerConfig(", start);
  const resolvePinned = new Function("path30", "findWranglerConfig", source.slice(start, end) + "; return resolveWranglerConfigPath;")(
    path, () => { throw Error("default production config lookup forbidden"); });
  assert.deepEqual(resolvePinned({ config: "dist/dev-worker/wrangler.json" }, { useRedirectIfAvailable: true }),
    { userConfigPath: "dist/dev-worker/wrangler.json", configPath: "dist/dev-worker/wrangler.json", deployConfigPath: undefined, redirected: false });
});
test("old Preview workflows stay on the old PR branch and do not deploy dev", async () => {
  for (const name of ["dev-preview.yml", "apu-preview-metadata-capture.yml"]) {
    const workflow = yaml.load(await readFile(new URL("../.github/workflows/" + name, import.meta.url), "utf8"));
    assert.deepEqual(workflow.on.push.branches, ["codex/f1-f3-mvp-stabilization"]);
    assert.ok(Object.values(workflow.jobs).every(job => job.if.includes("vars.APU_") && job.if.includes("'approved'")));
  }
  const source = await readFile(new URL("../ops/dev/prepare-worker.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from ["']node:child_process|\bfetch\s*\(|\bexecFile\s*\(|process\.env\s*[.\[]/);
});
for (const args of [[], ["--deploy"], ["deploy"], futureDevCommand(), ["--check-template"],
  ["--check-template", "--target", DEV.productionWorker], ["--check-template", "--target", DEV.worker, "--deploy"],
  ["--prepare-config", "--target", DEV.worker], ["--prepare-config", "--target", DEV.worker, "--inputs", "relative.json"]]) {
  test(`unsupported or implicit preparation command rejects ${JSON.stringify(args)}`, () => assert.throws(() => parsePreparationArgs(args)));
}
async function isolated(telemetry) {
  const directory = await mkdtemp(join(tmpdir(), "apu-dev-preparation-"));
  const script = join(directory, "ops/dev/prepare-worker.mjs"), inputsPath = join(directory, "inputs.json");
  await mkdir(dirname(script), { recursive: true }); await mkdir(join(directory, "dist/server"), { recursive: true });
  await writeFile(script, await readFile(new URL("../ops/dev/prepare-worker.mjs", import.meta.url)));
  await writeFile(join(directory, "wrangler.dev.json"), JSON.stringify(template));
  await writeFile(join(directory, "wrangler.jsonc"), productionText);
  await writeFile(join(directory, "dist/server/wrangler.json"), JSON.stringify(artifact));
  await writeFile(join(directory, "dist/server/index.js"), "export default {fetch(){return new Response('synthetic')}}");
  await writeFile(inputsPath, JSON.stringify({ ...inputs(), ...(telemetry ? { telemetry } : {}) }));
  const invoke = args => spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env: {
    ...process.env, OPENAI_API_KEY: "PRIVATE_PRODUCTION_KEY", APU_VECTOR_STORE_ID: "PRIVATE_VECTOR", CF_ACCESS_AUD: production.previews.vars.CF_ACCESS_AUD } });
  return { directory, inputsPath, invoke };
}
test("offline CLI stages only DEV files and preserves production config, artifact and source bytes", async () => {
  const f = await isolated();
  try {
    const productionPath = join(f.directory, "wrangler.jsonc"), artifactPath = join(f.directory, "dist/server/wrangler.json");
    const before = await readFile(artifactPath), originalEntry = await readFile(join(f.directory, "dist/server/index.js"));
    const check = f.invoke(["--check-config", "--target", DEV.worker, "--inputs", f.inputsPath]);
    assert.equal(check.status, 0, check.stderr); await assert.rejects(lstat(join(f.directory, "dist/dev-worker")), { code: "ENOENT" });
    const result = f.invoke(["--prepare-config", "--target", DEV.worker, "--inputs", f.inputsPath]);
    assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).deploymentAuthorized, false);
    const config = JSON.parse(await readFile(join(f.directory, "dist/dev-worker/wrangler.json"), "utf8"));
    validateDevConfig(config, template, inputs());
    assert.equal((await readFile(productionPath, "utf8")), productionText); assert.deepEqual(await readFile(artifactPath), before);
    assert.deepEqual(await readFile(join(f.directory, "dist/server/index.js")), originalEntry);
    const metadata = JSON.parse(await readFile(join(f.directory, "dist/dev-worker/preparation.json"), "utf8"));
    assert.equal(metadata.branch, "dev"); assert.equal(metadata.accessApplicationId, inputs().accessApplicationId);
    assert.equal(metadata.deploymentAuthorized, false); assert.equal(metadata.automaticDevUpdatesConfigured, false);
    assert.match(metadata.inputEvidence, /SUPPLIED INPUTS ONLY/);
    const repeat = f.invoke(["--prepare-config", "--target", DEV.worker, "--inputs", f.inputsPath]);
    assert.equal(repeat.status, 1); assert.deepEqual(await readFile(artifactPath), before);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});
test("incomplete inputs and deploy arguments cannot create output or expose ambient provider values", async () => {
  const f = await isolated();
  try {
    await writeFile(f.inputsPath, JSON.stringify(example));
    for (const args of [["--prepare-config", "--target", DEV.worker, "--inputs", f.inputsPath], ["--deploy", "--target", DEV.worker], futureDevCommand()]) {
      const result = f.invoke(args); assert.equal(result.status, 1); assert.doesNotMatch(result.stderr + result.stdout, /PRIVATE|PRODUCTION_KEY|VECTOR|0123456789abcdef/);
      await assert.rejects(lstat(join(f.directory, "dist/dev-worker")), { code: "ENOENT" });
    }
    const templateOnly = f.invoke(["--check-template", "--target", DEV.worker]);
    assert.equal(templateOnly.status, 0); assert.equal(JSON.parse(templateOnly.stdout).deploymentAuthorized, false);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});
test("pre-existing staging symlink cannot redirect writes into production artifacts", async () => {
  const f = await isolated();
  try {
    const original = await readFile(join(f.directory, "dist/server/wrangler.json"));
    await symlink(join(f.directory, "dist/server"), join(f.directory, "dist/dev-worker"));
    const result = f.invoke(["--prepare-config", "--target", DEV.worker, "--inputs", f.inputsPath]);
    assert.equal(result.status, 1); assert.deepEqual(await readFile(join(f.directory, "dist/server/wrangler.json")), original);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

const telemetryInputs = () => ({ enabled: true, dedicatedDev: true,
  databaseId: "12345678-1234-4234-8234-123456789abc", databaseName: "apu-ms-site-dev-telemetry",
  hostname: "apu-ms-site-dev.catsystem-exe.workers.dev", cohort: "synthetic-cohort", keyVersion: "k1", noticeVersion: "n1" });
test("B1 absent/disabled telemetry preserves original materialized bytes and has no D1 resource", () => {
  const legacy = structuredClone(template); delete legacy.vars.APU_TELEMETRY_ENABLED; delete legacy.vars.APU_TELEMETRY_METADATA_ENABLED;
  const old = buildDevConfig(legacy, artifact, inputs());
  assert.deepEqual(buildDevConfig(template, artifact, inputs()), old);
  assert.deepEqual(buildDevConfig(template, artifact, { ...inputs(), telemetry: { enabled: false } }), old);
  assert.equal(old.d1_databases, undefined);
  assert.equal(template.vars.APU_TELEMETRY_ENABLED, "0"); assert.equal(template.vars.APU_TELEMETRY_METADATA_ENABLED, "0");
});
test("B1 explicit DEV-only D1 input produces only dedicated optional binding, remains privacy/key/enrollment gated", async () => {
  const value = { ...inputs(), telemetry: telemetryInputs() }, config = buildDevConfig(template, artifact, value);
  validateDevConfig(config, template, value);
  assert.deepEqual(config.d1_databases, [{ binding: "TELEMETRY_DB", database_id: value.telemetry.databaseId, database_name: "apu-ms-site-dev-telemetry", migrations_dir: "../../telemetry/migrations" }]);
  assert.equal(config.vars.APU_TELEMETRY_ENABLED,"1"); assert.equal(config.vars.APU_TELEMETRY_ENV,"dev");
  assert.equal(config.vars.APU_TELEMETRY_METADATA_ENABLED,"0");
  assert.equal(config.vars.APU_TELEMETRY_PRIVACY_APPROVED,undefined); assert.equal(config.vars.TELEMETRY_CONTEXT_KEY,undefined);
  assert.equal(config.vars.APU_TELEMETRY_ELIGIBLE,undefined);
  const Ajv = require("ajv"), schema=JSON.parse(await readFile(new URL("../node_modules/wrangler/config-schema.json",import.meta.url),"utf8"));
  const validate = new Ajv({strict:false,logger:false}).compile(schema); assert.equal(validate(config),true,JSON.stringify(validate.errors));
  const forged=structuredClone(config);forged.d1_databases[0].binding="DB";
  assert.throws(()=>validateDevConfig(forged,template,value));
});
for(const [label,change] of [
  ["production name",t=>t.databaseName="apu-ms-site"], ["business binding",t=>t.binding="DB"],
  ["missing isolation",t=>delete t.dedicatedDev], ["false isolation",t=>t.dedicatedDev=false],
  ["malformed identity",t=>t.databaseId="bad"], ["zero identity",t=>t.databaseId="00000000-0000-0000-0000-000000000000"],
  ["production host",t=>t.hostname="apu.catsystem.ai"], ["cohort text",t=>t.cohort="PRIVATE PEDAGOGY"],
  ["secret input",t=>t.TELEMETRY_CONTEXT_KEY="PRIVATE"], ["privacy override",t=>t.privacyApproved=true],
  ["metadata override",t=>t.metadataEnabled=true], ["inactive resource",t=>t.enabled=false],
]) test(`B1 optional telemetry rejects ${label}`,()=>{
  const value=telemetryInputs();change(value);assert.throws(()=>buildDevConfig(template,artifact,{...inputs(),telemetry:value}));
});
for(const [key,value] of [["APU_TELEMETRY_ENABLED","1"],["APU_TELEMETRY_METADATA_ENABLED","1"],["APU_TELEMETRY_COHORT","unreviewed"]])
  test(`B1 telemetry template rejects ${key}=${value}`,()=>{const altered=structuredClone(template);altered.vars[key]=value;assert.throws(()=>validateDevTemplate(altered));});


const stagedTelemetry = () => ({ enabled: false, staged: true, dedicatedDev: true,
  databaseId: "12345678-1234-4234-8234-123456789abc", databaseName: "apu-ms-site-dev-telemetry",
  hostname: "apu-ms-site-dev.catsystem-exe.workers.dev" });
test("G1 staging binds only DEV telemetry D1 with collection/metadata definitively OFF", async () => {
  const value = { ...inputs(), telemetry: stagedTelemetry() }, config = buildDevConfig(template, artifact, value);
  validateDevConfig(config, template, value);
  assert.equal(config.name, "apu-ms-site-dev"); assert.equal(config.account_id, DEV.account);
  assert.deepEqual(config.d1_databases, [{ binding: "TELEMETRY_DB", database_id: value.telemetry.databaseId,
    database_name: "apu-ms-site-dev-telemetry", migrations_dir: "../../telemetry/migrations" }]);
  assert.deepEqual(config.vars, { ...buildDevConfig(template, artifact, inputs()).vars,
    APU_TELEMETRY_ENABLED: "0", APU_TELEMETRY_METADATA_ENABLED: "0", APU_TELEMETRY_ENV: "dev",
    APU_TELEMETRY_HOSTNAME: "apu-ms-site-dev.catsystem-exe.workers.dev" });
  assert.equal(resolve(root, "dist/dev-worker", config.d1_databases[0].migrations_dir), resolve(root, "telemetry/migrations"));
  const schema = JSON.parse(await readFile(new URL("../node_modules/wrangler/config-schema.json", import.meta.url), "utf8"));
  const Ajv = require("ajv"), validate = new Ajv({ strict: false, logger: false }).compile(schema);
  assert.equal(validate(config), true, JSON.stringify(validate.errors));
});
for (const [label, change] of [
  ["missing staging", t => delete t.staged], ["false staging", t => t.staged = false],
  ["enabled staging", t => t.enabled = true], ["missing disabled flag", t => delete t.enabled],
  ["false isolation", t => t.dedicatedDev = false], ["production Worker", t => t.worker = "apu-ms-site"],
  ["production database", t => t.databaseName = "apu-ms-site-telemetry"],
  ["business binding", t => t.binding = "DB"], ["binding override", t => t.binding = "TELEMETRY_DB"],
  ["missing UUID", t => delete t.databaseId], ["malformed UUID", t => t.databaseId = "not-a-uuid"],
  ["zero UUID", t => t.databaseId = "00000000-0000-0000-0000-000000000000"],
  ["production KV as UUID", t => t.databaseId = "4a24c791-d31a-4c09-8317-0c921cb744aa"],
  ["DEV Access UUID", t => t.databaseId = inputs().accessApplicationId],
  ["existing Access UUID", t => t.databaseId = "67a86152-2917-40c8-8e5f-6dce0beeaca8"],
  ["production hostname", t => t.hostname = "apu-ms-site.catsystem-exe.workers.dev"],
  ["host suffix", t => t.hostname += ".invalid"], ["URL instead of hostname", t => t.hostname = "https://" + t.hostname],
  ["metadata activation", t => t.metadataEnabled = true], ["privacy override", t => t.privacyApproved = true],
  ["enrollment", t => t.eligible = ["actor"]], ["cohort", t => t.cohort = "pilot"],
  ["secret", t => t.TELEMETRY_CONTEXT_KEY = "PRIVATE"],
  ["migration substitution", t => t.migrations_dir = "../../db/migrations"],
]) test(`G1 staged inputs reject ${label}`, () => {
  const t = stagedTelemetry(); change(t); assert.throws(() => buildDevConfig(template, artifact, { ...inputs(), telemetry: t }));
});
for (const [label, change] of [
  ["production Worker", c => c.name = DEV.productionWorker],
  ["wrong UUID", c => c.d1_databases[0].database_id = "87654321-1234-4234-8234-123456789abc"],
  ["wrong binding", c => c.d1_databases[0].binding = "DEV_LOG_STATE"],
  ["wrong name", c => c.d1_databases[0].database_name = "apu-ms-site"],
  ["wrong hostname", c => c.vars.APU_TELEMETRY_HOSTNAME = "apu.catsystem.ai"],
  ["collection activation", c => c.vars.APU_TELEMETRY_ENABLED = "1"],
  ["metadata activation", c => c.vars.APU_TELEMETRY_METADATA_ENABLED = "1"],
  ["privacy override", c => c.vars.APU_TELEMETRY_PRIVACY_APPROVED = "1"],
  ["enrollment", c => c.vars.APU_TELEMETRY_ELIGIBLE = "actor"],
  ["migration default", c => delete c.d1_databases[0].migrations_dir],
  ["migration substitution", c => c.d1_databases[0].migrations_dir = "../../db/migrations"],
  ["production binding inheritance", c => c.d1_databases.push({ binding: "DB", database_name: "production" })],
]) test(`G1 generated staged config rejects ${label}`, () => {
  const value = { ...inputs(), telemetry: stagedTelemetry() }, config = buildDevConfig(template, artifact, value);
  change(config); assert.throws(() => telemetryMigrationArgs("apply", config, template, value));
});
for (const mode of ["staged", "enabled"]) test(`G1 ${mode} rejects valid UUID reused from DEV KV or canonical production D1`, () => {
  const telemetry = mode === "staged" ? stagedTelemetry() : telemetryInputs();
  const value = { ...inputs(), telemetry };
  assert.throws(() => buildDevConfig(template, artifact, { ...value, kvNamespaceId: telemetry.databaseId.replaceAll("-", "") }),
    { code: "invalid_telemetry_database" });
  assert.throws(() => buildDevConfig(template, { ...artifact, d1_databases: [{ binding: "PRODUCTION", database_id: telemetry.databaseId }] }, value),
    { code: "production_telemetry_database_reuse_forbidden" });
});
test("G1 migration argument plans require staged OFF configuration, named DEV DB and explicit config only", () => {
  const value = { ...inputs(), telemetry: stagedTelemetry() }, config = buildDevConfig(template, artifact, value);
  for (const action of ["list", "apply"]) assert.deepEqual(telemetryMigrationArgs(action, config, template, value),
    ["d1", "migrations", action, "apu-ms-site-dev-telemetry", "--remote", "--config", "dist/dev-worker/wrangler.json"]);
  for (const action of ["execute", "create", "delete", "apply --config wrangler.jsonc", undefined])
    assert.throws(() => telemetryMigrationArgs(action, config, template, value));
  for (const telemetry of [undefined, { enabled: false }, telemetryInputs()]) {
    const other = { ...inputs(), ...(telemetry ? { telemetry } : {}) };
    assert.throws(() => telemetryMigrationArgs("apply", buildDevConfig(template, artifact, other), template, other), { code: "staged_telemetry_required" });
  }
});
test("G1 actual pinned Wrangler resolves config-relative migration from unrelated cwd and applies once to local D1", { timeout: 90000 }, async () => {
  const f = await isolated(stagedTelemetry());
  try {
    const migration = await readFile(new URL("../telemetry/migrations/0001_pilot_v1.sql", import.meta.url), "utf8");
    await mkdir(join(f.directory, "telemetry/migrations"), { recursive: true });
    await writeFile(join(f.directory, "telemetry/migrations/0001_pilot_v1.sql"), migration);
    const prepared = f.invoke(["--prepare-config", "--target", DEV.worker, "--inputs", f.inputsPath]);
    assert.equal(prepared.status, 0, prepared.stderr);
    const configPath = join(f.directory, "dist/dev-worker/wrangler.json");
    const configBytes = await readFile(configPath), config = JSON.parse(configBytes);
    const value = { ...inputs(), telemetry: stagedTelemetry() };
    validateDevConfig(config, template, value);
    const cwd = join(f.directory, "unrelated-cwd"); await mkdir(cwd);
    const env = { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_SEND_ERROR_REPORTS: "false",
      WRANGLER_LOG_PATH: join(f.directory, "wrangler.log"), CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false" };
    for (const key of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_API_KEY", "CLOUDFLARE_EMAIL", "CLOUDFLARE_ACCOUNT_ID"]) delete env[key];
    const run = args => {
      assert.ok(args.includes("--local") && !args.includes("--remote"), "local-only test execution");
      const result = spawnSync(process.execPath, [resolve(root, "node_modules/wrangler/bin/wrangler.js"), ...args,
        "--persist-to", join(f.directory, "local-state")], { cwd, env, encoding: "utf8", timeout: 25000 });
      assert.equal(result.status, 0, result.stderr + result.stdout); return result.stdout;
    };
    const migrations = action => run(telemetryMigrationArgs(action, config, template, value)
      .map(x => x === "--remote" ? "--local" : x === "dist/dev-worker/wrangler.json" ? configPath : x));
    const query = command => JSON.parse(run(["d1", "execute", "apu-ms-site-dev-telemetry", "--local", "--config", configPath, "--command", command, "--json"]))[0].results;
    assert.match(migrations("list"), /0001_pilot_v1\.sql/);
    migrations("apply");
    const sql = "SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name LIKE 'telemetry_%' AND sql IS NOT NULL ORDER BY type,name";
    const expected = new DatabaseSync(":memory:");
    try {
      expected.exec(migration);
      const normalize = rows => rows.map(r => ({ ...r, sql: r.sql.replace(/\s+/g, " ").trim() }));
      assert.deepEqual(normalize(query(sql)), normalize(expected.prepare(sql).all().map(r => ({ ...r }))));
    } finally { expected.close(); }
    assert.doesNotMatch(migrations("list"), /0001_pilot_v1\.sql/);
    migrations("apply"); // Reapplying via bookkeeping must not rerun CREATE TABLE.
    assert.deepEqual(query("SELECT name,COUNT(*) AS applied FROM d1_migrations GROUP BY name"), [{ name: "0001_pilot_v1.sql", applied: 1 }]);
    assert.deepEqual(query("SELECT (SELECT COUNT(*) FROM telemetry_sessions)+(SELECT COUNT(*) FROM telemetry_events)+(SELECT COUNT(*) FROM telemetry_ai_calls) AS records"), [{ records: 0 }]);
    assert.deepEqual(await readFile(configPath), configBytes);
    assert.equal(await readFile(join(f.directory, "wrangler.jsonc"), "utf8"), productionText);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

test("G1 operator bootstrap config is schema-valid without a fake pre-creation UUID; Wrangler matches the lock", async () => {
  const installed = JSON.parse(await readFile(new URL("../node_modules/wrangler/package.json", import.meta.url), "utf8"));
  const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
  assert.equal(installed.version, lock.packages["node_modules/wrangler"].version);
  const schema = JSON.parse(await readFile(new URL("../node_modules/wrangler/config-schema.json", import.meta.url), "utf8"));
  const Ajv = require("ajv"), validate = new Ajv({ strict: false, logger: false }).compile(schema);
  assert.equal(validate({ name: DEV.worker, account_id: DEV.account, send_metrics: false }), true, JSON.stringify(validate.errors));
});

// Synthetic receipt identities and TTLs are validation fixtures, never operator approvals.
const receiptInputs = () => ({ dedicatedDev: true, namespaceId: 'abcdef0123456789abcdef0123456789', ttlSeconds: 3600 });
test('G1-C5 receipt KV is separate, finite, schema-valid and composes with staged OFF/OFF D1', async () => {
  const value = { ...inputs(), telemetry: stagedTelemetry(), pilotRules: receiptInputs() };
  const config = buildDevConfig(template, artifact, value);
  validateDevConfig(config, template, value);
  assert.deepEqual(config.kv_namespaces, [{ binding: 'DEV_LOG_STATE', id: value.kvNamespaceId }, { binding: 'PILOT_RULES_ACCEPTANCE', id: value.pilotRules.namespaceId }]);
  assert.equal(config.vars.PILOT_RULES_RECEIPT_TTL_SECONDS, '3600');
  assert.equal(config.vars.APU_TELEMETRY_ENABLED, '0');
  assert.equal(config.vars.APU_TELEMETRY_METADATA_ENABLED, '0');
  assert.equal(config.vars.APU_TELEMETRY_ELIGIBLE, undefined);
  assert.equal(config.vars.APU_TELEMETRY_PRIVACY_APPROVED, undefined);
  const Ajv = require('ajv'), schema = JSON.parse(await readFile(new URL('../node_modules/wrangler/config-schema.json', import.meta.url), 'utf8'));
  const validate = new Ajv({ strict: false, logger: false }).compile(schema);
  assert.equal(validate(config), true, JSON.stringify(validate.errors));
  const missing = buildDevConfig(template, artifact, inputs());
  assert.equal(missing.vars.PILOT_RULES_RECEIPT_TTL_SECONDS, undefined);
  assert.equal(missing.kv_namespaces.length, 1, 'missing receipt config has no default binding/TTL');
  for (const field of ['kvNamespaceId', 'accessApplicationId', 'accessAudience', 'accessTeamDomain', 'operatorEmail']) {
    const incomplete = { ...value }; delete incomplete[field];
    assert.throws(() => buildDevConfig(template, artifact, incomplete));
  }
});
for (const ttlSeconds of [60, 31_536_000]) test(`G1-C5 accepts explicit server TTL boundary ${ttlSeconds}`, () => {
  const config = buildDevConfig(template, artifact, { ...inputs(), pilotRules: { ...receiptInputs(), ttlSeconds } });
  assert.equal(config.vars.PILOT_RULES_RECEIPT_TTL_SECONDS, String(ttlSeconds));
});
for (const ttlSeconds of [undefined, null, '', '3600', 'Infinity', Infinity, NaN, 59, 31_536_001, 60.5, 0, -1]) test(`G1-C5 rejects absent/nonfinite/noninteger/out-of-range TTL ${String(ttlSeconds)}`, () => {
  const pilotRules = { ...receiptInputs(), ttlSeconds };
  assert.throws(() => buildDevConfig(template, artifact, { ...inputs(), pilotRules }));
});
for (const [label, change] of [
  ['missing identity', r => delete r.namespaceId], ['null identity', r => r.namespaceId = null],
  ['zero identity', r => r.namespaceId = '0'.repeat(32)], ['malformed identity', r => r.namespaceId = 'not-an-id'],
  ['missing dedication', r => delete r.dedicatedDev], ['false dedication', r => r.dedicatedDev = false],
  ['unknown field', r => r.binding = 'DEV_LOG_STATE'], ['secret', r => r.secret = 'SYNTHETIC_FORBIDDEN'],
]) test(`G1-C5 receipt input rejects ${label}`, () => {
  const pilotRules = receiptInputs(); change(pilotRules);
  assert.throws(() => buildDevConfig(template, artifact, { ...inputs(), pilotRules }));
});
for (const namespaceId of [inputs().kvNamespaceId, inputs().accessApplicationId.replaceAll('-', ''), stagedTelemetry().databaseId.replaceAll('-', ''),
  ...production.kv_namespaces.flatMap(kv => [kv.id, kv.preview_id]), ...production.previews.kv_namespaces.map(kv => kv.id)]) test(`G1-C5 receipt namespace cannot reuse existing resource ${namespaceId}`, () => {
  assert.throws(() => buildDevConfig(template, artifact, { ...inputs(), telemetry: stagedTelemetry(), pilotRules: { ...receiptInputs(), namespaceId } }));
});
for (const place of ['root', 'preview', 'env']) test(`G1-C5 rejects receipt namespace discovered in canonical ${place} artifact`, () => {
  const source = structuredClone(artifact), kv_namespaces = [{ binding: 'UNRELATED', id: receiptInputs().namespaceId }];
  if (place === 'root') source.kv_namespaces = kv_namespaces;
  else if (place === 'preview') source.previews = { kv_namespaces };
  else source.env = { production: { kv_namespaces } };
  assert.throws(() => buildDevConfig(template, source, { ...inputs(), pilotRules: receiptInputs() }), { code: 'production_pilot_rules_namespace_reuse_forbidden' });
});
for (const mutate of [c => c.kv_namespaces[1].binding = 'DEV_LOG_STATE', c => c.kv_namespaces[1].id = inputs().kvNamespaceId,
  c => delete c.vars.PILOT_RULES_RECEIPT_TTL_SECONDS, c => c.vars.PILOT_RULES_RECEIPT_TTL_SECONDS = '0']) test('G1-C5 rejects post-preparation receipt config substitution', () => {
  const value = { ...inputs(), pilotRules: receiptInputs() }, config = buildDevConfig(template, artifact, value);
  mutate(config); assert.throws(() => validateDevConfig(config, template, value));
});
test('G1-C5 offline CLI stages the reviewed receipt contract without secrets or remote execution', async () => {
  const f = await isolated(stagedTelemetry());
  try {
    const value = { ...inputs(), telemetry: stagedTelemetry(), pilotRules: receiptInputs() };
    await writeFile(f.inputsPath, JSON.stringify(value));
    const result = f.invoke(['--prepare-config', '--target', DEV.worker, '--inputs', f.inputsPath]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).deploymentAuthorized, false);
    const config = JSON.parse(await readFile(join(f.directory, 'dist/dev-worker/wrangler.json'), 'utf8'));
    validateDevConfig(config, template, value);
    assert.equal(config.vars.PILOT_RULES_RECEIPT_TTL_SECONDS, '3600');
    assert.equal(config.kv_namespaces[1].binding, 'PILOT_RULES_ACCEPTANCE');
    assert.doesNotMatch(JSON.stringify(config), /PRIVATE_PRODUCTION_KEY|PRIVATE_VECTOR|TELEMETRY_CONTEXT_KEY|APU_TELEMETRY_ELIGIBLE/);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});
