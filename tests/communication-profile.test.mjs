import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  COMMUNICATION_PROFILES,
  DEFAULT_COMMUNICATION_PROFILE_ID,
  communicationProfileInstruction,
  isCommunicationProfile,
} from "../app/communication-profile.ts";

const [client, chatRoute, styles] = await Promise.all([
  readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);

test("Kolega is the default of three communication profiles", () => {
  assert.equal(DEFAULT_COMMUNICATION_PROFILE_ID, "colleague");
  assert.deepEqual(
    Object.values(COMMUNICATION_PROFILES).map(({ label }) => label),
    ["Operátor", "Kolega", "Metodik"],
  );
  assert.equal(isCommunicationProfile("operator"), true);
  assert.equal(isCommunicationProfile("colleague"), true);
  assert.equal(isCommunicationProfile("methodologist"), true);
  assert.equal(isCommunicationProfile("unknown"), false);
});

test("profiles change delivery but preserve the shared APU judgment", () => {
  for (const profile of ["operator", "colleague", "methodologist"]) {
    const instruction = communicationProfileInstruction(profile);
    assert.match(instruction, /mění pouze podání odpovědi/);
    assert.match(instruction, /nikoli pedagogický úsudek/);
    assert.match(instruction, /jednu primární dialogovou akci nebo otázku/);
  }
});

test("the selected profile is visible in the header and sent to the server", () => {
  assert.match(client, /className="personality-trigger"/);
  assert.match(client, /id="personality-menu-options"/);
  assert.match(client, /role="menuitemradio"/);
  assert.match(client, /communicationProfile,/);
  assert.match(chatRoute, /isCommunicationProfile\(communicationProfile\)/);
  assert.match(chatRoute, /communicationProfileInstruction\(communicationProfile\)/);
  assert.match(styles, /\.personality-menu-options/);
  assert.doesNotMatch(styles, /\.personality-select-wrap::after/);
});

test("costs are displayed in Czech crowns using the conservative fixed rate", () => {
  assert.match(client, /const CZK_PER_USD = 21\.5/);
  assert.match(client, /valueUsd \* CZK_PER_USD/);
  assert.match(client, /Kč/);
});
