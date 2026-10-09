#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadCorpus } from "./lib/eval-contract.ts";
import { buildGoldV2Proposal, writeGoldV2Proposal } from "./lib/gold-v2-proposal.ts";

export async function executeGoldV2Proposal(
  corpusPath = resolve("evals/f1-extraction/fixtures/corpus.json"),
  outputDirectory = resolve("evals/f1-extraction/results/gold-v2-proposal"),
) {
  const proposal = buildGoldV2Proposal(await loadCorpus(corpusPath));
  await writeGoldV2Proposal(outputDirectory, proposal);
  return proposal;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  executeGoldV2Proposal(process.argv[2] ? resolve(process.argv[2]) : undefined, process.argv[3] ? resolve(process.argv[3]) : undefined).then((proposal) => {
    console.log(JSON.stringify({ kind: proposal.kind, status: proposal.status, summary: proposal.summary, outputDirectory: resolve(process.argv[3] ?? "evals/f1-extraction/results/gold-v2-proposal") }, null, 2));
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : "F1 Gold Contract v2 proposal failed.");
    process.exitCode = 1;
  });
}
