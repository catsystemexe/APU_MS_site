import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildExtractionInstructions, buildGroundingInstructions, normalizeExtractionCandidates } from "../app/f1-extraction-contract.ts";
import { DEV_TEST_SCENARIOS } from "../app/dev-test-scenarios.ts";
import { MODEL_PROFILES, estimateCallCount, loadCorpus, parseCliArgs, resolveProfile, selectCases, validateCorpus } from "../evals/f1-extraction/lib/eval-contract.ts";
import { COVERAGE_SCHEMA, runExtractionPipeline } from "../evals/f1-extraction/lib/pipeline.ts";
import { aggregateScores, scoreCase } from "../evals/f1-extraction/lib/scoring.ts";
import { buildResultArtifacts, writeResultArtifacts } from "../evals/f1-extraction/lib/reporting.ts";
import { execute, isCliEntrypoint } from "../evals/f1-extraction/run.ts";

const corpusPath = new URL("../evals/f1-extraction/fixtures/corpus.json", import.meta.url).pathname;
const suite4Path = new URL("../evals/f1-extraction/fixtures/suite4-real-case-studies.json", import.meta.url).pathname;
const runUrl = new URL("../evals/f1-extraction/run.ts", import.meta.url).href;

test("gold corpus has 48 valid auditable cases and the required suite distribution", async () => {
  const corpus = await loadCorpus(corpusPath);
  assert.equal(corpus.cases.length, 48);
  assert.deepEqual(Object.fromEntries(["atomic", "mixed", "dense"].map((suite) => [suite, corpus.cases.filter((item) => item.suite === suite).length])), {
    atomic: 15, mixed: 16, dense: 17,
  });
  for (const item of corpus.cases) for (const fact of item.expectedFacts) {
    assert.ok(item.inputs[fact.source.inputIndex].includes(fact.source.quote), `${item.id}/${fact.id}`);
    assert.equal(typeof fact.uncertain, "boolean");
    assert.equal(typeof fact.negated, "boolean");
  }
});

test("committed JSON schema exposes evidence, uncertainty, negation and forbidden-inference fields", async () => {
  const schema = JSON.parse(await readFile(new URL("../evals/f1-extraction/fixtures/corpus.schema.json", import.meta.url), "utf8"));
  assert.deepEqual(schema.$defs.goldFact.required, ["id", "category", "text", "source", "uncertain", "negated", "requiredMarkers", "expectedAction", "relatedEntryId"]);
  assert.deepEqual(schema.$defs.goldFact.properties.source.required, ["inputIndex", "quote"]);
  assert.ok(schema.$defs.case.properties.forbiddenInferences);
});

test("five Human Gate failures are frozen as permanent dense regressions", async () => {
  const corpus = await loadCorpus(corpusPath);
  const ids = corpus.cases.filter((item) => item.tags.includes("human-gate")).map((item) => item.id).sort();
  assert.deepEqual(ids, ["human-gate-anicka", "human-gate-david", "human-gate-eliska", "human-gate-klarka", "human-gate-ondra"]);
  const labels = { "human-gate-anicka": "Anička", "human-gate-david": "David", "human-gate-eliska": "Eliška", "human-gate-klarka": "Klárka", "human-gate-ondra": "Ondra" };
  for (const id of ids) {
    const item = corpus.cases.find((entry) => entry.id === id);
    const scenario = DEV_TEST_SCENARIOS.find((entry) => entry.label === labels[id]);
    assert.equal(item.inputs[0], scenario.text, `${id} must retain the exact DEV scenario text`);
    assert.ok(item.expectedFacts.length >= 7);
  }
});

test("boundary sweeps cover all requested fact and category counts", async () => {
  const corpus = await loadCorpus(corpusPath);
  const factCounts = corpus.cases.filter((item) => item.tags.includes("sweep:fact-count")).map((item) => item.dimensions.factCount).sort((a, b) => a - b);
  const categoryCounts = corpus.cases.filter((item) => item.tags.includes("sweep:category-count")).map((item) => item.dimensions.categoryCount).sort((a, b) => a - b);
  assert.deepEqual(factCounts, [1, 2, 3, 4, 6, 8, 10]);
  assert.deepEqual(categoryCounts, [1, 2, 3, 4, 5]);
});

