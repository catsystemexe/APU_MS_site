import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDebugMapping,
  parseDebugMapping,
  splitAssistantMetadata,
} from "../app/response-metadata.ts";

test("extracts and canonicalizes profile, block and zone mapping", () => {
  const parsed = splitAssistantMetadata(
    "[FÁZE 2]\nPracovní vysvětlení.\n[DEBUG | Profil: P2/P5 | Blok: A / E | Zóna: 1/2]",
    { ensureDebug: true },
  );
  assert.equal(parsed.visibleContent, "Pracovní vysvětlení.");
  assert.equal(parsed.phaseLabel, "[FÁZE 2]");
  assert.deepEqual(parsed.debugMapping, {
    profiles: "P2 / P5",
    blocks: "A / E",
    zones: "1 / 2",
  });
  assert.equal(parsed.debugText, "[DEBUG | Profil: P2 / P5 | Blok: A / E | Zóna: 1 / 2]");
});

test("supplies an explicit unknown mapping when a situational response omits debug", () => {
  const parsed = splitAssistantMetadata("[FÁZE 1]\nPotřebuji doplnit situaci.", { ensureDebug: true });
  assert.equal(parsed.debugText, "[DEBUG | Profil: ? | Blok: ? | Zóna: ?]");
  assert.deepEqual(parsed.debugMapping, { profiles: "?", blocks: "?", zones: "?" });
});

test("does not add development mapping to INFO responses", () => {
  const parsed = splitAssistantMetadata("[INFO]\nAPU pracuje ve třech fázích.", { ensureDebug: true });
  assert.equal(parsed.phaseLabel, "[INFO]");
  assert.equal(parsed.debugText, "");
  assert.equal(parsed.debugMapping, null);
});

test("rejects communication-profile text as functional profile mapping", () => {
  assert.equal(parseDebugMapping("[DEBUG | Profil: Kolega]"), null);
  assert.equal(formatDebugMapping({ profiles: "P3", blocks: "A", zones: "2" }), "[DEBUG | Profil: P3 | Blok: A | Zóna: 2]");
});
