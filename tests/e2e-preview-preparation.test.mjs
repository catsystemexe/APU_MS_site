import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import Ajv from "ajv";
import ts from "typescript";

const read = path => readFile(new URL(path, import.meta.url), "utf8");
const [source, plan, schema, wranglerPackage, pkg, lock] = await Promise.all([
  read("../wrangler.jsonc"), read("../config/e2e-preview.preparation.json").then(JSON.parse),
  read("../node_modules/wrangler/config-schema.json").then(JSON.parse),
  read("../node_modules/wrangler/package.json").then(JSON.parse), read("../package.json").then(JSON.parse),
  read("../package-lock.json").then(JSON.parse),
]);
const parsed = ts.parseConfigFileTextToJson("wrangler.jsonc", source);
assert.equal(parsed.error, undefined);
const production = parsed.config;
const compile = name => new Ajv({ allErrors: true }).compile({ definitions: schema.definitions, $ref: `#/definitions/${name}` });
const validate = compile("RawConfig");
const validatePreview = compile("PreviewsConfig");
const dedicatedId = "1729ce8a6acd4cdcbed8248ac543677b";
const verifiedAudience = "1e1680481c99464a844a6ef0e502cf49fae89fc91c8cf3806ba48026b0088610";
const productionKv = [{ binding: "DEV_LOG_STATE", id: "4a24c791d31a4c0983170c921cb744aa", preview_id: "8dd4e8a10dc74086bbd746e733b3d8d8" }];
const isolatedKv = [{ binding: "DEV_LOG_STATE", id: dedicatedId }];

function assertPreviewIsolation(config) {
  assert.deepEqual(config.kv_namespaces, productionKv, "production binding must stay unchanged");
  assert.deepEqual(config.previews?.kv_namespaces, isolatedKv, "explicit dedicated id required; no fallback or preview_id");
}

test("installed Wrangler validates active Preview placement and rejects top-level-only fields", () => {
  assert.equal(wranglerPackage.version, "4.150.0");
  assert.equal(validate(production), true, JSON.stringify(validate.errors));
  assert.equal(validatePreview(production.previews), true, JSON.stringify(validatePreview.errors));
  for (const key of ["assets", "compatibility_date", "compatibility_flags", "name", "main", "no_bundle", "account_id"]) {
    assert.equal(validate({ ...production, previews: { ...production.previews, [key]: production[key] ?? "not-preview-specific" } }), false, `${key} stays top-level`);
  }
  assert.equal(pkg.devDependencies.ajv, "6.15.0", "schema test dependency must be direct and pinned");
  assert.equal(lock.packages[""].devDependencies.ajv, pkg.devDependencies.ajv);
});

test("verified dedicated KV replaces unknown preparation data without production or legacy-preview reuse", () => {
  assertPreviewIsolation(production);
  assert.equal(plan.verifiedResources.accountId, "4638092f63fa7fe58bcb9d2d041b7855");
  assert.deepEqual(plan.verifiedResources.dedicatedKv, {
    binding: "DEV_LOG_STATE", namespaceName: "apu-pr60-e2e-devlog-state", namespaceId: dedicatedId,
    provisioningStatus: "PROVISIONED", initiallyEmpty: true, boundToWorkerAtCreation: false, previewBindingDeployed: false,
  });
  assert.equal(Object.hasOwn(plan.requiredOperatorInputs, "dedicatedKvNamespaceId"), false);
  assert.match(plan.verifiedResources.evidence, /operator report/);
  assert.deepEqual(plan.kvRequirement, { binding: "DEV_LOG_STATE", dedicatedNamespaceRequired: true, allowProductionNamespace: false, allowExistingPreviewId: false });
  assert.match(schema.definitions.PreviewsConfig.properties.kv_namespaces.items.properties.preview_id.description, /wrangler dev/);
  for (const id of [undefined, productionKv[0].id, productionKv[0].preview_id]) {
    assert.throws(() => assertPreviewIsolation({ ...production, previews: { ...production.previews, kv_namespaces: [{ binding: "DEV_LOG_STATE", ...(id ? { id } : {}) }] } }));
  }
});

