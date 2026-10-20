import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify, isDeepStrictEqual } from "node:util";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const TARGET = Object.freeze({
  repository: "catsystemexe/APU_MS_site", branch: "codex/f1-f3-mvp-stabilization",
  account: "4638092f63fa7fe58bcb9d2d041b7855", worker: "apu-ms-site",
  preview: "apu-pr60-e2e", previewId: "79968345270d4008954af42b360775d2",
  url: "https://apu-pr60-e2e-apu-ms-site.catsystem-exe.workers.dev",
  kv: "1729ce8a6acd4cdcbed8248ac543677b", issuer: "https://catsystem-ai.cloudflareaccess.com",
});
export const ACCESS_VARS = Object.freeze({ APU_LOCAL_DEV_AUTH: "0", CF_ACCESS_TEAM_DOMAIN: TARGET.issuer,
  CF_ACCESS_AUD: "1e1680481c99464a844a6ef0e502cf49fae89fc91c8cf3806ba48026b0088610",
  APU_DEVELOPER_EMAILS: "catsystem.exe@gmail.com" });
const CONFIG = "dist/server/wrangler.json";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
class GuardFailure extends Error {
  constructor(code) { super(code); this.code = code; }
}
function requireThat(condition, code) { if (!condition) throw new GuardFailure(code); }
function equal(actual, expected, code) { requireThat(isDeepStrictEqual(actual, expected), code); }
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
function classified(stage, error, upload) {
  const failure = new GuardFailure(error instanceof GuardFailure ? error.code : "guard_failed_details_suppressed");
  failure.stage = stage; failure.upload = upload;
  return failure;
}
export function failureSummary(error) {
  // Only our own fixed codes are printable; never serialize Error/cause/raw IO.
  return { stage: error instanceof GuardFailure ? error.stage ?? "guard_entry" : "guard_entry",
    cause: error instanceof GuardFailure ? error.code : "guard_failed_details_suppressed",
    upload: error instanceof GuardFailure ? error.upload ?? "unattempted" : "unattempted",
    ...(error instanceof GuardFailure && error.priorFailure ? { priorFailure: error.priorFailure } : {}) };
}
// Normalized Vinext fields not used as resource configuration. Unknown fields
// fail closed instead of silently inheriting a future persistent binding.
const EMPTY_FIELDS = {
  vars: {}, durable_objects: { bindings: [] }, workflows: [], migrations: [], exports: {},
  triggers: {}, cloudchamber: {}, send_email: [], queues: { producers: [], consumers: [] }, connect: [],
  r2_buckets: [], d1_databases: [], vectorize: [], ai_search_namespaces: [], ai_search: [], agent_memory: [],
  hyperdrive: [], services: [], analytics_engine_datasets: [], dispatch_namespaces: [], mtls_certificates: [],
  pipelines: [], k2: [], secrets_store_secrets: [], artifacts: [], unsafe_hello_world: [], flagship: [],
  worker_loaders: [], ratelimits: [], vpc_services: [], vpc_networks: [], logfwdr: { bindings: [] },
};
const TOP_FIELDS = new Set([...Object.keys(EMPTY_FIELDS), "configPath", "userConfigPath", "topLevelName", "definedEnvironments",
  "keep_vars", "compatibility_date", "compatibility_flags", "jsx_factory", "jsx_fragment", "rules", "name", "main", "assets",
  "workers_dev", "preview_urls", "kv_namespaces", "observability", "python_modules", "previews", "dev", "no_bundle"]);

