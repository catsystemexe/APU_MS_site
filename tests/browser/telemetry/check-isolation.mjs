import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(path)); else result.push(path);
  }
  return result;
}
const sources = [...await files(join(root, "app")), ...await files(join(root, "worker"))].filter(p => /\.[cm]?[jt]sx?$/.test(p));
for (const path of sources) assert.doesNotMatch(await readFile(path, "utf8"), /telemetry-browser-(?:server|fixture)|tests\/browser\/telemetry|playwright-core/, "test harness must never be referenced by production modules");
const artifacts = [...await files(join(root, "dist/server")), ...await files(join(root, "dist/client"))].filter(p => /\.(?:m?js|json|map|html)$/.test(p));
assert.ok(artifacts.length > 0, "run the canonical build before artifact isolation validation");
for (const path of artifacts) assert.doesNotMatch(await readFile(path, "utf8"), /apu-telemetry-browser-|browser-auth\.synthetic\.invalid|ephemeral-h1|playwright-core|Synthetic voluntary measurement\. Test data only\./, "test harness/credentials must be absent from production artifacts");
console.log(JSON.stringify({ production_sources: sources.length, production_artifacts: artifacts.length, harness_references: 0, status: "PASS" }));