test("operator-verified Access vars are Preview-only; deployment and tester remain pending without provider credentials", () => {
  assert.equal(plan.kind, "apu-worker-preview-preparation");
  assert.equal(plan.deployable, false); assert.equal(plan.readiness, "NOT READY FOR DEPLOYMENT");
  assert.deepEqual(plan.deploymentAuthorization, {
    authorized: false, deployableFlagIsTechnicalLock: false,
    enforcedBy: "Execution authorization boundary; Wrangler does not read this preparation manifest",
  });
  assert.equal(plan.classification, "STATIC CONFIGURATION COMPLETE — DEPLOYMENT PENDING AUTHORIZATION");
  assert.equal(validate(plan), false, "preparation manifest must never be passed to Wrangler");
  assert.equal(plan.baseConfig, "wrangler.jsonc");
  assert.equal(plan.workerName, production.name); assert.equal(plan.previewName, "apu-pr60-e2e");
  assert.notEqual(plan.previewName, plan.sourceBranch.replaceAll("/", "-"));
  assert.deepEqual(production.previews, plan.proposedPreviewSettings);
  assert.deepEqual(production.previews.vars, { APU_LOCAL_DEV_AUTH: "0", CF_ACCESS_TEAM_DOMAIN: "https://catsystem-ai.cloudflareaccess.com", CF_ACCESS_AUD: verifiedAudience, APU_DEVELOPER_EMAILS: "catsystem.exe@gmail.com" });
  assert.deepEqual(plan.verifiedAccess.approvedDeveloperEmails, ["catsystem.exe@gmail.com"]);
  assert.equal(Object.hasOwn(plan.requiredOperatorInputs, "APU_DEVELOPER_EMAILS"), false);
  assert.equal(Object.hasOwn(production, "vars"), false, "do not add top-level runtime variables");
  assert.equal(Object.hasOwn(plan.requiredOperatorInputs, "CF_ACCESS_AUD"), false);
  assert.equal(plan.requiredOperatorInputs.approvedTesterIdentities, null);
  assert.equal(plan.verifiedAccess.accessConfigurationComplete, true);
  assert.equal(plan.verifiedAccess.hostedAccessEffectivenessVerified, false);
  assert.equal(plan.verifiedAccess.exactApplicationAudienceVerified, true);
  assert.equal(plan.verifiedAccess.separateTesterApproved, false);
  assert.equal(plan.verifiedAccess.separateTesterRoleVerified, false);
  assert.deepEqual(plan.verifiedAccess.audienceVerification, {
    applicationName: "apu-ms-site - Cloudflare Workers",
    applicationId: "67a86152-2917-40c8-8e5f-6dce0beeaca8",
    visuallyTranscribedCandidate: verifiedAudience,
    exactCopiedTag: verifiedAudience,
    exactComparisonConfirmed: true,
    status: "OPERATOR-VERIFIED — C2-C1-B operator copied the existing Access application's AUD tag and confirmed this exact value; not independently inspected through Cloudflare by Codex",
  });
  assert.equal(plan.verifiedAccess.policyName, "APU Developers");
  assert.equal(plan.verifiedAccess.policyId, "0370da35-f13c-4f72-8ced-9468bf1ca025");
  assert.equal(plan.verifiedAccess.policyAction, "Allow");
  assert.match(plan.verifiedAccess.workerAccessScope, /All traffic.*production and previews.*every URL/);
  assert.equal(plan.ignorePreviewsBaseConfig, true);
  assert.equal(Object.hasOwn(production.previews, "secrets"), false, "no provider-secret declarations for bootstrap");
  assert.equal(plan.providerBootstrap.providerFree, true);
  assert.equal(plan.providerBootstrap.providerSecretsPresent, false);
  assert.equal(plan.providerBootstrap.providerRequestsAuthorized, false);
  assert.deepEqual(plan.providerBootstrap.requiredSecrets, []);
  for (const key of ["OPENAI_API_KEY", "APU_VECTOR_STORE_ID"]) assert.equal(Object.hasOwn(production.previews.vars, key), false);
  assert.equal(Object.hasOwn(plan.requiredOperatorInputs, "previewSecretsFilePath"), false);
  assert.equal(Object.hasOwn(production.previews, "observability"), false);
  assert.equal(plan.remainingBlockers.some(item => /AUD/.test(item)), false, "missing-AUD blocker is obsolete");
  assert.ok(plan.remainingBlockers.some(item => /no separate tester is approved or verified/.test(item)));
  assert.deepEqual(plan.documentationReconciliation, { unpublishedWindowsC2B1Edits: 2, inspectedByCodex: false, requiredBeforeMerge: true });
});