test("Suite 4 is a valid optional empty holdout rather than synthesized data", async () => {
  const parsed = JSON.parse(await readFile(suite4Path, "utf8"));
  assert.deepEqual(validateCorpus(parsed), { corpus: parsed, errors: [] });
  assert.deepEqual(parsed.cases, []);
});

test("production and eval prompt builders share the exact core-aware contract", async () => {
  const core = await readFile(new URL("../apu-core/v1.6/02_OBSERVATION_AND_INTAKE.md", import.meta.url), "utf8");
  const extraction = buildExtractionInstructions(core);
  const grounding = buildGroundingInstructions(core);
  assert.ok(extraction.startsWith(core.trim()));
  assert.match(extraction, /povinně projdi všech pět kategorií/);
  assert.match(grounding, /z „žák je líný“ nelze přijmout/);
  assert.match(grounding, /Buď konzervativní/);
});

test("shared candidate normalization rejects invalid quotes and repairs cross-category links", () => {
  const message = "Při čtení odchází od stolu.";
  const notebook = [{ id: "course-1", category: "course", text: "Každý den.", trust: "confirmed" }];
  const normalized = normalizeExtractionCandidates(message, notebook, [
    { category: "manifestations", sourceQuote: "odchází od stolu", notebookText: "Odchází od stolu.", action: "duplicate", relatedEntryId: "course-1", reason: null },
    { category: "context", sourceQuote: "neexistující citace", notebookText: "Jinde.", action: "add", relatedEntryId: null, reason: null },
  ]);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].action, "add");
  assert.equal(normalized[0].relatedEntryId, null);
  assert.deepEqual({ start: normalized[0].start, end: normalized[0].end }, { start: 10, end: 26 });
});

test("deterministic scorer separates pass, review, miss, unsupported facts and marker preservation", async () => {
  const corpus = await loadCorpus(corpusPath);
  const item = corpus.cases.find((entry) => entry.id === "atomic-uncertainty");
  const exact = { inputIndex: 0, category: "manifestations", sourceQuote: "Možná odejde hlavně při hluku", notebookText: "Možná odejde hlavně při hluku.", action: "add", relatedEntryId: null, reason: null };
  const pass = scoreCase(item, [exact]);
  assert.equal(pass.matches[0].state, "EXACT");
  assert.equal(pass.metrics.deterministicRecall, 1);
  assert.equal(pass.metrics.uncertaintyPreservation, 1);
  const review = scoreCase(item, [{ ...exact, sourceQuote: "odejde hlavně při hluku", notebookText: "Při hluku pravděpodobně odchází." }]);
  assert.equal(review.matches[0].state, "REVIEW");
  assert.equal(review.metrics.semanticRecall, 0, "REVIEW is not silently counted as a semantic equivalent");
  const unsupported = scoreCase(item, [...[exact], { ...exact, sourceQuote: "při hluku", notebookText: "Má diagnózu.", category: "context" }]);
  assert.equal(unsupported.counts.unsupported, 1);
});

test("aggregate metrics include stability, latency, tokens and cost", async () => {
  const corpus = await loadCorpus(corpusPath);
  const item = corpus.cases.find((entry) => entry.id === "atomic-manifestation");
  const candidate = { inputIndex: 0, category: "manifestations", sourceQuote: "kopne do židle", notebookText: "Kopne do židle.", action: "add", relatedEntryId: null, reason: null };
  const score = scoreCase(item, [candidate]);
  const base = { ...score, profile: "baseline", pipeline: "baseline", latencyMs: 100, inputTokens: 20, outputTokens: 10, estimatedCostUsd: 0.001, candidates: [candidate] };
  const aggregate = aggregateScores([{ ...base, repetition: 1 }, { ...base, repetition: 2 }]);
  assert.equal(aggregate[0].stability, 1);
  assert.equal(aggregate[0].averageLatencyMs, 100);
  assert.equal(aggregate[0].inputTokens, 40);
  assert.equal(aggregate[0].estimatedCostUsd, 0.002);
});

