import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { locateSourceQuote } from "../app/notepad-model.ts";

test("source quotes are accepted only as exact message substrings", () => {
  const message = "Žák při delším zadání odmítá začít.";
  assert.deepEqual(locateSourceQuote(message, "při delším zadání"), { start: 4, end: 21 });
  assert.equal(locateSourceQuote(message, "tuto frázi uživatel nenapsal"), null);
});

test("extract route requests strict structured output and revalidates quotes", async () => {
  const source = await readFile(new URL("../app/api/extract/route.ts", import.meta.url), "utf8");
  assert.match(source, /type:\s*"json_schema"/);
  assert.match(source, /strict:\s*true/);
  assert.match(source, /locateSourceQuote\(body\.message as string, candidate\.sourceQuote\)/);
  assert.match(source, /verifyGrounding\(apiKey, requestId, body\.message as string, notebook/);
  assert.match(source, /z „žák je líný“ nelze přijmout/);
  assert.match(source, /povinně projdi všech pět kategorií/);
  assert.match(source, /Pedagogická potřeba/);
  assert.match(source, /Zkušenosti/);
  assert.match(source, /Pedagogickou potřebu zapisuj jen tehdy/);
  assert.match(source, /Samotný popis obtíže, četnosti nebo závažnosti nikdy není pedagogickou potřebou/);
  assert.match(source, /apu-core\/v1\.6\/02_OBSERVATION_AND_INTAKE\.md\?raw/);
  assert.doesNotMatch(source, /isExplicitPedagogicalNeed|EXPLICIT_NEED_PATTERNS/);
  assert.match(source, /nevyzkoušené návrhy APU/);
  assert.match(source, /unconfirmed položku nepovažuj za nezávislý důkaz/);
  assert.match(source, /item\.trust === "confirmed" \|\| item\.trust === "unconfirmed"/);
  assert.match(source, /Samotné vynechání podmětu není důvod pro uncertain ani different/);
  assert.match(source, /„Děje se to ve vyučování, každý den, zejména v odpoledních hodinách“/);
  assert.match(source, /„Děje se to každý den“ NEVRACEJ duplicate manifestations/);
  assert.match(source, /entry\.id === candidate\.relatedEntryId && entry\.category === candidate\.category/);
  assert.match(source, /candidate\.action = "add"/);
  assert.match(source, /currentNotebook: notebook/);
  assert.match(source, /required: \["situationRelation", "situationReason", "categoryReview", "candidates"\]/);
  assert.match(source, /acceptedCandidateKeys/);
  assert.match(source, /store:\s*false/);
  assert.match(source, /významově odlišných explicitních projevů rozděl na samostatné candidates/);
  assert.match(source, /„unavený“, „apatický“, „málo komunikuje“, „odmítá úkoly“ a „špatně se soustředí“ jsou odlišné projevy/);
  assert.match(source, /skutečnou parafrázi téhož projevu vrať jen jednou/);
  assert.match(source, /z explicitního „žák je apatický“ smíš přijmout pouze manifestations/);
  assert.match(source, /model: EXTRACTION_MODEL,\s+reasoning: \{ effort: "low" \},\s+instructions: EXTRACTION_INSTRUCTIONS/);
  assert.match(source, /name: "extract"[\s\S]{0,250}?reasoning: "low"/);
  assert.match(source, /name: "grounding"[\s\S]{0,250}?reasoning: "low"/);
});

test("Core v1.3 owns semantic extraction of the complete pedagogical need", async () => {
  const core = await readFile(new URL("../apu-core/v1.3/02_OBSERVATION_AND_INTAKE.md", import.meta.url), "utf8");
  assert.match(core, /Sémantická extrakce Pedagogické potřeby/);
  assert.match(core, /porozumění situaci a přípravu komunikace s rodiči/);
  assert.match(core, /nikoli podle pevného slovníku, regulárního výrazu/);
});
