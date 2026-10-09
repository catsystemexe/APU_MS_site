#!/usr/bin/env node
import { resolve, win32 } from "node:path";
import { pathToFileURL } from "node:url";
import { executeGroundingReplay } from "./lib/grounding-replay.ts";

export const HELP = `F1 grounding replay (eval only)

Usage:
  npm run eval:f1-grounding-replay -- --source <judged-result-directory> --profile baseline --variant evidence-scope-v2 --run-id <id> --output-dir <path> --max-calls <n> [--corpus <path>]

The command reads saved stage-runs.jsonl PRE candidates and saved semantic evidence. It makes grounding calls only (gpt-5.6-luna/low), never extraction, coverage, or semantic-judge calls, and refuses to overwrite its source or an existing output directory.`;

export function isCliEntrypoint(moduleUrl: string, entryPath: string | undefined, windows = process.platform === "win32") {
  if (typeof entryPath !== "string") return false;
  const absoluteEntryPath = windows ? win32.resolve(entryPath) : resolve(entryPath);
  return moduleUrl === pathToFileURL(absoluteEntryPath, { windows }).href;
}

if (isCliEntrypoint(import.meta.url, process.argv[1])) {
  if (process.argv.includes("--help") || process.argv.includes("-h")) console.log(HELP);
  else executeGroundingReplay().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => {
    console.error(error instanceof Error ? error.message : "F1 grounding replay failed.");
    process.exitCode = 1;
  });
}