test("profile, pipeline, filters and call guards parse deterministically", async () => {
  assert.deepEqual(Object.keys(MODEL_PROFILES), ["baseline", "terra-extract", "terra-both", "terra-medium", "sol-reference"]);
  assert.deepEqual(MODEL_PROFILES.baseline, {
    id: "baseline", extractionModel: "gpt-5.6-luna", extractionReasoning: "low",
    groundingModel: "gpt-5.6-luna", groundingReasoning: "low",
    description: "Production baseline: Luna/low extraction and Luna/low grounding.",
  });
  const options = parseCliArgs(["--suite", "atomic,dense", "--case", "atomic-manifestation", "--profiles", "baseline,terra-medium", "--pipelines", "baseline,coverage", "--repetitions", "3", "--max-calls", "100", "--extraction-model", "gpt-5.6-terra", "--extraction-reasoning", "medium"], "/repo");
  assert.deepEqual(options.profiles, ["baseline", "terra-medium"]);
  assert.deepEqual(options.pipelines, ["baseline", "coverage"]);
  assert.equal(resolveProfile(MODEL_PROFILES.baseline, options.overrides).extractionModel, "gpt-5.6-terra");
  assert.equal(resolveProfile(MODEL_PROFILES.baseline, options.overrides).extractionReasoning, "medium");
  const corpus = await loadCorpus(corpusPath);
  const selected = selectCases(corpus, options);
  assert.deepEqual(selected.map((item) => item.id), ["atomic-manifestation"]);
  assert.deepEqual(estimateCallCount(selected, options), { cases: 1, turns: 1, repetitions: 3, configurations: 4, providerCalls: 30, semanticJudgeCalls: 0 });
  assert.deepEqual(estimateCallCount(selected, { ...options, judgeModel: "gpt-5.6-luna" }), { cases: 1, turns: 1, repetitions: 3, configurations: 4, providerCalls: 42, semanticJudgeCalls: 12 });
  assert.throws(() => parseCliArgs(["--profiles", "unknown"], "/repo"), /unsupported profile/);
});

test("CLI dry run reports scope without requiring provider credentials", async () => {
  const result = await execute(["--dry-run", "--corpus", corpusPath, "--suite", "atomic", "--profiles", "baseline,terra-extract", "--pipelines", "baseline,coverage", "--repetitions", "2", "--max-calls", "400"], process.cwd());
  assert.equal(result.kind, "dry-run");
  assert.equal(result.plan.cases, 15);
  assert.equal(result.plan.configurations, 4);
  assert.equal(result.plan.estimatedProviderCalls, 300);
});

test("CLI entrypoint detection normalizes native Windows paths", () => {
  const windowsPath = String.raw`C:\repo\evals\f1-extraction\run.ts`;
  const windowsUrl = pathToFileURL(windowsPath, { windows: true }).href;
  assert.equal(isCliEntrypoint(windowsUrl, windowsPath, true), true);
  assert.equal(isCliEntrypoint(windowsUrl, String.raw`C:\repo\evals\f1-extraction\other.ts`, true), false);
});

test("importing run.ts from the test runner is not treated as a CLI launch", () => {
  assert.notEqual(pathToFileURL(fileURLToPath(import.meta.url)).href, runUrl);
  assert.equal(isCliEntrypoint(runUrl, process.argv[1]), false);
});

test("live CLI fails before provider setup when OPENAI_API_KEY is absent", async () => {
  await assert.rejects(
    execute(["--corpus", corpusPath, "--case", "atomic-manifestation", "--max-calls", "2"], process.cwd(), {}),
    /OPENAI_API_KEY is unavailable\. No provider call was made/,
  );
});

