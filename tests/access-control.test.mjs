import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadAccessAuth() {
  const source = (await readFile(new URL("../app/access-auth.ts", import.meta.url), "utf8"))
    .replace('import { headers } from "next/headers";', "const headers = async () => new Headers();");
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
}

function jwtSegment(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function unsignedJwt(claims, kid = "test-key") {
  return `${jwtSegment({ alg: "RS256", kid, typ: "JWT" })}.${jwtSegment(claims)}.c2lnbmF0dXJl`;
}

async function signedJwt(claims, kid = "test-key") {
  const keyPair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const protectedToken = `${jwtSegment({ alg: "RS256", kid, typ: "JWT" })}.${jwtSegment(claims)}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keyPair.privateKey, Buffer.from(protectedToken));
  return {
    token: `${protectedToken}.${Buffer.from(signature).toString("base64url")}`,
    jwk: { ...await crypto.subtle.exportKey("jwk", keyPair.publicKey), kid, alg: "RS256", use: "sig" },
  };
}

test("all model-backed API routes enforce the shared Access identity", async () => {
  for (const relativePath of ["../app/api/chat/route.ts", "../app/api/extract/route.ts", "../app/api/analysis/route.ts"]) {
    const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
    assert.match(source, /getAccessIdentity\(request\.headers\)/);
    assert.match(source, /401/);
  }
});

test("local auth bypass remains explicitly bounded to development", async () => {
  const source = await readFile(new URL("../app/access-auth.ts", import.meta.url), "utf8");
  assert.match(source, /process\.env\.NODE_ENV === "development"/);
  assert.match(source, /process\.env\.APU_LOCAL_DEV_AUTH === "1"/);
});

test("the verified Access email and developer role are passed into the header", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const client = await readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8");

  assert.match(page, /email=\{identity\.email\}/);
  assert.match(page, /isDeveloper=\{identity\.role === "developer"\}/);
  assert.match(client, /className="account-email"[^>]*>\{email\}/);
  assert.match(client, /\{isDeveloper && <DeveloperHeaderControls/);
  assert.match(client, /className="developer-indicator"[^>]*>DEV ON<\/span>/);
  assert.match(client, /className="developer-log-toggle"[\s\S]*?<TriangleAlert/);
  assert.doesNotMatch(client, /className="personality-trigger"/);
});

test("Access validation reports safe, specific failures and preserves successful validation", async (t) => {
  const { getAccessIdentity } = await loadAccessAuth();
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    CF_ACCESS_AUD: process.env.CF_ACCESS_AUD,
    CF_ACCESS_TEAM_DOMAIN: process.env.CF_ACCESS_TEAM_DOMAIN,
    APU_DEVELOPER_EMAILS: process.env.APU_DEVELOPER_EMAILS,
  };
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const logs = [];
  console.warn = (message) => logs.push(message);

  const configure = (domain = "access.example.com") => {
    process.env.NODE_ENV = "test";
    process.env.CF_ACCESS_AUD = "test-audience";
    process.env.CF_ACCESS_TEAM_DOMAIN = domain;
    process.env.APU_DEVELOPER_EMAILS = "developer@example.com";
    logs.length = 0;
  };
  const claims = (overrides = {}) => ({
    iss: `https://${process.env.CF_ACCESS_TEAM_DOMAIN}`,
    aud: "test-audience",
    email: "developer@example.com",
    exp: Math.floor(Date.now() / 1000) + 300,
    ...overrides,
  });
  const expectFailure = async (token, reason) => {
    const identity = await getAccessIdentity(new Headers(token ? { "cf-access-jwt-assertion": token } : {}));
    assert.equal(identity, null);
    assert.deepEqual(logs, [`[access-auth] validation_failed reason=${reason}`]);
  };

  try {
    await t.test("missing_config logs key names but no values", async () => {
      delete process.env.CF_ACCESS_AUD;
      delete process.env.CF_ACCESS_TEAM_DOMAIN;
      logs.length = 0;
      assert.equal(await getAccessIdentity(new Headers()), null);
      assert.deepEqual(logs, ["[access-auth] validation_failed reason=missing_config missing=CF_ACCESS_AUD,CF_ACCESS_TEAM_DOMAIN"]);
    });
    await t.test("missing_access_header", async () => {
      configure();
      await expectFailure(null, "missing_access_header");
    });
    await t.test("issuer_mismatch", async () => {
      configure();
      const token = unsignedJwt(claims({
        iss: "https://other.example.com/private/path?aud=secret-audience&email=secret@example.com",
      }));
      assert.equal(await getAccessIdentity(new Headers({ "cf-access-jwt-assertion": token })), null);
      assert.deepEqual(logs, [
        "[access-auth] validation_failed reason=issuer_mismatch"
          + " expected_issuer_host=access.example.com actual_issuer_host=other.example.com",
      ]);
      assert.doesNotMatch(logs[0], /private|secret|JWT|signature|claims|audience|@/i);
    });
    await t.test("audience_mismatch", async () => {
      configure();
      await expectFailure(unsignedJwt(claims({ aud: "wrong-audience" })), "audience_mismatch");
    });
    await t.test("expired token", async () => {
      configure();
      await expectFailure(unsignedJwt(claims({ exp: Math.floor(Date.now() / 1000) - 1 })), "token_expired");
    });
    await t.test("jwk_not_found", async () => {
      configure("missing-key.example.com");
      globalThis.fetch = async () => new Response(JSON.stringify({ keys: [] }), { status: 200 });
      await expectFailure(unsignedJwt(claims()), "jwk_not_found");
    });
    await t.test("signature_invalid", async () => {
      configure("invalid-signature.example.com");
      const signed = await signedJwt(claims());
      globalThis.fetch = async () => new Response(JSON.stringify({ keys: [signed.jwk] }), { status: 200 });
      await expectFailure(unsignedJwt(claims()), "signature_invalid");
    });
    await t.test("successful validation remains unchanged", async () => {
      configure("successful.example.com");
      const signed = await signedJwt(claims());
      globalThis.fetch = async () => new Response(JSON.stringify({ keys: [signed.jwk] }), { status: 200 });
      const identity = await getAccessIdentity(new Headers({ "cf-access-jwt-assertion": signed.token }));
      assert.deepEqual(identity, { email: "developer@example.com", role: "developer" });
      assert.deepEqual(logs, []);
    });
  } finally {
    console.warn = originalWarn;
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
