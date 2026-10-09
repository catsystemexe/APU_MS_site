import { createHash } from "node:crypto";
import { access, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import type { ExtractionNotebookInput, GroundingVerdict } from "../../../app/f1-extraction-contract.ts";
import { MODEL_PROFILES, loadCorpus, type EvalCase } from "./eval-contract.ts";
import { createOpenAIProvider, recordUsage, type EvalProvider, type PipelineCall, type PipelineTurnTrace, type StageCandidate } from "./pipeline.ts";
import { aggregateScores, type CandidateClassification, type CaseScore, type EvaluatedCandidate } from "./scoring.ts";
import { replayStagedSemanticEvaluationFromEvidence, validateStagedSemanticEvidence, type StagedSemanticEvidence } from "./semantic-evidence.ts";
import { calculateStageMetrics, summarizeStageCalls, type StageRun } from "./stage-analysis.ts";

export const GROUNDING_REPLAY_VARIANT = "evidence-scope-v2" as const;
export const GROUNDING_REPLAY_REASON_CATEGORIES = [
  "accept_direct",
  "accept_shared_subject",
  "accept_shared_scope",
  "accept_coreference",
  "accept_relation_context",
  "reject_unsupported_meaning",
  "reject_category_mismatch",
  "reject_semantic_strengthening",
  "reject_ambiguous_coreference",
  "reject_inferred_relation",
  "reject_other",
] as const;
export type GroundingReplayReasonCategory = typeof GROUNDING_REPLAY_REASON_CATEGORIES[number];

const ACCEPT_REASONS = new Set<GroundingReplayReasonCategory>([
  "accept_direct", "accept_shared_subject", "accept_shared_scope", "accept_coreference", "accept_relation_context",
]);

export const EVIDENCE_SCOPE_V2_INSTRUCTIONS = `Jsi izolovaná experimentální grounding brána eval harnessu APU. Neměníš produkční pravidla.

EVIDENČNÍ ROZSAH:
- sourceQuote je lokální kotva faktu.
- newUserMessage je úplný autoritativní evidenční kontext.
- Nevyžaduj, aby sourceQuote samo obsahovalo každé slovo nebo gramatickou závislost notebookText.
- Přijmi jen notebookText, který je přímo a jednoznačně vyplývající z newUserMessage a jehož sourceQuote správně kotví lokální fakt.

KATEGORIE:
- manifestations: přímo pozorovatelné chování nebo reakce;
- goals: pedagogem explicitně vyjádřená potřeba nebo cíl;
- context: situace, prostředí, osoby nebo spouštěče;
- course: četnost, trvání, intenzita, počátek nebo vývoj;
- helps: již vyzkoušená nebo pozorovaná podmínka či změna spolu s explicitním účinkem.

POVOLENÉ DOPLNĚNÍ Z newUserMessage:
1. sdílený gramatický podmět;
2. sdílený předřazený kontext nebo příslovečné určení se zřejmým dosahem přes koordinované predikáty;
3. sdílený řídící predikát v koordinaci;
4. explicitní rozlišení zájmena nebo koreference;
5. explicitní rozlišení elipsy;
6. zachování vztahového kontextu již uvedeného ve stejné větě nebo klauzi;
7. obnovení vypuštěného podmětu nebo referentu pouze tehdy, existuje-li jediný gramaticky plausibilní referent.

PŘÍSNÉ ZÁKAZY:
- nepřidávej nový substantivní fakt, příčinu, diagnózu, záměr, potřebu, interpretaci ani doporučení;
- neměň význam kategorie;
- neposiluj význam a neodstraňuj nejistotu, negaci ani kvalifikátory někdy, jindy, asi nebo ne vždy;
- nevytvářej časový ani kauzální vztah jen z pořadí ve větě;
- nerozlišuj nejednoznačnou koreferenci;
- nepřeváděj context/course na helps bez explicitně pozorované podmínky nebo změny a jejího účinku.

Příklady:
- „Robin při práci vstane a odloží tužku.“ dovoluje z kotvy „odloží tužku“ zápis „Robin při práci odloží tužku.“
- „Pomohlo až klidnější místo a přítomnost známé učitelky.“ dovoluje z druhé kotvy zápis „Pomohla přítomnost známé učitelky.“
- „Častěji se to stává před ostatními dětmi.“ dovoluje zachovat celý explicitní kontext.
- „Asi dvakrát týdně uteče ze třídy; potřebuji ověřit, zda tomu předchází hluk.“ dovoluje jednoznačné „tomu“ rozvinout jako útěk ze třídy, ale zachovej „potřebuji ověřit“.
- „Po přesazení už nekřičí a při samostatné práci vydrží deset minut.“ samo nedokládá helps „Při samostatné práci vydrží deset minut.“
- „dokončí a požádá o další“ samo nedokládá silnější časový vztah „Po dokončení úkolu požádá o další.“

Každému verdiktu přiřaď právě jednu reasonCategory z povoleného enumu. accepted=true smí používat jen accept_* kategorii; accepted=false jen reject_* kategorii. Vrať právě jeden verdikt pro každý vstupní index, bez duplicit a mezer.`;

export const GROUNDING_REPLAY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdicts"],
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "accepted", "reasonCategory", "reason"],
        properties: {
          index: { type: "integer", minimum: 0 },
          accepted: { type: "boolean" },
          reasonCategory: { type: "string", enum: GROUNDING_REPLAY_REASON_CATEGORIES },
          reason: { type: "string" },
        },
      },
    },
  },
} as const;

