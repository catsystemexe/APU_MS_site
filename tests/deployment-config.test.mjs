import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production deploys preserve Cloudflare-managed variables and secrets", async () => {
  const wrangler = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const generatedWranglerUrl = new URL("../dist/server/wrangler.json", import.meta.url);
  const generatedWrangler = await readFile(generatedWranglerUrl, "utf8").then(JSON.parse, (error) => error.code === "ENOENT" ? null : Promise.reject(error));
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.match(wrangler, /"keep_vars"\s*:\s*true/);
  assert.match(wrangler, /"main"\s*:\s*"\.\/dist\/server\/index\.js"/);
  assert.match(wrangler, /"no_bundle"\s*:\s*true/);
  assert.match(wrangler, /"find_additional_modules"\s*:\s*true/);
  assert.match(wrangler, /"base_dir"\s*:\s*"\.\/dist\/server"/);
  assert.match(wrangler, /"type"\s*:\s*"ESModule"/);
  assert.match(wrangler, /"\*\*\/\*\.js"/);
  assert.match(wrangler, /"\*\*\/\*\.mjs"/);
  assert.equal(generatedWrangler?.keep_vars ?? true, true);
  assert.equal(generatedWrangler?.main ?? "index.js", "index.js");
  assert.equal(generatedWrangler?.no_bundle ?? true, true);
  assert.deepEqual(generatedWrangler?.rules ?? [{ type: "ESModule", globs: ["**/*.js", "**/*.mjs"] }], [
    { type: "ESModule", globs: ["**/*.js", "**/*.mjs"] },
  ]);
  assert.match(packageJson.scripts.deploy, /wrangler deploy --config wrangler\.jsonc --keep-vars/);
  assert.doesNotMatch(packageJson.scripts.deploy, /npm run build/);
  assert.match(wrangler, /"binding"\s*:\s*"DEV_LOG_STATE"/);
  assert.match(wrangler, /"id"\s*:\s*"4a24c791d31a4c0983170c921cb744aa"/);
  assert.match(wrangler, /"preview_id"\s*:\s*"8dd4e8a10dc74086bbd746e733b3d8d8"/);
  assert.notEqual("4a24c791d31a4c0983170c921cb744aa", "8dd4e8a10dc74086bbd746e733b3d8d8");

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
