import { createReport, type ReportOptions } from "../../telemetry/reports/engine.ts";
import { reportCsv, type View } from "../../telemetry/reports/csv.ts";
import { openTarget, deletionPlan, applyDeletion, safeCliError, writeExport, type Target } from "../../telemetry/reports/local.ts";
import { pathToFileURL } from "node:url";

export function argumentsOf(args: string[]) {
  const values: Record<string, string> = {};
  const allowed = new Set(["database", "cohort", "test-class", "mode", "from", "to", "as-of", "retained-since", "view", "operator", "linkage", "out", "apply", "confirm", "ledger", "participant"]);
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.slice(2), value = args[i + 1];
    if (!args[i]?.startsWith("--") || !allowed.has(key) || Object.hasOwn(values, key) || !value || value.startsWith("--")) throw Error("invalid_arguments"); values[key] = value;
  }
  return values;
}
function required(a: Record<string, string>, key: string) { if (!a[key]) throw Error("missing_argument"); return a[key]; }
function timestamp(value: string) { if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) throw Error("invalid_timestamp"); return Date.parse(value); }
function main() {
  const [command, ...args] = process.argv.slice(2), a = argumentsOf(args);
  if (!["export", "retention", "delete-participant"].includes(command)) throw Error("invalid_command");
  for (const key of ["operator", "apply"]) if (a[key] && a[key] !== "yes") throw Error("invalid_arguments");
  if (a.linkage && !["approved", "unavailable"].includes(a.linkage)) throw Error("invalid_arguments");
  const target: Target = { database: required(a, "database"), cohort: required(a, "cohort"), testClass: (a["test-class"] ?? "tester") as Target["testClass"], mode: required(a, "mode") as Target["mode"] };
  const asOf = timestamp(required(a, "as-of")), apply = a.apply === "yes";
  if (command === "export" && apply) throw Error("invalid_arguments");
  const db = openTarget(target, apply);
  try {
    if (command === "export") {
      const options: ReportOptions = { cohort: target.cohort, from: required(a, "from"), to: required(a, "to"), asOf,
        retainedSince: timestamp(required(a, "retained-since")), testClass: target.testClass, linkage: a.linkage === "approved" };
      const createdAt = Date.now(), csv = reportCsv(createReport(db, options), { view: (a.view ?? "summary") as View, operator: a.operator === "yes", createdAt });
      writeExport(required(a, "out"), csv, createdAt); process.stdout.write("export_written_local\n");
    } else {
      const request = command === "retention" ? { action: "retention" as const, asOf } : { action: "participant" as const, asOf, participant: required(a, "participant") };
      const result = apply ? applyDeletion(db, target, request, required(a, "confirm"), required(a, "ledger")) : deletionPlan(db, target, request);
      process.stdout.write(JSON.stringify({ mode: apply ? "applied_local_synthetic" : "dry_run", confirmation: result.confirmation, counts: result.counts }) + "\n");
    }
  } finally { db.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { try { main(); } catch (error) { process.stderr.write(safeCliError(error) + "\n"); process.exitCode = 1; } }
