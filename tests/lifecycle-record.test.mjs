import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { addCompletedLifecycleRecord, withCompletedLifecycleRecord } from "../app/lifecycle-record.ts";

const notebookRecord = { operation: "notebook", state: "completed", label: "Doplněn Zápisník" };

test("completed lifecycle records are attached to an assistant message and deduplicated by operation", () => {
  const message = { id: "assistant-1", role: "assistant", content: "Odpověď" };
  const once = withCompletedLifecycleRecord(message, notebookRecord);
  const twice = withCompletedLifecycleRecord(once, notebookRecord);

  assert.equal(once.lifecycleRecords.length, 1);
  assert.strictEqual(twice, once);
  assert.deepEqual(addCompletedLifecycleRecord([message], "other-assistant", notebookRecord), [message]);
});

test("notebook and analysis lifecycle records use actual success branches", async () => {
  const client = await readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8");

  assert.match(client, /if \(applied\.added\.length\) \{[\s\S]*?label: "Doplněn Zápisník"/);
  assert.doesNotMatch(client, /applied\.added\.length === 0[\s\S]*?Doplněn Zápisník/);
  assert.match(client, /chatUpdate\.kind === "entry"[\s\S]*?"Vytvořeny pracovní hypotézy"[\s\S]*?"Aktualizován Rozbor"/);
});

test("completed records render separately from transient assistant content and survive stream deltas", async () => {
  const client = await readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8");

  assert.match(client, /message\.lifecycleRecords\?\.map[\s\S]*?<CompletedLifecycleStatus/);
  assert.match(client, /if \(phase === "intake"\) clearF1ProcessingStatus\(\)[\s\S]*?content: snapshot\.visibleContent/);
  assert.doesNotMatch(client, /clearF1ProcessingStatus\([\s\S]{0,200}lifecycleRecords:\s*\[\]/);
});
