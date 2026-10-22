import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  GROUNDING_RESCUE_INSTRUCTIONS,
  GROUNDING_RESCUE_SCHEMA,
  PRODUCTION_GROUNDING_RESCUE_MODEL,
  PRODUCTION_GROUNDING_RESCUE_REASONING,
  validateGroundingRescueVerdicts,
} from "../app/f1-extraction-contract.ts";
import { MODEL_PROFILES, loadCorpus } from "../evals/f1-extraction/lib/eval-contract.ts";
import { runExtractionPipeline } from "../evals/f1-extraction/lib/pipeline.ts";
import { summarizeStageCalls } from "../evals/f1-extraction/lib/stage-analysis.ts";
import { execute } from "../evals/f1-extraction/run.ts";

const corpusPath = new URL("../evals/f1-extraction/fixtures/corpus.json", import.meta.url).pathname;

function rawExtraction(candidates = []) {
  return {
    situationRelation: "same",
    situationReason: null,
    categoryReview: { manifestations: candidates.length ? "found" : "none", goals: "none", context: "none", course: "none", helps: "none" },
    candidates,
  };
}

function candidate(sourceQuote, notebookText, action = "add", relatedEntryId = null) {
  return { category: "manifestations", sourceQuote, notebookText, action, relatedEntryId, reason: null };
}

test("historical baseline and coverage pipelines remain primary-grounding only", async () => {
  const corpus = await loadCorpus(corpusPath);
  const item = corpus.cases.find((entry) => entry.id === "atomic-manifestation");
  for (const pipeline of ["baseline", "coverage"]) {
    const formats = [];
    const provider = { async call(input) {
      formats.push(input.formatName);
      if (input.stage === "extraction") return { value: rawExtraction([candidate("kopne do židle", "Kopne do židle.")]), latencyMs: 1, usage: null };
      if (input.stage === "coverage") return { value: { candidates: [] }, latencyMs: 1, usage: null };
      return { value: { verdicts: [{ index: 0, accepted: false, reason: "primary rejection" }] }, latencyMs: 1, usage: null };
    } };
    const result = await runExtractionPipeline(item, MODEL_PROFILES.baseline, pipeline, provider);
    assert.deepEqual(result.candidates, []);
    assert.equal(formats.includes("apu_f1_eval_production_grounding_rescue"), false);
    assert.equal("groundingRescueVerdicts" in result.turns[0], false);
    assert.deepEqual(formats, pipeline === "coverage"
      ? ["apu_f1_eval_extraction", "apu_f1_eval_coverage", "apu_f1_eval_grounding"]
      : ["apu_f1_eval_extraction", "apu_f1_eval_grounding"]);
  }
});