export type GroundingReplayProviderVerdict = {
  index: number;
  accepted: boolean;
  reasonCategory: GroundingReplayReasonCategory;
  reason: string;
};

export function validateGroundingReplayVerdicts(value: unknown, submittedCount: number) {
  if (!value || typeof value !== "object" || !Array.isArray((value as { verdicts?: unknown }).verdicts)) throw new Error("Grounding replay response must contain verdicts.");
  const verdicts = (value as { verdicts: unknown[] }).verdicts;
  if (verdicts.length !== submittedCount) throw new Error(`Grounding replay verdict completeness failed: expected ${submittedCount}, received ${verdicts.length}.`);
  const byIndex = new Map<number, GroundingReplayProviderVerdict>();
  for (const raw of verdicts) {
    if (!raw || typeof raw !== "object") throw new Error("Grounding replay verdict is not an object.");
    const verdict = raw as Partial<GroundingReplayProviderVerdict>;
    if (!Number.isInteger(verdict.index) || verdict.index! < 0 || verdict.index! >= submittedCount) throw new Error(`Grounding replay verdict index is out of range: ${String(verdict.index)}.`);
    if (byIndex.has(verdict.index!)) throw new Error(`Grounding replay verdict index is duplicated: ${verdict.index}.`);
    if (typeof verdict.accepted !== "boolean" || typeof verdict.reason !== "string" || !GROUNDING_REPLAY_REASON_CATEGORIES.includes(verdict.reasonCategory as GroundingReplayReasonCategory)) throw new Error(`Grounding replay verdict ${verdict.index} has an invalid contract.`);
    const acceptedCategory = ACCEPT_REASONS.has(verdict.reasonCategory as GroundingReplayReasonCategory);
    if (acceptedCategory !== verdict.accepted) throw new Error(`Grounding replay verdict ${verdict.index} has an incompatible accepted/reasonCategory pair.`);
    byIndex.set(verdict.index!, verdict as GroundingReplayProviderVerdict);
  }
  for (let index = 0; index < submittedCount; index += 1) if (!byIndex.has(index)) throw new Error(`Grounding replay verdict completeness failed: missing index ${index}.`);
  return { verdicts: [...byIndex.values()].sort((left, right) => left.index - right.index) };
}

export type SavedStageArtifactRun = {
  caseId: string;
  profile: string;
  pipeline: string;
  repetition: number;
  preGroundingScore: CaseScore;
  postGroundingScore: CaseScore;
  stageTurns: PipelineTurnTrace[];
  semanticEvidence: StagedSemanticEvidence;
  stageMetrics?: StageRun["stageMetrics"];
};

function sha256(contents: string) {
  return createHash("sha256").update(contents).digest("hex");
}

async function sha256File(path: string) {
  return sha256(await readFile(path, "utf8"));
}

function stageRunKey(run: Pick<SavedStageArtifactRun, "caseId" | "profile" | "pipeline" | "repetition">) {
  return `${run.caseId}::${run.profile}::${run.pipeline}::${run.repetition}`;
}

function validateSavedStageRun(value: unknown, lineNumber: number): SavedStageArtifactRun {
  if (!value || typeof value !== "object") throw new Error(`stage-runs.jsonl line ${lineNumber} is not an object.`);
  const run = value as Partial<SavedStageArtifactRun>;
  if (typeof run.caseId !== "string" || typeof run.profile !== "string" || typeof run.pipeline !== "string" || !Number.isInteger(run.repetition)
    || !run.preGroundingScore || !run.postGroundingScore || !Array.isArray(run.stageTurns) || !run.semanticEvidence) {
    throw new Error(`stage-runs.jsonl line ${lineNumber} lacks the judged staged-run contract required for replay.`);
  }
  validateStagedSemanticEvidence(run.semanticEvidence);
  return structuredClone(run as SavedStageArtifactRun);
}

