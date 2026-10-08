import { access, mkdir, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { SupportedModelId } from "../../../app/model-config.ts";
import { atomicWriteJson, runKey, type RunState } from "./checkpoint.ts";
import type { StageRun } from "./stage-analysis.ts";

export const RESCORE_PLAN_VERSION = 1;
export const SCORING_CONTRACT_VERSION = 3;

export type RescorePlan = {
  version: typeof RESCORE_PLAN_VERSION;
  scoringContractVersion: typeof SCORING_CONTRACT_VERSION;
  runId: string;
  createdAt: string;
  sourceRawRunsPath: string;
  sourceSha256: string;
  sourceRunKeys: string[];
  corpusPath: string;
  corpusSha256: string;
  judgeModel: SupportedModelId;
  totalRuns: number;
};

function checkpointFilename(key: string) {
  return `${key.replace(/[^a-zA-Z0-9_-]+/g, "_")}.json`;
}

export async function initializeRescoreDirectory(directory: string, plan: RescorePlan) {
  try {
    await access(directory);
    throw new Error(`Rescore output already exists: ${directory}`);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  await mkdir(join(directory, "checkpoints"), { recursive: true });
  const state: RunState = { version: 1, status: "running", completedRunKeys: [], updatedAt: new Date().toISOString(), lastError: null };
  await Promise.all([
    atomicWriteJson(join(directory, "rescore-plan.json"), plan),
    atomicWriteJson(join(directory, "run-state.json"), state),
  ]);
  return state;
}

export async function saveRescoredRun(directory: string, run: StageRun, state: RunState) {
  const key = runKey(run);
  await atomicWriteJson(join(directory, "checkpoints", checkpointFilename(key)), { key, run });
  if (!state.completedRunKeys.includes(key)) state.completedRunKeys.push(key);
  state.status = "running";
  state.updatedAt = new Date().toISOString();
  state.lastError = null;
  await atomicWriteJson(join(directory, "run-state.json"), state);
}

export async function loadRescoreDirectory(directoryInput: string) {
  const directory = resolve(directoryInput);
  const plan = JSON.parse(await readFile(join(directory, "rescore-plan.json"), "utf8")) as RescorePlan;
  const state = JSON.parse(await readFile(join(directory, "run-state.json"), "utf8")) as RunState;
  if (plan.version !== RESCORE_PLAN_VERSION || state.version !== 1) throw new Error("Rescore resume directory uses an unsupported checkpoint version.");
  if (plan.scoringContractVersion !== SCORING_CONTRACT_VERSION) throw new Error("Rescore resume rejected: scoring contract version is incompatible.");
  if (plan.totalRuns !== plan.sourceRunKeys.length || new Set(plan.sourceRunKeys).size !== plan.sourceRunKeys.length) throw new Error("Rescore resume plan has invalid source run keys.");
  const files = await readdir(join(directory, "checkpoints"));
  const checkpoints = await Promise.all(files.filter((file) => file.endsWith(".json")).map(async (file) => JSON.parse(await readFile(join(directory, "checkpoints", file), "utf8")) as { key: string; run: StageRun }));
  const expected = new Set(plan.sourceRunKeys);
  const byKey = new Map<string, StageRun>();
  for (const checkpoint of checkpoints) {
    if (!expected.has(checkpoint.key)) throw new Error(`Rescore resume contains an incompatible checkpoint: ${checkpoint.key}`);
    if (byKey.has(checkpoint.key)) throw new Error(`Rescore resume contains a duplicate checkpoint: ${checkpoint.key}`);
    byKey.set(checkpoint.key, checkpoint.run);
  }
  if (state.completedRunKeys.some((key) => !byKey.has(key))) throw new Error("Rescore resume state references a missing checkpoint.");
  return { directory, plan, state, runs: plan.sourceRunKeys.flatMap((key) => byKey.has(key) ? [byKey.get(key)!] : []) };
}

export function assertResumeRescoreArguments(argv: string[]) {
  const flagsWithValues = new Set(["--resume-rescore", "--max-calls"]);
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    if (!flagsWithValues.has(flag)) throw new Error(`--resume-rescore cannot be combined with ${flag}`);
  }
}
