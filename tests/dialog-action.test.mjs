import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  cleanDialogActionQuestion, cleanStructuredQuestionText, fallbackQuestController, requiredIntakeTarget, resolveDialogEvent, resolveF2OutputNavigation, resolveTextDialogEvent, validateQuestControllerResult,
} from "../app/dialog-action.ts";
import { canBypassQuestController, QUEST_CONTROLLER_SCHEMA } from "../app/quest-controller.ts";

const manifestation = { category: "manifestations", text: "Při samostatné práci odloží tužku a nezačne." };
const goal = { category: "goals", text: "Potřebuji podpořit zahájení práce bez opakovaných výzev." };
const context = { category: "context", text: "Nejčastěji se to děje při ranní samostatné práci." };
const course = { category: "course", text: "Situace nastává přibližně třikrát týdně." };
const helps = { category: "helps", text: "Pomáhá rozdělit zadání na dva kroky." };
const continueOption = { id: "continue_to_solution", label: "Můžeme se teď podívat, co z dosavadních informací vyplývá?" };

const main = (target) => ({
  type: "MAIN", target, required: true, options: [],
  question: target === "observed_phenomenon" ? "Co konkrétně pozorujete?" : "Co potřebujete vyřešit?",
});
const nav = () => ({ type: "NAV", target: "phase", question: "Můžeme přejít k návrhům?", required: false, options: [continueOption] });
const side = (target = "context") => ({ type: "SIDE", target, question: "Která doplňující informace situaci zpřesní?", required: false, options: [] });

test("missing observed phenomenon produces MAIN plus one SIDE and no NAV", () => {
  assert.equal(requiredIntakeTarget([]), "observed_phenomenon");
  const result = fallbackQuestController([], "intake");
  assert.deepEqual(result.dialog_actions.map((action) => action.type), ["MAIN", "SIDE"]);
  assert.equal(result.dialog_actions[0].target, "observed_phenomenon");
});

test("missing pedagogical need produces one MAIN and exactly one SIDE", () => {
  assert.equal(requiredIntakeTarget([manifestation]), "teacher_need");
  const result = fallbackQuestController([manifestation], "intake");
  assert.deepEqual(result.dialog_actions.map((action) => action.type), ["MAIN", "SIDE"]);
  assert.equal(result.dialog_actions[0].target, "teacher_need");
  assert.equal(result.dialog_actions.length, 2);
});

test("transition gate produces one SIDE followed by NAV while phase stays intake", () => {
  const notebook = [manifestation, goal];
  assert.equal(requiredIntakeTarget(notebook), null);
  const result = fallbackQuestController(notebook, "intake");
  assert.deepEqual(result.dialog_actions.map((action) => action.type), ["SIDE", "NAV"]);
  assert.deepEqual(result.dialog_actions[1].options, [continueOption]);
  assert.equal(result.phase, "intake");
  assert.equal(result.transition_ready, true);
});

test("no concrete gap produces the general fallback SIDE", () => {
  const complete = [manifestation, goal, context, course, helps];
  const result = fallbackQuestController(complete, "intake");
  assert.deepEqual(result.dialog_actions.map((action) => action.type), ["SIDE", "NAV"]);
  assert.match(result.dialog_actions[0].question, /ještě něco důležitého/i);
});

test("MAIN and NAV are mutually exclusive", () => {
  const invalid = { phase: "intake", transition_ready: false, intake_question_policy_applies: true, dialog_actions: [main("teacher_need"), nav()] };
  assert.equal(validateQuestControllerResult(invalid, [manifestation], "intake"), null);
});

test("a valid turn never contains two SIDE questions", () => {
  const invalid = { phase: "intake", transition_ready: true, intake_question_policy_applies: true, dialog_actions: [nav(), side("context"), side("course")] };
  assert.equal(validateQuestControllerResult(invalid, [manifestation, goal], "intake"), null);
});

test("a relevant intake turn never contains more than two questions", () => {
  const schema = QUEST_CONTROLLER_SCHEMA.properties.dialog_actions;
  assert.equal(schema.maxItems, 2);
  for (const notebook of [[], [manifestation], [manifestation, goal]]) {
    assert.ok(fallbackQuestController(notebook, "intake").dialog_actions.length <= 2);
  }
});

