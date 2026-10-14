import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv from "ajv";
import ts from "typescript";

const read = path => readFile(new URL(path, import.meta.url), "utf8");
const [source, plan, schema, wranglerPackage, pkg] = await Promise.all([
  read("../wrangler.jsonc"), read("../config/e2e-preview.preparation.json").then(JSON.parse),
  read("../node_modules/wrangler/config-schema.json").then(JSON.parse),
  read("../node_modules/wrangler/package.json").then(JSON.parse), read("../package.json").then(JSON.parse),
]);
const parsed = ts.parseConfigFileTextToJson("wrangler.jsonc", source);
assert.equal(parsed.error, undefined);
const production = parsed.config;
const validate = new Ajv({ allErrors: true }).compile({ ...schema, $ref: "#/definitions/RawConfig" });

test("installed Wrangler supports schema-valid top-level production and proposed Preview fields", () => {
  assert.equal(wranglerPackage.version, "4.150.0");
  assert.equal(validate(production), true, JSON.stringify(validate.errors));
  // Validate field placement/types only, not deployability: KV and Access inputs remain absent.
  assert.equal(validate({ ...production, previews: plan.proposedPreviewSettings }), true, JSON.stringify(validate.errors));
  for (const key of ["assets", "compatibility_date", "compatibility_flags", "name", "main"]) {
    assert.equal(validate({ ...production, previews: { [key]: production[key] } }), false, `${key} stays top-level`);
  }
});

test("preparation is deliberately not a deployable Wrangler configuration and contains no resource fallback", () => {
  assert.equal(plan.kind, "apu-worker-preview-preparation"); assert.equal(plan.deployable, false);
  assert.equal(validate(plan), false);
  assert.equal(plan.baseConfig, "wrangler.jsonc");
  assert.equal(plan.workerName, production.name); assert.equal(plan.previewName, "apu-pr60-e2e");
  assert.notEqual(plan.previewName, plan.sourceBranch.replaceAll("/", "-"));
  assert.equal(Object.hasOwn(production, "previews"), false, "no incomplete active Preview block");
  assert.equal(plan.requiredOperatorInputs.dedicatedKvNamespaceId, null);
  assert.deepEqual(plan.kvRequirement, { binding: "DEV_LOG_STATE", dedicatedNamespaceRequired: true, allowProductionNamespace: false, allowExistingPreviewId: false });
  for (const namespace of production.kv_namespaces) {
    assert.equal(JSON.stringify(plan).includes(namespace.id), false);
    assert.equal(JSON.stringify(plan).includes(namespace.preview_id), false);
  }
  assert.match(schema.definitions.PreviewsConfig.properties.kv_namespaces.items.properties.preview_id.description, /wrangler dev/);
});

test("Preview requires explicit Access/provider setup and excludes shared base secrets", () => {
  assert.equal(plan.ignorePreviewsBaseConfig, true);
  for (const name of ["CF_ACCESS_TEAM_DOMAIN", "CF_ACCESS_AUD", "APU_DEVELOPER_EMAILS", "previewSecretsFilePath"]) {
    assert.equal(plan.requiredOperatorInputs[name], null);
  }
  assert.deepEqual(plan.proposedPreviewSettings.secrets.required, ["OPENAI_API_KEY", "APU_VECTOR_STORE_ID"]);
  assert.equal(plan.proposedPreviewSettings.vars.APU_LOCAL_DEV_AUTH, "0");
  assert.equal(Object.hasOwn(plan.proposedPreviewSettings, "observability"), false, "retain top-level observability without a Preview override");
});

test("standalone module graph, assets, production identity/KV and deployment commands remain intact", () => {
  assert.equal(production.name, "apu-ms-site"); assert.equal(production.main, "./dist/server/index.js");
  assert.equal(production.no_bundle, true); assert.equal(production.find_additional_modules, true);
  assert.equal(production.base_dir, "./dist/server");
  assert.deepEqual(production.rules, [{ type: "ESModule", globs: ["**/*.js", "**/*.mjs"] }]);
  assert.equal(production.compatibility_date, "2026-08-21"); assert.deepEqual(production.compatibility_flags, ["nodejs_compat"]);
  assert.deepEqual(production.assets, { directory: "dist/client", binding: "ASSETS", not_found_handling: "none" });
  assert.deepEqual(production.kv_namespaces, [{ binding: "DEV_LOG_STATE", id: "4a24c791d31a4c0983170c921cb744aa", preview_id: "8dd4e8a10dc74086bbd746e733b3d8d8" }]);
  assert.equal(production.keep_vars, true); assert.equal(production.preview_urls, true);
  assert.equal(pkg.scripts.build, "bash scripts/build-verified.sh");
  assert.equal(pkg.scripts.deploy, "wrangler deploy --config wrangler.jsonc --keep-vars");
  assert.ok(plan.requiredDeploymentEvidence.includes("deploymentId"));
  assert.ok(plan.requiredDeploymentEvidence.includes("boundKvNamespaceId"));
});