export async function resolveStageRunsPath(inputPath: string) {
  const absolute = resolve(inputPath);
  const details = await stat(absolute);
  return details.isDirectory() ? join(absolute, "stage-runs.jsonl") : absolute;
}

export async function loadSavedStageRuns(inputPath: string) {
  const stageRunsPath = await resolveStageRunsPath(inputPath);
  const source = await readFile(stageRunsPath, "utf8");
  const runs = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    try { return validateSavedStageRun(JSON.parse(line) as unknown, index + 1); }
    catch (error) {
      if (error instanceof SyntaxError) throw new Error(`stage-runs.jsonl line ${index + 1} is not valid JSON.`);
      throw error;
    }
  });
  if (!runs.length) throw new Error("stage-runs.jsonl contains no saved runs.");
  const keys = runs.map(stageRunKey);
  if (new Set(keys).size !== keys.length) throw new Error("stage-runs.jsonl contains duplicate run identities.");
  return { stageRunsPath, sourceDirectory: dirname(stageRunsPath), sourceSha256: sha256(source), runs };
}

export type GroundingReplayOptions = {
  source: string;
  profile: string;
  variant: typeof GROUNDING_REPLAY_VARIANT;
  runId: string;
  outputDir: string;
  maxCalls: number;
  corpusPath: string;
};

function requiredValue(argv: string[], index: number, flag: string) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
}

export function parseGroundingReplayArgs(argv: string[], cwd = process.cwd()): GroundingReplayOptions {
  const values = new Map<string, string>();
  const allowed = new Set(["--source", "--profile", "--variant", "--run-id", "--output-dir", "--max-calls", "--corpus"]);
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!allowed.has(flag)) throw new Error(`Unknown grounding replay option: ${flag}`);
    const value = requiredValue(argv, index, flag);
    if (values.has(flag)) throw new Error(`Grounding replay option is duplicated: ${flag}`);
    values.set(flag, value);
    index += 1;
  }
  for (const flag of ["--source", "--profile", "--variant", "--run-id", "--output-dir", "--max-calls"]) if (!values.has(flag)) throw new Error(`Grounding replay requires ${flag}.`);
  const maxCalls = Number(values.get("--max-calls"));
  if (!Number.isInteger(maxCalls) || maxCalls < 1) throw new Error("--max-calls must be a positive integer.");
  const variant = values.get("--variant");
  if (variant !== GROUNDING_REPLAY_VARIANT) throw new Error(`Unsupported grounding replay variant: ${variant}.`);
  const profile = values.get("--profile")!;
  if (profile !== "baseline") throw new Error("Grounding replay currently supports only --profile baseline.");
  const runId = values.get("--run-id")!;
  if (!/^[a-zA-Z0-9._-]+$/.test(runId)) throw new Error("--run-id may contain only letters, digits, dot, underscore, and hyphen.");
  return {
    source: resolve(cwd, values.get("--source")!),
    profile,
    variant,
    runId,
    outputDir: resolve(cwd, values.get("--output-dir")!),
    maxCalls,
    corpusPath: resolve(cwd, values.get("--corpus") ?? "evals/f1-extraction/fixtures/corpus.json"),
  };
}

export type GroundingReplayVerdictRow = {
  caseId: string;
  profile: string;
  pipeline: string;
  repetition: number;
  inputIndex: number;
  candidateId: string;
  category: string;
  sourceQuote: string;
  notebookText: string;
  originalAccepted: boolean;
  replayAccepted: boolean;
  originalReason: string | null;
  replayReason: string;
  replayReasonCategory: GroundingReplayReasonCategory;
  semanticClassification: CandidateClassification["state"];
  associatedGoldFactIds: string[];
  restoresGoldFact: boolean;
  restoredGoldFactIds: string[];
  grounded_extra: boolean;
  unsupported: boolean;
};

export type GroundingReplayPlan = {
  version: 1;
  runId: string;
  createdAt: string;
  variant: typeof GROUNDING_REPLAY_VARIANT;
  profile: "baseline";
  model: "gpt-5.6-luna";
  reasoning: "low";
  sourceStageRunsPath: string;
  sourceStageRunsSha256: string;
  corpusPath: string;
  corpusSha256: string;
  sourceRunKeys: string[];
  totalRuns: number;
  totalGroundingCalls: number;
  extractionCalls: 0;
  coverageCalls: 0;
  judgeCalls: 0;
};

type ReplayState = { version: 1; status: "running" | "failed" | "completed"; completedRuns: number; totalRuns: number; updatedAt: string; lastError: string | null };

async function atomicWrite(path: string, contents: string) {
  const temporary = `${path}.tmp-${process.pid}-${crypto.randomUUID()}`;
  await writeFile(temporary, contents);
  await rename(temporary, path);
}

