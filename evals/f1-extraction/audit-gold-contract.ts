#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { auditGoldCorpus } from "./lib/gold-contract-audit.ts";
import { loadCorpus } from "./lib/eval-contract.ts";

export async function executeGoldContractAudit(corpusPath = resolve("evals/f1-extraction/fixtures/corpus.json")) {
  return auditGoldCorpus(await loadCorpus(corpusPath));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  executeGoldContractAudit(process.argv[2] ? resolve(process.argv[2]) : undefined).then((report) => {
    console.log(JSON.stringify(report, null, 2));
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : "F1 gold-contract audit failed.");
    process.exitCode = 1;
  });
}
