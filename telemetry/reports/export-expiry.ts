import { readdirSync, lstatSync, realpathSync, readFileSync, unlinkSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { digest } from "./csv.ts";
export function expiryPlan(directory: string, asOf: number) {
  if (!isAbsolute(directory) || realpathSync(directory) !== directory || !lstatSync(directory).isDirectory() || !Number.isSafeInteger(asOf) || asOf < 0) throw Error("invalid_export_directory");
  const files = readdirSync(directory).filter(f => /^telemetry-[A-Za-z0-9_-]+\.csv\.expiry\.json$/.test(f)).sort();
  if (files.length > 10000) throw Error("export_limit_exceeded");
  const expired: { name: string; sha256: string }[] = [];
  for (const name of files) {
    const sidecar = join(directory, name), csv = sidecar.slice(0, -".expiry.json".length);
    if (!lstatSync(sidecar).isFile() || !lstatSync(csv).isFile() || lstatSync(sidecar).isSymbolicLink() || lstatSync(csv).isSymbolicLink()) throw Error("invalid_export_target");
    const m = JSON.parse(readFileSync(sidecar, "utf8"));
    if (m.version !== 1 || !Number.isSafeInteger(m.created_at) || m.expires_at !== m.created_at + 7 * 86400000 || !/^[a-f0-9]{64}$/.test(m.sha256) || digest(readFileSync(csv, "utf8")) !== m.sha256) throw Error("invalid_export_manifest");
    if (m.expires_at <= asOf) expired.push({ name: name.slice(0, -".expiry.json".length), sha256: m.sha256 });
  }
  return { confirmation: digest(JSON.stringify({ directory, asOf, expired })), files: expired.length, expired };
}
export function pruneExports(directory: string, asOf: number, confirmation: string) {
  const plan = expiryPlan(directory, asOf); if (plan.confirmation !== confirmation) throw Error("export_plan_changed");
  for (const f of plan.expired) { unlinkSync(join(directory, f.name)); unlinkSync(join(directory, f.name + ".expiry.json")); }
  return { files: plan.files };
}