test("standalone module graph, assets, production identity/KV and deployment commands remain intact", () => {
  assert.equal(production.name, "apu-ms-site"); assert.equal(production.main, "./dist/server/index.js");
  assert.equal(production.no_bundle, true); assert.equal(production.find_additional_modules, true);
  assert.equal(production.base_dir, "./dist/server");
  assert.deepEqual(production.rules, [{ type: "ESModule", globs: ["**/*.js", "**/*.mjs"] }]);
  assert.equal(production.compatibility_date, "2026-08-21"); assert.deepEqual(production.compatibility_flags, ["nodejs_compat"]);
  assert.deepEqual(production.assets, { directory: "dist/client", binding: "ASSETS", not_found_handling: "none" });
  assertPreviewIsolation(production);
  assert.equal(production.keep_vars, true); assert.equal(production.preview_urls, true);
  assert.equal(pkg.scripts.build, "bash scripts/build-verified.sh");
  assert.equal(pkg.scripts.deploy, "wrangler deploy --config wrangler.jsonc --keep-vars");
  assert.ok(plan.requiredDeploymentEvidence.includes("deploymentId"));
  assert.ok(plan.requiredDeploymentEvidence.includes("boundKvNamespaceId"));
});

test("canonical Vinext effective configuration preserves the full isolated Preview block and production contract", async () => {
  const generatedPath = new URL("../dist/server/wrangler.json", import.meta.url);
  const effective = JSON.parse(await readFile(generatedPath, "utf8"));
  const redirectPath = new URL("../.wrangler/deploy/config.json", import.meta.url);
  const redirect = JSON.parse(await readFile(redirectPath, "utf8"));
  assert.equal(resolve(dirname(fileURLToPath(redirectPath)), redirect.configPath), fileURLToPath(generatedPath));
  assert.equal(validatePreview(effective.previews), true, JSON.stringify(validatePreview.errors));
  assert.deepEqual(effective.previews, production.previews, "STOP on any missing or changed Preview setting");
  assert.equal(plan.generatedConfiguration.previewIsolationVerified, true);
  assert.match(plan.generatedConfiguration.verificationScope, /STATIC GENERATED CONFIG ONLY.*not verified/);
  assertPreviewIsolation(effective);
  assert.equal(effective.name, production.name);
  assert.equal(effective.no_bundle, true);
  assert.deepEqual(effective.rules, production.rules);
  assert.equal(resolve(dirname(fileURLToPath(generatedPath)), effective.main), fileURLToPath(new URL("../dist/server/index.js", import.meta.url)));
  assert.equal(resolve(dirname(fileURLToPath(generatedPath)), effective.assets.directory), fileURLToPath(new URL("../dist/client", import.meta.url)));
  assert.equal(effective.assets.binding, "ASSETS"); assert.equal(effective.assets.not_found_handling, "none");
  assert.equal(effective.compatibility_date, production.compatibility_date);
  assert.deepEqual(effective.compatibility_flags, production.compatibility_flags);
  assert.deepEqual(effective.observability, production.observability);
  assert.equal(effective.keep_vars, true);
});