async function atomicWriteJson(path: string, value: unknown) {
  await atomicWrite(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function assertFreshOutput(sourceDirectory: string, outputDirectory: string) {
  const source = resolve(sourceDirectory);
  const output = resolve(outputDirectory);
  const relativeToSource = relative(source, output);
  if (source === output || (!relativeToSource.startsWith("..") && relativeToSource !== "")) throw new Error("Grounding replay output must not overwrite or write inside the source result directory.");
  try {
    await access(outputDirectory);
    throw new Error(`Grounding replay output already exists: ${outputDirectory}`);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
}

function evaluated(candidate: StageCandidate): EvaluatedCandidate {
  const { candidateId, origin, ...value } = candidate;
  void candidateId; void origin;
  return value;
}

function originalVerdictMap(turn: PipelineTurnTrace) {
  const submittedIds = turn.groundingSubmittedCandidates.map((candidate) => candidate.candidateId);
  const verdicts = new Map<string, PipelineTurnTrace["groundingVerdicts"][number]>();
  if (turn.groundingVerdicts.length !== submittedIds.length) throw new Error(`Saved turn ${turn.inputIndex} has incomplete original grounding verdicts.`);
  for (const verdict of turn.groundingVerdicts) {
    if (!submittedIds.includes(verdict.candidateId) || verdict.submittedIndex < 0 || verdict.submittedIndex >= submittedIds.length || submittedIds[verdict.submittedIndex] !== verdict.candidateId) throw new Error(`Saved turn ${turn.inputIndex} has an invalid original grounding verdict index.`);
    if (verdicts.has(verdict.candidateId)) throw new Error(`Saved turn ${turn.inputIndex} has duplicate original grounding verdicts.`);
    verdicts.set(verdict.candidateId, verdict);
  }
  return verdicts;
}

function addOriginalAcceptedToNotebook(item: EvalCase, notebook: ExtractionNotebookInput[], turn: PipelineTurnTrace) {
  for (const candidate of turn.finalCandidates) if (candidate.action === "add") notebook.push({
    id: `eval-${item.id}-${turn.inputIndex}-${notebook.length}`,
    category: candidate.category,
    text: candidate.notebookText,
    trust: "unconfirmed",
  });
}

function associatedFacts(evidence: StagedSemanticEvidence) {
  const result = new Map<string, string[]>();
  for (const fact of evidence.goldFacts) for (const group of fact.supportGroups) for (const candidateId of group.candidateIds) {
    result.set(candidateId, [...new Set([...(result.get(candidateId) ?? []), fact.goldFactId])]);
  }
  return result;
}

function classificationMap(evidence: StagedSemanticEvidence) {
  return new Map(evidence.candidates.map((candidate) => [candidate.candidateId, candidate.classification]));
}

function validateReplaySourceRun(item: EvalCase, saved: SavedStageArtifactRun) {
  for (const turn of saved.stageTurns) {
    const message = item.inputs[turn.inputIndex];
    if (typeof message !== "string") throw new Error(`Saved turn ${turn.inputIndex} is outside the input range for case ${item.id}.`);
    const preIds = new Set(turn.preGroundingCandidates.map((candidate) => candidate.candidateId));
    const submittedIds = turn.groundingSubmittedCandidates.map((candidate) => candidate.candidateId);
    if (new Set(submittedIds).size !== submittedIds.length) throw new Error(`Saved turn ${turn.inputIndex} has duplicate submitted candidate IDs.`);
    for (const candidate of turn.groundingSubmittedCandidates) {
      if (!preIds.has(candidate.candidateId)) throw new Error(`Saved grounding candidate ${candidate.candidateId} is absent from the turn PRE universe.`);
      if (!message.includes(candidate.sourceQuote)) throw new Error(`Saved grounding candidate ${candidate.candidateId} has a sourceQuote outside newUserMessage.`);
    }
    originalVerdictMap(turn);
  }
  const reproduced = replayStagedSemanticEvaluationFromEvidence(item, saved.stageTurns, saved.preGroundingScore, saved.semanticEvidence);
  if (JSON.stringify(reproduced.postScore.counts) !== JSON.stringify(saved.postGroundingScore.counts)
    || JSON.stringify(reproduced.postScore.metrics) !== JSON.stringify(saved.postGroundingScore.metrics)) {
    throw new Error(`Saved semantic evidence does not reproduce the current POST score for ${stageRunKey(saved)}.`);
  }
}

async function replayOneRun(item: EvalCase, saved: SavedStageArtifactRun, provider: EvalProvider) {
  const calls: PipelineCall[] = [];
  const rows: GroundingReplayVerdictRow[] = [];
  const replayTurns: PipelineTurnTrace[] = [];
  const notebook = structuredClone(item.startingNotebook);
  const factsByCandidate = associatedFacts(saved.semanticEvidence);
  const classifications = classificationMap(saved.semanticEvidence);
  for (const sourceTurn of saved.stageTurns) {
    const originalVerdicts = originalVerdictMap(sourceTurn);
    const submitted = structuredClone(sourceTurn.groundingSubmittedCandidates);
    let replayVerdicts: GroundingReplayProviderVerdict[] = [];
    if (submitted.length) {
      const call = await provider.call({
        stage: "grounding",
        model: "gpt-5.6-luna",
        reasoning: "low",
        instructions: EVIDENCE_SCOPE_V2_INSTRUCTIONS,
        input: {
          currentNotebook: notebook,
          newUserMessage: item.inputs[sourceTurn.inputIndex],
          candidates: submitted.map((candidate, index) => ({ index, ...evaluated(candidate) })),
        },
        schema: GROUNDING_REPLAY_SCHEMA,
        formatName: "apu_f1_grounding_evidence_scope_v2",
        maxOutputTokens: Math.min(4_000, Math.max(1_200, 500 + submitted.length * 180)),
        parse: (value) => validateGroundingReplayVerdicts(value, submitted.length),
      });
      replayVerdicts = call.value.verdicts;
      calls.push({ stage: "grounding", model: "gpt-5.6-luna", reasoning: "low", latencyMs: call.latencyMs, usage: call.usage });
    }
    const acceptedIds = new Set(submitted.filter((candidate, index) => replayVerdicts[index]?.accepted).map((candidate) => candidate.candidateId));
    const finalCandidates = sourceTurn.preGroundingCandidates.filter((candidate) => candidate.action === "duplicate" || candidate.action === "skip" || acceptedIds.has(candidate.candidateId));
    const groundingVerdicts = submitted.map((candidate, submittedIndex) => {
      const replay = replayVerdicts[submittedIndex];
      return {
        candidateId: candidate.candidateId,
        submittedIndex,
        accepted: replay.accepted,
        reason: replay.reason,
        providerVerdict: { index: submittedIndex, accepted: replay.accepted, reason: replay.reason } satisfies GroundingVerdict,
      };
    });
    replayTurns.push({
      ...structuredClone(sourceTurn),
      groundingVerdicts,
      finalCandidates,
    });
    for (const [submittedIndex, candidate] of submitted.entries()) {
      const original = originalVerdicts.get(candidate.candidateId)!;
      const replay = replayVerdicts[submittedIndex];
      const classification = classifications.get(candidate.candidateId);
      if (!classification) throw new Error(`Saved semantic evidence lacks candidate ${candidate.candidateId}.`);
      rows.push({
        caseId: saved.caseId,
        profile: saved.profile,
        pipeline: saved.pipeline,
        repetition: saved.repetition,
        inputIndex: sourceTurn.inputIndex,
        candidateId: candidate.candidateId,
        category: candidate.category,
        sourceQuote: candidate.sourceQuote,
        notebookText: candidate.notebookText,
        originalAccepted: original.accepted,
        replayAccepted: replay.accepted,
        originalReason: original.reason,
        replayReason: replay.reason,
        replayReasonCategory: replay.reasonCategory,
        semanticClassification: classification.state,
        associatedGoldFactIds: factsByCandidate.get(candidate.candidateId) ?? [],
        restoresGoldFact: false,
        restoredGoldFactIds: [],
        grounded_extra: classification.state === "GROUNDED_EXTRA",
        unsupported: classification.state === "UNSUPPORTED",
      });
    }
    addOriginalAcceptedToNotebook(item, notebook, sourceTurn);
  }
  const replayed = replayStagedSemanticEvaluationFromEvidence(item, replayTurns, saved.preGroundingScore, saved.semanticEvidence);
  const currentCovered = new Set(saved.postGroundingScore.matches.filter((match) => match.state === "EXACT" || match.state === "SEMANTIC_EQUIVALENT").map((match) => match.goldFactId));
  const replayCovered = new Set(replayed.postScore.matches.filter((match) => match.state === "EXACT" || match.state === "SEMANTIC_EQUIVALENT").map((match) => match.goldFactId));
  for (const row of rows) {
    row.restoredGoldFactIds = row.associatedGoldFactIds.filter((id) => !currentCovered.has(id) && replayCovered.has(id));
    row.restoresGoldFact = !row.originalAccepted && row.replayAccepted && row.restoredGoldFactIds.length > 0;
  }
  const accounting = recordUsage(calls);
  const finalCandidates = replayTurns.flatMap((turn) => turn.finalCandidates);
  const run: StageRun = {
    ...replayed.postScore,
    caseId: saved.caseId,
    profile: saved.profile,
    pipeline: saved.pipeline,
    repetition: saved.repetition,
    candidates: finalCandidates.map(evaluated),
    suite: item.suite,
    factCount: item.dimensions.factCount,
    categoryCount: item.dimensions.categoryCount,
    linguistic: item.dimensions.linguistic,
    ...accounting,
    preGroundingCandidates: replayed.context.preCandidates.map(evaluated),
    preGroundingScore: replayed.preScore,
    stageTurns: replayTurns,
    stageMetrics: calculateStageMetrics(replayed.preScore, replayed.postScore, replayTurns),
    stageCalls: calls,
    stageAccounting: summarizeStageCalls(calls),
    semanticEvidence: replayed.evidence,
  };
  return { run, rows };
}

function coveredCount(score: CaseScore) {
  return score.counts.semanticCovered;
}

function comparisonRow(savedRuns: SavedStageArtifactRun[], replayRuns: StageRun[], verdictRows: GroundingReplayVerdictRow[]) {
  const replayByKey = new Map(replayRuns.map((run) => [stageRunKey(run), run]));
  const selectedRows = verdictRows.filter((row) => savedRuns.some((run) => stageRunKey(run) === stageRunKey(row)));
  const gold = savedRuns.reduce((total, run) => total + run.preGroundingScore.counts.gold, 0);
  const preCovered = savedRuns.reduce((total, run) => total + coveredCount(run.preGroundingScore), 0);
  const currentCovered = savedRuns.reduce((total, run) => total + coveredCount(run.postGroundingScore), 0);
  const replayCovered = savedRuns.reduce((total, saved) => total + coveredCount(replayByKey.get(stageRunKey(saved))!), 0);
  const currentActual = savedRuns.reduce((total, run) => total + run.postGroundingScore.counts.actual, 0);
  const replayActual = savedRuns.reduce((total, saved) => total + replayByKey.get(stageRunKey(saved))!.counts.actual, 0);
  const currentCorrect = savedRuns.reduce((total, run) => total + run.postGroundingScore.counts.semanticCorrectCandidates, 0);
  const replayCorrect = savedRuns.reduce((total, saved) => total + replayByKey.get(stageRunKey(saved))!.counts.semanticCorrectCandidates, 0);
  return {
    runs: savedRuns.length,
    goldFacts: gold,
    preSemanticRecall: preCovered / Math.max(1, gold),
    currentPostSemanticRecall: currentCovered / Math.max(1, gold),
    replayPostSemanticRecall: replayCovered / Math.max(1, gold),
    currentGroundingLosses: preCovered - currentCovered,
    replayGroundingLosses: preCovered - replayCovered,
    currentSemanticPrecision: currentCorrect / Math.max(1, currentActual),
    replaySemanticPrecision: replayCorrect / Math.max(1, replayActual),
    currentGroundedExtras: savedRuns.reduce((total, run) => total + run.postGroundingScore.counts.groundedExtra, 0),
    replayGroundedExtras: savedRuns.reduce((total, saved) => total + replayByKey.get(stageRunKey(saved))!.counts.groundedExtra, 0),
    currentUnsupported: savedRuns.reduce((total, run) => total + run.postGroundingScore.counts.unsupported, 0),
    replayUnsupported: savedRuns.reduce((total, saved) => total + replayByKey.get(stageRunKey(saved))!.counts.unsupported, 0),
    rejectedGoldSupportingCandidates: selectedRows.filter((row) => !row.originalAccepted && row.associatedGoldFactIds.length > 0).length,
    restoredCandidates: selectedRows.filter((row) => row.restoresGoldFact).length,
    newlyAcceptedGroundedExtras: selectedRows.filter((row) => !row.originalAccepted && row.replayAccepted && row.grounded_extra).length,
    newlyAcceptedUnsupported: selectedRows.filter((row) => !row.originalAccepted && row.replayAccepted && row.unsupported).length,
  };
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function percentage(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function buildReplayArtifacts(plan: GroundingReplayPlan, savedRuns: SavedStageArtifactRun[], replayRuns: StageRun[], verdictRows: GroundingReplayVerdictRow[]) {
  const currentByKey = new Map(savedRuns.map((run) => [stageRunKey(run), run]));
  const overall = comparisonRow(savedRuns, replayRuns, verdictRows);
  const suites = ["atomic", "mixed", "dense"].map((suite) => {
    const selected = savedRuns.filter((saved) => replayRuns.find((run) => stageRunKey(run) === stageRunKey(saved))?.suite === suite);
    return { suite, ...comparisonRow(selected, replayRuns, verdictRows) };
  });
  const humanGateRuns = savedRuns.filter((saved) => saved.caseId.startsWith("human-gate-"));
  const humanGateCases = [...new Set(humanGateRuns.map((run) => run.caseId))].sort().map((caseId) => ({
    caseId,
    ...comparisonRow(humanGateRuns.filter((run) => run.caseId === caseId), replayRuns, verdictRows),
  }));
  const comparison = { overall, bySuite: suites, humanGateCases };
  const aggregate = {
    metadata: { plan, savedSemanticEvidenceReused: true, extractionCalls: 0, coverageCalls: 0, judgeCalls: 0 },
    comparison,
    replayAggregate: aggregateScores(replayRuns),
  };
  const caseScores = replayRuns.map((run) => {
    const current = currentByKey.get(stageRunKey(run))!;
    return JSON.stringify({
      caseId: run.caseId, profile: run.profile, pipeline: run.pipeline, repetition: run.repetition, suite: run.suite,
      preGroundingScore: current.preGroundingScore,
      currentPostGroundingScore: current.postGroundingScore,
      replayPostGroundingScore: { matches: run.matches, candidateClassifications: run.candidateClassifications, counts: run.counts, metrics: run.metrics },
      replayStageMetrics: run.stageMetrics,
    });
  }).join("\n") + (replayRuns.length ? "\n" : "");
  const verdicts = verdictRows.map((row) => JSON.stringify(row)).join("\n") + (verdictRows.length ? "\n" : "");
  const headers = ["scope", "value", ...Object.keys(overall)];
  const dimensionRows = [
    ...suites.map((row) => ({ scope: "suite", value: row.suite, ...row })),
    ...humanGateCases.map((row) => ({ scope: "human_gate", value: row.caseId, ...row })),
  ];
  const dimensionCsv = [headers.join(","), ...dimensionRows.map((row) => headers.map((header) => csvCell((row as Record<string, unknown>)[header])).join(","))].join("\n") + "\n";
  const summary = [
    "# F1 grounding replay — evidence-scope-v2", "",
    `Source SHA-256: \`${plan.sourceStageRunsSha256}\``,
    `Profile: ${plan.profile}; grounding model: ${plan.model}/${plan.reasoning}; calls: ${plan.totalGroundingCalls}.`,
    "Extraction calls: 0; coverage calls: 0; semantic-judge calls: 0. Saved staged semantic evidence was reused.", "",
    "| Scope | PRE recall | Current POST recall | Replay POST recall | Current losses | Replay losses | Current precision | Replay precision | New grounded extras | New unsupported |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    `| Overall | ${percentage(overall.preSemanticRecall)} | ${percentage(overall.currentPostSemanticRecall)} | ${percentage(overall.replayPostSemanticRecall)} | ${overall.currentGroundingLosses} | ${overall.replayGroundingLosses} | ${percentage(overall.currentSemanticPrecision)} | ${percentage(overall.replaySemanticPrecision)} | ${overall.newlyAcceptedGroundedExtras} | ${overall.newlyAcceptedUnsupported} |`,
    ...suites.map((row) => `| ${row.suite} | ${percentage(row.preSemanticRecall)} | ${percentage(row.currentPostSemanticRecall)} | ${percentage(row.replayPostSemanticRecall)} | ${row.currentGroundingLosses} | ${row.replayGroundingLosses} | ${percentage(row.currentSemanticPrecision)} | ${percentage(row.replaySemanticPrecision)} | ${row.newlyAcceptedGroundedExtras} | ${row.newlyAcceptedUnsupported} |`),
    "", "## Human Gate cases", "",
    ...(humanGateCases.length ? humanGateCases.map((row) => `- ${row.caseId}: current losses ${row.currentGroundingLosses}; replay losses ${row.replayGroundingLosses}; restored candidates ${row.restoredCandidates}; newly accepted unsupported ${row.newlyAcceptedUnsupported}.`) : ["- none in selected source runs"]),
    "",
  ].join("\n");
  return { aggregate, caseScores, verdicts, dimensionCsv, summary };
}

export async function executeGroundingReplay(
  argv = process.argv.slice(2),
  cwd = process.cwd(),
  environment: NodeJS.ProcessEnv = process.env,
  dependencies: { provider?: EvalProvider; now?: () => string } = {},
) {
  const options = parseGroundingReplayArgs(argv, cwd);
  const source = await loadSavedStageRuns(options.source);
  const savedRuns = source.runs.filter((run) => run.profile === options.profile);
  if (!savedRuns.length) throw new Error(`No saved staged runs found for profile ${options.profile}.`);
  const corpus = await loadCorpus(options.corpusPath);
  const corpusById = new Map(corpus.cases.map((item) => [item.id, item]));
  for (const saved of savedRuns) if (!corpusById.has(saved.caseId)) throw new Error(`Saved staged run references unknown corpus case ${saved.caseId}.`);
  for (const saved of savedRuns) validateReplaySourceRun(corpusById.get(saved.caseId)!, saved);
  const totalGroundingCalls = savedRuns.reduce((total, run) => total + run.stageTurns.filter((turn) => turn.groundingSubmittedCandidates.length > 0).length, 0);
  if (totalGroundingCalls > options.maxCalls) throw new Error(`Estimated grounding replay calls ${totalGroundingCalls} exceed --max-calls ${options.maxCalls}.`);
  const profile = MODEL_PROFILES.baseline;
  if (profile.groundingModel !== "gpt-5.6-luna" || profile.groundingReasoning !== "low") throw new Error("Baseline grounding replay requires gpt-5.6-luna with low reasoning.");
  const outputDirectory = resolve(options.outputDir, options.runId);
  await assertFreshOutput(source.sourceDirectory, outputDirectory);
  const apiKey = environment.OPENAI_API_KEY;
  if (!dependencies.provider && !apiKey) throw new Error("OPENAI_API_KEY is unavailable. Grounding replay requires an approved local environment; no provider call was made.");
  const corpusContents = await readFile(options.corpusPath, "utf8");
  const now = dependencies.now ?? (() => new Date().toISOString());
  const plan: GroundingReplayPlan = {
    version: 1,
    runId: options.runId,
    createdAt: now(),
    variant: options.variant,
    profile: "baseline",
    model: "gpt-5.6-luna",
    reasoning: "low",
    sourceStageRunsPath: source.stageRunsPath,
    sourceStageRunsSha256: source.sourceSha256,
    corpusPath: options.corpusPath,
    corpusSha256: sha256(corpusContents),
    sourceRunKeys: savedRuns.map(stageRunKey),
    totalRuns: savedRuns.length,
    totalGroundingCalls,
    extractionCalls: 0,
    coverageCalls: 0,
    judgeCalls: 0,
  };
  await mkdir(options.outputDir, { recursive: true });
  await mkdir(outputDirectory);
  const state: ReplayState = { version: 1, status: "running", completedRuns: 0, totalRuns: savedRuns.length, updatedAt: now(), lastError: null };
  await Promise.all([atomicWriteJson(join(outputDirectory, "replay-plan.json"), plan), atomicWriteJson(join(outputDirectory, "run-state.json"), state)]);
  const provider = dependencies.provider ?? createOpenAIProvider(apiKey!, options.runId);
  const replayRuns: StageRun[] = [];
  const verdictRows: GroundingReplayVerdictRow[] = [];
  try {
    for (const saved of savedRuns) {
      const item = corpusById.get(saved.caseId)!;
      const replayed = await replayOneRun(item, saved, provider);
      replayRuns.push(replayed.run);
      verdictRows.push(...replayed.rows);
      state.completedRuns = replayRuns.length;
      state.updatedAt = now();
      await atomicWriteJson(join(outputDirectory, "run-state.json"), state);
    }
    if (await sha256File(source.stageRunsPath) !== plan.sourceStageRunsSha256) throw new Error("Grounding replay source stage-runs.jsonl changed during execution.");
    if (await sha256File(options.corpusPath) !== plan.corpusSha256) throw new Error("Grounding replay corpus changed during execution.");
    const artifacts = buildReplayArtifacts(plan, savedRuns, replayRuns, verdictRows);
    await Promise.all([
      atomicWrite(join(outputDirectory, "grounding-replay-verdicts.jsonl"), artifacts.verdicts),
      atomicWrite(join(outputDirectory, "case-scores.jsonl"), artifacts.caseScores),
      atomicWriteJson(join(outputDirectory, "aggregate.json"), artifacts.aggregate),
      atomicWrite(join(outputDirectory, "dimension-breakdown.csv"), artifacts.dimensionCsv),
      atomicWrite(join(outputDirectory, "summary.md"), artifacts.summary),
    ]);
    state.status = "completed";
    state.updatedAt = now();
    await atomicWriteJson(join(outputDirectory, "run-state.json"), state);
    return { kind: "grounding-replay" as const, directory: outputDirectory, runs: replayRuns.length, groundingCalls: totalGroundingCalls, plan };
  } catch (error) {
    state.status = "failed";
    state.updatedAt = now();
    state.lastError = error instanceof Error ? error.message : "Grounding replay failed.";
    await atomicWriteJson(join(outputDirectory, "run-state.json"), state);
    throw error;
  }
}
