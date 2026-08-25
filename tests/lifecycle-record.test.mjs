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

test("completed records render inside the assistant response between its header and content", async () => {
  const client = await readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8");

  assert.match(client, /<div className="message-author">[\s\S]*?message-phase[\s\S]*?<\/div>[\s\S]*?message-lifecycle-records[\s\S]*?message\.lifecycleRecords\.map[\s\S]*?<CompletedLifecycleStatus[\s\S]*?<div className=\{message\.role === "assistant"/);
  assert.match(client, /message\.phaseLabel\.replace\(\/\^\\\[\|\\\]\$\/g, ""\)/);
  assert.match(client, /if \(phase === "intake"\) clearF1ProcessingStatus\(\)[\s\S]*?content: snapshot\.visibleContent/);
  assert.doesNotMatch(client, /clearF1ProcessingStatus\([\s\S]{0,200}lifecycleRecords:\s*\[\]/);
});

test("completed records survive the first main-content delta", () => {
  const pending = withCompletedLifecycleRecord(
    { id: "assistant-1", role: "assistant", content: "" },
    notebookRecord,
  );
  const afterFirstDelta = { ...pending, content: "Rozumím" };

  assert.deepEqual(afterFirstDelta.lifecycleRecords, [notebookRecord]);
  assert.equal(afterFirstDelta.content, "Rozumím");
});

test("multiple completed records use a compact uncarded stack", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(styles, /\.message-lifecycle-records\s*\{[\s\S]*?display:\s*grid;[\s\S]*?gap:\s*2px;/);
  assert.match(styles, /\.lifecycle-record\s*\{[\s\S]*?margin:\s*0;/);
});

test("only substantive assistant content receives the response surface", async () => {
  const [client, styles] = await Promise.all([
    readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(client, /message\.role === "assistant" && \(message\.content \|\| message\.analysisEntryHypotheses\)[\s\S]*?assistant-response/);
  assert.match(client, /assistant-response--f2-entry[\s\S]*?analysisNextPrompt[\s\S]*?<AnalysisQuestionRow[\s\S]*?dialogActions\?\.map[\s\S]*?<DialogActionCard/);
  assert.match(styles, /\.assistant-response\s*\{[\s\S]*?background:\s*var\(--bg-surface\)/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.assistant-response\s*\{[\s\S]*?max-width:\s*100%;[\s\S]*?padding:\s*7px 8px;/);
  assert.doesNotMatch(styles, /\.assistant-response\s*\{[^}]*?(?:border:|box-shadow:)/);
  assert.match(styles, /\.assistant-response\.assistant-response--f2-entry\s*\{[^}]*?padding:\s*0;[^}]*?background:\s*transparent;/);
  assert.match(styles, /\.message-list\s*\{[\s\S]*?background:\s*color-mix\(in srgb, var\(--bg-page\) 72%, var\(--bg-surface\) 28%\)/);
  assert.match(client, /message\.role === "user" \? "user-response" : undefined/);
  assert.match(styles, /\.message--user\s*\{[^}]*?width:\s*100%;[^}]*?\}/);
  assert.doesNotMatch(styles, /\.message--user\s*\{[^}]*?justify-items:/);
  assert.match(styles, /\.message--user \.message-label\s*\{[^}]*?justify-self:\s*end;/);
  assert.match(styles, /\.user-response\s*\{[^}]*?justify-self:\s*end;[^}]*?max-width:\s*min\(690px, calc\(100% - 16px\)\);/);
  assert.match(styles, /\.user-response \.message-content\s*\{[^}]*?max-width:\s*100%;/);
  assert.doesNotMatch(styles, /\.message--user \.message-content\s*\{[^}]*?(?:width:|min-width:|max-width:)/);
  assert.doesNotMatch(styles, /\.user-response\s*\{[^}]*?min-width:/);
  assert.doesNotMatch(styles, /\.message-content\s*\{[^}]*?overflow-wrap:\s*anywhere;/);
  assert.match(styles, /\.message-content\s*\{[^}]*?overflow-wrap:\s*break-word;/);
});
