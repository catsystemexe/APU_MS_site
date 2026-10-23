import { expiryPlan, pruneExports } from "../../telemetry/reports/export-expiry.ts";
import { safeCliError } from "../../telemetry/reports/local.ts";
try {
  const args = process.argv.slice(2), a: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) { const key = args[i]?.slice(2); if (!args[i]?.startsWith("--") || !["directory", "as-of", "apply", "confirm"].includes(key) || !args[i + 1] || Object.hasOwn(a, key)) throw Error("invalid_arguments"); a[key] = args[i + 1]; }
  if (!a["as-of"] || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{3})?Z$/.test(a["as-of"]) || (a.apply && a.apply !== "yes")) throw Error("invalid_arguments");
  const asOf = Date.parse(a["as-of"]), plan = expiryPlan(a.directory, asOf);
  const result = a.apply === "yes" ? pruneExports(a.directory, asOf, a.confirm) : { files: plan.files, confirmation: plan.confirmation };
  process.stdout.write(JSON.stringify(result) + "\n");
} catch (error) { process.stderr.write(safeCliError(error) + "\n"); process.exitCode = 1; }