test("actual built API enforces verified Preview Access vars with synthetic JWTs and no external requests", async t => {
  const keys = ["CF_ACCESS_TEAM_DOMAIN", "CF_ACCESS_AUD", "APU_DEVELOPER_EMAILS", "APU_LOCAL_DEV_AUTH", "OPENAI_API_KEY", "APU_VECTOR_STORE_ID", "NODE_ENV"];
  const saved = new Map(keys.map(key => [key, process.env[key]]));
  const originalFetchKey = Symbol.for("vinext.fetchCache.originalFetch");
  const patchInstalledKey = Symbol.for("vinext.fetchCache.patchInstalled");
  const globals = new Map(["fetch", originalFetchKey, patchInstalledKey].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => {
    for (const [key, value] of saved) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    for (const [key, descriptor] of globals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  });
  for (const key of keys) delete process.env[key];
  const { previews } = JSON.parse(await read("../dist/server/wrangler.json"));
  Object.assign(process.env, previews.vars, { NODE_ENV: "production" });
  const keyPair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true, ["sign", "verify"],
  );
  const kid = "synthetic-preview-key";
  const publicJwk = { ...await crypto.subtle.exportKey("jwk", keyPair.publicKey), kid, alg: "RS256", use: "sig" };
  let jwksRequests = 0;
  const fixtureFetch = async input => {
    assert.equal(String(input), `${previews.vars.CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`, "only synthetic JWKS allowed; no external/provider request");
    jwksRequests++;
    return Response.json({ keys: [publicJwk] });
  };
  globalThis.fetch = fixtureFetch; globalThis[originalFetchKey] = fixtureFetch; delete globalThis[patchInstalledKey];
  const token = async (overrides = {}) => {
    const segment = value => Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsigned = `${segment({ alg: "RS256", kid, typ: "JWT" })}.${segment({
      iss: previews.vars.CF_ACCESS_TEAM_DOMAIN, aud: previews.vars.CF_ACCESS_AUD,
      email: previews.vars.APU_DEVELOPER_EMAILS, exp: Math.floor(Date.now() / 1000) + 300, ...overrides,
    })}`;
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keyPair.privateKey, new TextEncoder().encode(unsigned));
    return `${unsigned}.${Buffer.from(signature).toString("base64url")}`;
  };
  const url = new URL("../dist/server/index.js", import.meta.url); url.searchParams.set("verified-preview-auth", crypto.randomUUID());
  const worker = (await import(url.href)).default;
  const request = jwt => worker.fetch(new Request("https://preview.invalid/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json", ...(jwt ? { "cf-access-jwt-assertion": jwt } : {}) },
    body: JSON.stringify({ message: "Provider-free bootstrap check" }),
  }), {}, { waitUntil() {} });
  await t.test("missing AUD still fails closed", async () => {
    delete process.env.CF_ACCESS_AUD;
    try { assert.equal((await request(await token())).status, 401); }
    finally { process.env.CF_ACCESS_AUD = previews.vars.CF_ACCESS_AUD; }
    assert.equal(jwksRequests, 0);
  });
  await t.test("missing JWT fails closed", async () => {
    assert.equal((await request()).status, 401);
    assert.equal(jwksRequests, 0);
  });
  await t.test("malformed JWT fails closed", async () => {
    assert.equal((await request("not-a-trusted-token")).status, 401);
    assert.equal(jwksRequests, 0);
  });
  await t.test("signed JWT for another audience fails closed", async () => {
    assert.equal((await request(await token({ aud: "synthetic-wrong-audience" }))).status, 401);
    assert.equal(jwksRequests, 0);
  });
  await t.test("invalid signature fails closed with synthetic JWKS", async () => {
    const valid = await token();
    const invalid = `${valid.slice(0, valid.lastIndexOf(".") + 1)}${Buffer.from("invalid-signature").toString("base64url")}`;
    assert.equal((await request(invalid)).status, 401);
    assert.ok(jwksRequests > 0);
  });
  await t.test("valid synthetic JWT reaches missing-provider 503 without a provider call", async () => {
    assert.equal((await request(await token())).status, 503);
  });
});