test("all communication profiles share the same structural policy", async () => {
  const fixture = { phase: "intake", transition_ready: false, intake_question_policy_applies: true, dialog_actions: [main("teacher_need"), side("context")] };
  for (const profile of ["operator", "colleague", "methodologist"]) {
    assert.ok(profile);
    const result = validateQuestControllerResult(fixture, [manifestation], "intake");
    assert.deepEqual(result?.dialog_actions.map((action) => action.type), ["MAIN", "SIDE"]);
  }
  const source = await readFile(new URL("../app/quest-controller.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /communicationProfileInstruction|CommunicationProfileId/);
});

test("questions are independent structured items with visual type rendering", async () => {
  const [card, client, styles] = await Promise.all([
    readFile(new URL("../app/dialog-action-card.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(client, /message\.dialogActions\?\.map/);
  assert.match(card, /dialog-action-question/);
  assert.match(card, /dialog-action-nav-card/);
  assert.match(card, /NOTEPAD_CATEGORY_META\.manifestations/);
  assert.match(card, /NOTEPAD_CATEGORY_META\.goals/);
  assert.match(styles, /--dialog-primary:/);
  assert.match(styles, /--dialog-detail:/);
  assert.match(styles, /--dialog-navigation:/);
});

test("the active teacher-need question offers standard-input quick responses and contextual help", async () => {
  const [card, client, styles] = await Promise.all([
    readFile(new URL("../app/dialog-action-card.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  for (const label of ["Pochopit", "Prozkoumat", "Vytvořit"]) assert.match(card, new RegExp(label));
  assert.match(card, /active && action\.type === "MAIN" && action\.target === "teacher_need"/);
  assert.match(card, /Můžete si vybrat jeden ze směrů, nebo odpovědět vlastními slovy\. Pokud si nejste jistí, klidně napište, že to chcete nejdřív probrat\./);
  assert.match(card, /onMouseEnter/);
  assert.match(card, /onFocus/);
  assert.match(card, /onClick/);
  assert.match(client, /await sendMessage\(response, \{ explicitNeed: path \}\)/);
  assert.match(client, /explicitNeed: options\.explicitNeed/);
  assert.match(card, /label: "Prozkoumat", path: "POZOROVAT"/);
  assert.match(client, /quickResponseSubmittingRef\.current/);
  assert.match(styles, /\.teacher-need-quick-responses[\s\S]*flex-wrap: wrap/);
});

test("structured F1 questions are clean and Main receives a prose-only boundary", async () => {
  assert.equal(cleanStructuredQuestionText("💬 Co jste už vyzkoušeli?"), "Co jste už vyzkoušeli?");
  assert.equal(cleanDialogActionQuestion(side()).question, side().question);
  const [controller, runtime, route] = await Promise.all([
    readFile(new URL("../app/quest-controller.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/runtime-instructions.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(controller, /nikdy do ní nevkládej emoji, prefix 💬/);
  assert.match(runtime, /běžný text odpovědi smí obsahovat jen vysvětlení nebo reakci v oznamovacích větách/);
  assert.match(route, /dialog_actions: controllerRun\.result\.dialog_actions\.map\(cleanDialogActionQuestion\)/);
});

test("question policy follows phase rather than workspace view", async () => {
  assert.deepEqual(fallbackQuestController([], "development"), { phase: "development", transition_ready: false, intake_question_policy_applies: false, dialog_actions: [] });
  assert.deepEqual(fallbackQuestController([], "output"), { phase: "output", transition_ready: false, intake_question_policy_applies: false, dialog_actions: [] });
  assert.deepEqual(fallbackQuestController([], "intake", { askedTargets: [] }, false), { phase: "intake", transition_ready: false, intake_question_policy_applies: false, dialog_actions: [] });
  const route = await readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8");
  assert.match(route, /const applyIntakePolicy = phase === "intake"/);
  assert.doesNotMatch(route, /activeWorkspacePanel/);
});

test("controller output validation enforces priority order, independent SIDE, and target history", () => {
  const valid = { phase: "intake", transition_ready: true, intake_question_policy_applies: true, dialog_actions: [side("context"), nav()] };
  assert.deepEqual(validateQuestControllerResult(valid, [manifestation, goal], "intake")?.dialog_actions, valid.dialog_actions);
  assert.equal(validateQuestControllerResult({ phase: "intake", transition_ready: true, intake_question_policy_applies: true, dialog_actions: [nav(), side()] }, [manifestation, goal], "intake"), null);
  assert.equal(validateQuestControllerResult(valid, [manifestation, goal], "intake", { askedTargets: ["context"] }), null);
  assert.equal(validateQuestControllerResult({ phase: "intake", transition_ready: false, intake_question_policy_applies: true, dialog_actions: [main("observed_phenomenon")] }, [manifestation], "intake"), null);
  assert.equal(validateQuestControllerResult({ phase: "intake", transition_ready: true, intake_question_policy_applies: true, dialog_actions: [] }, [manifestation, goal], "intake"), null);
  assert.deepEqual(validateQuestControllerResult({ phase: "intake", transition_ready: false, intake_question_policy_applies: false, dialog_actions: [] }, [manifestation, goal], "intake"), {
    phase: "intake", transition_ready: false, intake_question_policy_applies: false, dialog_actions: [],
  });
});

test("controlled navigation changes phase without creating a fact", () => {
  assert.deepEqual(resolveDialogEvent("continue_to_solution", [manifestation, goal], "intake"), {
    phase: "development",
    transition_ready: false,
    intake_question_policy_applies: false,
    dialog_actions: [],
  });
  assert.equal(resolveDialogEvent("untrusted_option", [manifestation, goal], "intake"), null);
});

test("explicit chat instructions are equivalent to clicking the Phase 2 navigation", () => {
  const notebook = [manifestation, goal];
  for (const message of [
    "Přejdi do fáze 2.",
    "Dobře, dej mi doporučení.",
    "Pojďme k návrhům podpory.",
    "Jak bys postupoval?",
    "Ano, pokračuj.",
  ]) assert.equal(resolveTextDialogEvent(message, notebook, "intake"), "continue_to_solution", message);
});

test("ambiguous, informational and negative chat messages do not change phase", () => {
  const notebook = [manifestation, goal];
  for (const message of [
    "Ano.",
    "Kdy můžeme přejít do fáze 2?",
    "Zatím nepřecházej do fáze 2.",
    "Ještě mi nedávej doporučení.",
    "Četnost je přibližně třikrát týdně.",
  ]) assert.equal(resolveTextDialogEvent(message, notebook, "intake"), null, message);
});

test("chat navigation cannot bypass Intake minimum and Phase 3 needs an explicit instruction", () => {
  assert.equal(resolveTextDialogEvent("Dej mi doporučení.", [manifestation], "intake"), null);
  assert.equal(resolveTextDialogEvent("Přejdi do fáze 2.", [manifestation, goal], "development"), null);
  assert.equal(resolveTextDialogEvent("Přejdi do fáze 3 a připrav výstup.", [manifestation, goal], "development"), "continue_to_output");
});

test("F2 output intent stays at PREVIEW without a snapshot and enters F3 only with one", () => {
  const event = resolveTextDialogEvent("Přejdi k výstupu.", [manifestation, goal], "development");
  assert.equal(event, "continue_to_output");
  assert.equal(resolveF2OutputNavigation(event, undefined, false), "stay_for_preview");
  assert.equal(resolveF2OutputNavigation(event, undefined, true), "enter_f3");
  assert.equal(resolveF2OutputNavigation(null, "continue_to_output", false), "stay_for_preview");
  assert.equal(resolveF2OutputNavigation(null, undefined, true), null);
  assert.deepEqual(resolveDialogEvent("continue_to_output", [manifestation, goal], "development"), {
    phase: "development", transition_ready: false, intake_question_policy_applies: false, dialog_actions: [],
  });
});

test("F2 output navigation is handled before extraction/chat and chat rejects output authority", async () => {
  const [client, route] = await Promise.all([
    readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8"),
  ]);
  assert.ok(client.indexOf("handleF2OutputNavigation(rawText") < client.indexOf('fetch("/api/extract"'));
  assert.match(client, /current \?\? createF3State\(f2Preview\.snapshot\)/);
  assert.match(client, /setPhase\("output"\)/);
  assert.match(route, /if \(phase === "output"\).*409/);
  assert.match(route, /textDialogEvent === "continue_to_output"/);
  assert.match(route, /Přechod do F3 musí klient vyřešit/);
});

test("Quest Controller uses Core as the pedagogical source and a strict technical schema", async () => {
  assert.equal(QUEST_CONTROLLER_SCHEMA.additionalProperties, false);
  assert.deepEqual(QUEST_CONTROLLER_SCHEMA.required, ["phase", "transition_ready", "intake_question_policy_applies", "chat_navigation_event", "dialog_actions"]);
  const source = await readFile(new URL("../app/quest-controller.ts", import.meta.url), "utf8");
  assert.match(source, /args\.coreInstructions/);
  assert.match(source, /strict: true/);
  assert.match(source, /store: false/);
  assert.match(source, /chat_navigation_event === "continue_to_solution"/);
  assert.doesNotMatch(source, /MAIN má absolutní prioritu|Po splnění minima vyber/);
});

test("phase and debug remain in the existing visual hierarchy without per-message usage", async () => {
  const [client, metadata, styles] = await Promise.all([
    readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/response-metadata.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(client, /phaseLabel/);
  assert.match(client, /event\.phaseLabel/);
  assert.match(await readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8"), /phaseLabel: controllerResult\.phase === "intake"/);
  assert.match(metadata, /FÁZE\\s\+\[123\]/);
  assert.match(client, /diagnostic-debug/);
  assert.doesNotMatch(client, /diagnostic-usage|diagnostic-cost|diagnostic-controller/);
  assert.match(styles, /\.message-phase/);
  assert.match(styles, /\.dialog-action-question p \{[^}]*font-size: calc\(15px \* var\(--font-scale\)\)/s);
});

test("runtime keeps technical debug and dialog rendering outside Core", async () => {
  const [route, runtime, core] = await Promise.all([
    readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/runtime-instructions.ts", import.meta.url), "utf8"),
    readFile(new URL("../apu-core/v1.4/00_INSTRUCTIONS_v1.4.md", import.meta.url), "utf8"),
  ]);
  assert.match(runtime, /\[DEBUG \| Profil: \.\.\. \| Blok: \.\.\. \| Zóna: \.\.\.\]/);
  assert.match(route, /composeApuSiteInstructions\(\{/);
  assert.match(core, /Politika otázek MAIN \/ NAV \/ SIDE/);
  assert.doesNotMatch(runtime, /SIDE vybírej v tomto pořadí|MAIN a NAV se vzájemně nahrazují/);
});

test("an unanswered pending SIDE is preserved by the deterministic fallback", () => {
  const pendingSide = { target: "helps", question: "Co jste zatím vyzkoušel a jak dítě reagovalo?" };
  const result = fallbackQuestController([manifestation, goal], "intake", { askedTargets: [], pendingSide });
  assert.deepEqual(result.dialog_actions[0], { type: "SIDE", ...pendingSide, required: false, options: [] });
});

test("a pending SIDE is not repeated after its category is present in the canonical notebook", () => {
  const pendingSide = { target: "course", question: "Jak často se to děje?" };
  const result = fallbackQuestController([manifestation, goal, course], "intake", {
    askedTargets: ["course"],
    pendingSide,
  });
  assert.deepEqual(result.dialog_actions.map((action) => action.type), ["SIDE", "NAV"]);
  assert.notEqual(result.dialog_actions[0].target, "course");
  assert.equal(result.dialog_actions[1].type, "NAV");
});

test("controller cannot advance phase without the explicit navigation event", () => {
  const premature = { phase: "development", transition_ready: false, intake_question_policy_applies: false, dialog_actions: [] };
  assert.equal(validateQuestControllerResult(premature, [manifestation, goal], "intake"), null);
  assert.equal(fallbackQuestController([manifestation, goal], "intake").phase, "intake");
});

test("Controller fast path is limited to a resolved F1 update with exactly one missing mandatory category", () => {
  for (const notebook of [[manifestation], [manifestation, context], [manifestation, course]]) {
    const input = {
      phase: "intake",
      notebook,
      refinement: { askedTargets: [] },
      applyIntakePolicy: true,
      hasExplicitNavigationEvent: false,
      hasResolvedIntakeUpdate: true,
    };
    assert.equal(canBypassQuestController(input), true);
    assert.deepEqual(
      fallbackQuestController(input.notebook, input.phase, input.refinement, input.applyIntakePolicy).dialog_actions.map((action) => action.type),
      ["MAIN", "SIDE"],
    );
    assert.equal(fallbackQuestController(input.notebook, input.phase, input.refinement, input.applyIntakePolicy).dialog_actions[0].target, "teacher_need");
  }
});

test("Controller fast path keeps pending SIDE, ambiguous state and explicit navigation on their existing paths", () => {
  const base = {
    phase: "intake",
    notebook: [manifestation],
    refinement: { askedTargets: [] },
    applyIntakePolicy: true,
    hasExplicitNavigationEvent: false,
    hasResolvedIntakeUpdate: true,
  };
  assert.equal(canBypassQuestController({ ...base, refinement: { askedTargets: [], pendingSide: { target: "context", question: "Kdy se to děje?" } } }), false);
  assert.equal(canBypassQuestController({ ...base, notebook: [] }), false);
  assert.equal(canBypassQuestController({ ...base, hasExplicitNavigationEvent: true }), false);
  assert.equal(canBypassQuestController({ ...base, hasResolvedIntakeUpdate: false }), false);
});

test("chat route records deterministic Controller bypass without inventing an LLM duration", async () => {
  const [route, client, exportSource] = await Promise.all([
    readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/session-export.ts", import.meta.url), "utf8"),
  ]);
  assert.match(route, /canBypassQuestController/);
  assert.match(route, /mode: "deterministic_bypass"/);
  assert.match(route, /controller: \{ mode: controllerMode \}/);
  assert.match(client, /controllerFastPathEligible/);
  assert.match(exportSource, /deterministic_bypass/);
});
