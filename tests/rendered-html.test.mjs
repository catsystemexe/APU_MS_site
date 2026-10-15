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

async function loadWorker(t, { jwks = "available", developerEmails = "developer@example.com", nodeEnv = "test" } = {}) {
  const environmentKeys = ["CF_ACCESS_TEAM_DOMAIN", "CF_ACCESS_AUD", "APU_DEVELOPER_EMAILS", "NODE_ENV", "APU_LOCAL_DEV_AUTH", "OPENAI_API_KEY", "APU_VECTOR_STORE_ID"];
  const environment = new Map(environmentKeys.map(key => [key, process.env[key]]));
  // Vinext captures this shared fetch when the bundle loads and installs a wrapper
  // during requests. Own both entry points for this test, restoring their descriptors.
  const originalFetchKey = Symbol.for("vinext.fetchCache.originalFetch");
  const patchInstalledKey = Symbol.for("vinext.fetchCache.patchInstalled");
  const globals = new Map(["fetch", originalFetchKey, patchInstalledKey].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => {
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    for (const [key, value] of environment) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const fixtureFetch = async input => {
    assert.equal(String(input), `${issuer}/cdn-cgi/access/certs`, "fixture forbids external/provider requests");
    return jwks === "unavailable" ? new Response(null, { status: 503 }) : Response.json({ keys: jwks === "missing" ? [] : [publicJwk] });
  };
  globalThis.fetch = fixtureFetch;
  globalThis[originalFetchKey] = fixtureFetch;
  delete globalThis[patchInstalledKey];
  process.env.CF_ACCESS_TEAM_DOMAIN = issuer;
  process.env.CF_ACCESS_AUD = audience;
  process.env.APU_DEVELOPER_EMAILS = developerEmails;
  process.env.NODE_ENV = nodeEnv;
  process.env.APU_LOCAL_DEV_AUTH = "0";
  // Valid auth must stop at missing provider configuration, even on credentialed hosts.
  delete process.env.OPENAI_API_KEY;
  delete process.env.APU_VECTOR_STORE_ID;
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("fixture", crypto.randomUUID());
  return (await import(workerUrl.href)).default;
}

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

test("renders development preview metadata", async t => {
  const worker = await loadWorker(t);

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
  assert.match(html, /developer@example\.com/);
  assert.match(html, /DEV ON/);
  assert.match(html, /Telemetrie a náklady konverzace/);
  assert.match(html, /Konverzace/);
  assert.match(html, /desktop-tool-chat/);
  assert.match(html, /desktop-tool-build/);
  assert.match(html, /Nový projekt/);
  assert.match(html, /Zápisník/);
  assert.match(html, /Obsah/);
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

test("fails closed without a valid Access identity", async t => {
  const worker = await loadWorker(t);
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

test("shows developer surfaces only to developers", async t => {
  const worker = await loadWorker(t);
  const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const developer = await worker.fetch(new Request("http://localhost/", { headers: await identityHeaders("developer@example.com") }), env, ctx);
  const tester = await worker.fetch(new Request("http://localhost/", { headers: await identityHeaders("tester@example.com") }), env, ctx);
  const developerHtml = await developer.text();
  const testerHtml = await tester.text();
  assert.match(developerHtml, /Otevřít nastavení/);
  assert.match(developerHtml, /conversation-diagnostics/);
  assert.match(testerHtml, /Otevřít nastavení/);
  assert.doesNotMatch(testerHtml, /conversation-diagnostics/);
  assert.match(developerHtml, /Stáhnout APU Session JSON/);
  assert.match(developerHtml, /developer-log-toggle/);
  assert.match(developerHtml, /DEV ON/);
  const developerHeader = developerHtml.match(/<header\b[^>]*class="app-header"[\s\S]*?<\/header>/)?.[0];
  assert.ok(developerHeader);
  for (const label of ["Testovací scénáře", "Telemetrie a náklady konverzace", "Stáhnout APU Session JSON"]) {
    assert.equal(developerHeader.split(`aria-label="${label}"`).length - 1, 1, `${label} is one distinct control`);
  }
  assert.doesNotMatch(developerHeader, /DEV LOG|dev-log-panel|dev-log-overlay/);
  assert.match(testerHtml, /tester@example\.com/);
  assert.doesNotMatch(testerHtml, /Stáhnout APU Session JSON|session-export-trigger|developer-log-toggle|DEV ON|Telemetrie a náklady konverzace|diagnostic-debug/);
  assert.match(testerHtml, /Popište mi situaci, se kterou chcete dnes pracovat\./);
  assert.match(testerHtml, /Zobrazit příklad situace/);
});

test("STABLE empty developer allowlist omits developer surfaces even for the DEV developer email", async t => {
  const worker = await loadWorker(t, { developerEmails: "", nodeEnv: "production" });
  const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  for (const email of ["teacher@example.com", "developer@example.com"]) {
    await t.test(email, async () => {
      const response = await worker.fetch(new Request("http://localhost/", { headers: await identityHeaders(email) }), env, ctx);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.doesNotMatch(html, /DEV ON|DEV LOG|developer-controls|developer-indicator|developer-log-toggle|dev-scenario|conversation-diagnostics|conversation-stats-popover|session-export-trigger|header-session-export|diagnostic-debug|response-diagnostics/);
      assert.doesNotMatch(html, /Testovací scénáře|Telemetrie a náklady konverzace|Stáhnout APU Session JSON/);
      assert.ok(html.includes(email));
      for (const label of ["Otevřít nastavení", "Nový projekt", "Zápisník", "Obsah", "Výstup", "apu-logo-horizontal.png"]) assert.ok(html.includes(label), label);
    });
  }
  const anonymous = await worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), env, ctx);
  assert.match(await anonymous.text(), /Ověřená identita Cloudflare Access není dostupná/);
});

test("model API rejects invalid auth and accepts tester and developer identities", async t => {
  const worker = await loadWorker(t);
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

test("model APIs reject invalid signatures, issuer, audience and expiration", async t => {
  const worker = await loadWorker(t);
  const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const valid = await accessToken("tester@example.com");
  const tokens = [
    valid.slice(0, valid.lastIndexOf(".") + 1) + base64url("invalid-signature"),
    await accessToken("tester@example.com", { iss: "https://other.example.invalid" }),
    await accessToken("tester@example.com", { aud: "different-audience" }),
    await accessToken("tester@example.com", { exp: Math.floor(Date.now() / 1000) - 1 }),
  ];
  for (const route of ["/api/chat", "/api/extract"]) for (const token of tokens) {
    const response = await worker.fetch(new Request(`http://localhost${route}`, {
      method: "POST", headers: { "content-type": "application/json", "cf-access-jwt-assertion": token },
      body: JSON.stringify({ message: "synthetic", notebook: [] }),
    }), env, ctx);
    assert.equal(response.status, 401);
  }
});

for (const jwks of ["missing", "unavailable"]) test(`model APIs fail closed with ${jwks} JWKS`, async t => {
  const worker = await loadWorker(t, { jwks });
  const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  for (const route of ["/api/chat", "/api/extract"]) {
    const response = await worker.fetch(new Request(`http://localhost${route}`, {
      method: "POST", headers: { "content-type": "application/json", "cf-access-jwt-assertion": await accessToken("developer@example.com") },
      body: JSON.stringify({ message: "synthetic", notebook: [] }),
    }), env, ctx);
    assert.equal(response.status, 401);
  }
});

test("render fixtures own preloaded Vinext fetch state and restore globals/environment", async t => {
  const globalKeys = ["fetch", Symbol.for("vinext.fetchCache.originalFetch"), Symbol.for("vinext.fetchCache.patchInstalled")];
  const globals = new Map(globalKeys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const environmentKeys = ["CF_ACCESS_TEAM_DOMAIN", "CF_ACCESS_AUD", "APU_DEVELOPER_EMAILS", "NODE_ENV", "APU_LOCAL_DEV_AUTH", "OPENAI_API_KEY", "APU_VECTOR_STORE_ID"];
  const environment = new Map(environmentKeys.map(key => [key, process.env[key]]));
  let staleFetchCalls = 0;
  const staleFetch = async () => { staleFetchCalls++; throw new Error("Synthetic stale fetch must not run"); };
  try {
    globalThis.fetch = staleFetch;
    globalThis[globalKeys[1]] = staleFetch;
    globalThis[globalKeys[2]] = true;
    process.env.OPENAI_API_KEY = "synthetic-never-call";
    process.env.APU_VECTOR_STORE_ID = "synthetic-never-call";
    const expectedEnvironment = new Map(environmentKeys.map(key => [key, process.env[key]]));
    await t.test("a valid signed tester JWT still stops before any provider call", async child => {
      const worker = await loadWorker(child);
      const response = await worker.fetch(new Request("http://localhost/api/chat", {
        method: "POST", headers: { "content-type": "application/json", "cf-access-jwt-assertion": await accessToken("tester@example.com") },
        body: JSON.stringify({ message: "synthetic", notebook: [] }),
      }), { ASSETS: { fetch: async () => new Response(null, { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
      assert.equal(response.status, 503);
    });
    assert.equal(staleFetchCalls, 0);
    assert.equal(globalThis.fetch === staleFetch, true);
    assert.equal(globalThis[globalKeys[1]] === staleFetch, true);
    assert.equal(globalThis[globalKeys[2]], true);
    for (const [key, value] of expectedEnvironment) assert.equal(process.env[key] === value, true, `${key} restored`);
  } finally {
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    for (const [key, value] of environment) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
