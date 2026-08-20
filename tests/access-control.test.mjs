import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("allowlist contains only the two invited ChatGPT accounts", async () => {
  const source = await readFile(new URL("../app/chatgpt-auth.ts", import.meta.url), "utf8");
  const allowlistBlock = source.match(/const ALLOWED_EMAILS = new Set\(\[([\s\S]*?)\]\);/)?.[1] ?? "";
  const emails = [...allowlistBlock.matchAll(/["']([^"']+@[^"']+)["']/g)].map((match) => match[1]).sort();
  assert.deepEqual(emails, ["almadellobo@gmail.com", "z.vilimek@gmail.com"]);
});

test("all model-backed API routes enforce the server-side allowlist", async () => {
  for (const relativePath of ["../app/api/chat/route.ts", "../app/api/extract/route.ts", "../app/api/analysis/route.ts"]) {
    const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
    assert.match(source, /getChatGPTUser\(/);
    assert.match(source, /isAllowedChatGPTUser\(user\.email\)/);
    assert.match(source, /401/);
    assert.match(source, /403/);
  }
});
