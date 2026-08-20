import assert from "node:assert/strict";
import test from "node:test";
import { findAssistantHighlightRanges } from "../app/assistant-highlights.ts";
import {
  applyCandidates,
  compactNotepad,
  confirmNotepadEntry,
  EMPTY_NOTEPAD,
  migrateLegacyNotepad,
  replaceEntryFromConflict,
} from "../app/notepad-model.ts";

test("compact context treats explicit extracted notes as canonical and excludes the current message", () => {
  const state = structuredClone(EMPTY_NOTEPAD);
  state.manifestations.push({ id: "manual-1", text: "Ručně zapsaný projev.", origin: "manual" });
  state.context.push({
    id: "reviewed-1",
    text: "Potvrzený kontext.",
    origin: "extracted",
    reviewStatus: "reviewed",
    source: { messageId: "older-message", quote: "kontext", start: 0, end: 7 },
  });
  state.course.push({
    id: "older-auto-1",
    text: "Starší nepotvrzená četnost.",
    origin: "extracted",
    reviewStatus: "unreviewed",
    source: { messageId: "older-message", quote: "často", start: 0, end: 5 },
  });
  state.helps.push({
    id: "current-auto-1",
    text: "Nový automatický zápis.",
    origin: "extracted",
    reviewStatus: "unreviewed",
    source: { messageId: "current-message", quote: "nový", start: 0, end: 4 },
  });

  assert.deepEqual(compactNotepad(state, { excludeSourceMessageId: "current-message" }), [
    { category: "manifestations", id: "manual-1", text: "Ručně zapsaný projev.", trust: "confirmed" },
    { category: "context", id: "reviewed-1", text: "Potvrzený kontext.", trust: "confirmed" },
    { category: "course", id: "older-auto-1", text: "Starší nepotvrzená četnost.", trust: "confirmed" },
  ]);
});

test("highlight targets the APU restatement and excludes the following hypothesis", () => {
  const response = "Děkuji: žák usíná každý den ve vyučování, zejména odpoledne. Příčinu zatím nelze určit.";
  const ranges = findAssistantHighlightRanges(response, [
    "Žák usíná.",
    "Každý den.",
    "Ve vyučování.",
    "V odpoledních hodinách.",
  ]);
  assert.deepEqual(ranges, [{
    start: response.indexOf("žák usíná"),
    end: response.indexOf(". Příčinu") + 1,
  }]);
  assert.equal(response.slice(ranges[0].start, ranges[0].end).includes("Příčinu"), false);
});

test("legacy string entries migrate as manual notes", () => {
  const legacy = {
    manifestations: ["Odmítá začít."],
    goals: [],
    context: [],
    course: [],
    helps: [],
  };
  const migrated = migrateLegacyNotepad(legacy);
  assert.equal(migrated?.manifestations[0].text, "Odmítá začít.");
  assert.equal(migrated?.manifestations[0].origin, "manual");
  assert.equal(migrated?.manifestations[0].source, undefined);
});

test("safe candidates are added with exact source coordinates and duplicates are skipped", () => {
  const candidate = {
    category: "manifestations",
    sourceQuote: "odmítne začít pracovat",
    notebookText: "Odmítá zahájit práci.",
    action: "add",
    relatedEntryId: null,
    reason: null,
    start: 12,
    end: 35,
  };
  const first = applyCandidates(EMPTY_NOTEPAD, "msg-1", [candidate]);
  assert.equal(first.state.manifestations.length, 1);
  assert.equal(first.state.manifestations[0].source?.messageId, "msg-1");
  assert.equal(first.state.manifestations[0].source?.start, 12);
  assert.equal(first.state.manifestations[0].reviewStatus, "reviewed");
  assert.equal(first.state.manifestations[0].visibility, "unseen");

  const second = applyCandidates(first.state, "msg-2", [candidate]);
  assert.equal(second.state.manifestations.length, 1);
  assert.equal(second.added.length, 0);
});

test("reference intake preserves all distinct explicit manifestations, context and course facts", () => {
  const message = "Žák je odpoledne unavený, je apatický, málo komunikuje, odmítá úkoly a špatně se soustředí. Děje se to skoro každý den poslední měsíc.";
  const candidates = [
    ["manifestations", "unavený", "Je unavený."],
    ["manifestations", "apatický", "Je apatický."],
    ["manifestations", "málo komunikuje", "Málo komunikuje."],
    ["manifestations", "odmítá úkoly", "Odmítá úkoly."],
    ["manifestations", "špatně se soustředí", "Špatně se soustředí."],
    ["context", "odpoledne", "Odpoledne."],
    ["course", "skoro každý den", "Skoro každý den."],
    ["course", "poslední měsíc", "Poslední měsíc."],
  ].map(([category, sourceQuote, notebookText]) => ({
    category,
    sourceQuote,
    notebookText,
    action: "add",
    relatedEntryId: null,
    reason: null,
    start: message.indexOf(sourceQuote),
    end: message.indexOf(sourceQuote) + sourceQuote.length,
  }));
  const result = applyCandidates(EMPTY_NOTEPAD, "msg-distinct", candidates);
  assert.deepEqual(result.state.manifestations.map((entry) => entry.text), ["Je unavený.", "Je apatický.", "Málo komunikuje.", "Odmítá úkoly.", "Špatně se soustředí."]);
  assert.deepEqual(result.state.context.map((entry) => entry.text), ["Odpoledne."]);
  assert.deepEqual(result.state.course.map((entry) => entry.text), ["Skoro každý den.", "Poslední měsíc."]);
  assert.equal(result.added.length, 8);
});

