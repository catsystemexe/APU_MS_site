import { readFile, mkdtemp, chmod, open, lstat, realpath, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify, isDeepStrictEqual } from "node:util";
import { resolve, dirname, join, isAbsolute, relative, sep } from "node:path";
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
// Only the live upload adapter may refine whether the command was attempted or
// returned before a local file failure. Ordinary IO errors stay suppressed.
class UploadFailure extends GuardFailure {
  constructor(code, upload) {
    super(code); this.upload = upload;
    this.stage = upload === "returned" ? "upload_response_normalization" : "wrangler_execution";
  }
}
function requireThat(condition, code) { if (!condition) throw new GuardFailure(code); }
function equal(actual, expected, code) { requireThat(isDeepStrictEqual(actual, expected), code); }
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
function classified(stage, error, upload) {
  const failure = new GuardFailure(error instanceof GuardFailure ? error.code : "guard_failed_details_suppressed");
  failure.stage = stage; failure.upload = upload;
  if (error instanceof GuardFailure && error.cleanupFailed) failure.cleanupFailed = true;
  return failure;
}
export function failureSummary(error) {
  // Only our own fixed codes are printable; never serialize Error/cause/raw IO.
  return { stage: error instanceof GuardFailure ? error.stage ?? "guard_entry" : "guard_entry",
    cause: error instanceof GuardFailure ? error.code : "guard_failed_details_suppressed",
    upload: error instanceof GuardFailure ? error.upload ?? "unattempted" : "unattempted",
    ...(error instanceof GuardFailure && error.cleanupFailed ? { cleanup: "structured_output_cleanup_failed" } : {}),
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
  // Pinned SDK upload resource only. NOT the observed Preview-scoped latest GET.
  requireThat(record(deployment), "unsupported_deployment_metadata");
  const fields = ["id", "preview_id", "preview_name", "migration_tag", "urls", "compatibility_date", "compatibility_flags", "limits", "placement", "cache", "annotations", "env", "created_on"];
  requireThat(Object.keys(deployment).every(key => fields.includes(key)), "unsupported_deployment_metadata");
  requireThat(typeof deployment.id === "string" && UUID.test(deployment.id), "missing_deployment_identity");
  requireThat(typeof deployment.preview_id === "string" && deployment.preview_id.length > 0, "missing_deployment_preview_id");
  equal(deployment.preview_id, TARGET.previewId, "wrong_deployment_preview_id");
  requireThat(typeof deployment.preview_name === "string" && deployment.preview_name.length > 0, "missing_deployment_preview_name");
  equal(deployment.preview_name, TARGET.preview, "wrong_deployment_preview_name");
  equal(deployment.env, expectedBindings(), "remote_bindings_or_secrets_mismatch");
  if (sha) {
    requireThat(record(deployment.annotations) && Object.hasOwn(deployment.annotations, "workers/commit_sha"), "deployment_source_mismatch");
    equal(deployment.annotations["workers/commit_sha"], sha, "deployment_source_mismatch");
  }
  return deploymentUrl(deployment.urls);
}
const VERSION_FIELDS = Object.freeze({
  annotations: "object", assets: "object", author_email: "string", author_id: "string",
  compatibility_date: "string", compatibility_flags: "array", created_on: "string", env: "object",
  id: "string", main_module: "string", number: "number", source: "string", startup_time_ms: "number",
  urls: "array", usage_model: "string",
});
export function validatePreviewVersion(version, sha) {
  // Key/type contract observed in authenticated run 39494160174. Inner env/URL
  // values were NOT captured: retain the exact existing isolation/URL validators.
  requireThat(record(version), "unsupported_version_metadata");
  requireThat(Object.keys(version).every(key => Object.hasOwn(VERSION_FIELDS, key) || key === "preview_id" || key === "preview_name"), "unsupported_version_metadata");
  for (const [key, type] of Object.entries(VERSION_FIELDS)) {
    const value = version[key];
    requireThat(Object.hasOwn(version, key) && (type === "object" ? record(value) : type === "array" ? Array.isArray(value) :
      type === "number" ? typeof value === "number" && Number.isFinite(value) : typeof value === type), "invalid_version_field_type");
  }
  requireThat(UUID.test(version.id), "invalid_version_identity");
  requireThat(version.compatibility_flags.every(flag => typeof flag === "string"), "invalid_version_field_type");
  if (Object.hasOwn(version, "preview_id")) equal(version.preview_id, TARGET.previewId, "wrong_version_preview_id");
  if (Object.hasOwn(version, "preview_name")) equal(version.preview_name, TARGET.preview, "wrong_version_preview_name");
  equal(version.env, expectedBindings(), "remote_bindings_or_secrets_mismatch");
  const hasCommit = Object.hasOwn(version.annotations, "workers/commit_sha");
  const commit = hasCommit ? version.annotations["workers/commit_sha"] : undefined;
  if (hasCommit) requireThat(typeof commit === "string" && /^[0-9a-f]{40}$/.test(commit), "invalid_version_commit_sha");
  if (sha) equal(commit, sha, "version_source_mismatch");
  return deploymentUrl(version.urls);
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
    const versionShape = record(value.deployment) && ["assets", "number", "main_module"].some(key => Object.hasOwn(value.deployment, key));
    const url = versionShape ? validatePreviewVersion(value.deployment, sha) : validateDeployment(value.deployment, sha);
    return { previewId: value.preview.id, previewName: value.preview.name,
      previewSlug: value.preview.slug, uploadResourceId: value.deployment.id, uploadUrl: url };
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
    uploadResourceId: value.deployment_id, uploadUrl: deploymentUrl(value.deployment_urls) };
}
export const MAX_STRUCTURED_OUTPUT_BYTES = 64 * 1024;
function validateOutputTimestamp(value) {
  requireThat(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value, "structured_output_timestamp_invalid");
}
export function normalizeStructuredOutput(raw, sha) {
  requireThat(typeof raw === "string", "structured_output_unavailable");
  requireThat(Buffer.byteLength(raw, "utf8") <= MAX_STRUCTURED_OUTPUT_BYTES, "structured_output_oversized");
  // Pinned writeOutput appends compact JSON plus LF on every call. Require its
  // complete two-record framing; never trim away blank/extra/incomplete records.
  requireThat(raw.endsWith("\n"), "structured_output_incomplete");
  const lines = raw.slice(0, -1).split("\n");
  requireThat(lines.length === 2 && lines.every(line => line.length > 0), "structured_output_record_count_invalid");
  const entries = lines.map(line => {
    let value;
    try { value = JSON.parse(line); } catch { throw new GuardFailure("structured_output_json_invalid"); }
    // Exact JSON.stringify framing also rejects duplicate keys, multiple JSON
    // documents, non-JSON prefixes/suffixes and non-canonical serialization.
    requireThat(record(value) && JSON.stringify(value) === line, "structured_output_record_invalid");
    return value;
  });
  const [session, preview] = entries;
  requireThat(session.type === "wrangler-session" && preview.type === "preview", "structured_output_sequence_invalid");
  equal(Object.keys(session).sort(), ["type", "version", "wrangler_version", "command_line_args", "log_file_path", "timestamp"].sort(), "structured_output_session_invalid");
  equal(session.version, 1, "structured_output_session_invalid");
  equal(session.wrangler_version, "4.150.0", "structured_output_session_invalid");
  equal(session.command_line_args, previewArgs().slice(2), "structured_output_session_command_mismatch");
  requireThat(typeof session.log_file_path === "string" && isAbsolute(session.log_file_path), "structured_output_session_invalid");
  validateOutputTimestamp(session.timestamp); validateOutputTimestamp(preview.timestamp);
  // Session metadata is supporting evidence only. Keep the strict flat Preview
  // schema/target/IDs/URLs and all authoritative post-upload checks unchanged.
  return normalizeUploadResponse(preview, sha);
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

function validatePendingVersion(version, env) {
  if (env.APU_DEV_PREVIEW_CI_MODE === "once" && Object.hasOwn(version.annotations, "workers/commit_sha")) {
    requireThat(version.annotations["workers/commit_sha"] !== env.GITHUB_SHA, "approved_sha_already_deployed");
  }
}
async function readScopedVersion(io, sha) {
  // Association boundary: authenticated fixed Preview resource GET must validate
  // before liveIO's fixed Preview-scoped latest GET. The object alone is NOT a
  // target proof; no rollout inventory, caller-selected URL or fabricated IDs.
  const preview = await io.preview(); validatePreview(preview);
  const version = await io.latestVersion();
  const url = validatePreviewVersion(version, sha);
  return { preview, version, url };
}

// Dependency injection is for provider-free tests. Production uses only GETs
// for evidence; the fixed Wrangler Preview command is the sole mutation path.
export async function updateExistingPreview(io) {
  let stage = "initial_preflight", upload = "unattempted", before, result, failure;
  const sourceCurrent = async () => equal(await io.branchHead(), io.env.GITHUB_SHA, "source_branch_advanced");
  try {
    validateContext(io.env, await io.head()); validateConfig(await io.config());
    await io.clean(); await io.wranglerContract(); await sourceCurrent();
    const previous = await readScopedVersion(io); validatePendingVersion(previous.version, io.env);
    before = productionState(await io.production());
    stage = "pre_upload_recheck";
    const rechecked = await readScopedVersion(io); validateConfig(await io.config());
    validatePendingVersion(rechecked.version, io.env); await sourceCurrent();
    equal(await io.head(), io.env.GITHUB_SHA, "checkout_sha_mismatch"); await io.clean();
    const args = previewArgs(); validateCommand(args);
    stage = "wrangler_execution"; upload = "invoked";
    const raw = await io.upload(args);
    upload = "returned"; stage = "upload_response_normalization";
    const uploaded = normalizeStructuredOutput(raw, io.env.GITHUB_SHA);
    stage = "post_upload_readback";
    const latest = await readScopedVersion(io, io.env.GITHUB_SHA);
    if (uploaded.previewSlug !== undefined) equal(latest.preview.slug, uploaded.previewSlug, "upload_preview_slug_mismatch");
    requireThat(latest.version.id !== previous.version.id && latest.version.id !== rechecked.version.id, "version_not_updated");
    // POST/CLI IDs are opaque upload-resource IDs. No verified cross-model ID
    // equality exists. Correlate exact API-provided unique URL + approved source
    // on the authoritative scoped Version instead; fail closed on disagreement.
    const url = latest.url;
    equal(url, uploaded.uploadUrl, "upload_version_url_mismatch");
    await io.anonymous(TARGET.url); await io.anonymous(url);
    await sourceCurrent();
    result = { source: io.env.GITHUB_SHA, preview: TARGET.preview, previewId: TARGET.previewId,
      versionId: latest.version.id, uploadResourceId: uploaded.uploadResourceId, previewUrl: TARGET.url, versionUrl: url, upload };
  } catch (error) {
    if (error instanceof UploadFailure) { stage = error.stage; upload = error.upload; }
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
const OUTPUT_FILES = Object.freeze({ mkdtemp, chmod, open, lstat, realpath, rm });
function sameFile(actual, expected) { return actual.dev === expected.dev && actual.ino === expected.ino; }
function outsideCheckout(path) {
  const fromRoot = relative(ROOT, path);
  return fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot);
}
async function structuredUpload(args, env, execute, files) {
  let directory, directoryStat, handle, original, output, failure, upload = "unattempted";
  const trustedFile = stat => stat.isFile() && stat.nlink === 1 && sameFile(stat, original) &&
    (stat.mode & 0o777) === 0o600 && stat.uid === process.getuid();
  try {
    requireThat(process.platform !== "win32" && constants.O_NOFOLLOW !== undefined, "structured_output_platform_unsupported");
    const temporaryRoot = await files.realpath(tmpdir());
    requireThat(isAbsolute(temporaryRoot) && outsideCheckout(temporaryRoot), "structured_output_location_invalid");
    directory = await files.mkdtemp(join(temporaryRoot, "apu-preview-output-"));
    await files.chmod(directory, 0o700);
    directoryStat = await files.lstat(directory);
    requireThat(directoryStat.isDirectory() && directoryStat.uid === process.getuid() &&
      (directoryStat.mode & 0o777) === 0o700 && await files.realpath(directory) === directory, "structured_output_directory_invalid");
    const path = join(directory, "result.ndjson");
    handle = await files.open(path, constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    original = await handle.stat();
    requireThat(trustedFile(original) && original.size === 0, "structured_output_file_invalid");
    // Preserve the allowlist. Only this newly generated, private path is added;
    // inherited output-directory/path, log and API-base overrides stay excluded.
    const cliEnv = Object.fromEntries(["PATH", "TMPDIR", "LANG", "LC_ALL", "GITHUB_SHA", "GITHUB_REPOSITORY", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]
      .filter(key => env[key] !== undefined).map(key => [key, env[key]]));
    upload = "invoked";
    try {
      await execute("npx", args, { cwd: ROOT, env: { ...cliEnv, CI: "true", GITHUB_SERVER_URL: "https://github.com",
        WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false", WRANGLER_OUTPUT_FILE_PATH: path }, maxBuffer: 4 * 1024 * 1024 });
    } catch { throw new GuardFailure("preview_upload_failed_output_suppressed"); }
    upload = "returned";
    const checkPath = async () => {
      const parent = await files.lstat(directory), entry = await files.lstat(path);
      requireThat(parent.isDirectory() && sameFile(parent, directoryStat) && parent.uid === process.getuid() &&
        (parent.mode & 0o777) === 0o700 && trustedFile(entry), "structured_output_file_invalid");
    };
    await checkPath();
    const before = await handle.stat();
    requireThat(trustedFile(before), "structured_output_file_invalid");
    requireThat(before.size > 0, "structured_output_empty");
    requireThat(before.size <= MAX_STRUCTURED_OUTPUT_BYTES, "structured_output_oversized");
    // Read the original descriptor, never a substituted pathname. Bound even a
    // concurrent append to max+1 bytes instead of an unbounded readFile().
    const buffer = Buffer.alloc(MAX_STRUCTURED_OUTPUT_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    requireThat(length <= MAX_STRUCTURED_OUTPUT_BYTES, "structured_output_oversized");
    const after = await handle.stat();
    requireThat(trustedFile(after) && length === before.size && after.size === before.size &&
      after.mtimeMs === before.mtimeMs && after.ctimeMs === before.ctimeMs, "structured_output_file_changed");
    await checkPath();
    try { output = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buffer.subarray(0, length)); }
    catch { throw new GuardFailure("structured_output_encoding_invalid"); }
  } catch (error) {
    failure = new UploadFailure(error instanceof GuardFailure ? error.code :
      upload === "returned" ? "structured_output_read_failed" : "structured_output_prepare_failed", upload);
  } finally {
    let cleanupFailed = false;
    if (handle) { try { await handle.close(); } catch { cleanupFailed = true; } }
    if (directory) {
      try { await files.rm(directory, { recursive: true, force: true }); }
      catch { cleanupFailed = true; }
    }
    if (cleanupFailed) {
      failure ??= new UploadFailure("structured_output_cleanup_failed", upload);
      failure.cleanupFailed = true;
    }
  }
  if (failure) throw failure;
  return output;
}
export function liveIO(env, { execute = exec, files = OUTPUT_FILES } = {}) {
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
    preview: () => cf(previewPath), latestVersion: () => cf(previewPath + "/deployments/latest"),
    production: () => cf(`/workers/scripts/${TARGET.worker}/deployments`),
    upload: async args => {
      validateCommand(args);
      return structuredUpload(args, env, execute, files);
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
