import { createHash } from "node:crypto";
import type { Cell, PilotReport, Row } from "./engine.ts";
export type View = keyof PilotReport["rows"];
export function csvCell(value: Cell): string {
  if (value === null) return "";
  let text = String(value);
  // Whitespace/control prefixes must not hide a spreadsheet formula. Quote alone is insufficient.
  if (/^[\s\u0000-\u001f]*[=+@-]/u.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function reportCsv(report: PilotReport, { view = "summary", operator = false, createdAt = Date.now() }: { view?: View; operator?: boolean; createdAt?: number } = {}) {
  if (!Object.hasOwn(report.rows, view) || (!operator && view !== "summary")) throw Error("operator_export_required");
  if (view === "participants" && report.metadata.participant_linkage !== "approved") throw Error("participant_linkage_unavailable");
  const suppressed = !operator && report.smallCell;
  if (!Number.isSafeInteger(createdAt) || createdAt < 0) throw Error("invalid_export_time");
  const meta: Row = { ...report.metadata, exported_at: new Date(createdAt).toISOString(), expires_at: new Date(createdAt + 7 * 86400000).toISOString(), export_audience: operator ? "restricted_operator" : "shared_aggregate", report_view: view,
    export_status: suppressed ? "suppressed_small_or_complementary_cells" : "observed", null_encoding: "empty_cell" };
  // Coverage is co-exported on every report, with the same suppression as metric values.
  const coverage = Object.fromEntries(Object.entries(report.rows.quality[0]).map(([k, v]) => [`coverage_${k}`, suppressed ? null : v]));
  const data = report.rows[view], rows: Row[] = (data.length ? data : [{}]).map(row => ({ ...meta, ...coverage,
    ...Object.fromEntries(Object.entries(row)
      .filter(([k]) => report.metadata.participant_linkage === "approved" || !["participant_id", "key_version"].includes(k))
      .map(([k, v]) => [k, suppressed ? null : v])) }));
  const columns = [...new Set(rows.flatMap(r => Object.keys(r)))];
  return columns.map(csvCell).join(",") + "\r\n" + rows.map(r => columns.map(k => csvCell(r[k] ?? null)).join(",")).join("\r\n") + "\r\n";
}
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
