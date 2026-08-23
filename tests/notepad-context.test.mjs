import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const chatRoute = await readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8");
const runtimeInstructions = await readFile(new URL("../app/runtime-instructions.ts", import.meta.url), "utf8");

test("chat context treats explicit extracted user information as canonical", () => {
  assert.match(chatRoute, /trust: "confirmed" \| "unconfirmed"/);
  assert.match(chatRoute, /Explicitní uživatelské informace zachycené sémantickým extraktorem jsou kanonické/);
  assert.match(chatRoute, /Modelové domněnky se do Zápisníku nezapisují/);
  assert.match(chatRoute, /z aktuální zprávy v tomto JSON záměrně nejsou/);
  assert.doesNotMatch(chatRoute, /uživatelem potvrzený pracovní kontext jedné řešené situace/);
});

test("chat prompt is independent of the active workspace view", () => {
  assert.doesNotMatch(chatRoute, /activeWorkspacePanel/);
  assert.match(chatRoute, /composeApuSiteInstructions/);
  assert.doesNotMatch(runtimeInstructions, /Aktivní pracovní vrstva:|AKTIVNÍ PRACOVNÍ VRSTVA/);
});
