import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

const issuer = "https://apu-test.cloudflareaccess.com";
const audience = "apu-test-audience";
const keyId = "apu-test-key";
const keys = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"],
);
const publicJwk = { ...(await crypto.subtle.exportKey("jwk", keys.publicKey)), kid: keyId, alg: "RS256", use: "sig" };
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  if (String(input) === `${issuer}/cdn-cgi/access/certs`) return Response.json({ keys: [publicJwk] });
  return originalFetch(input, init);
};
process.env.CF_ACCESS_TEAM_DOMAIN = issuer;
process.env.CF_ACCESS_AUD = audience;
process.env.APU_DEVELOPER_EMAILS = "developer@example.com";

function base64url(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  return Buffer.from(bytes).toString("base64url");
}

async function accessToken(email, overrides = {}) {
  const header = base64url(JSON.stringify({ alg: "RS256", kid: keyId, typ: "JWT" }));
  const claims = base64url(JSON.stringify({
    iss: issuer, aud: audience, email, exp: Math.floor(Date.now() / 1000) + 300, ...overrides,
  }));
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", keys.privateKey, new TextEncoder().encode(`${header}.${claims}`),
  );
  return `${header}.${claims}.${base64url(signature)}`;
}

async function identityHeaders(email) {
  return { accept: "text/html", "cf-access-jwt-assertion": await accessToken(email) };
}

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: await identityHeaders("developer@example.com"),
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, developmentPreviewMeta);
  assert.match(html, /GPT-5\.6 Sol/);
  assert.match(html, /Konverzace/);
  assert.match(html, /IN/);
  assert.match(html, /OUT/);
  assert.match(html, /Nový projekt/);
  assert.match(html, /Zápisník/);
  assert.match(html, /Rozbor/);
  assert.match(html, /Výstup/);
  assert.match(html, /lucide-scan-search/);
  assert.match(html, /lucide-notebook-pen/);
  assert.match(html, /Otevřít nastavení/);
  assert.match(html, /Stáhnout APU Session JSON/);
  assert.match(html, /lucide-download/);
  assert.doesNotMatch(html, /Kopírovat text/);
  assert.doesNotMatch(html, /Uložit na Google Drive/);
  assert.match(html, /lucide-user-round/);
  assert.match(html, /apu-logo-horizontal\.png/);
  assert.match(html, /apu-flower\.svg/);
});

test("fails closed without a valid Access identity", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("anonymous", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const env = {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  };
  const ctx = { waitUntil() {}, passThroughOnException() {} };

  const anonymous = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    env,
    ctx,
  );
  const anonymousHtml = await anonymous.text();
  assert.equal(anonymous.status, 200);
  assert.match(anonymousHtml, /Ověřená identita Cloudflare Access není dostupná/);
  assert.doesNotMatch(anonymousHtml, /Pracovní hypotézy se zobrazí/);

  const invalid = await worker.fetch(
    new Request("http://localhost/", {
      headers: {
        accept: "text/html",
        "cf-access-jwt-assertion": "invalid.jwt.value",
      },
    }),
    env,
    ctx,
  );
  const invalidHtml = await invalid.text();
  assert.equal(invalid.status, 200);
  assert.match(invalidHtml, /Ověřená identita Cloudflare Access není dostupná/);
  assert.doesNotMatch(invalidHtml, /Pracovní hypotézy se zobrazí/);
});

test("shows developer surfaces only to developers", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("roles", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const developer = await worker.fetch(new Request("http://localhost/", { headers: await identityHeaders("developer@example.com") }), env, ctx);
  const tester = await worker.fetch(new Request("http://localhost/", { headers: await identityHeaders("tester@example.com") }), env, ctx);
  const developerHtml = await developer.text();
  const testerHtml = await tester.text();
  assert.match(developerHtml, /Otevřít nastavení/);
  assert.match(developerHtml, /conversation-diagnostics/);
  assert.doesNotMatch(testerHtml, /Otevřít nastavení/);
  assert.doesNotMatch(testerHtml, /conversation-diagnostics/);
  assert.match(testerHtml, /Co dnes potřebujete\?/);
});

test("model API rejects invalid auth and accepts tester and developer identities", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("api-auth", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const env = {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  };
  const ctx = { waitUntil() {}, passThroughOnException() {} };

  for (const route of ["/api/chat", "/api/extract"]) {
    const anonymous = await worker.fetch(
      new Request(`http://localhost${route}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "test", notebook: [] }),
      }),
      env,
      ctx,
    );
    assert.equal(anonymous.status, 401);

    const invalid = await worker.fetch(
      new Request(`http://localhost${route}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-access-jwt-assertion": "invalid.jwt.value",
        },
        body: JSON.stringify({ message: "test", notebook: [] }),
      }),
      env,
      ctx,
    );
    assert.equal(invalid.status, 401);

    for (const email of ["tester@example.com", "developer@example.com"]) {
      const accepted = await worker.fetch(new Request(`http://localhost${route}`, {
        method: "POST",
        headers: { "content-type": "application/json", "cf-access-jwt-assertion": await accessToken(email) },
        body: JSON.stringify({ message: "test", notebook: [] }),
      }), env, ctx);
      assert.equal(accepted.status, 503);
    }
  }
});