export function validateConfig(config) {
  requireThat(config && typeof config === "object" && !Array.isArray(config), "invalid_generated_config");
  requireThat(Object.keys(config).every(key => TOP_FIELDS.has(key)), "unknown_generated_setting");
  equal(config.name, TARGET.worker, "wrong_worker"); equal(config.topLevelName, TARGET.worker, "wrong_worker");
  equal(config.definedEnvironments, [], "named_environment_forbidden");
  equal(config.previews, { vars: ACCESS_VARS, kv_namespaces: [{ binding: "DEV_LOG_STATE", id: TARGET.kv }] }, "preview_isolation_mismatch");
  // Production remains in its existing top-level section. Wrangler Preview uses
  // only the explicit previews bindings; --ignore-base-config is mandatory.
  equal(config.kv_namespaces, [{ binding: "DEV_LOG_STATE", id: "4a24c791d31a4c0983170c921cb744aa", preview_id: "8dd4e8a10dc74086bbd746e733b3d8d8" }], "production_config_changed");
  for (const [key, value] of Object.entries(EMPTY_FIELDS)) equal(config[key], value, "unexpected_resource_or_inheritance");
  equal(config.assets, { directory: "../client", binding: "ASSETS", not_found_handling: "none" }, "unexpected_assets");
  equal(config.main, "index.js", "unexpected_entry"); equal(config.no_bundle, true, "bundling_forbidden");
  equal(config.rules, [{ type: "ESModule", globs: ["**/*.js", "**/*.mjs"] }], "unexpected_modules");
  equal(config.compatibility_date, "2026-08-21", "compatibility_changed");
  equal(config.compatibility_flags, ["nodejs_compat"], "compatibility_changed");
  equal(config.keep_vars, true, "production_config_changed");
  equal(config.preview_urls, true, "preview_urls_disabled"); equal(config.workers_dev, true, "workers_dev_changed");
}
export function validateAuthorization(env) {
  equal(env.APU_DEV_PREVIEW_CI_ENABLED, "approved", "ci_not_activated");
  requireThat(env.GITHUB_SHA?.length === 40 && /^[0-9a-f]{40}$/.test(env.GITHUB_SHA), "invalid_source_sha");
  requireThat(env.APU_DEV_PREVIEW_CI_MODE === "once" || env.APU_DEV_PREVIEW_CI_MODE === "auto", "invalid_ci_mode");
  if (env.APU_DEV_PREVIEW_CI_MODE === "once") {
    requireThat(env.APU_DEV_PREVIEW_CI_APPROVED_SHA?.length === 40 && /^[0-9a-f]{40}$/.test(env.APU_DEV_PREVIEW_CI_APPROVED_SHA), "invalid_approved_sha");
    equal(env.APU_DEV_PREVIEW_CI_APPROVED_SHA, env.GITHUB_SHA, "source_sha_not_approved");
  }
}
export function validateContext(env, head) {
  equal(env.GITHUB_REPOSITORY, TARGET.repository, "unauthorized_repository");
  equal(env.GITHUB_REF, `refs/heads/${TARGET.branch}`, "unauthorized_branch");
  equal(env.GITHUB_EVENT_NAME, "push", "unauthorized_event");
  validateAuthorization(env);
  equal(head, env.GITHUB_SHA, "checkout_sha_mismatch");
  equal(env.CLOUDFLARE_ACCOUNT_ID, TARGET.account, "wrong_account");
  requireThat(Boolean(env.CLOUDFLARE_API_TOKEN?.trim() && env.GITHUB_TOKEN?.trim()), "missing_credentials");
  requireThat(!env.OPENAI_API_KEY && !env.APU_VECTOR_STORE_ID && !env.CLOUDFLARE_API_KEY && !env.CLOUDFLARE_EMAIL, "unexpected_credentials");
}
export function previewArgs() {
  return ["--no-install", "wrangler", "preview", "--config", CONFIG, "--worker-name", TARGET.worker, "--name", TARGET.preview, "--ignore-base-config", "--json"];
}
export function validateCommand(args) { equal(args, previewArgs(), "unsupported_deployment_command_or_flags"); }
export function validatePreview(preview) {
  equal(preview?.id, TARGET.previewId, "missing_or_wrong_preview_identity");
  equal(preview?.name, TARGET.preview, "wrong_preview_name");
  equal(preview?.urls, [TARGET.url], "unexpected_preview_url");
}
function expectedBindings() {
  return { ...Object.fromEntries(Object.entries(ACCESS_VARS).map(([key, text]) => [key, { type: "plain_text", text }])),
    DEV_LOG_STATE: { type: "kv_namespace", namespace_id: TARGET.kv }, ASSETS: { type: "assets" } };
}
export function validateDeployment(deployment, sha) {
  requireThat(record(deployment), "unsupported_deployment_metadata");
  const fields = ["id", "preview_id", "preview_name", "migration_tag", "urls", "compatibility_date", "compatibility_flags", "limits", "placement", "cache", "annotations", "env", "created_on"];
  requireThat(Object.keys(deployment).every(key => fields.includes(key)), "unsupported_deployment_metadata");
  requireThat(typeof deployment.id === "string" && UUID.test(deployment.id), "missing_deployment_identity");
  requireThat(typeof deployment.preview_id === "string" && deployment.preview_id.length > 0, "missing_deployment_preview_id");
  equal(deployment.preview_id, TARGET.previewId, "wrong_deployment_preview_id");
  requireThat(typeof deployment.preview_name === "string" && deployment.preview_name.length > 0, "missing_deployment_preview_name");
  equal(deployment.preview_name, TARGET.preview, "wrong_deployment_preview_name");
  equal(deployment.env, expectedBindings(), "remote_bindings_or_secrets_mismatch");
  if (sha) equal(deployment.annotations?.["workers/commit_sha"], sha, "deployment_source_mismatch");
  return deploymentUrl(deployment.urls);
}
function deploymentUrl(urls) {
  // urls is authoritative metadata. The version-style URL prefix is NOT derived
  // from DeploymentResource.id; pinned Wrangler just passes API URLs through.
  requireThat(Array.isArray(urls) && urls.length === 1 && typeof urls[0] === "string" &&
    /^https:\/\/[a-f0-9]{8}-apu-ms-site\.catsystem-exe\.workers\.dev$/.test(urls[0]), "unexpected_deployment_url");
  return urls[0];
}
export function normalizeUploadResponse(raw, sha) {
  let value = raw;
  if (typeof raw === "string") {
    try { value = JSON.parse(raw); } catch { throw new GuardFailure("upload_json_invalid"); }
  }
  requireThat(record(value), "unsupported_upload_metadata");
  if (Object.hasOwn(value, "preview") || Object.hasOwn(value, "deployment")) {
    // Pinned runPreview --json stdout: { preview: PreviewResource, deployment: DeploymentResource }.
    equal(Object.keys(value).sort(), ["deployment", "preview"], "unsupported_upload_metadata");
    validatePreview(value.preview);
    requireThat(typeof value.preview.slug === "string" && value.preview.slug.length > 0, "invalid_upload_preview_slug");
    const url = validateDeployment(value.deployment, sha);
    return { previewId: value.preview.id, previewName: value.preview.name,
      previewSlug: value.preview.slug, deploymentId: value.deployment.id, deploymentUrl: url };
  }
  // Pinned previewHandler writeOutput record, NOT its stdout format. No synthetic
  // DeploymentResource/bindings/source: these must come from authoritative GETs.
  const fields = ["type", "version", "worker_name", "preview_id", "preview_name", "preview_slug", "preview_urls", "deployment_id", "deployment_urls"];
  equal(Object.keys(value).filter(key => key !== "timestamp").sort(), [...fields].sort(), "unsupported_upload_metadata");
  equal(value.type, "preview", "unsupported_upload_type"); equal(value.version, 1, "unsupported_upload_version");
  equal(value.worker_name, TARGET.worker, "wrong_upload_worker");
  equal(value.preview_id, TARGET.previewId, "wrong_upload_preview_id");
  equal(value.preview_name, TARGET.preview, "wrong_upload_preview_name");
  requireThat(typeof value.preview_slug === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.preview_slug) && value.preview_slug.length <= 63, "invalid_upload_preview_slug");
  equal(value.preview_urls, [TARGET.url], "unexpected_preview_url");
  requireThat(typeof value.deployment_id === "string" && UUID.test(value.deployment_id), "missing_deployment_identity");
  if (Object.hasOwn(value, "timestamp")) requireThat(typeof value.timestamp === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.timestamp) && Number.isFinite(Date.parse(value.timestamp)), "invalid_upload_timestamp");
  return { previewId: value.preview_id, previewName: value.preview_name, previewSlug: value.preview_slug,
    deploymentId: value.deployment_id, deploymentUrl: deploymentUrl(value.deployment_urls) };
}
export function productionState(result) {
  const active = result?.deployments?.[0];
  requireThat(UUID.test(active?.id ?? "") && Array.isArray(active.versions) && active.versions.length > 0, "production_state_unavailable");
  const versions = active.versions.map(value => {
    requireThat(UUID.test(value?.version_id ?? "") && Number.isFinite(value.percentage) && value.percentage >= 0 && value.percentage <= 100, "production_state_unavailable");
    return { version_id: value.version_id, percentage: value.percentage };
  }).sort((a, b) => a.version_id.localeCompare(b.version_id));
  requireThat(new Set(versions.map(value => value.version_id)).size === versions.length && Math.abs(versions.reduce((sum, value) => sum + value.percentage, 0) - 100) < 0.000001, "production_state_unavailable");
  return { deploymentId: active.id, versions };
}

