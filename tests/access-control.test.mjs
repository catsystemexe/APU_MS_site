import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