test("coverage pipeline recovers a missed explicit fact and still grounds it", async () => {
  assert.equal(COVERAGE_SCHEMA.additionalProperties, false);
  assert.deepEqual(COVERAGE_SCHEMA.required, ["candidates"]);
  const corpus = await loadCorpus(corpusPath);
  const item = corpus.cases.find((entry) => entry.id === "atomic-manifestation");
  const stages = [];
  const provider = { async call(input) {
    stages.push(input.stage);
    if (input.stage === "extraction") return { value: { situationRelation: "same", situationReason: null, categoryReview: { manifestations: "none", goals: "none", context: "none", course: "none", helps: "none" }, candidates: [] }, latencyMs: 1, usage: null };
    if (input.stage === "coverage") return { value: { candidates: [{ category: "manifestations", sourceQuote: "kopne do židle", notebookText: "Kopne do židle.", action: "add", relatedEntryId: null, reason: null }] }, latencyMs: 1, usage: null };
    if (input.stage === "grounding") return { value: { verdicts: [{ index: 0, accepted: true, reason: null }] }, latencyMs: 1, usage: null };
    throw new Error("unexpected stage");
  } };
  const result = await runExtractionPipeline(item, MODEL_PROFILES.baseline, "coverage", provider);
  assert.deepEqual(stages, ["extraction", "coverage", "grounding"]);
  assert.equal(result.candidates.length, 1);
  assert.equal(scoreCase(item, result.candidates).metrics.explicitFactRecall, 1);
});

test("coverage candidates rejected by final grounding are not counted", async () => {
  const corpus = await loadCorpus(corpusPath);
  const item = corpus.cases.find((entry) => entry.id === "atomic-manifestation");
  const provider = { async call(input) {
    if (input.stage === "extraction") return { value: { situationRelation: "same", situationReason: null, categoryReview: { manifestations: "none", goals: "none", context: "none", course: "none", helps: "none" }, candidates: [] }, latencyMs: 1, usage: null };
    if (input.stage === "coverage") return { value: { candidates: [{ category: "manifestations", sourceQuote: "kopne do židle", notebookText: "Má poruchu chování.", action: "add", relatedEntryId: null, reason: null }] }, latencyMs: 1, usage: null };
    return { value: { verdicts: [{ index: 0, accepted: false, reason: "unsupported" }] }, latencyMs: 1, usage: null };
  } };
  const result = await runExtractionPipeline(item, MODEL_PROFILES.baseline, "coverage", provider);
  assert.deepEqual(result.candidates, []);
});

test("result artifacts serialize JSONL, aggregate JSON/CSV and Markdown", async () => {
  const corpus = await loadCorpus(corpusPath);
  const item = corpus.cases.find((entry) => entry.id === "atomic-manifestation");
  const candidate = { inputIndex: 0, category: "manifestations", sourceQuote: "kopne do židle", notebookText: "Kopne do židle.", action: "add", relatedEntryId: null, reason: null };
  const score = scoreCase(item, [candidate]);
  const run = { ...score, profile: "baseline", pipeline: "baseline", repetition: 1, latencyMs: 10, inputTokens: 2, outputTokens: 1, estimatedCostUsd: 0.0001, candidates: [candidate], suite: item.suite, factCount: item.dimensions.factCount, categoryCount: item.dimensions.categoryCount, linguistic: item.dimensions.linguistic };
  const artifacts = buildResultArtifacts([run], { runId: "test" });
  assert.doesNotThrow(() => JSON.parse(artifacts.rawJsonl.trim()));
  assert.doesNotThrow(() => JSON.parse(artifacts.aggregateJson));
  assert.match(artifacts.aggregateCsv, /deterministicRecall/);
  assert.match(artifacts.aggregateCsv, /preGroundingSemanticRecall.*extraction_miss_count.*grounding_loss_count/);
  assert.match(artifacts.dimensionCsv, /factCount/);
  assert.match(artifacts.summary, /Unsupported canonical facts/);
  const root = await mkdtemp(join(tmpdir(), "apu-f1-eval-"));
  try {
    const directory = await writeResultArtifacts(root, "run", [run], { runId: "test" });
    assert.match(await readFile(join(directory, "summary.md"), "utf8"), /F1 extraction evaluation/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
