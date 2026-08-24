import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analysisChangeKeys, cleanAnalysisQuestionText, formatAnalysisChat, preserveAnalysisSelection } from "../app/analysis-model.ts";
import { toggleExpandedHypothesis } from "../app/analysis-accordion.ts";

const analysis = {
  hypotheses: [{ id: "h1", rank: 1, title: "H", summary: "S", relevantNeeds: ["n1"], question: null, supportingInformation: [], limitations: [], unknowns: [], questions: [] }],
  needs: [{ needId: "n1", title: "N", sourceText: "Need", relevantHypotheses: ["h1"], direction: "D", question: null, distinctions: [], parameters: [], limitations: [], questions: [], intendedOutput: "O" }],
  suggestedNeeds: [], mode: "entry", mainUncertainty: "U", chatUpdate: { kind: "entry", summary: "S", notebookChanges: [], hypothesisChanges: [], remainingUncertainty: "U", nextPrompt: null }, transitionReady: false,
};

test("analysis selection is preserved while its items still exist", () => {
  assert.deepEqual(preserveAnalysisSelection({ selectedHypothesisId: "h1", activeNeedId: "n1" }, analysis), { selectedHypothesisId: "h1", activeNeedId: "n1" });
  assert.deepEqual(preserveAnalysisSelection({ selectedHypothesisId: "missing", activeNeedId: "missing" }, analysis), { selectedHypothesisId: "h1", activeNeedId: "n1" });
});

test("hypothesis expansion toggles independently from analytical selection", () => {
  let expanded = new Set();
  expanded = toggleExpandedHypothesis(expanded, "h1");
  assert.deepEqual([...expanded], ["h1"]);
  expanded = toggleExpandedHypothesis(expanded, "h2");
  assert.deepEqual([...expanded], ["h1", "h2"]);
  expanded = toggleExpandedHypothesis(expanded, "h1");
  assert.deepEqual([...expanded], ["h2"]);
  expanded = toggleExpandedHypothesis(expanded, "h2");
  assert.deepEqual([...expanded], []);
});

test("Phase 2 uses Terra low with KB and a strict structured analysis", async () => {
  const source = await readFile(new URL("../app/api/analysis/route.ts", import.meta.url), "utf8");
  assert.match(source, /model: "gpt-5\.6-terra"/);
  assert.match(source, /reasoning: \{ effort: "low" \}/);
  assert.match(source, /file_search/);
  assert.match(source, /type: "json_schema"/);
  assert.match(source, /strict: true/);
  assert.match(source, /goals\.map/);
  assert.match(source, /ENTRY_ANALYSIS_SCHEMA/);
  assert.match(source, /maxItems: 4/);
  assert.match(source, /relevantNeeds/);
  assert.match(source, /Jde o F2 Entry/);
  assert.doesNotMatch(source, /odděl je jen tehdy, pokud je lze rozlišit/);
});

test("Phase 2 chat and card are produced by the same structured analysis request", async () => {
  const source = await readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8");
  assert.match(source, /\/api\/analysis/);
  assert.match(source, /formatAnalysisChat\(result\.analysis\)/);
  assert.match(source, /analysisEntryHypotheses: entryHypotheses\(result\.analysis\)/);
  assert.match(source, /previousAnalysis: analysis/);
  assert.match(source, /selectedHypothesisId/);
  assert.match(source, /activeNeedId/);
  assert.match(source, /continue_to_output/);
  assert.match(source, /canonicalNeed: getF1ToF2NeedContract\(notepadState, activeNeedId\)/);
});

