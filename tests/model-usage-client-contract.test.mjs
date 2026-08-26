import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const client = await readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8");

test("client collects canonical records from every non-streaming response path without a role gate", () => {
  assert.match(client, /setModelUsageRecords/);
  assert.equal((client.match(/collectModelUsageRecords\((?:payload|responseResult|result)\)/g) ?? []).length, 6);
  const collector = client.slice(client.indexOf("function collectModelUsageRecords"), client.indexOf("useEffect", client.indexOf("function collectModelUsageRecords")));
  assert.match(collector, /readModelUsageRecords/);
  assert.match(collector, /appendModelUsageRecords/);
  assert.doesNotMatch(collector, /isDeveloper|role/);
});

test("chat sends the canonical request id and collects terminal stream records before errors", () => {
  assert.match(client, /controllerFastPathEligible[^]*requestId,\s*turnId,/);
  const processLine = client.slice(client.indexOf("const processLine = (line: string)"), client.indexOf("while (true)", client.indexOf("const processLine = (line: string)")));
  assert.match(processLine, /collectModelUsageRecords\(event\)/);
  assert.ok(processLine.indexOf("collectModelUsageRecords(event)") < processLine.indexOf('event.type === "error"'));
});

test("raw records are cleared with the client session and are not exported in schema 1.0", () => {
  assert.match(client, /setModelUsageRecords\(\[\]\)/);
  const exportCall = client.slice(client.indexOf("buildSessionExport({"), client.indexOf("downloadSessionExport", client.indexOf("buildSessionExport({")));
  assert.doesNotMatch(exportCall, /modelUsageRecords/);
});
