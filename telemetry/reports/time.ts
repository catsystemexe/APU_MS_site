export const TIMEZONE = "Europe/Prague";
const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
export function civilDate(ms: number): string {
  const parts = formatter.formatToParts(ms), part = (name: string) => parts.find(p => p.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function nextDate(date: string): string { return new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10); }
/** First instant of a Prague civil date. Binary search avoids fixed-offset/DST assumptions. */
export function midnight(date: string): number {
  if (!validDate(date)) throw Error("invalid_date");
  const utc = Date.parse(date); let low = utc - 14 * 3600000, high = utc + 14 * 3600000;
  while (low < high) { const mid = Math.floor((low + high) / 2); if (civilDate(mid) < date) low = mid + 1; else high = mid; }
  return low;
}
export function isoWeek(date: string): string {
  const d = new Date(date), weekday = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - weekday);
  const year = d.getUTCFullYear(), week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}
export type Interval = [number, number];
export function union(intervals: Interval[]): number {
  const sorted = intervals.filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let total = 0, start = 0, end = 0;
  for (const [a, b] of sorted) { if (a > end) { total += end - start; start = a; end = b; } else end = Math.max(end, b); }
  return total + end - start;
}
export function splitDays(start: number, end: number): { date: string; interval: Interval }[] {
  const parts: { date: string; interval: Interval }[] = [];
  while (start < end) { const date = civilDate(start), boundary = midnight(nextDate(date)), stop = Math.min(end, boundary); parts.push({ date, interval: [start, stop] }); start = stop; }
  return parts;
}