function validatePendingDeployment(deployment, env) {
  validateDeployment(deployment);
  if (env.APU_DEV_PREVIEW_CI_MODE === "once") {
    requireThat(deployment.annotations?.["workers/commit_sha"] !== env.GITHUB_SHA, "approved_sha_already_deployed");
  }
}

// Dependency injection is for provider-free tests. Production uses only GETs
// for evidence; the fixed Wrangler Preview command is the sole mutation path.
export async function updateExistingPreview(io) {
  let stage = "initial_preflight", upload = "unattempted", before, result, failure;
  const sourceCurrent = async () => equal(await io.branchHead(), io.env.GITHUB_SHA, "source_branch_advanced");
  try {
    validateContext(io.env, await io.head()); validateConfig(await io.config());
    await io.clean(); await io.wranglerContract(); await sourceCurrent();
    validatePreview(await io.preview());
    const previous = await io.deployment(); validatePendingDeployment(previous, io.env);
    before = productionState(await io.production());
    stage = "pre_upload_recheck";
    validatePreview(await io.preview()); validateConfig(await io.config());
    validatePendingDeployment(await io.deployment(), io.env); await sourceCurrent();
    equal(await io.head(), io.env.GITHUB_SHA, "checkout_sha_mismatch"); await io.clean();
    const args = previewArgs(); validateCommand(args);
    stage = "wrangler_execution"; upload = "invoked";
    const raw = await io.upload(args);
    upload = "returned"; stage = "upload_response_normalization";
    const uploaded = normalizeUploadResponse(raw, io.env.GITHUB_SHA);
    requireThat(uploaded.deploymentId !== previous.id, "deployment_not_updated");
    stage = "post_upload_readback";
    const currentPreview = await io.preview(); validatePreview(currentPreview);
    if (uploaded.previewSlug !== undefined) equal(currentPreview.slug, uploaded.previewSlug, "upload_preview_slug_mismatch");
    const latest = await io.deployment(); validateDeployment(latest, io.env.GITHUB_SHA);
    equal(latest.id, uploaded.deploymentId, "preview_changed_after_upload");
    const url = deploymentUrl(latest.urls);
    equal(url, uploaded.deploymentUrl, "upload_deployment_url_mismatch");
    await io.anonymous(TARGET.url); await io.anonymous(url);
    await sourceCurrent();
    result = { source: io.env.GITHUB_SHA, preview: TARGET.preview, previewId: TARGET.previewId,
      deploymentId: latest.id, previewUrl: TARGET.url, deploymentUrl: url, upload };
  } catch (error) {
    failure = classified(stage, error, upload);
  } finally {
    // Even an uncertain subprocess outcome/parse/read-back failure must compare
    // production. No retry, production mutation or automatic rollback exists.
    if (upload !== "unattempted") {
      try { equal(productionState(await io.production()), before, "production_changed"); }
      catch (error) {
        const critical = classified("production_preservation_postflight",
          new GuardFailure("CRITICAL_production_preservation_not_verified_no_automatic_rollback"), upload);
        critical.priorFailure = { cause: error instanceof GuardFailure ? error.code : "guard_failed_details_suppressed",
          ...(failure ? { operation: failureSummary(failure) } : {}) };
        failure = critical;
      }
    }
  }
  if (failure) throw failure;
  return result;
}

