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
import { DEV, validateDevTemplate, validateDevInputs, buildDevConfig, validateDevConfig,
  futureDevCommand, validateFutureDevCommand, parsePreparationArgs } from "../ops/dev/prepare-worker.mjs";
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
  assert.equal(template.vars.APU_DEVELOPER_EMAILS, null); assert.ok(Object.values(example).every(value => value === null));
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
for (const key of Object.keys(example)) {
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
async function isolated() {
  const directory = await mkdtemp(join(tmpdir(), "apu-dev-preparation-"));
  const script = join(directory, "ops/dev/prepare-worker.mjs"), inputsPath = join(directory, "inputs.json");
  await mkdir(dirname(script), { recursive: true }); await mkdir(join(directory, "dist/server"), { recursive: true });
  await writeFile(script, await readFile(new URL("../ops/dev/prepare-worker.mjs", import.meta.url)));
  await writeFile(join(directory, "wrangler.dev.json"), JSON.stringify(template));
  await writeFile(join(directory, "wrangler.jsonc"), productionText);
  await writeFile(join(directory, "dist/server/wrangler.json"), JSON.stringify(artifact));
  await writeFile(join(directory, "dist/server/index.js"), "export default {fetch(){return new Response('synthetic')}}");
  await writeFile(inputsPath, JSON.stringify(inputs()));
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