test("production-rescue submits only explicit primary false candidates and maps local indexes", async () => {
  const message = "A kope. B křičí. C vstane. D odloží tužku. E sedí. Dup. Skip.";
  const item = {
    id: "production-rescue-mapping", suite: "atomic", description: "mapping", inputs: [message],
    startingNotebook: [{ id: "existing", category: "manifestations", text: "Dup.", trust: "confirmed" }],
    expectedFacts: [], expectedRelations: [], forbiddenInferences: [], tags: [],
    dimensions: { factCount: 0, categoryCount: 0, linguistic: ["compound"] },
  };
  const extracted = [
    candidate("A kope", "A kope."),
    candidate("B křičí", "B křičí."),
    candidate("C vstane", "C vstane."),
    candidate("D odloží tužku", "D odloží tužku."),
    candidate("E sedí", "E sedí."),
    candidate("Dup", "Dup.", "duplicate", "existing"),
    candidate("Skip", "Skip.", "skip"),
  ];
  const provider = { async call(input) {
    if (input.stage === "extraction") return { value: rawExtraction(extracted), latencyMs: 1, usage: null };
    if (input.formatName === "apu_f1_eval_grounding") return { value: { verdicts: [
      { index: 0, accepted: true, reason: null },
      { index: 1, accepted: false, reason: "too narrow" },
      { index: 2, accepted: true, reason: null },
      { index: 3, accepted: false, reason: "too narrow" },
    ] }, latencyMs: 2, usage: null };
    assert.equal(input.model, PRODUCTION_GROUNDING_RESCUE_MODEL);
    assert.equal(input.reasoning, PRODUCTION_GROUNDING_RESCUE_REASONING);
    assert.strictEqual(input.instructions, GROUNDING_RESCUE_INSTRUCTIONS);
    assert.strictEqual(input.schema, GROUNDING_RESCUE_SCHEMA);
    assert.deepEqual(input.input.candidates.map((entry) => entry.notebookText), ["B křičí.", "D odloží tužku."]);
    assert.deepEqual(input.input.candidates.map((entry) => entry.index), [0, 1]);
    assert.equal(input.input.candidates.some((entry) => "candidateId" in entry), false);
    const value = input.parse({ verdicts: [
      { index: 0, accepted: false, reasonCategory: "reject_other", reason: "still rejected" },
      { index: 1, accepted: true, reasonCategory: "accept_shared_subject", reason: "explicit shared subject" },
    ] });
    return { value, latencyMs: 3, usage: null };
  } };
  const result = await runExtractionPipeline(item, MODEL_PROFILES.baseline, "production-rescue", provider);
  assert.deepEqual(result.candidates.map((entry) => entry.notebookText), ["A kope.", "C vstane.", "D odloží tužku.", "Dup.", "Skip."]);
  assert.deepEqual(result.turns[0].groundingRescueSubmittedCandidateIds, ["turn-0-extract-1", "turn-0-extract-3"]);
  assert.deepEqual(result.turns[0].groundingRescueVerdicts.map((entry) => ({
    rescueIndex: entry.rescueIndex, originalGroundingIndex: entry.originalGroundingIndex, accepted: entry.accepted,
  })), [
    { rescueIndex: 0, originalGroundingIndex: 1, accepted: false },
    { rescueIndex: 1, originalGroundingIndex: 3, accepted: true },
  ]);
  assert.equal(result.turns[0].groundingVerdicts[3].accepted, false, "primary verdict remains distinct from rescue");
  assert.equal(result.turns[0].groundingRescueFailure, null);
  assert.equal(result.calls.filter((call) => call.stage === "grounding").length, 2);
  assert.deepEqual(summarizeStageCalls(result.calls).grounding, {
    calls: 2, latencyMs: 5, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0,
  });
});

test("production-rescue makes no optional call when primary accepts every candidate", async () => {
  const corpus = await loadCorpus(corpusPath);
  const item = corpus.cases.find((entry) => entry.id === "atomic-manifestation");
  let groundingCalls = 0;
  const provider = { async call(input) {
    if (input.stage === "extraction") return { value: rawExtraction([candidate("kopne do židle", "Kopne do židle.")]), latencyMs: 1, usage: null };
    groundingCalls += 1;
    assert.equal(input.formatName, "apu_f1_eval_grounding");
    return { value: { verdicts: [{ index: 0, accepted: true, reason: null }] }, latencyMs: 1, usage: null };
  } };
  const result = await runExtractionPipeline(item, MODEL_PROFILES.baseline, "production-rescue", provider);
  assert.equal(groundingCalls, 1);
  assert.equal(result.calls.length, 2);
  assert.deepEqual(result.turns[0].groundingRescueSubmittedCandidateIds, []);
  assert.deepEqual(result.turns[0].groundingRescueVerdicts, []);
  assert.equal(result.turns[0].groundingRescueFailure, null);
});

test("production-rescue failures and malformed verdicts preserve the primary result", async (t) => {
  const corpus = await loadCorpus(corpusPath);
  const item = corpus.cases.find((entry) => entry.id === "atomic-manifestation");
  for (const mode of ["provider-failure", "incomplete"]) await t.test(mode, async () => {
    const provider = { async call(input) {
      if (input.stage === "extraction") return { value: rawExtraction([
        candidate("kopne do židle", "Kopne do židle."),
        candidate("do židle", "Do židle nekope."),
      ]), latencyMs: 1, usage: null };
      if (input.formatName === "apu_f1_eval_grounding") return { value: { verdicts: [
        { index: 0, accepted: true, reason: null },
        { index: 1, accepted: false, reason: "rejected" },
      ] }, latencyMs: 2, usage: null };
      if (mode === "provider-failure") throw new Error("provider unavailable");
      return { value: { verdicts: [] }, latencyMs: 3, usage: null };
    } };
    const result = await runExtractionPipeline(item, MODEL_PROFILES.baseline, "production-rescue", provider);
    assert.deepEqual(result.candidates.map((entry) => entry.notebookText), ["Kopne do židle."]);
    assert.equal(result.turns[0].groundingVerdicts[0].accepted, true);
    assert.match(result.turns[0].groundingRescueFailure, /Grounding rescue failed/);
    assert.equal(result.turns[0].groundingRescueVerdicts[0].accepted, null);
    assert.equal(result.calls.filter((call) => call.stage === "grounding").length, 2);
  });
});

