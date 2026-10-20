import process from "node:process";
import { pathToFileURL } from "node:url";

export const PREVIEW_URL =
  "https://api.cloudflare.com/client/v4/accounts/4638092f63fa7fe58bcb9d2d041b7855/workers/workers/apu-ms-site/previews/apu-pr60-e2e";
export const DEPLOYMENT_URL = `${PREVIEW_URL}/deployments/latest`;
const EXPECTED = {
  repository: "catsystemexe/APU_MS_site",
  ref: "refs/heads/codex/f1-f3-mvp-stabilization",
  previewId: "79968345270d4008954af42b360775d2",
  previewName: "apu-pr60-e2e",
  sha: /^[0-9a-f]{40}$/,
};
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

export function keyTypes(value) {
  return record(value)
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, typeOf(value[key])]))
    : {};
}

function safeIdentifier(value) {
  return typeof value === "string" && IDENTIFIER.test(value) ? value : undefined;
}

function field(value, name, { identifier = false } = {}) {
  const result = { presence: Object.hasOwn(value, name) ? "present" : "missing" };
  if (!Object.hasOwn(value, name)) return result;
  result.type = typeOf(value[name]);
  if (value[name] === null) return result;
  if (identifier && typeof value[name] === "string") {
    const safe = safeIdentifier(value[name]);
    if (safe !== undefined) result.value = safe;
  }
  return result;
}

export function sanitizePreviewResponse(body) {
  const result = record(body?.result) ? body.result : undefined;
  return {
    topLevel: keyTypes(body),
    result: keyTypes(result),
    id: safeIdentifier(result?.id),
    name: safeIdentifier(result?.name),
    slug: field(result ?? {}, "slug", { identifier: true }),
    urls: field(result ?? {}, "urls"),
  };
}

export function sanitizeDeploymentResponse(body) {
  const result = record(body?.result) ? body.result : undefined;
  const previewId = field(result ?? {}, "preview_id", { identifier: true });
  const previewName = field(result ?? {}, "preview_name", { identifier: true });
  return {
    topLevel: keyTypes(body),
    result: keyTypes(result),
    id: safeIdentifier(result?.id),
    preview_id: previewId,
    preview_name: previewName,
    annotationKeys: record(result?.annotations) ? Object.keys(result.annotations).sort() : [],
    env: field(result ?? {}, "env"),
    urls: field(result ?? {}, "urls"),
  };
}

export function classifyRelationship(preview, deployment) {
  const id = deployment.preview_id?.value;
  const name = deployment.preview_name?.value;
  if (preview.id === undefined || preview.name === undefined || id === undefined || name === undefined) {
    return "UNPROVABLE";
  }
  return id === preview.id && name === preview.name ? "VERIFIED MATCH" : "VERIFIED MISMATCH";
}

function authorization(env) {
  if (env.GITHUB_REPOSITORY !== EXPECTED.repository ||
      env.GITHUB_REF !== EXPECTED.ref ||
      env.GITHUB_EVENT_NAME !== "push" ||
      env.GITHUB_EVENT_DELETED === "true" ||
      !EXPECTED.sha.test(env.GITHUB_SHA ?? "") ||
      env.APU_DEV_PREVIEW_CI_ENABLED !== "disabled" ||
      env.APU_PREVIEW_METADATA_CAPTURE_ENABLED !== "approved" ||
      env.APU_PREVIEW_METADATA_CAPTURE_SHA !== env.GITHUB_SHA) {
    throw new Error("authorization_failed");
  }
  if (!env.CLOUDFLARE_API_TOKEN) throw new Error("cloudflare_token_unavailable");
}

async function getJson(url, token, fetchImpl) {
  const response = await fetchImpl(url, {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!response.ok) {
    const error = new Error("cloudflare_http_error");
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export async function captureMetadata({ env = process.env, fetchImpl = fetch } = {}) {
  authorization(env);
  const previewBody = await getJson(PREVIEW_URL, env.CLOUDFLARE_API_TOKEN, fetchImpl);
  const deploymentBody = await getJson(DEPLOYMENT_URL, env.CLOUDFLARE_API_TOKEN, fetchImpl);
  const preview = sanitizePreviewResponse(previewBody);
  const deployment = sanitizeDeploymentResponse(deploymentBody);
  return { preview, deployment, relationship: classifyRelationship(preview, deployment) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(await captureMetadata()));
  } catch (error) {
    const status = Number.isInteger(error?.status) ? `_${error.status}` : "";
    console.error(`metadata_capture_failed_${error?.message === "authorization_failed" ? "authorization" : "request"}${status}`);
    process.exitCode = 1;
  }
}