test("a true repeated manifestation stays one notebook entry", () => {
  const message = "Žák je velmi unavený a působí výrazně unaveně.";
  const candidate = { category: "manifestations", sourceQuote: message, notebookText: "Je výrazně unavený.", action: "add", relatedEntryId: null, reason: null, start: 0, end: message.length };
  const result = applyCandidates(EMPTY_NOTEPAD, "msg-paraphrase", [candidate, candidate]);
  assert.deepEqual(result.state.manifestations.map((entry) => entry.text), ["Je výrazně unavený."]);
});

test("an explicit apathetic state does not create inferred manifestations", () => {
  const message = "Žák je odpoledne apatický.";
  const result = applyCandidates(EMPTY_NOTEPAD, "msg-apathetic-only", [{ category: "manifestations", sourceQuote: "apatický", notebookText: "Je apatický.", action: "add", relatedEntryId: null, reason: null, start: message.indexOf("apatický"), end: message.indexOf("apatický") + "apatický".length }]);
  assert.deepEqual(result.state.manifestations.map((entry) => entry.text), ["Je apatický."]);
});

test("one message can add context and course with independent highlight coordinates", () => {
  const message = "Děje se to ve vyučování, každý den, zejména v odpoledních hodinách";
  const candidates = [
    {
      category: "context",
      sourceQuote: "ve vyučování",
      notebookText: "Ve vyučování.",
      action: "add",
      relatedEntryId: null,
      reason: null,
      start: message.indexOf("ve vyučování"),
      end: message.indexOf("ve vyučování") + "ve vyučování".length,
    },
    {
      category: "course",
      sourceQuote: "každý den",
      notebookText: "Každý den.",
      action: "add",
      relatedEntryId: null,
      reason: null,
      start: message.indexOf("každý den"),
      end: message.indexOf("každý den") + "každý den".length,
    },
    {
      category: "context",
      sourceQuote: "zejména v odpoledních hodinách",
      notebookText: "Zejména v odpoledních hodinách.",
      action: "add",
      relatedEntryId: null,
      reason: null,
      start: message.indexOf("zejména v odpoledních hodinách"),
      end: message.length,
    },
  ];

  const result = applyCandidates(EMPTY_NOTEPAD, "msg-context-course", candidates);
  assert.equal(result.state.context.length, 2);
  assert.equal(result.state.course.length, 1);
  assert.equal(result.added.length, 3);
  assert.equal(result.state.context[0].source?.quote, "ve vyučování");
  assert.equal(result.state.course[0].source?.quote, "každý den");
  assert.equal(result.state.context[1].source?.quote, "zejména v odpoledních hodinách");
});

test("conflicts replace only the explicitly linked entry", () => {
  const state = structuredClone(EMPTY_NOTEPAD);
  state.course.push({ id: "course-1", text: "Jednou týdně.", origin: "manual" });
  state.course.push({ id: "course-2", text: "Trvá deset minut.", origin: "manual" });
  const candidate = {
    category: "course",
    sourceQuote: "už skoro každý den",
    notebookText: "V poslední době skoro každý den.",
    action: "conflict",
    relatedEntryId: "course-1",
    reason: "Mění četnost.",
    start: 0,
    end: 19,
  };
  const next = replaceEntryFromConflict(state, "msg-3", candidate);
  assert.equal(next.course[0].text, "V poslední době skoro každý den.");
  assert.equal(next.course[0].origin, "extracted");
  assert.equal(next.course[0].reviewStatus, "reviewed");
  assert.equal(next.course[0].visibility, "unseen");
  assert.equal(next.course[1].text, "Trvá deset minut.");
});

test("confirming an extracted entry clears only its review marker", () => {
  const state = structuredClone(EMPTY_NOTEPAD);
  state.context.push({
    id: "context-1",
    text: "Během odpoledního vyučování.",
    origin: "extracted",
    reviewStatus: "unreviewed",
    source: { messageId: "msg-4", quote: "odpoledne", start: 0, end: 9 },
  });

  const next = confirmNotepadEntry(state, "context", "context-1");
  assert.equal(next.context[0].reviewStatus, "reviewed");
  assert.equal(next.context[0].text, "Během odpoledního vyučování.");
  assert.equal(next.context[0].source?.messageId, "msg-4");
});
