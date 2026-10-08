import { access, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ModelProfile, PipelineId } from "./eval-contract.ts";
import type { StageRun } from "./stage-analysis.ts";

export const RUN_PLAN_VERSION = 1;

export type RunPlan = {
  version: typeof RUN_PLAN_VERSION;
  runId: string;
  createdAt: string;
  corpusPath: string;
  corpusSha256: string;
  caseIds: string[];
  profiles: string[];
  resolvedProfiles: ModelProfile[];
  pipelines: PipelineId[];
  repetitions: number;
  judgeModel: string | null;
  totalRuns: number;
  displayPlan: Record<string, unknown>;
};

export type RunState = {
  version: 1;
  status: "running" | "failed" | "completed";
  completedRunKeys: string[];
  updatedAt: string;
  lastError: string | null;
};

export function runKey(identity: { caseId: string; profile: string; pipeline: string; repetition: number }) {
  return `${identity.caseId}::${identity.profile}::${identity.pipeline}::${identity.repetition}`;
}

export async function atomicWriteJson(path: string, value: unknown) {
  const temporary = `${path}.tmp-${process.pid}-${crypto.randomUUID()}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, path);
}

export async function initializeRunDirectory(directory: string, plan: RunPlan) {
  try {
    await access(directory);
    throw new Error(`Result directory already exists: ${directory}`);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  await mkdir(join(directory, "checkpoints"), { recursive: true });
  const state: RunState = { version: 1, status: "running", completedRunKeys: [], updatedAt: new Date().toISOString(), lastError: null };
  await Promise.all([
    atomicWriteJson(join(directory, "run-plan.json"), plan),
    atomicWriteJson(join(directory, "run-state.json"), state),
  ]);
  return state;
}

function checkpointFilename(key: string) {
  return `${key.replace(/[^a-zA-Z0-9_-]+/g, "_")}.json`;
}

export async function saveCompletedRun(directory: string, run: StageRun, state: RunState) {
  const key = runKey(run);
  await atomicWriteJson(join(directory, "checkpoints", checkpointFilename(key)), { key, run });
  if (!state.completedRunKeys.includes(key)) state.completedRunKeys.push(key);
  state.status = "running";
  state.updatedAt = new Date().toISOString();
  state.lastError = null;
  await atomicWriteJson(join(directory, "run-state.json"), state);
}

export async function saveRunState(directory: string, state: RunState, status: RunState["status"], lastError: string | null = null) {
  state.status = status;
  state.updatedAt = new Date().toISOString();
  state.lastError = lastError;
  await atomicWriteJson(join(directory, "run-state.json"), state);
}

export async function loadRunDirectory(directoryInput: string) {
  const directory = resolve(directoryInput);
  const plan = JSON.parse(await readFile(join(directory, "run-plan.json"), "utf8")) as RunPlan;
  const state = JSON.parse(await readFile(join(directory, "run-state.json"), "utf8")) as RunState;
  if (plan.version !== RUN_PLAN_VERSION || state.version !== 1) throw new Error("Resume directory uses an unsupported checkpoint version.");
  const files = await readdir(join(directory, "checkpoints"));
  const checkpoints = await Promise.all(files.filter((file) => file.endsWith(".json")).map(async (file) => JSON.parse(await readFile(join(directory, "checkpoints", file), "utf8")) as { key: string; run: StageRun }));
  const byKey = new Map<string, StageRun>();
  for (const checkpoint of checkpoints) {
    if (byKey.has(checkpoint.key)) throw new Error(`Resume directory contains duplicate checkpoint key: ${checkpoint.key}`);
    byKey.set(checkpoint.key, checkpoint.run);
  }
  const expectedKeys = new Set(plan.caseIds.flatMap((caseId) => plan.profiles.flatMap((profile) => plan.pipelines.flatMap((pipeline) => Array.from({ length: plan.repetitions }, (_, index) => runKey({ caseId, profile, pipeline, repetition: index + 1 }))))));
  for (const key of byKey.keys()) if (!expectedKeys.has(key)) throw new Error(`Resume directory contains a checkpoint incompatible with its run plan: ${key}`);
  if (expectedKeys.size !== plan.totalRuns) throw new Error("Resume run plan has an inconsistent total run count.");
  if (state.completedRunKeys.some((key) => !byKey.has(key))) throw new Error("Resume state references a missing completed checkpoint.");
  return { directory, plan, state, runs: [...expectedKeys].flatMap((key) => byKey.has(key) ? [byKey.get(key)!] : []) };
}

export function assertResumeArguments(argv: string[]) {
  const allowed = new Set(["--resume"]);
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!allowed.has(flag)) throw new Error(`--resume cannot be combined with ${flag}`);
    index += 1;
  }
}

