import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fallbackQuestController } from "../app/dialog-action.ts";
import {
  enforceStructuredF1Prose,
  isStructuredF1Turn,
  mainProseOwnsDialogInteraction,
} from "../app/f1-response-contract.ts";

const fixture = fallbackQuestController([
  { category: "manifestations", text: "žák spí" },
  { category: "goals", text: "pochopit" },
], "intake");

test("llm_fallback fixture keeps SIDE and NAV structured without exposing duplicated Main prose", () => {
  assert.equal(isStructuredF1Turn(fixture), true);
  assert.deepEqual(fixture.dialog_actions.map((action) => action.type), ["SIDE", "NAV"]);

  const invalidMain = `Rozumím, že potřebujete situaci pochopit.\n\n💬 ${fixture.dialog_actions[0].question}\n\n${fixture.dialog_actions[1].question}`;
  const visibleProse = enforceStructuredF1Prose(invalidMain, fixture.dialog_actions);

  assert.equal(visibleProse, "Rozumím. Popsanou situaci budeme dál zpřesňovat podle vašich informací.");
  for (const action of fixture.dialog_actions) assert.equal(visibleProse.includes(action.question), false);
  assert.doesNotMatch(visibleProse, /💬/u);
  assert.deepEqual(fixture.dialog_actions.map((action) => action.type), ["SIDE", "NAV"]);
});

test("structured F1 accepts declarative prose and does not globally blacklist a non-question bubble", () => {
  const declarative = "Rozumím 💬 a popsanou situaci budeme dál zpřesňovat.";
  assert.equal(mainProseOwnsDialogInteraction(declarative, fixture.dialog_actions), false);
  assert.equal(enforceStructuredF1Prose(declarative, fixture.dialog_actions), declarative);
});

test("structured F1 rejects a paraphrased question without relying on an emoji match", () => {
  assert.equal(mainProseOwnsDialogInteraction("Ve které části dne si spánku všímáte nejčastěji?", fixture.dialog_actions), true);
});

test("only structured F1 output is buffered before it can reach the client", async () => {
  const route = await readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8");
  assert.match(route, /bufferStructuredF1Prose = isStructuredF1Turn\(controllerResult\)/);
  assert.match(route, /if \(bufferStructuredF1Prose\) bufferedMainProse \+= event\.delta;\s*else emit\(\{ type: "delta", text: event\.delta \}\)/);
  assert.match(route, /enforceStructuredF1Prose\(bufferedMainProse, controllerResult\.dialog_actions\)/);
});

test("Core no longer asks the model to prefix questions with a UI bubble", async () => {
  const [core, runtime] = await Promise.all([
    readFile(new URL("../apu-core/v1.6/00_INSTRUCTIONS_v1.6.md", import.meta.url), "utf8"),
    readFile(new URL("../app/runtime-instructions.ts", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(core, /Doplňující otázku začni symbolem 💬/u);
  assert.doesNotMatch(runtime, /prefixu 💬|emoji 💬/u);
});