test("F2 receives canonical initial routing and validates it against the Zápisník need", async () => {
  const route = await readFile(new URL("../app/api/analysis/route.ts", import.meta.url), "utf8");
  assert.match(route, /validCanonicalNeed/);
  assert.match(route, /need\.initialF2Path === mapping\.f2Path/);
  assert.match(route, /const input = \{ notebook: body\.notebook, canonicalNeed/);
  assert.doesNotMatch(route, /function (?:classify|infer).*Path/i);
});

test("analysis UI delegates to the stateful build editor and snapshot preview", async () => {
  const [source, editor] = await Promise.all([
    readFile(new URL("../app/notepad.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/f2-build-editor.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(source, /<F2BuildEditor/);
  assert.match(source, /<F2Preview/);
  assert.match(editor, /Společný analytický obraz/);
  assert.match(editor, /\+ Doplnit informaci/);
  assert.match(editor, /Aktualizovat preview/);
  assert.doesNotMatch(editor, /Přejít k vytvoření výstupu/);
});

test("stable IDs drive granular unread diffs and reordering alone is ignored", async () => {
  const model = await readFile(new URL("../app/analysis-model.ts", import.meta.url), "utf8");
  assert.match(model, /analysisChangeKeys/);
  assert.match(model, /hypothesis:\$\{item\.id\}:header/);
  assert.doesNotMatch(model, /old\.rank !== item\.rank/);
});

test("reordering stable hypotheses does not create an unread change", () => {
  const second = { ...analysis, hypotheses: [{ ...analysis.hypotheses[0], rank: 2 }] };
  assert.deepEqual([...analysisChangeKeys(analysis, second)], []);
});

test("non-entry Phase 2 chat does not duplicate the standard phase label", () => {
  const text = formatAnalysisChat(analysis);
  assert.doesNotMatch(text, /\[FÁZE 2\]/);
  assert.match(text, /Připravil jsem kartu Rozbor/);
  assert.match(text, /Nejdůležitější nejistota: U/);
});

test("F2 entry chat uses the shared analysis hypotheses and a single clickable callout", async () => {
  const [client, entry] = await Promise.all([
    readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/f2-entry-summary.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(client, /content: "", analysisEntryHypotheses: entryHypotheses\(result\.analysis\)/);
  assert.match(client, /<F2EntrySummary hypotheses=\{message\.analysisEntryHypotheses\} onOpenAnalysis=\{\(\) => setActivePanel\("analysis"\)\}/);
  assert.doesNotMatch(client, /if \(phase === "intake" && nextPhase === "development"\) setActivePanel\("analysis"\)/);
  assert.match(entry, /Připravil jsem kartu Rozbor z aktuálního Zápisníku/);
  assert.match(entry, /hypotheses\.map/);
  assert.match(entry, /value=\{hypothesis\.rank\}/);
});

test("F2 chat uses only nextPrompt and strips a legacy emoji prefix", () => {
  const entry = {
    ...analysis,
    chatUpdate: { ...analysis.chatUpdate, summary: "💬 Je dítě unavené i mimo vyučování?", nextPrompt: { type: "question", text: "💬 Je dítě unavené i mimo vyučování?" } },
  };
  const text = formatAnalysisChat(entry);
  assert.equal(cleanAnalysisQuestionText(entry.chatUpdate.nextPrompt.text), "Je dítě unavené i mimo vyučování?");
  assert.doesNotMatch(text, /Je dítě unavené i mimo vyučování/);
});

test("F2 nextPrompt has one dedicated chat renderer without a hypothesis fallback", async () => {
  const [client, route, row] = await Promise.all([
    readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/analysis/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/analysis-question-row.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(client, /analysisNextPrompt: result\.analysis\.chatUpdate\.nextPrompt/);
  assert.match(client, /message\.analysisNextPrompt\?\.type === "question"/);
  assert.match(client, /<AnalysisQuestionRow text=\{message\.analysisNextPrompt\.text\}/);
  assert.match(route, /chatUpdate\.nextPrompt je jediná prioritní otázka pro chat/);
  assert.match(route, /cleanAnalysisQuestionText/);
  assert.match(row, /NOTEPAD_CATEGORY_META/);
});

test("F1 question renderer remains independent from F2 analysis questions", async () => {
  const source = await readFile(new URL("../app/dialog-action-card.tsx", import.meta.url), "utf8");
  assert.match(source, /dialog-action-question/);
  assert.match(source, /\{action\.question\}/);
});

test("entry contract retains its compatible question data while the build shell defers detailed fields", async () => {
  const route = await readFile(new URL("../app/api/analysis/route.ts", import.meta.url), "utf8");
  assert.match(route, /question: nullableEntryQuestion/);
  assert.doesNotMatch(route.slice(route.indexOf("const ENTRY_ANALYSIS_SCHEMA"), route.indexOf("const WORKING_ANALYSIS_SCHEMA")), /sourceText|supportingInformation|remainingUncertainty/);
  assert.match(route, /Negeneruj detailní opory, limity, seznamy neznámých, parametry ani zamýšlené výstupy/);
  assert.match(route, /questions: \{ type: "array"/);
});

test("output context preserves entry uncertainty without treating readiness as a gate", async () => {
  const [client, route, wrapper] = await Promise.all([
    readFile(new URL("../app/apu-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/runtime-instructions.ts", import.meta.url), "utf8"),
  ]);
  assert.match(client, /analysisMode: analysis\.mode/);
  assert.match(client, /mainUncertainty: analysis\.mainUncertainty/);
  assert.match(route, /analysisMainUncertainty/);
  assert.match(wrapper, /z Entry stavu nevydávej obecnější podklad za rozhodnutou analýzu/);
});
