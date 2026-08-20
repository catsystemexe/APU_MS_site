import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: {
        accept: "text/html",
        "oai-authenticated-user-email": "almadellobo@gmail.com",
      },
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

test("keeps the APU interface behind ChatGPT sign-in", async () => {
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
  assert.match(anonymousHtml, /Přihlásit se přes ChatGPT/);
  assert.doesNotMatch(anonymousHtml, /Pracovní hypotézy se zobrazí/);

  const forbidden = await worker.fetch(
    new Request("http://localhost/", {
      headers: {
        accept: "text/html",
        "oai-authenticated-user-email": "cizi.ucet@example.com",
      },
    }),
    env,
    ctx,
  );
  const forbiddenHtml = await forbidden.text();
  assert.equal(forbidden.status, 200);
  assert.match(forbiddenHtml, /Účet nemá přístup/);
  assert.doesNotMatch(forbiddenHtml, /Pracovní hypotézy se zobrazí/);
});

test("rejects anonymous and non-allowlisted model API requests before runtime configuration", async () => {
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

    const forbidden = await worker.fetch(
      new Request(`http://localhost${route}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "oai-authenticated-user-email": "cizi.ucet@example.com",
        },
        body: JSON.stringify({ message: "test", notebook: [] }),
      }),
      env,
      ctx,
    );
    assert.equal(forbidden.status, 403);
  }
});