const exec = promisify(execFile);
async function git(...args) { return (await exec("git", args, { cwd: ROOT })).stdout.trim(); }
async function config() { return JSON.parse(await readFile(resolve(ROOT, CONFIG), "utf8")); }
async function wranglerContract() {
  const installed = JSON.parse(await readFile(resolve(ROOT, "node_modules/wrangler/package.json"), "utf8"));
  equal(installed.version, "4.150.0", "unreviewed_wrangler_version");
}
export function liveIO(env, { execute = exec } = {}) {
  const cfBase = `https://api.cloudflare.com/client/v4/accounts/${TARGET.account}`;
  const previewPath = `/workers/workers/${TARGET.worker}/previews/${TARGET.preview}`;
  async function get(url, token) {
    let response;
    try { response = await fetch(url, { method: "GET", cache: "no-store", redirect: "error", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: AbortSignal.timeout(15_000) }); }
    catch { throw new GuardFailure("metadata_transport_unavailable"); }
    requireThat(response.ok, "metadata_http_unavailable");
    try { return await response.json(); } catch { throw new GuardFailure("metadata_json_unavailable"); }
  }
  async function cf(path) {
    const body = await get(cfBase + path, env.CLOUDFLARE_API_TOKEN);
    requireThat(body?.success === true && body.result, "cloudflare_metadata_unavailable"); return body.result;
  }
  return { env, config, wranglerContract,
    head: () => git("rev-parse", "HEAD"),
    clean: async () => equal(await git("status", "--porcelain", "--untracked-files=no"), "", "tracked_source_changed"),
    branchHead: async () => (await get(`https://api.github.com/repos/${TARGET.repository}/git/ref/heads/${TARGET.branch}`, env.GITHUB_TOKEN))?.object?.sha,
    preview: () => cf(previewPath), deployment: () => cf(previewPath + "/deployments/latest"),
    production: () => cf(`/workers/scripts/${TARGET.worker}/deployments`),
    upload: async args => {
      validateCommand(args);
      // Exclude API-base overrides, OAuth/legacy auth, secret-file/output-path
      // overrides and unrelated provider credentials from the Wrangler process.
      const cliEnv = Object.fromEntries(["PATH", "TMPDIR", "LANG", "LC_ALL", "GITHUB_SHA", "GITHUB_REPOSITORY", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]
        .filter(key => env[key] !== undefined).map(key => [key, env[key]]));
      try {
        const { stdout } = await execute("npx", args, { cwd: ROOT, env: { ...cliEnv, CI: "true", GITHUB_SERVER_URL: "https://github.com", WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false" }, maxBuffer: 4 * 1024 * 1024 });
        return stdout; // Parsed only in the separately classified normalization stage.
      } catch { throw new GuardFailure("preview_upload_failed_output_suppressed"); }
    },
    anonymous: async url => {
      let response;
      try { response = await fetch(url, { redirect: "manual", credentials: "omit", signal: AbortSignal.timeout(15_000) }); }
      catch { throw new GuardFailure("anonymous_access_check_unavailable"); }
      requireThat([302, 303, 307, 308].includes(response.status), "anonymous_access_not_protected");
      let destination;
      try { destination = new URL(response.headers.get("location")); } catch { throw new GuardFailure("access_redirect_missing"); }
      requireThat(destination.origin === TARGET.issuer && destination.pathname.startsWith("/cdn-cgi/access/login/"), "unexpected_access_redirect");
    },
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    equal(process.argv.length, 3, "unsupported_guard_arguments");
    if (process.argv[2] === "--check-config") { validateConfig(await config()); await wranglerContract(); console.log("PASS: generated Preview configuration and pinned Wrangler"); }
    else {
      equal(process.argv[2], "--deploy-approved", "unsupported_guard_mode");
      const result = await updateExistingPreview(liveIO(process.env));
      console.log(JSON.stringify(result)); // Explicit safe summary, never raw API/CLI output.
    }
  } catch (error) {
    console.error(JSON.stringify({ error: "DEV_Preview_stopped", ...failureSummary(error) })); process.exitCode = 1;
  }
}
