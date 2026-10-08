import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { DEV_TEST_SCENARIOS, DEV_TEST_SCENARIO_PATHS } from "../app/dev-test-scenarios.ts";

test("Human Gate matrix has nine unique cases and three ordered difficulties per path", () => {
  assert.equal(DEV_TEST_SCENARIOS.length, 9);
  assert.equal(new Set(DEV_TEST_SCENARIOS.map(({ id }) => id)).size, 9);
  assert.deepEqual(DEV_TEST_SCENARIO_PATHS, ["POCHOPIT", "POZOROVAT", "VYTVOŘIT"]);
  const loads = {
    POCHOPIT: ["VLNA", "BOUŘE", "TSUNAMI"],
    POZOROVAT: ["BOUŘE", "TSUNAMI", "VLNA"],
    VYTVOŘIT: ["TSUNAMI", "VLNA", "BOUŘE"],
  };
  for (const path of DEV_TEST_SCENARIO_PATHS) {
    const scenarios = DEV_TEST_SCENARIOS.filter((scenario) => scenario.path === path);
    assert.deepEqual(scenarios.map(({ difficulty }) => difficulty), [1, 2, 3]);
    assert.deepEqual(scenarios.map(({ load }) => load), loads[path]);
    assert.deepEqual(scenarios.map(({ subtitle }) => subtitle), ["Jednoduchý", "Více proměnných", "Nejasná / konfliktní data"]);
    assert.ok(scenarios.every(({ label }) => label.length > 0));
  }
});

// Digests of the complete supplied inputs, including punctuation and teacher goals.
test("all nine scenario texts exactly preserve the supplied Human Gate inputs", () => {
  const expected = [
    "8c4092794b18731c4ba986d87e31b480873a3afb6de8f22809cc7fc12f601717",
    "ce9b59bb46ff86b32eb02d7b87945cabff0449b2f41bbd532c94848022b80387",
    "ad7e90d6a77248ae684f0e709bd19b0bd0101c5293321890ebe8562873ecb49e",
    "be30167d8658fad7383a3ac9a4bac0e034d96668a85a9e71a8beea5bed22aab6",
    "f1b62939bf847892d4290db5fa855a6cd26dec276a8db229b524032e99fd4d3a",
    "1718b69b78fc367643f32cf58b0607d3834308246da950bf1e177145d1248bbe",
    "00efdb77b461a08e921d0265dc7ba0b74736f97516c301f4497e0c069bd52a10",
    "743fe564f88518c1cd04d139489d0b2ab284b43dd24c5dea234e0225658b9049",
    "122f420367fb902be4ccbb339d1aa3753ac21bea927ce09c0379fd90e4388b5b"
];
  assert.deepEqual(DEV_TEST_SCENARIOS.map(({ text }) => createHash("sha256").update(text).digest("hex")), expected);
});
