import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  DEPLOYMENT_URL,
  PREVIEW_URL,
  captureMetadata,
  classifyRelationship,
  sanitizeDeploymentResponse,
  sanitizePreviewResponse,
} from "../ops/ci/read-preview-metadata.mjs";

const baseEnv = {
  GITHUB_REPOSITORY: "catsystemexe/APU_MS_site",
  GITHUB_REF: "refs/heads/codex/f1-f3-mvp-stabilization",
  GITHUB_EVENT_NAME: "push",
  GITHUB_EVENT_DELETED: "false",
  GITHUB_SHA: "a".repeat(40),
  APU_DEV_PREVIEW_CI_ENABLED: "disabled",
  APU_PREVIEW_METADATA_CAPTURE_ENABLED: "approved",
  APU_PREVIEW_METADATA_CAPTURE_SHA: "a".repeat(40),
  CLOUDFLARE_API_TOKEN: "secret",
};
const preview = { success: true, result: { id: "79968345270d4008954af42b360775d2", name: "apu-pr60-e2e", slug: "apu-pr60-e2e", urls: [] } };
const deployment = { success: true, result: { id: "deployment-1", preview_id: "79968345270d4008954af42b360775d2", preview_name: "apu-pr60-e2e", annotations: { "workers/commit_sha": "secret" }, env: {}, urls: [] } };
const mockFetch = (responses, calls = []) => async (url, options) => {
  calls.push({ url, options });
  return { ok: true, status: 200, json: async () => responses.shift() };
};

test("makes exactly two fixed authenticated GET requests and sanitizes output", async () => {
  const calls = [];
  const result = await captureMetadata({ env: baseEnv, fetchImpl: mockFetch([preview, deployment], calls) });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((call) => call.url), [PREVIEW_URL, DEPLOYMENT_URL]);
  assert.ok(calls.every((call) => call.options.method === "GET" && call.options.redirect === "error"));
  assert.equal(result.relationship, "VERIFIED MATCH");
  assert.deepEqual(result.deployment.annotationKeys, ["workers/commit_sha"]);
  assert.equal(result.deployment.preview_name.value, "apu-pr60-e2e");
});

test("distinguishes missing, null and invalid fields", () => {
  const result = sanitizeDeploymentResponse({ result: { preview_id: null, preview_name: 42 } });
  assert.deepEqual(result.preview_id, { presence: "present", type: "null" });
  assert.deepEqual(result.preview_name, { presence: "present", type: "number" });
  assert.deepEqual(sanitizePreviewResponse({ result: {} }).slug, { presence: "missing" });
  assert.equal(classifyRelationship(sanitizePreviewResponse({ result: {} }), result), "UNPROVABLE");
});

test("classifies wrong identity and missing relationship", () => {
  const p = sanitizePreviewResponse(preview);
  const wrong = sanitizeDeploymentResponse({ result: { id: "deployment-1", preview_id: "wrong", preview_name: "apu-pr60-e2e" } });
  assert.equal(classifyRelationship(p, wrong), "VERIFIED MISMATCH");
  assert.equal(classifyRelationship(p, sanitizeDeploymentResponse({ result: { id: "deployment-1" } })), "UNPROVABLE");
});

test("suppresses secret-like and unexpected free-form values", () => {
  const result = sanitizeDeploymentResponse({ unexpected: "token=super-secret", result: { id: "deployment-1", preview_name: "Bearer abc" } });
  assert.deepEqual(result.topLevel, { result: "object", unexpected: "string" });
  assert.equal(result.preview_name.value, undefined);
  assert.equal(JSON.stringify(result).includes("super-secret"), false);
});

test("rejects redirects and raw HTTP bodies are not exposed", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.redirect, "error");
    return { ok: false, status: 403, json: async () => ({ error: "secret body" }) };
  };
  await assert.rejects(captureMetadata({ env: baseEnv, fetchImpl }), /cloudflare_http_error/);
  assert.equal(calls.length, 1);
});

test("sanitizes unexpected top-level keys and never changes request targets", async () => {
  const calls = [];
  const result = await captureMetadata({
    env: baseEnv,
    fetchImpl: mockFetch([
      { success: true, result: { id: "79968345270d4008954af42b360775d2", name: "apu-pr60-e2e" }, leaked: "token-value" },
      { success: true, result: { id: "deployment-1" }, leaked: "binding-value" },
    ], calls),
  });
  assert.deepEqual(result.preview.topLevel, { leaked: "string", result: "object", success: "boolean" });
  assert.ok(calls.every((call) => [PREVIEW_URL, DEPLOYMENT_URL].includes(call.url)));
  assert.equal(JSON.stringify(result).includes("token-value"), false);
  assert.equal(JSON.stringify(result).includes("binding-value"), false);
});

test("workflow is push-only, manually gated, protected and non-deploying", async () => {
  const workflow = await readFile(new URL("../.github/workflows/apu-preview-metadata-capture.yml", import.meta.url), "utf8");
  assert.match(workflow, /paths:\s*\n\s+- \.github\/workflows\/apu-preview-metadata-capture\.yml/);
  assert.match(workflow, /vars\.APU_PREVIEW_METADATA_CAPTURE_ENABLED == 'approved'/);
  assert.match(workflow, /vars\.APU_PREVIEW_METADATA_CAPTURE_SHA == github\.sha/);
  assert.match(workflow, /vars\.APU_DEV_PREVIEW_CI_ENABLED == 'disabled'/);
  assert.match(workflow, /environment: apu-dev-preview/);
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
  assert.doesNotMatch(workflow, /workflow_dispatch|pull_request|schedule|wrangler|deploy|upload-artifact/);
});

for (const [name, patch] of [
  ["absent authorization", { APU_PREVIEW_METADATA_CAPTURE_ENABLED: undefined }],
  ["disabled authorization", { APU_PREVIEW_METADATA_CAPTURE_ENABLED: "disabled" }],
  ["mismatched SHA", { APU_PREVIEW_METADATA_CAPTURE_SHA: "b".repeat(40) }],
  ["enabled deployment gate", { APU_DEV_PREVIEW_CI_ENABLED: "approved" }],
]) {
  test(`makes no requests with ${name}`, async () => {
    let requests = 0;
    const env = { ...baseEnv, ...patch };
    await assert.rejects(captureMetadata({ env, fetchImpl: async () => { requests += 1; } }), /authorization_failed/);
    assert.equal(requests, 0);
  });
}
