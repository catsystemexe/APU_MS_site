import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production deploys preserve Cloudflare-managed variables and secrets", async () => {
  const wrangler = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const generatedWrangler = JSON.parse(
    await readFile(new URL("../dist/server/wrangler.json", import.meta.url), "utf8"),
  );
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.match(wrangler, /"keep_vars"\s*:\s*true/);
  assert.equal(generatedWrangler.keep_vars, true);
  assert.match(packageJson.scripts.deploy, /wrangler deploy --config wrangler\.jsonc --keep-vars/);

  for (const runtimeValue of [
    "OPENAI_API_KEY",
    "APU_VECTOR_STORE_ID",
    "CF_ACCESS_TEAM_DOMAIN",
    "CF_ACCESS_AUD",
    "APU_DEVELOPER_EMAILS",
  ]) {
    assert.doesNotMatch(wrangler, new RegExp(`"${runtimeValue}"\\s*:`));
  }
});