test("a rescued add candidate enters the notebook for the following turn", async () => {
  const item = {
    id: "production-rescue-notebook", suite: "mixed", description: "notebook", inputs: ["Robin odloží tužku.", "Pokračujeme."],
    startingNotebook: [], expectedFacts: [], expectedRelations: [], forbiddenInferences: [], tags: [],
    dimensions: { factCount: 0, categoryCount: 0, linguistic: ["compound"] },
  };
  let sawRescuedNotebookEntry = false;
  const provider = { async call(input) {
    if (input.stage === "extraction" && input.input.newUserMessage === item.inputs[0]) return {
      value: rawExtraction([candidate("odloží tužku", "Robin odloží tužku.")]), latencyMs: 1, usage: null,
    };
    if (input.stage === "extraction") {
      sawRescuedNotebookEntry = input.input.currentNotebook.some((entry) => entry.text === "Robin odloží tužku.");
      return { value: rawExtraction(), latencyMs: 1, usage: null };
    }
    if (input.formatName === "apu_f1_eval_grounding") return {
      value: { verdicts: [{ index: 0, accepted: false, reason: "quote too narrow" }] }, latencyMs: 1, usage: null,
    };
    return { value: validateGroundingRescueVerdicts({ verdicts: [{
      index: 0, accepted: true, reasonCategory: "accept_shared_subject", reason: "shared subject",
    }] }, 1), latencyMs: 1, usage: null };
  } };
  const result = await runExtractionPipeline(item, MODEL_PROFILES.baseline, "production-rescue", provider);
  assert.equal(sawRescuedNotebookEntry, true);
  assert.equal(result.turns[0].finalCandidates[0].notebookText, "Robin odloží tužku.");
  assert.equal(result.turns[1].preGroundingCandidates.length, 0);
});

test("production-rescue persists distinct run identity, trace, and two grounding calls", async () => {
  const root = await mkdtemp(join(tmpdir(), "apu-f1-production-rescue-"));
  let rescueCalls = 0;
  const provider = { async call(input) {
    if (input.stage === "extraction") return { value: rawExtraction([candidate("kopne do židle", "Kopne do židle.")]), latencyMs: 1, usage: null };
    if (input.formatName === "apu_f1_eval_grounding") return { value: { verdicts: [{ index: 0, accepted: false, reason: "too narrow" }] }, latencyMs: 2, usage: null };
    rescueCalls += 1;
    return { value: validateGroundingRescueVerdicts({ verdicts: [{ index: 0, accepted: true, reasonCategory: "accept_shared_subject", reason: "shared subject" }] }, 1), latencyMs: 3, usage: null };
  } };
  try {
    const completed = await execute([
      "--corpus", corpusPath, "--case", "atomic-manifestation", "--profiles", "baseline",
      "--pipelines", "production-rescue", "--run-id", "production-rescue", "--output-dir", root, "--max-calls", "3",
    ], process.cwd(), {}, { provider });
    assert.equal(rescueCalls, 1);
    const plan = JSON.parse(await readFile(join(completed.directory, "run-plan.json"), "utf8"));
    const stage = JSON.parse((await readFile(join(completed.directory, "stage-runs.jsonl"), "utf8")).trim());
    assert.deepEqual(plan.pipelines, ["production-rescue"]);
    assert.match(plan.displayPlan.estimatedProviderCalls.toString(), /^3$/);
    assert.equal(stage.pipeline, "production-rescue");
    assert.equal(stage.stageAccounting.grounding.calls, 2);
    assert.equal(stage.stageTurns[0].groundingRescueVerdicts[0].originalGroundingIndex, 0);
    let resumedCalls = 0;
    const resumed = await execute(["--resume", completed.directory], process.cwd(), {}, { provider: { async call() { resumedCalls += 1; throw new Error("must not call"); } } });
    assert.equal(resumed.runs, 1);
    assert.equal(resumedCalls, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
