import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const client = await readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8");

test("client collects canonical records from every non-streaming response path without a role gate", () => {
  assert.match(client, /setModelUsageSession/);
  assert.equal((client.match(/collectModelUsageRecords\((?:payload|responseResult|result)\)/g) ?? []).length, 6);
  const collector = client.slice(client.indexOf("function collectModelUsageRecords"), client.indexOf("useEffect", client.indexOf("function collectModelUsageRecords")));
  assert.match(collector, /readModelUsageRecords/);
  assert.match(collector, /appendModelUsageSessionRecords/);
  assert.doesNotMatch(collector, /isDeveloper|role/);
});

test("chat sends the canonical request id and collects terminal stream records before errors", () => {
  assert.match(client, /controllerFastPathEligible[^]*requestId,\s*turnId,/);
  const processLine = client.slice(client.indexOf("const processLine = (line: string)"), client.indexOf("while (true)", client.indexOf("const processLine = (line: string)")));
  assert.match(processLine, /collectModelUsageRecords\(event\)/);
  assert.ok(processLine.indexOf("collectModelUsageRecords(event)") < processLine.indexOf('event.type === "error"'));
});

test("raw records and their derived summary are cleared with the client session and are not exported in schema 1.0", () => {
  assert.match(client, /setModelUsageSession\(createModelUsageSession\(\)\)/);
  const exportCall = client.slice(client.indexOf("buildSessionExport({"), client.indexOf("downloadSessionExport", client.indexOf("buildSessionExport({")));
  assert.doesNotMatch(exportCall, /modelUsageRecords/);
});

test("client maintains a non-UI shadow comparison between legacy diagnostics and canonical usage", () => {
  assert.match(client, /compareUsageShadow\(legacyDiagnostics, modelUsageSession\)/);
  assert.match(client, /usageShadowComparisonRef\.current/);
  const exportCall = client.slice(client.indexOf("buildSessionExport({"), client.indexOf("downloadSessionExport", client.indexOf("buildSessionExport({")));
  assert.doesNotMatch(exportCall, /usageShadowComparison/);
});

test("DEV header reads the canonical session summary while legacy diagnostics remain only in shadow comparison", () => {
  assert.match(client, /const canonicalUsageSummary = useMemo\(\(\) => \{/);
  assert.match(client, /inputTokens: summary\.input_tokens/);
  assert.match(client, /totalTokens: summary\.normalized_total_tokens/);
  assert.match(client, /estimatedCostUsd: summary\.complete_estimated_cost_usd/);
  assert.match(client, /knownCostSubtotalUsd: summary\.known_cost_subtotal_usd/);
  assert.match(client, /unpricedCallCount: summary\.unpriced_call_count/);
  const header = client.slice(client.indexOf('className="stats-trigger"'), client.indexOf('<nav className="project-actions"'));
  assert.match(header, /canonicalUsageSummary/);
  assert.doesNotMatch(header, /\bsummary\./);
});
