import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [client, output, dialog] = await Promise.all([
  readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/f3-finalization.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/dialog-action.ts", import.meta.url), "utf8"),
]);

test("primary F2 to F3 navigation uses current Rozbor and never requires legacy PREVIEW", () => {
  const navigation = client.slice(client.indexOf("function enterF3"), client.indexOf("async function refreshStructuredAnalysis"));
  assert.match(navigation, /currentF2ToF3Source\.snapshot/);
  assert.match(navigation, /createF3State\(currentF2ToF3Source\.snapshot\)/);
  assert.doesNotMatch(navigation, /f2Preview|renderF2Preview|PREVIEW/);
  const intent = client.slice(client.indexOf("function handleF2OutputNavigation"), client.indexOf("async function sendMessage"));
  assert.match(intent, /Boolean\(currentF2ToF3Source\.snapshot\)/);
  assert.doesNotMatch(intent, /f2Preview|PREVIEW/);
  assert.match(dialog, /valid current-Rozbor snapshot/);
});

test("Output workspace keeps explicit return, adoption and regeneration transitions", () => {
  assert.match(output, /Vrátit se do Rozboru/);
  assert.match(output, /Přijmout aktuální Rozbor/);
  assert.match(output, /state\.sourceStatus === "stale"/);
  assert.match(output, /REGENEROVAT VÝSTUP/);
  assert.match(output, /[Dd]osavadní výstup zůst/);
  assert.doesNotMatch(output, /PREVIEW|preview/);
});

test("legacy Preview remains isolated instead of authoritative for F3 adoption", () => {
  assert.match(client, /async function renderF2Preview/);
  const outputProps = client.slice(client.indexOf("f2ToF3Snapshot="), client.indexOf("onF3Return="));
  assert.match(outputProps, /currentF2ToF3Source\.snapshot/);
  assert.match(outputProps, /adoptF2Snapshot\(current, currentF2ToF3Source\.snapshot\)/);
  assert.doesNotMatch(outputProps, /f2Preview\.snapshot/);
});
